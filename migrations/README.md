# Named content migrations

Each folder is one migration for the Sanity CLI: `sanity migration run <folder>`.
They change the dataset, so only the owner runs them, from an authenticated
Sanity CLI session. CI, previews and coding agents never do. The project id and
dataset come from `.env.local`; never commit them.

| Migration                    | What it does                                                                                                                                                                                                                                                                                  | Safe to run again                                                                                                                                           | On production                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `personal-site-profile`      | Earlier migration: builds the Profile from the legacy documents.                                                                                                                                                                                                                              | Yes                                                                                                                                                         | Run                                                                                                                      |
| `personal-site-cleanup`      | Earlier migration: deletes the legacy documents and post fields.                                                                                                                                                                                                                              | Yes                                                                                                                                                         | Run                                                                                                                      |
| `normalize-link-annotations` | Rewrites legacy `link` annotations in post and project essays as `contentLink`, the annotation the Studio writes. Today there is one, in `my-homelab`. Each patch carries the document's revision, so a concurrent edit is not overwritten.                                                   | Yes: documents without a legacy link are not touched                                                                                                        | Not yet: the site renders both annotations alike, so it can run at any time after a backup                               |
| `seed-resume-projects`       | Creates the four résumé projects as **drafts** (`drafts.project-<slug>`) from the reviewed values in `seed-resume-projects/data.ts`. Nothing is published. The homelab draft reuses the homelab post's rack photo as its 3D-model poster, and its rack callouts link to that post's headings. | Yes: a project is skipped when `project-<slug>` exists as a published document, a draft or a release version, or when another project already uses the slug | Run before the launch (1 Oct 2026). Three projects are published; the website project is kept as a draft and answers 404 |

## Back up and restore

The posts, projects, profile and résumé PDF live only in the Sanity dataset:
`lib/fixtures.ts` is test content, not a copy. Take an export before every
migration and after any large edit, and keep a copy off this machine.

```bash
pnpm exec sanity login                    # once
set -a; . ./.env.local; set +a            # the project id and dataset, from the environment
mkdir -p ~/backups
pnpm exec sanity dataset export "$NEXT_PUBLIC_STORE_SANITY_DATASET" ~/backups/site-$(date +%F).tar.gz
```

The tarball holds every document, drafts included, and the dataset's image
and file assets.

- **Within the history window.** The Studio keeps each document's revisions:
  open the document, then **Review changes**, pick a revision and **Restore**.
  A deleted document keeps its history too: opened by its id in the Studio, it
  offers to restore its last revision. The window
  is the plan's history retention, three days on the free plan (check the
  project's plan at sanity.io/manage). Anything older exists only in an export.
- **From an export.** To bring back only what was deleted, import with
  `--missing`, which skips every document that still exists:

    ```bash
    pnpm exec sanity dataset import ~/backups/site-<date>.tar.gz "$NEXT_PUBLIC_STORE_SANITY_DATASET" --missing
    ```

    To roll documents back to the backup, use `--replace` instead: it overwrites
    each document that is in the backup and keeps the rest. Neither flag
    deletes a document created after the backup; delete those in the Studio
    first if they should go too.

- **After a restore**, open a restored page on the site. If it still shows the
  old content, publish the document again in the Studio: that calls the
  webhook, which refreshes every page that shows it.

## Running a migration

From the repository root, with Node 24 and pnpm installed, after the export
above:

```bash
pnpm exec sanity login                    # once
set -a; . ./.env.local; set +a            # the project id and dataset, from the environment
pnpm exec sanity migration list           # the four migrations are listed

# Link annotations: a dry run prints the patches without writing anything.
pnpm exec sanity migration run normalize-link-annotations
pnpm exec sanity migration run normalize-link-annotations --no-dry-run

# The four project drafts (run before the launch): dry run, then run.
pnpm exec sanity migration run seed-resume-projects
pnpm exec sanity migration run seed-resume-projects --no-dry-run
```

- **What the dry runs should show.**
    - `normalize-link-annotations`: one patch, on the `my-homelab` post. It sets the one annotation's `_type` to `contentLink` and keeps its key and `href`.
    - `seed-resume-projects`: on a dataset without the projects, one transaction with four `createIfNotExists` mutations, for `drafts.project-gmail-spam-filter` (MSN-01), `drafts.project-homelab` (MSN-02), `drafts.project-kubernetes-cluster` (MSN-03) and `drafts.project-personal-website` (MSN-04). On production every project exists, so all four are skipped.
    - Lines starting `seed-resume-projects:` list anything skipped or left out, for example a project that already exists, or a homelab callout whose post heading was renamed.
    - To dry-run against the backup instead of the live dataset, add `--from-export ~/backups/site-<date>.tar.gz`.
- **Webhooks stay active during a run.** The link patch updates the published `my-homelab` post, so the webhook refreshes its pages; they look the same, because both annotations render alike. Seeded drafts are not published, so the site does not change until you publish them.
- **Undo.**
    - To remove seeded drafts before publishing, discard them in the Studio, or delete them from the CLI: `pnpm exec sanity documents delete drafts.project-gmail-spam-filter drafts.project-homelab drafts.project-kubernetes-cluster drafts.project-personal-website`.
    - To undo the link patch, import the backup with `--replace` (above).

## After seeding: review and publish in the Studio

This is how the seeded drafts were reviewed before the launch; it applies again
if the seed runs on a dataset without the projects.

Open `/studio` → **Missions · Projects**. Each draft is listed as "MSN-0n · Title".

1. **Read every field.** The drafts use only what the résumé, the homelab post and your answers of 2026-09-28 state. The source of each value is noted in `seed-resume-projects/data.ts`.
2. **Fill in what only you know.**
    - **All four:** My Role, and a Status Note if you want one.
    - **Homelab and website:** start dates.
    - **Gmail filter and Kubernetes cluster:** whether they were personal, coursework or work projects. Also a dataset link for the Gmail filter, and any repository or write-up for the Kubernetes cluster.
3. **Pick the covers and check the homelab's model.**
    - No draft has a cover: choose one for each mission, or leave it empty. A cover is the plate beside the project page's head and a 3:2 thumbnail on its card, so a landscape image reads best; the rack photo is a tall portrait. For the homelab, you can pick one of the photos already in "A Homelab Built to Be Rebuilt"; there is no need to upload it again.
    - The 3D-model poster reuses the rack photo from that post. The project's page shows it as the model's plate, and the featured stage shows it when the project has no cover.
    - Check the wording of the five rack callouts.
4. **Confirm the mission numbers and slugs.** A published project's slug is a permanent URL: `/portfolio/gmail-spam-filter`, `/portfolio/homelab` and `/portfolio/kubernetes-cluster`. The website project is kept as a draft, so `/portfolio/personal-website` answers 404.
5. **Publish each draft.** The webhook then refreshes `/portfolio` and every page that lists projects (its filter must include `project`).
6. **Link related posts.** In each post's **Related Projects**, add Homelab to "A Homelab Built to Be Rebuilt". Adding it to "Sharing the DGX Spark GPU with MicroK8s" is your call; the ASUS Ascent in the rack is that DGX Spark.
