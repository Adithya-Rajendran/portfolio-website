import type {
    ContentBody,
    PostListItem,
    PostMeta,
    PostWithBody,
    ProfileData,
    ProjectListItem,
    ProjectWithBody,
} from "@/lib/sanity-client";
import { newestFirst } from "@/lib/content-rules";
import {
    SEED_PROJECTS,
    type SeedProject,
} from "@/migrations/seed-resume-projects/data";
import {
    seedBody,
    seedDocumentId,
} from "@/migrations/seed-resume-projects/build";

export function fixturesEnabled(): boolean {
    return process.env.SANITY_USE_FIXTURES === "1";
}

let sequence = 0;
const nextKey = () => `fixture-${sequence++}`;

function textBlock(
    text: string,
    style: "normal" | "h2" | "h3" | "h4" | "blockquote" = "normal",
) {
    return {
        _key: nextKey(),
        _type: "block",
        style,
        markDefs: [],
        children: [
            { _key: nextKey(), _type: "span", text, marks: [] as string[] },
        ],
    };
}

/**
 * A paragraph whose links are Studio-style `contentLink` annotations:
 * `[text, href]` pairs become linked spans between the plain `parts`.
 */
function linkedTextBlock(...parts: (string | [text: string, href: string])[]) {
    const markDefs: { _key: string; _type: "contentLink"; href: string }[] = [];
    const children = parts.map((part) => {
        if (typeof part === "string") {
            return { _key: nextKey(), _type: "span", text: part, marks: [] };
        }
        const [text, href] = part;
        const mark = { _key: nextKey(), _type: "contentLink" as const, href };
        markDefs.push(mark);
        return { _key: nextKey(), _type: "span", text, marks: [mark._key] };
    });
    return {
        _key: nextKey(),
        _type: "block",
        style: "normal",
        markDefs,
        children,
    };
}

/**
 * The fixture profile carries only the owner's real published values (Sanity
 * and the résumé, recorded in design/shared/content-real.md), including every
 * field the redesign adds, so fixture builds exercise them without inventing
 * facts. A field the published profile leaves empty (location) stays empty.
 * The UC Santa Cruz start is known only to the year (2019), so it is stored as
 * a year-precision date and printed without a month.
 */
