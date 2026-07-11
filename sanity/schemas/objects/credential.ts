import { defineField, defineType } from "sanity";

const DAY_MS = 24 * 60 * 60 * 1000;

function lifecycleLabel(expiresOn?: string, lifetime?: boolean) {
    if (lifetime) return "Lifetime";
    if (!expiresOn) return "Expiry needed";

    const daysRemaining =
        (new Date(`${expiresOn}T23:59:59Z`).getTime() - Date.now()) / DAY_MS;

    if (daysRemaining < 0) return "Expired";
    if (daysRemaining <= 90) return "Renewal due";
    return "Active";
}

export default defineType({
    name: "credential",
    title: "Credential",
    type: "object",
    fields: [
        defineField({
            name: "title",
            title: "Credential Name",
            type: "string",
            validation: (Rule) => Rule.required().max(140),
        }),
        defineField({
            name: "issuer",
            title: "Issuer",
            type: "string",
            validation: (Rule) => Rule.required().max(100),
        }),
        defineField({
            name: "issuedOn",
            title: "Issued On",
            type: "date",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "lifetime",
            title: "Lifetime / No Expiry",
            type: "boolean",
            initialValue: false,
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "expiresOn",
            title: "Expires On",
            type: "date",
            hidden: ({ parent }) => Boolean(parent?.lifetime),
            validation: (Rule) => [
                Rule.min(Rule.valueOfField("issuedOn")),
                Rule.custom((value, context) => {
                    const parent = context.parent as
                        { lifetime?: boolean } | undefined;
                    if (parent?.lifetime && value) {
                        return "Remove the expiry date for a lifetime credential.";
                    }
                    if (!parent?.lifetime && !value) {
                        return "Add an expiry date or mark this as lifetime.";
                    }
                    return true;
                }),
            ],
        }),
        defineField({
            name: "credentialId",
            title: "Credential ID",
            type: "string",
            validation: (Rule) => Rule.max(160),
        }),
        defineField({
            name: "verificationUrl",
            title: "Verification URL",
            type: "url",
            validation: (Rule) =>
                Rule.required().uri({ scheme: ["http", "https"] }),
        }),
        defineField({
            name: "badge",
            title: "Badge Image",
            type: "image",
            options: { hotspot: true },
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                    validation: (Rule) => Rule.required(),
                }),
            ],
            validation: (Rule) => Rule.required(),
        }),
    ],
    preview: {
        select: {
            title: "title",
            issuer: "issuer",
            expiresOn: "expiresOn",
            lifetime: "lifetime",
            media: "badge",
        },
        prepare({ title, issuer, expiresOn, lifetime, media }) {
            return {
                title,
                subtitle: `${issuer} · ${lifecycleLabel(expiresOn, lifetime)}`,
                media,
            };
        },
    },
});
