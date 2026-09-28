import { at, defineMigration, patch, set } from "sanity/migrate";
import { findLegacyLinks } from "./links";

/**
 * Rewrites legacy `link` annotations in post and project essays as the
 * `contentLink` annotation the Studio writes today. Published documents and
 * drafts are both patched; each patch carries the document's revision, so an
 * edit made while the migration runs is never overwritten. Documents with no
 * legacy link are left alone, so a second run changes nothing.
 *
 * Run it yourself with an authenticated Sanity CLI: see migrations/README.md.
 */
export default defineMigration({
    title: "Turn legacy link annotations into contentLink annotations",
    documentTypes: ["post", "project"],
    migrate: {
        document(document) {
            const fixes = findLegacyLinks(document);
            if (!fixes.length) return undefined;
            return patch(
                document._id,
                fixes.map(({ path, markDef }) => at(path, set(markDef))),
                { ifRevision: document._rev },
            );
        },
    },
});
