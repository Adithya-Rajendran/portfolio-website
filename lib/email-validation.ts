import dns from "dns/promises";
import { domainToASCII } from "node:url";

/**
 * The contact form's server-side address checks, after the shape the form
 * and the server share (`EMAIL_PATTERN` in lib/contact.ts): the domain in
 * the ASCII form DNS and mail servers take, then whether it can receive
 * mail.
 */

// RFC 1035 caps a domain name at 253 characters. Validate length and a
// conservative character set before issuing a DNS query so the resolver
// isn't a free oracle for arbitrary attacker-supplied strings.
export const DOMAIN_PATTERN =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * The whole mail check's time limit. The domain is the sender's to choose,
 * so a slow nameserver must not hold the function: past this the check
 * gives up and lets the message through.
 */
export const MAIL_CHECK_TIMEOUT_MS = 3000;

/**
 * The address with its domain in ASCII ("user@bücher.de" →
 * "user@xn--bcher-kva.de"), or null when the domain has no valid ASCII
 * form.
 */
export function asciiAddress(email: string): string | null {
    const at = email.lastIndexOf("@");
    const domain = domainToASCII(email.slice(at + 1));
    if (at < 1 || !domain || domain.length > 253) return null;
    if (!DOMAIN_PATTERN.test(domain)) return null;
    return `${email.slice(0, at)}@${domain}`;
}

/** A lookup DNS could not answer: it proves nothing about the address. */
type Unknown = { unknown: string };
type Answer = boolean | Unknown;

/**
 * The records of one kind: none for ENODATA (the name exists without
 * them), false for ENOTFOUND (no such domain), else the error's code.
 */
async function lookUp<T>(
    query: () => Promise<T[]>,
): Promise<T[] | false | Unknown> {
    try {
        return await query();
    } catch (error: unknown) {
        const code = (error as { code?: unknown } | null)?.code;
        if (code === "ENODATA") return [];
        if (code === "ENOTFOUND") return false;
        return { unknown: typeof code === "string" ? code : "EUNKNOWN" };
    }
}

async function mailAnswer(
    resolver: InstanceType<typeof dns.Resolver>,
    domain: string,
): Promise<Answer> {
    const mx = await lookUp(() => resolver.resolveMx(domain));
    if (!Array.isArray(mx)) return mx;
    // A null MX ("MX 0 .", RFC 7505) says the domain takes no mail.
    if (mx.length > 0) {
        return mx.some(({ exchange }) => exchange !== "" && exchange !== ".");
    }
    // No MX: mail goes to the domain's own address (RFC 5321 §5.1).
    for (const query of [
        () => resolver.resolve4(domain),
        () => resolver.resolve6(domain),
    ]) {
        const found = await lookUp<string>(query);
        if (!Array.isArray(found)) return found;
        if (found.length > 0) return true;
    }
    return false;
}

/**
 * Whether the address's domain may receive mail: false only when DNS
 * answers that it does not (no such domain, or neither an MX record nor
 * an address to fall back to, or a null MX). A lookup that cannot finish
 * (a timeout, SERVFAIL, a refused connection, or the time limit above)
 * proves nothing about the sender, so the message goes and the failure is
 * logged. Expects the ASCII address (`asciiAddress`).
 */
export async function mayReceiveMail(email: string): Promise<boolean> {
    const domain = email.split("@")[1];
    if (!domain || domain.length > 253 || !DOMAIN_PATTERN.test(domain)) {
        return false;
    }

    const resolver = new dns.Resolver({
        timeout: MAIL_CHECK_TIMEOUT_MS,
        tries: 1,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<Answer>((resolve) => {
        timer = setTimeout(() => {
            resolver.cancel();
            resolve({ unknown: "ETIMEOUT" });
        }, MAIL_CHECK_TIMEOUT_MS);
    });
    try {
        const answer = await Promise.race([
            mailAnswer(resolver, domain),
            deadline,
        ]);
        if (typeof answer === "boolean") return answer;
        console.warn(
            `[email-validation] Could not check the sender's domain for mail (${answer.unknown}); sending anyway.`,
        );
        return true;
    } finally {
        clearTimeout(timer);
    }
}
