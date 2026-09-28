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