export const FIXTURE_PROFILE: ProfileData = {
    _id: "profile",
    _updatedAt: "2026-07-11T00:00:00Z",
    name: "Adithya Rajendran",
    headline: "Former Canonical engineer · Robotics & AI studies at SJSU",
    tagline: "I’m exploring how robots perceive and remember the world.",
    introduction:
        "I’m exploring how robots perceive and remember the world. Here I share practical engineering notes and the questions I’m following next.",
    // profile.bio as published, all five paragraphs.
    bio: [
        "I’m pursuing an MS in Engineering (Interdisciplinary) at San José State University, with a focus on the intersection of robotics and AI. I started in August 2026 and expect to graduate in 2028.",
        "What draws me to robotic vision is the possibility of machines understanding the environments people live in: recognizing familiar objects, remembering where they were seen, and reasoning about what has changed. I’m particularly interested in shared spaces, where people move, borrow, and return objects, and a robot has to decide when to look again or ask for help.",
        "Before SJSU, I worked as a Field Software Engineer at Canonical until July 2026. I designed and deployed private-cloud systems built on Linux, OpenStack, Kubernetes, and Ceph, and worked through problems across the stack. Customer conversations, technical demonstrations, and explaining complex systems were as much a part of the role as troubleshooting. I’m bringing that combination of problem-solving and speaking into my studies.",
        "My route into engineering began with security. At UC Santa Cruz, the Slug Security Club gave me a place to explore network security and ethical hacking. After graduating, I worked on cloud compliance, threat modeling, and automation before moving to Canonical. My homelab remains a place to recreate systems, test ideas, and learn by breaking and rebuilding them.",
        "This notebook follows the systems I build and the questions I want to explore next. My longer-term interests include space exploration and the role autonomous machines could play beyond Earth.",
    ].join("\n\n"),
    availability: {
        status: "open",
        // The résumé header line, printed as written.
        openTo: "Summer 2027 internships · Full-time opportunities in 2028",
        // Summer 2027, approximated for placing the planned orbit only.
        from: "2027-06-01",
        consultingOpen: false,
        updatedAt: "2026-09-24",
    },
    // The plan's default launch (open question 8): the UC Santa Cruz start.
    launch: {
        date: "2019-01-01",
        precision: "year",
        event: "Started at UC Santa Cruz",
    },
    startHereIds: ["fixture-post-3", "fixture-post-1"],
    // profile.location is empty in the published profile.
    socialLinks: [
        {
            _key: "profile-linkedin",
            _type: "externalLink",
            label: "LinkedIn",
            url: "https://www.linkedin.com/in/adithya-rajendran",
            kind: "profile",
        },
        {
            _key: "profile-github",
            _type: "externalLink",
            label: "GitHub",
            url: "https://github.com/Adithya-Rajendran",
            kind: "profile",
        },
        {
            _key: "profile-credly",
            _type: "externalLink",
            label: "Credly",
            url: "https://www.credly.com/users/adithya-rajendran",
            kind: "profile",
        },
        {
            _key: "profile-hackthebox",
            _type: "externalLink",
            label: "Hack The Box",
            url: "https://app.hackthebox.com/users/514798",
            kind: "profile",
        },
        {
            _key: "profile-tryhackme",
            _type: "externalLink",
            label: "TryHackMe",
            url: "https://tryhackme.com/p/Cagmas",
            kind: "profile",
        },
    ],
    currentCuriosities: [
        {
            _key: "curiosity-memory-confidence",
            _type: "curiosity",
            kind: "question",
            title: "When should a robot stop trusting where it last saw an object?",
            note: "A question I want to investigate: how missed detections, occlusion, and time should change confidence in a remembered location.",
        },
        {
            _key: "curiosity-shared-objects",
            _type: "curiosity",
            kind: "question",
            title: "How should robots track objects that people move, borrow, and return?",
            note: "I’m interested in visual memory for shared spaces, where a tool can be visible, in use, or somewhere a robot has not checked.",
        },
        {
            _key: "curiosity-search-or-ask",
            _type: "curiosity",
            kind: "question",
            title: "When should a robot ask a person instead of continuing to search?",
            note: "Exploring the tradeoff between taking another look, searching elsewhere, waiting, and interrupting someone for help.",
        },
    ],
    curiositiesUpdatedAt: "2026-09-24T00:00:00Z",
    timeline: [
        {
            _key: "timeline-sjsu",
            _type: "timelineEntry",
            kind: "education",
            title: "M.S. Engineering (Interdisciplinary)",
            organization: "San José State University",
            orgShort: "SJSU",
            orgUrl: "https://www.sjsu.edu/",
            employment: "degree",
            isCurrent: true,
            startDate: "2026-08-01",
            expectedEndYear: 2028,
            summary: "Studying the intersection of robotics and AI.",
            highlights: [
                "Study focus: the intersection of robotics and artificial intelligence.",
                "Expected graduation: 2028.",
            ],
        },
        {
            _key: "timeline-canonical",
            _type: "timelineEntry",
            kind: "work",
            title: "Field Software Engineer I",
            organization: "Canonical Ltd (Ubuntu)",
            orgShort: "Canonical",
            orgUrl: "https://canonical.com/",
            location: "Remote",
            isCurrent: false,
            startDate: "2024-05-01",
            endDate: "2026-07-01",
            // Paraphrases and quotes the bio's own account of the move.
            burn: {
                label: "Security → Cloud",
                note: "After graduating, I worked on cloud compliance, threat modeling, and automation before moving to Canonical.",
            },
            summary:
                "Systems engineering, customer problem-solving, and technical communication across private-cloud deployments.",
            highlights: [
                "Designed and led large-scale private-cloud deployments using OpenStack, Kubernetes, and Ceph.",
                "Diagnosed issues from the Linux kernel and network switches through to applications, contributing patches where needed.",
                "Led customer discovery calls and tailored technical demonstrations, helping clients evaluate approaches against their business goals.",
                "Automated deployment and operations tasks with Python, Terraform, and Bash to reduce manual work and errors.",
                "Worked with engineering and support teams on custom solutions to improve performance and resolve recurring customer issues.",
                "Created CIS and DISA STIG tailoring files to support customers’ CMMC and HIPAA compliance work.",
                "Documented root causes and fixes in the knowledge base to help resolve similar incidents faster.",
                "Helped define statements of work, aligning sales, support, and engineering on the scope of each engagement.",
                "Brought customer use cases and technical challenges to product and engineering teams to inform the roadmap.",
            ],
            // Only terms named in the highlights above.
            skills: [
                "OpenStack",
                "Kubernetes",
                "Ceph",
                "Linux",
                "Python",
                "Terraform",
                "Bash",
            ],
        },
        {
            _key: "timeline-tcr",
            _type: "timelineEntry",
            kind: "work",
            title: "Cybersecurity Analyst Intern",
            organization: "Technical Consulting & Research, Inc. (TCR)",
            orgShort: "TCR",
            employment: "internship",
            location: "Fremont, CA",
            isCurrent: false,
            startDate: "2023-12-01",
            endDate: "2024-05-01",
            highlights: [
                "Identified gaps between cloud-provider configurations and compliance requirements through fit-gap analysis.",
                "Built Python automation that saved 1–2 hours of manual work per week.",
                "Presented “Navigating AI Risks for Small Businesses” at IGNITE and Bucknell University conferences.",
                "Used MITRE ATT&CK to improve threat modeling, contributing to a 15% reduction in system vulnerabilities.",
                "Applied least-privilege access and network segmentation to strengthen security.",
                "Built JavaScript demos to explain how compliance requirements affect applications.",
                "Implemented authentication and authorization with Auth0.",
                "Created security reports and visualizations to explain findings to non-technical stakeholders.",
            ],
        },
        {
            _key: "timeline-ucsc",
            _type: "timelineEntry",
            kind: "education",
            title: "B.S. Computer Science",
            organization: "University of California, Santa Cruz",
            orgShort: "UCSC",
            orgUrl: "https://www.ucsc.edu/",
            employment: "degree",
            location: "Santa Cruz, CA",
            isCurrent: false,
            // The owner gave the year only (2019 – 2023): never print a month.
            startDate: "2019-01-01",
            startPrecision: "year",
            endDate: "2023-06-01",
            highlights: [
                "Explored network security and ethical hacking through the Slug Security Club’s workshops and competitions.",
                "Relevant coursework: Computer Systems and C, Cryptography, Advanced Computer Networking, Principle of System Design, Artificial Intelligence, and Natural Language Processing.",
            ],
        },
    ],
    // profile.skillGroups as published.
    skillGroups: [
        {
            _key: "skills-infrastructure",
            _type: "skillGroup",
            title: "Infrastructure",
            skills: [
                "OpenStack",
                "Ceph",
                "KVM",
                "LXC/LXD",
                "Kubernetes",
                "AWS",
                "Azure",
                "Linux",
                "Git",
                "CI/CD",
                "Terraform",
            ],
        },
        {
            _key: "skills-cybersecurity",
            _type: "skillGroup",
            title: "Cybersecurity",
            skills: [
                "CMMC",
                "CIS",
                "DISA STIG",
                "FIPS 140-3",
                "MITRE ATT&CK",
                "NIST",
                "Metasploit",
                "Burp Suite",
                "Firewalls",
                "VLANs",
                "Networking",
            ],
        },
        {
            _key: "skills-development",
            _type: "skillGroup",
            title: "Development",
            skills: [
                "Python",
                "Rust",
                "Bash",
                "TypeScript",
                "React",
                "Next.js",
                "Vercel",
                "Tailwind CSS",
                "HTML",
                "PostgreSQL",
            ],
        },
    ],
    // profile.credentials as published. The status is the one the profile
    // query computes on 2026-09-28: both expiring credentials have expired.
    credentials: [
        {
            _key: "credential-aws-saa",
            _type: "credential",
            title: "AWS Certified Solutions Architect – Associate",
            issuer: "AWS",
            issuedOn: "2023-09-01",
            expiresOn: "2026-09-01",
            lifetime: false,
            lifecycleStatus: "expired",
            verificationUrl:
                "https://www.credly.com/badges/80207866-2bf2-41a0-8c92-991295e79063/",
        },
        {
            _key: "credential-security-plus",
            _type: "credential",
            title: "CompTIA Security+",
            issuer: "CompTIA",
            issuedOn: "2022-08-01",
            expiresOn: "2025-08-01",
            lifetime: false,
            lifecycleStatus: "expired",
            verificationUrl:
                "https://www.credly.com/badges/78c2780d-63dc-4c2b-a6df-72138c469271",
        },
        {
            _key: "credential-mta-security",
            _type: "credential",
            title: "MTA: Security Fundamentals",
            issuer: "Microsoft",
            issuedOn: "2018-05-01",
            lifetime: true,
            lifecycleStatus: "lifetime",
            verificationUrl:
                "https://www.credly.com/badges/b0889cff-2fbc-46c0-b16e-f631fefb024b",
        },
    ],
    talksAndPapers: [
        {
            // Its date, co-presenters and links are not published yet.
            _key: "talk-navigating-ai-risks",
            _type: "talkOrPaper",
            title: "Navigating AI Risks for Small Businesses",
            kind: "talk",
            venue: "IGNITE · Bucknell University",
        },
    ],
};

