export function asciiAddress(email: string): string | null {
    const at = email.lastIndexOf("@");
    if (at < 1) return null;
    try {
        const domain = new URL(`https://${email.slice(at + 1)}`).hostname;
        const address = `${email.slice(0, at)}@${domain}`;
        return domain.length <= 253 &&
            address.length <= 254 &&
            /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
                domain,
            )
            ? address
            : null;
    } catch {
        return null;
    }
}
type DNSResult = { Status: number; Answer?: { type: number; data: string }[] };
async function query(domain: string, type: string): Promise<DNSResult> {
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.searchParams.set("name", domain);
    url.searchParams.set("type", type);
    const response = await fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("DNS service unavailable");
    return response.json() as Promise<DNSResult>;
}
export async function mayReceiveMail(address: string): Promise<boolean> {
    const domain = address.slice(address.lastIndexOf("@") + 1);
    try {
        const mx = await query(domain, "MX");
        if (mx.Status === 3) return false;
        if (mx.Status !== 0) return true;
        const records = (mx.Answer || []).filter((a) => a.type === 15);
        if (records.length)
            return records.some((a) => !/^\s*0\s+\.?\s*$/.test(a.data));
        const addresses = await Promise.all([
            query(domain, "A"),
            query(domain, "AAAA"),
        ]);
        if (addresses.some((a) => a.Status !== 0 && a.Status !== 3))
            return true;
        return addresses.some((a) =>
            (a.Answer || []).some((r) => r.type === 1 || r.type === 28),
        );
    } catch {
        return true;
    }
}
