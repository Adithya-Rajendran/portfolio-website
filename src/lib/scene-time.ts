/** The phase of the visitor's day, determined by their local clock. */
export type ScenePhase = "dawn" | "day" | "dusk" | "night";

export function getScenePhase(date: Date = new Date()): ScenePhase {
    const hour = date.getHours();
    if (hour >= 6 && hour < 9) return "dawn";
    if (hour >= 9 && hour < 17) return "day";
    if (hour >= 17 && hour < 20) return "dusk";
    return "night";
}