/**
 * Fixture posts. They are not the owner's writing: their titles say so, and
 * their text only describes what each one exercises (code listings, links,
 * a quotation, a short entry).
 */
const fixturePosts: PostWithBody[] = [
    {
        _id: "fixture-post-1",
        _updatedAt: "2026-06-26T00:00:00Z",
        title: "Fixture post: code listings and links",
        slug: "fixture-post-code-and-links",
        description:
            "Fixture content for offline builds: a section heading, two code listings and Studio-style links.",
        publishedAt: "2026-06-26",
        revisedAt: "2026-07-02",
        tags: ["fixture", "code"],
        projectIds: ["fixture-project-flagship"],
        wordCount: 42,
        body: [
            textBlock(
                "This fixture post exists only in builds without Sanity credentials. It describes no real work.",
            ),
            textBlock("Fixture section in a post", "h2"),
            textBlock(
                "A fixture paragraph under a heading that a fixture mission callout links to.",
            ),
            {
                _key: nextKey(),
                _type: "code",
                language: "bash",
                filename: "fixture.sh",
                code: "echo fixture\nls -la",
            },
            linkedTextBlock(
                "Fixture links: ",
                ["a fixture post", "/blog/fixture-post-short-note"],
                " and ",
                ["an external page", "https://example.com/fixture"],
                ".",
            ),
            {
                _key: nextKey(),
                _type: "code",
                language: "yaml",
                code: "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: fixture",
            },
        ] as ContentBody,
    },
    {
        _id: "fixture-post-2",
        _updatedAt: "2026-05-12T00:00:00Z",
        title: "Fixture post: a quotation",
        slug: "fixture-post-quotation",
        description:
            "Fixture content for offline builds: a paragraph and a quotation.",
        publishedAt: "2026-05-12",
        tags: ["fixture", "notes"],
        wordCount: 13,
        body: [
            textBlock(
                "This fixture post exists only in builds without Sanity credentials.",
            ),
            textBlock("A fixture quotation.", "blockquote"),
        ] as ContentBody,
    },
    {
        _id: "fixture-post-3",
        _updatedAt: "2026-04-02T00:00:00Z",
        title: "Fixture post: a short note",
        slug: "fixture-post-short-note",
        description: "Fixture content for offline builds: a single paragraph.",
        publishedAt: "2026-04-02",
        tags: ["fixture"],
        wordCount: 10,
        body: [
            textBlock(
                "This fixture post exists only in builds without Sanity credentials.",
            ),
        ] as ContentBody,
    },
];

