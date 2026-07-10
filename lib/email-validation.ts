import dns from "dns/promises";

/**
 * Shared email-address validation used by the contact form and the
 * newsletter signup so both actions enforce identical rules.
 */

/** Conservative allowlist applied on top of zod's email format check. */
export const EMAIL_CHARSET_PATTERN = /^[\w.+@-]+$/;

// RFC 1035 caps a domain name at 253 characters. Validate length and a
// conservative character set before issuing a DNS query so the resolver
// isn't a free oracle for arbitrary attacker-supplied strings.
export const DOMAIN_PATTERN =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export async function hasValidMxRecords(email: string): Promise<boolean> {
    const domain = email.split("@")[1];
    if (!domain || domain.length > 253 || !DOMAIN_PATTERN.test(domain)) {
        return false;
    }

    try {
        const records = await dns.resolveMx(domain);
        return records.length > 0;
    } catch {
        return false;
    }
}
