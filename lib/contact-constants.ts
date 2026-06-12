/**
 * Contact form limits shared by the client form (textarea maxLength)
 * and the server action's zod schema. Lives outside actions/ because
 * a "use server" module may only export async functions.
 */
export const MESSAGE_MAX_LENGTH = 1000;
