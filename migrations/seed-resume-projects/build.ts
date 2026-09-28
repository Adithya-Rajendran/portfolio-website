/**
 * Turns the reviewed drafts in `data.ts` into Sanity documents and decides
 * which of them to create. Pure (no dataset access and no Sanity imports), so
 * the tests and the fixture content (`lib/fixtures.ts`) use it as is.
 */
import { extractHeadings, type HeadingSourceBlock } from "../../lib/headings";
import type { Project } from "../../sanity.types";
import type { SeedImage, SeedParagraph, SeedProject } from "./data";

/** A project draft as the migration writes it. */
export type SeedDraft = Omit<Project, "_createdAt" | "_updatedAt" | "_rev">;

/** A stored document as the migration reads it from the dataset export. */
export type StoredDocument = {
    _id: string;
    _type: string;
    [key: string]: unknown;
};

/** A published post: its id and body (headings and images). */
export type PublishedPost = { id: string; body: readonly HeadingSourceBlock[] };

export type SeedPlan = {
    /** The drafts to create, in mission-number order. */
    drafts: SeedDraft[];
    /** Projects left alone because they, or their slug, already exist. */
    skipped: { slug: string; reason: string }[];
    /** Fields left out or clashes to fix, for the owner to read. */
    notes: string[];
};

/** Once published, a seeded project has the id `project-<slug>`. */
export function seedDocumentId(slug: string): string {
    return `project-${slug}`;
}

/** Seeded projects are created as drafts: `drafts.project-<slug>`. */
export function seedDraftId(slug: string): string {
    return `drafts.${seedDocumentId(slug)}`;
}

/** The published id behind a draft or release version id. */
export function publishedIdOf(id: string): string {
    if (id.startsWith("drafts.")) return id.slice("drafts.".length);
    if (id.startsWith("versions.")) return id.split(".").slice(2).join(".");
    return id;
}

function isPublishedId(id: string): boolean {
    return publishedIdOf(id) === id;
}

function slugOf(document: StoredDocument): string | undefined {
    const slug = document.slug as { current?: unknown } | undefined;
    return typeof slug?.current === "string" ? slug.current : undefined;
}

/** Portable Text paragraphs; links become `contentLink` annotations. */
export function seedBody(
    paragraphs: readonly SeedParagraph[],
): Project["body"] {
    return paragraphs.map((parts, index) => {
        const key = `p${index + 1}`;
        const markDefs: { _key: string; _type: "contentLink"; href: string }[] =
            [];
        const children = parts.map((part, partIndex) => {
            const spanKey = `${key}s${partIndex + 1}`;
            if (typeof part === "string") {
                return {
                    _key: spanKey,
                    _type: "span" as const,
                    text: part,
                    marks: [],
                };
            }
            const [text, href] = part;
            const mark = {
                _key: `${key}l${markDefs.length + 1}`,
                _type: "contentLink" as const,
                href,
            };
            markDefs.push(mark);
            return {
                _key: spanKey,
                _type: "span" as const,
                text,
                marks: [mark._key],
            };
        });
        return {
            _key: key,
            _type: "block" as const,
            style: "normal" as const,
            markDefs,
            children,
        };
    });
}

/** Every image asset id in a post body, including gallery images. */
function assetIdsIn(body: readonly HeadingSourceBlock[]): Set<string> {
    const ids = new Set<string>();
    const add = (image: unknown) => {
        const ref = (image as { asset?: { _ref?: unknown } } | undefined)?.asset
            ?._ref;
        if (typeof ref === "string") ids.add(ref);
    };
    for (const block of body) {
        if (block._type === "image") add(block);
        if (block._type === "gallery" && Array.isArray(block.images)) {
            block.images.forEach(add);
        }
    }
    return ids;
}

/**
 * The published posts by slug. Drafts and release versions are ignored:
 * callout anchors are checked against the post readers can open.
 */
export function publishedPosts(
    documents: readonly StoredDocument[],
): Map<string, PublishedPost> {
    const posts = new Map<string, PublishedPost>();
    for (const document of documents) {
        if (document._type !== "post" || !isPublishedId(document._id)) {
            continue;
        }
        const slug = slugOf(document);
        if (!slug) continue;
        const body = Array.isArray(document.body)
            ? (document.body as HeadingSourceBlock[])
            : [];
        posts.set(slug, { id: document._id, body });
    }
    return posts;
}

function imageValue(image: SeedImage) {
    return {
        _type: "image" as const,
        asset: { _type: "reference" as const, _ref: image.asset },
        alt: image.alt,
    };
}

/**
 * The Sanity draft for one project. An image is used only when its asset is
 * still in the named published post, and a callout links to a heading only
 * when that post has it, so the draft never carries a broken reference or a
 * link the Studio would reject. What is left out is listed in `notes`.
 */
