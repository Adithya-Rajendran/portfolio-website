import {
    createIfNotExists,
    defineMigration,
    transaction,
} from "sanity/migrate";
import { planSeed, type StoredDocument } from "./build";
import { SEED_PROJECTS } from "./data";

/**
 * Creates the four résumé projects as drafts (`drafts.project-<slug>`) from
 * the reviewed values in `data.ts`. Nothing is published: the owner reviews,
 * corrects and publishes each draft in the Studio. A project that already
 * exists (published, as a draft or in a release) or whose slug is taken is
 * skipped, so the migration is safe to run again. Posts are read only to
 * reuse the homelab post's rack photo and to link the rack callouts to its
 * headings.
 *
 * Run it yourself with an authenticated Sanity CLI: see migrations/README.md.
 */
export default defineMigration({
    title: "Seed the four résumé projects as drafts",
    documentTypes: ["project", "post"],
    async *migrate(documents) {
        const stored: StoredDocument[] = [];
        for await (const document of documents()) {
            stored.push(document as StoredDocument);
        }

        const plan = planSeed(stored, SEED_PROJECTS);
        for (const { slug, reason } of plan.skipped) {
            console.warn(`seed-resume-projects: skipped ${slug}: ${reason}.`);
        }
        for (const note of plan.notes) {
            console.warn(`seed-resume-projects: ${note}`);
        }
        if (!plan.drafts.length) return;

        // One transaction: either every missing draft is created or none is.
        // createIfNotExists also guards against a draft created meanwhile.
        yield transaction(plan.drafts.map((draft) => createIfNotExists(draft)));
    },
});
