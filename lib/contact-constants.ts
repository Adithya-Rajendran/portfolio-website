/**
 * Contact form limits shared by the client form (textarea maxLength)
 * and the server action's zod schema. Lives outside actions/ because
 * a "use server" module may only export async functions.
 */
export const MESSAGE_MAX_LENGTH = 1000;

/**
 * The longest address, the email field's `maxLength` in the form: 254
 * characters, the most a mail path carries (RFC 5321, with its local part
 * at most 64: `EMAIL_PATTERN` in lib/contact.ts).
 */
export const EMAIL_MAX_LENGTH = 254;
