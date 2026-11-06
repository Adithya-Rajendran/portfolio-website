/**
 * Fixed world coordinates, well beyond the instrument and its inspection orbit.
 * A dolly changes the instrument's size, but barely changes a world's angular
 * size or position. Turning the camera can naturally move a world out of frame;
 * never reattach it to the camera to keep it in view.
 */
export const studyWorlds = {
    workshop: { position: [-300, -155, -1400], radius: 65 },
    observatory: { position: [-420, 245, -1600], radius: 45 },
    relay: { position: [-280, 220, -1500], radius: 75 },
} satisfies Record<
    string,
    { position: [number, number, number]; radius: number }
>;
