/**
 * Stat values (contract §11, "vehicle-page stats"): a number and its unit
 * are set apart, the unit smaller and quieter. Only a value written as a
 * number, a space and a short unit is split ("195.1 W", "12 TB",
 * "0.4 ms"); anything else ("3 × MS-01", "90%", "Okta OIDC") is shown as
 * written.
 */
export function splitUnit(value: string): { amount: string; unit: string } {
    const match = /^([−-]?\d[\d.,]*)\s+([A-Za-zµ°%/]{1,5})$/.exec(value.trim());
    return match
        ? { amount: match[1], unit: match[2] }
        : { amount: value.trim(), unit: "" };
}

const NUMBER_WORD =
    /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;

/**
 * Whether a value reads as a quantity, and so can be set as a stat: it
 * starts with a number ("195.1 W", "3 × MS-01", "90%", "0.4 ms") or a
 * number word ("Zero"). A name ("Okta OIDC", "CIS Level 1",
 * "Next.js + React") is not a stat, however short.
 */
export function isQuantity(value: string): boolean {
    const text = value.trim();
    return /^[−-]?\.?\d/.test(text) || NUMBER_WORD.test(text);
}
