# Named content migrations

Each folder is one migration for the Sanity CLI: `sanity migration run <folder>`.
They change the dataset, so only the owner runs them, from an authenticated
Sanity CLI session. CI, previews and coding agents never do. The project id and
dataset come from `.env.local`; never commit them.

| Migration                    | What it does                                                                                                                                                                                                                                                           | Safe to run again                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `personal-site-profile`      | Earlier migration: builds the Profile from the legacy documents.                                                                                                                                                                                                       | Yes                                                                                                                                                         |
| `personal-site-cleanup`      | Earlier migration: deletes the legacy documents and post fields.                                                                                                                                                                                                       | Yes                                                                                                                                                         |
| `normalize-link-annotations` | Rewrites legacy `link` annotations in post and project essays as `contentLink`, the annotation the Studio writes. Today there is one, in `my-homelab`. Each patch carries the document's revision, so a concurrent edit is not overwritten.                            | Yes: documents without a legacy link are not touched                                                                                                        |
| `seed-resume-projects`       | Creates the four résumé projects as **drafts** (`drafts.project-<slug>`) from the reviewed values in `seed-resume-projects/data.ts`. Nothing is published. The homelab draft reuses the homelab post's rack photo, and its rack callouts link to that post's headings. | Yes: a project is skipped when `project-<slug>` exists as a published document, a draft or a release version, or when another project already uses the slug |

## Running them

From the repository root, with Node 24 and pnpm installed:

```bash
pnpm exec sanity login                    # once
set -a; . ./.env.local; set +a            # the project id and dataset, from the environment
pnpm exec sanity migration list           # both new migrations are listed

# 1. Back up the dataset first.
mkdir -p ~/backups
pnpm exec sanity dataset export "$NEXT_PUBLIC_STORE_SANITY_DATASET" ~/backups/site-$(date +%F).tar.gz

# 2. Link annotations: a dry run prints the patches without writing anything.
pnpm exec sanity migration run normalize-link-annotations
pnpm exec sanity migration run normalize-link-annotations --no-dry-run

# 3. The four project drafts: dry run, then run.
pnpm exec sanity migration run seed-resume-projects
pnpm exec sanity migration run seed-resume-projects --no-dry-run
```

- **What the dry runs should show.**
    - `normalize-link-annotations`: one patch, on the `my-homelab` post. It sets the one annotation's `_type` to `contentLink` and keeps its key and `href`.
    - `seed-resume-projects`: one transaction with four `createIfNotExists` mutations, for `drafts.project-gmail-spam-filter` (MSN-01), `drafts.project-homelab` (MSN-02), `drafts.project-kubernetes-cluster` (MSN-03) and `drafts.project-personal-website` (MSN-04).
    - Lines starting `seed-resume-projects:` list anything skipped or left out, for example a project that already exists, or a homelab callout whose post heading was renamed.
    - To dry-run against the backup instead of the live dataset, add `--from-export ~/backups/site-<date>.tar.gz`.
- **Webhooks stay active during a run.** The link patch updates the published `my-homelab` post, so the webhook refreshes its pages; they look the same, because both annotations render alike. The drafts are not published, so the site does not change until you publish them.
- **Undo.**
    - To remove the seeded drafts, delete them in the Studio before publishing.
    - To restore everything, import the backup: `pnpm exec sanity dataset import ~/backups/site-<date>.tar.gz "$NEXT_PUBLIC_STORE_SANITY_DATASET" --replace`.

## After seeding: review and publish in the Studio

Open `/studio` → **Missions · Projects**. Each draft is listed as "MSN-0n · Title".

1. **Read every field.** The drafts use only what the résumé, the homelab post and your answers of 2026-09-28 state. The source of each value is noted in `seed-resume-projects/data.ts`.
2. **Fill in what only you know.**
    - **All four:** My Role, and a Status Note if you want one.
    - **Homelab and website:** start dates.
    - **Gmail filter and Kubernetes cluster:** whether they were personal, coursework or work projects. Also a dataset link for the Gmail filter, and any repository or write-up for the Kubernetes cluster.
3. **Check the homelab's images.**
    - The cover and the 3D-model poster reuse the rack photo from "A Homelab Built to Be Rebuilt". Pick another of that post's photos if you prefer; there is no need to upload it again.
    - Check the wording of the five rack callouts.
4. **Confirm the mission numbers and slugs.** The slugs are permanent URLs: `/portfolio/gmail-spam-filter`, `/portfolio/homelab`, `/portfolio/kubernetes-cluster` and `/portfolio/personal-website`.
5. **Publish each draft.** The current `/portfolio` page shows published projects right away.
6. **Link related posts.** In each post's **Related Projects**, add Homelab to "A Homelab Built to Be Rebuilt". Adding it to "Sharing the DGX Spark GPU with MicroK8s" is your call; the ASUS Ascent in the rack is that DGX Spark.