function listPost(post: PostWithBody): PostListItem {
    const { body: _body, _updatedAt: _updated, ...item } = post;
    return item;
}

function metaPost(post: PostWithBody): PostMeta {
    const { _id: _id, body: _body, ...meta } = post;
    return meta;
}

/**
 * The owner's four résumé projects, from the drafts the seed migration
 * writes (`migrations/seed-resume-projects/data.ts`), so fixture builds show
 * the real missions with their published ids (`project-<slug>`). The seeds
 * have no cover (the owner picks one). Fixture builds have no Sanity assets
 * and no copy of the homelab post, so the model poster keeps only its alt
 * text and the callouts carry no links; links in the essays point at the real
 * posts' URLs.
 */
function fixtureFromSeed(seed: SeedProject): ProjectWithBody {
    const model = seed.model;
    return {
        _id: seedDocumentId(seed.slug),
        _updatedAt: "2026-09-28T00:00:00Z",
        designation: seed.designation,
        title: seed.title,
        slug: seed.slug,
        summary: seed.summary,
        status: seed.status,
        types: [...seed.types],
        ...(seed.featured ? { featured: seed.featured } : {}),
        ...(seed.dates
            ? {
                  startDate: seed.dates.start,
                  endDate: seed.dates.end,
                  datePrecision: seed.dates.precision,
                  datesApproximate: seed.dates.approximate,
              }
            : {}),
        technologies: [...seed.technologies],
        highlights: [...seed.highlights],
        parameters: seed.parameters?.map(({ key, label, value }) => ({
            _key: key,
            label,
            value,
        })),
        links: seed.links?.map(({ key, ...link }) => ({
            _key: key,
            _type: "externalLink",
            ...link,
        })),
        hasModel: Boolean(model),
        brief: seed.brief,
        results: seed.results?.map(({ key, ...result }) => ({
            _key: key,
            ...result,
        })),
        lessons: seed.lessons,
        next: seed.next,
        ...(model
            ? {
                  model: {
                      kind: "procedural",
                      procedural: model.procedural,
                      poster: { _type: "image", alt: model.poster.alt },
                      title: model.title,
                      alt: model.alt,
                      realWorld: { ...model.realWorld },
                      hotspots: model.callouts.map(
                          ({ key, label, title, body, part }) => ({
                              _key: key,
                              label,
                              title,
                              body,
                              part,
                          }),
                      ),
                  },
              }
            : {}),
        body: seedBody(seed.body),
    };
}

