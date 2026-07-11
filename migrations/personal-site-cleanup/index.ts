import { at, defineMigration, del, patch, unset } from "sanity/migrate";

const LEGACY_TYPES = new Set([
    "intro",
    "about",
    "experience",
    "certification",
    "skillCategory",
    "homePage",
]);

export default defineMigration({
    title: "Remove legacy personal-site documents and post fields",
    documentTypes: [...LEGACY_TYPES, "post"],
    migrate: {
        document(document) {
            if (LEGACY_TYPES.has(document._type)) {
                return del(document._id);
            }

            if (document._type === "post") {
                return patch(document._id, [
                    at("date", unset()),
                    at("featured", unset()),
                    at("image", unset()),
                ]);
            }

            return undefined;
        },
    },
});
