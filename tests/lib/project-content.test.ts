import { describe, expect, it } from "vitest";
import { formatProjectYears, projectStatusLabel } from "@/lib/project-content";
import {
    checkModelPart,
    MODEL_PART_OPTIONS,
    PROCEDURAL_MODEL_OPTIONS,
} from "@/lib/viewer/registry";

describe("projectStatusLabel", () => {
    it("prints the Studio label for every status", () => {
        expect(projectStatusLabel("active")).toBe("Active");
        expect(projectStatusLabel("completed")).toBe("Complete");
        expect(projectStatusLabel("planned")).toBe("Planned");
        expect(projectStatusLabel("stopped")).toBe("Stopped");
    });
});

describe("formatProjectYears", () => {
    it("prints a single year or a range of years", () => {
        expect(
            formatProjectYears({
                startDate: "2023-01-01",
                endDate: "2023-06-01",
            }),
        ).toBe("2023");
        expect(
            formatProjectYears({
                startDate: "2024-01-01",
                endDate: "2025-01-01",
            }),
        ).toBe("2024–2025");
        expect(formatProjectYears({ startDate: "2024-05-01" })).toBe("2024");
        expect(formatProjectYears({ endDate: "2025-01-01" })).toBe("2025");
        expect(formatProjectYears({})).toBeNull();
    });

    it("marks the owner's estimates with c.", () => {
        expect(
            formatProjectYears({
                startDate: "2023-01-01",
                endDate: "2023-12-31",
                datesApproximate: true,
            }),
        ).toBe("c. 2023");
        expect(
            formatProjectYears({
                startDate: "2024-01-01",
                endDate: "2025-01-01",
                datesApproximate: true,
            }),
        ).toBe("c. 2024–2025");
        expect(formatProjectYears({ datesApproximate: true })).toBeNull();
    });
});

describe("viewer registry", () => {
    it("offers the homelab rack and its five callout parts", () => {
        expect(PROCEDURAL_MODEL_OPTIONS.map(({ value }) => value)).toEqual([
            "homelab-rack",
        ]);
        expect(MODEL_PART_OPTIONS.map(({ value }) => value)).toEqual([
            "tier0",
            "network",
            "ms01",
            "ascent",
            "power",
        ]);
    });

    it("accepts only parts of the chosen model", () => {
        expect(checkModelPart("homelab-rack", "ascent")).toBe(true);
        expect(checkModelPart("homelab-rack", "gripper")).toEqual(
            expect.stringContaining("tier0, network, ms01, ascent, power"),
        );
        // Nothing to check until both are set; an unknown model is left
        // to the model field's own list.
        expect(checkModelPart(undefined, "ascent")).toBe(true);
        expect(checkModelPart("homelab-rack", undefined)).toBe(true);
        expect(checkModelPart("robot-arm", "gripper")).toBe(true);
    });
});