/**
 * Listed projects: the owner's four seeded missions (MSN-01 to MSN-04), then
 * fixture stand-ins for shapes the real missions lack. The stand-ins' names
 * say they are fixtures and they describe no real work: one fills every
 * mission field and links callouts to its essay and to a fixture post, one
 * has estimated years ("c. 2023"), and one is planned, without dates.
 */
export const FIXTURE_PROJECTS: ProjectWithBody[] = [
    ...SEED_PROJECTS.map(fixtureFromSeed),
    {
        _id: "fixture-project-flagship",
        _updatedAt: "2026-07-11T00:00:00Z",
        designation: 5,
        title: "Fixture flagship mission",
        slug: "fixture-flagship-mission",
        summary:
            "A fixture project that fills every mission field the site reads.",
        status: "active",
        statusNote: "Fixture status note.",
        types: ["infrastructure", "hardware"],
        // Slot 1 is the homelab's.
        featured: 2,
        myRole: "Fixture role",
        technologies: ["Fixture technology A", "Fixture technology B"],
        highlights: ["Exercises every module of a mission page."],
        parameters: [
            { _key: "parameter-a", label: "Parameter A", value: "1" },
            { _key: "parameter-b", label: "Parameter B", value: "2 × 3" },
            { _key: "parameter-c", label: "Parameter C", value: "4 W" },
        ],
        links: [
            {
                _key: "fixture-flagship-link",
                _type: "externalLink",
                label: "Fixture repository",
                url: "https://example.com/fixture-repository",
                kind: "repo",
            },
        ],
        hasModel: true,
        brief: {
            problem: "The fixture problem statement.",
            approach: "The fixture approach.",
            outcome: "The fixture outcome.",
        },
        results: [
            {
                _key: "result-a",
                metric: "Fixture metric",
                value: "100%",
                note: "A fixture note on how it was measured.",
            },
        ],
        lessons: ["A fixture lesson."],
        next: ["A fixture next step."],
        model: {
            kind: "procedural",
            procedural: "homelab-rack",
            poster: { _type: "image", alt: "Fixture poster of the model" },
            title: "Fixture model",
            alt: "A fixture description of the model for readers who cannot see it.",
            realWorld: { dimension: "height", value: 12, unit: "U" },
            hotspots: [
                {
                    _key: "hotspot-essay",
                    label: "1",
                    title: "Fixture callout to the essay",
                    body: "Links to a section of this project's essay.",
                    part: "tier0",
                    anchor: { heading: "fixture-section" },
                },
                {
                    _key: "hotspot-post",
                    label: "2",
                    title: "Fixture callout to a post",
                    part: "power",
                    anchor: {
                        heading: "fixture-section-in-a-post",
                        postId: "fixture-post-1",
                    },
                },
            ],
        },
        body: [
            textBlock("Fixture section", "h2"),
            textBlock("A fixture paragraph under the section heading."),
        ] as ContentBody,
    },
    {
        _id: "fixture-project-complete",
        _updatedAt: "2026-06-01T00:00:00Z",
        designation: 6,
        title: "Fixture completed mission",
        slug: "fixture-completed-mission",
        summary:
            "A fixture project whose dates are an estimate known to the year.",
        status: "completed",
        types: ["software"],
        startDate: "2023-01-01",
        endDate: "2023-12-31",
        datePrecision: "year",
        datesApproximate: true,
        technologies: ["Fixture technology C"],
        highlights: ["Prints its years as an estimate."],
        results: [
            { _key: "result-b", metric: "Fixture accuracy", value: "90%" },
        ],
        hasModel: false,
        body: [textBlock("A fixture essay without headings.")] as ContentBody,
    },
    {
        _id: "fixture-project-planned",
        _updatedAt: "2026-05-01T00:00:00Z",
        designation: 7,
        title: "Fixture planned mission",
        slug: "fixture-planned-mission",
        summary: "A fixture project that has not started, so it has no dates.",
        status: "planned",
        types: ["research"],
        technologies: ["Fixture technology D"],
        highlights: ["Has a status but no dates."],
        hasModel: false,
        body: [
            textBlock("A fixture essay for a planned project."),
        ] as ContentBody,
    },
];

