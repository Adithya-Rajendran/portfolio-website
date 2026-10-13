/**
 * The contact form's fallback rate limit, used only while the Vercel WAF
 * rule `contact-form` is missing (`checkRateLimit` answers `not-found`).
 * The WAF rule is the real limit; this one is a stopgap, and honest about
 * it: the counts live in one function instance's memory, so on Vercel
 * each instance keeps its own and a cold start forgets them. It slows a
 * burst from one address and caps what one instance sends, no more.
 */

export interface FallbackLimits {
    /** The fixed window, in milliseconds. */
    windowMs: number;
    /** Sends one address may make in a window. */
    perAddress: number;
    /** Sends this instance makes in a window, from every address. */
    total: number;
}

/** About what the WAF rule allows one address: 5 in 10 minutes. */
export const CONTACT_FALLBACK_LIMITS: FallbackLimits = {
    windowMs: 10 * 60 * 1000,
    perAddress: 5,
    total: 30,
};

/** Sends counted since `start`. */
interface Tally {
    start: number;
    count: number;
}

/**
 * A per-address and per-instance fixed-window counter. The returned check
 * counts an allowed send and answers whether this one is over a limit;
 * a refused send counts against nothing.
 */
export function createFallbackLimiter(limits: FallbackLimits) {
    const byAddress = new Map<string, Tally>();
    let all: Tally = { start: 0, count: 0 };

    return function limited(address: string, now = Date.now()): boolean {
        const fresh = (tally: Tally | undefined): tally is Tally =>
            tally !== undefined && now - tally.start < limits.windowMs;
        if (!fresh(all)) all = { start: now, count: 0 };
        if (all.count >= limits.total) return true;
        // Only allowed sends add an entry, so the map stays small; the
        // expired ones go once it holds `total`.
        if (byAddress.size >= limits.total) {
            for (const [key, tally] of byAddress) {
                if (!fresh(tally)) byAddress.delete(key);
            }
        }
        const seen = byAddress.get(address);
        const tally = fresh(seen) ? seen : { start: now, count: 0 };
        if (tally.count >= limits.perAddress) return true;
        tally.count += 1;
        all.count += 1;
        byAddress.set(address, tally);
        return false;
    };
}

/**
 * The sender's address as Vercel reports it: `x-real-ip`, else the first
 * `x-forwarded-for` entry (Vercel sets both and overwrites a client's
 * own). Without either, every sender shares one count.
 */
export function senderAddress(headers: {
    get(name: string): string | null;
}): string {
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real;
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || "unknown";
}