export function buildSeedDraft(
    seed: SeedProject,
    posts: ReadonlyMap<string, PublishedPost>,
): { draft: SeedDraft; notes: string[] } {
    const notes: string[] = [];
    const hasImage = (image: SeedImage) => {
        const post = posts.get(image.post);
        if (post && assetIdsIn(post.body).has(image.asset)) return true;
        return false;
    };

    let model: SeedDraft["model"];
    if (seed.model) {
        const source = seed.model;
        if (!hasImage(source.poster)) {
            notes.push(
                `${seed.slug}: 3D model left out, because its poster image is not in the published post “${source.poster.post}”.`,
            );
        } else {
            const post = posts.get(source.anchorPost);
            const headings = new Set(
                post
                    ? extractHeadings({ body: post.body }).map((h) => h.id)
                    : [],
            );
            model = {
                kind: "procedural",
                procedural: source.procedural,
                poster: imageValue(source.poster),
                title: source.title,
                alt: source.alt,
                realWorld: { ...source.realWorld },
                hotspots: source.callouts.map((callout) => {
                    const linked = post && headings.has(callout.heading);
                    if (!linked) {
                        notes.push(
                            `${seed.slug}: callout ${callout.label} has no link, because the published post “${source.anchorPost}” has no heading “${callout.heading}”.`,
                        );
                    }
                    return {
                        _key: callout.key,
                        _type: "hotspot" as const,
                        label: callout.label,
                        title: callout.title,
                        body: callout.body,
                        part: callout.part,
                        ...(post && linked
                            ? {
                                  anchor: {
                                      heading: callout.heading,
                                      post: {
                                          _type: "reference" as const,
                                          _ref: post.id,
                                          _weak: true,
                                      },
                                  },
                              }
                            : {}),
                    };
                }),
            };
        }
    }

    const draft: SeedDraft = {
        _id: seedDraftId(seed.slug),
        _type: "project",
        designation: seed.designation,
        title: seed.title,
        slug: { _type: "slug", current: seed.slug },
        summary: seed.summary,
        types: [...seed.types],
        ...(seed.featured ? { featured: seed.featured } : {}),
        status: seed.status,
        ...(seed.dates
            ? {
                  startDate: seed.dates.start,
                  ...(seed.dates.end ? { endDate: seed.dates.end } : {}),
                  ...(seed.dates.precision
                      ? { datePrecision: seed.dates.precision }
                      : {}),
                  ...(seed.dates.approximate ? { datesApproximate: true } : {}),
              }
            : {}),
        technologies: [...seed.technologies],
        highlights: [...seed.highlights],
        ...(seed.parameters?.length
            ? {
                  parameters: seed.parameters.map(({ key, label, value }) => ({
                      _key: key,
                      _type: "parameter" as const,
                      label,
                      value,
                  })),
              }
            : {}),
        ...(seed.links?.length
            ? {
                  links: seed.links.map(({ key, label, url, kind }) => ({
                      _key: key,
                      _type: "externalLink" as const,
                      label,
                      url,
                      kind,
                  })),
              }
            : {}),
        ...(seed.brief ? { brief: { ...seed.brief } } : {}),
        ...(seed.results?.length
            ? {
                  results: seed.results.map(({ key, ...result }) => ({
                      _key: key,
                      _type: "result" as const,
                      ...result,
                  })),
              }
            : {}),
        ...(seed.lessons?.length ? { lessons: [...seed.lessons] } : {}),
        ...(seed.next?.length ? { next: [...seed.next] } : {}),
        ...(model ? { model } : {}),
        body: seedBody(seed.body),
    };
    return { draft, notes };
}

/**
 * Which drafts to create. A project is skipped when a published project, a
 * draft or a release version with its id (`project-<slug>`) exists, or when
 * another project already uses its slug: publishing deletes the draft, so
 * checking the draft id alone would recreate a stale draft on a second run.
 * A mission number another project already holds is reported, not changed;
 * the Studio flags the clash until one of them is renumbered.
 */
export function planSeed(
    documents: readonly StoredDocument[],
    seeds: readonly SeedProject[],
): SeedPlan {
    const projects = documents.filter(
        (document) => document._type === "project",
    );
    const posts = publishedPosts(documents);
    const plan: SeedPlan = { drafts: [], skipped: [], notes: [] };

    for (const seed of seeds) {
        const id = seedDocumentId(seed.slug);
        const existing = projects.find(
            (project) => publishedIdOf(project._id) === id,
        );
        if (existing) {
            plan.skipped.push({
                slug: seed.slug,
                reason: `${existing._id} already exists`,
            });
            continue;
        }
        const sameSlug = projects.find(
            (project) => slugOf(project) === seed.slug,
        );
        if (sameSlug) {
            plan.skipped.push({
                slug: seed.slug,
                reason: `${sameSlug._id} already uses the slug “${seed.slug}”`,
            });
            continue;
        }
        const sameNumber = projects.find(
            (project) => project.designation === seed.designation,
        );
        if (sameNumber) {
            const number = String(seed.designation).padStart(2, "0");
            plan.notes.push(
                `${seed.slug}: MSN-${number} is already used by ${sameNumber._id}. Renumber one of them in the Studio before publishing.`,
            );
        }
        const { draft, notes } = buildSeedDraft(seed, posts);
        plan.drafts.push(draft);
        plan.notes.push(...notes);
    }
    return plan;
}
