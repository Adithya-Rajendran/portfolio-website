const MONTHS: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
};

const OPEN_ENDED = new Set(["present", "current", "now"]);
const LIFETIME = new Set([
    "lifetime",
    "never",
    "no expiry",
    "no expiration",
    "does not expire",
]);

export function isOpenEnded(value: string) {
    return OPEN_ENDED.has(value.trim().toLowerCase());
}

export function isLifetime(value: string) {
    return LIFETIME.has(value.trim().toLowerCase());
}

export function parseLegacyDate(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;

    const normalized = value.trim().replace(/,/g, "");
    if (!normalized || isOpenEnded(normalized) || isLifetime(normalized)) {
        return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

    const datetime = normalized.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (datetime) return datetime[1];

    const yearMonth = normalized.match(/^(\d{4})-(\d{2})$/);
    if (yearMonth) return `${yearMonth[1]}-${yearMonth[2]}-01`;

    const numericMonth = normalized.match(/^(\d{1,2})\/(\d{4})$/);
    if (numericMonth) {
        return `${numericMonth[2]}-${numericMonth[1].padStart(2, "0")}-01`;
    }

    const monthYear = normalized.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (monthYear) {
        const month = MONTHS[monthYear[1].toLowerCase()];
        if (month) return `${monthYear[2]}-${month}-01`;
    }

    const monthDayYear = normalized.match(
        /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/,
    );
    if (monthDayYear) {
        const month = MONTHS[monthDayYear[1].toLowerCase()];
        if (month) {
            return `${monthDayYear[3]}-${month}-${monthDayYear[2].padStart(2, "0")}`;
        }
    }

    const year = normalized.match(/^(\d{4})$/);
    if (year) return `${year[1]}-01-01`;

    return undefined;
}

export function parseLegacyRange(value: unknown) {
    if (typeof value !== "string" || !value.trim()) return undefined;

    const parts = value.trim().split(/\s+(?:-|–|—|to)\s+/i);
    const startDate = parseLegacyDate(parts[0]);
    if (!startDate) return undefined;

    if (parts.length === 1) {
        return { startDate, endDate: undefined, openEnded: true };
    }

    const endText = parts.slice(1).join(" ").trim();
    if (isOpenEnded(endText)) {
        return { startDate, endDate: undefined, openEnded: true };
    }

    const endDate = parseLegacyDate(endText);
    if (!endDate) return undefined;

    return { startDate, endDate, openEnded: false };
}