function listProject(project: ProjectWithBody): ProjectListItem {
    const {
        body: _body,
        brief: _brief,
        results: _results,
        lessons: _lessons,
        next: _next,
        model: _model,
        ...item
    } = project;
    return item;
}

/**
 * A renderer-only project fixture. It deliberately exercises every custom
 * contentBody member but is never returned by the public project-list query.
 */
export const PROJECT_ESSAY_FIXTURE: ProjectWithBody = {
    _id: "fixture-project-essay",
    _updatedAt: "2026-07-11T00:00:00Z",
    designation: 99,
    title: "Portable Text project essay fixture",
    slug: "portable-text-project-fixture",
    summary: "A non-published fixture for exercising rich project prose.",
    status: "completed",
    types: ["software"],
    hasModel: false,
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    technologies: ["Next.js", "Sanity"],
    highlights: ["Tests every safe rich-prose block."],
    links: [
        {
            _key: "fixture-project-link",
            _type: "externalLink",
            label: "Sanity",
            url: "https://www.sanity.io/",
        },
    ],
    body: [
        textBlock("Fixture heading", "h2"),
        textBlock("Paragraph, lists, marks, and quotes use Portable Text."),
        {
            _key: "fixture-callout",
            _type: "callout",
            tone: "note",
            title: "Callout",
            body: [textBlock("Nested Portable Text stays structured.")],
        },
        {
            _key: "fixture-gallery",
            _type: "gallery",
            images: [
                {
                    _key: "fixture-gallery-image",
                    _type: "image",
                    alt: "Fixture gallery image",
                },
            ],
            caption: "Gallery caption",
        },
        {
            _key: "fixture-image",
            _type: "image",
            alt: "Standalone project essay image",
        },
        {
            _key: "fixture-code",
            _type: "code",
            language: "typescript",
            filename: "fixture.ts",
            code: "export const safe = true;",
        },
        {
            _key: "fixture-media",
            _type: "mediaEmbed",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            title: "Supported media fixture",
        },
    ] as ContentBody,
};

export function resolveFixtureQuery<T>(
    query: string,
    params: Record<string, unknown>,
): T | null {
    if (query.includes('_id == "profile"')) {
        return FIXTURE_PROFILE as T;
    }

    if (query.includes('_type == "project"')) {
        if (query.includes("slug.current == $slug")) {
            return ([...FIXTURE_PROJECTS, PROJECT_ESSAY_FIXTURE].find(
                (project) => project.slug === params.slug,
            ) ?? null) as T;
        }
        if (query.includes('"updatedAt": _updatedAt')) {
            return FIXTURE_PROJECTS.map(({ slug, _updatedAt }) => ({
                slug,
                updatedAt: _updatedAt ?? "",
            })) as T;
        }
        if (query.includes(".slug.current")) {
            return FIXTURE_PROJECTS.map(({ slug }) => slug) as T;
        }
        return FIXTURE_PROJECTS.map(listProject) as T;
    }

    if (!query.includes('_type == "post"')) return null;

    const today = typeof params.today === "string" ? params.today : "9999";
    const posts = newestFirst(
        fixturePosts.filter((post) => post.publishedAt <= today),
    );

    if (query.includes("references($projectId)")) {
        return posts
            .filter((post) =>
                post.projectIds?.includes(String(params.projectId)),
            )
            .map(listPost) as T;
    }

    if (query.includes("slug.current == $slug")) {
        const post = posts.find((item) => item.slug === params.slug);
        if (!post) return null;
        return (query.includes("body[]{") ? post : metaPost(post)) as T;
    }

    if (query.includes('"updatedAt": _updatedAt')) {
        return posts.map(({ slug, _updatedAt }) => ({
            slug,
            updatedAt: _updatedAt ?? "",
        })) as T;
    }

    if (query.includes(".slug.current")) {
        return posts.map(({ slug }) => slug) as T;
    }

    if (query.includes("body[]{")) return posts as T;
    return posts.map(listPost) as T;
}
