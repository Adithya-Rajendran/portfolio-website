import type {
    ContentBody,
    PostListItem,
    PostMeta,
    PostWithBody,
    ProfileData,
    ProjectWithBody,
} from "@/lib/sanity-client";
import { newestFirst } from "@/lib/content-rules";

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
 * The fixture profile carries the owner's real published values (Sanity and
 * the résumé, recorded in design/shared/content-real.md) for every field the
 * redesign adds, so fixture builds exercise them without inventing facts. The
 * UC Santa Cruz start is known only to the year (2019), so it is stored as a
 * year-precision date and printed without a month.
 */
export const FIXTURE_PROFILE: ProfileData = {
    _id: "profile",
    _updatedAt: "2026-07-11T00:00:00Z",
    name: "Adithya Rajendran",
    headline: "Former Canonical engineer · Robotics & AI studies at SJSU",
    tagline: "I’m exploring how robots perceive and remember the world.",
    introduction:
        "I’m exploring how robots perceive and remember the world. Here I share practical engineering notes and the questions I’m following next.",
    bio: "My best work starts with a system that is technically possible but operationally unclear. I like learning in public, building small systems at home, and keeping useful notes on the open web.\n\nWriting here does not follow a content strategy. It is simply a record of the things I care enough to understand and remember.",
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
    location: "United States",
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
    skillGroups: [
        {
            _key: "skills-platforms",
            _type: "skillGroup",
            title: "Platforms",
            skills: ["Kubernetes", "OpenStack", "Linux", "AWS"],
        },
        {
            _key: "skills-practice",
            _type: "skillGroup",
            title: "Practice",
            skills: ["Terraform", "Ansible", "GitOps", "Security"],
        },
    ],
    credentials: [
        {
            _key: "credential-active",
            _type: "credential",
            title: "Kubernetes Administrator",
            issuer: "Cloud Native Computing Foundation",
            issuedOn: "2025-03-01",
            expiresOn: "2028-03-01",
            lifetime: false,
            lifecycleStatus: "active",
            verificationUrl: "https://www.credly.com/",
        },
        {
            _key: "credential-lifetime",
            _type: "credential",
            title: "Security+",
            issuer: "CompTIA",
            issuedOn: "2021-02-01",
            lifetime: true,
            lifecycleStatus: "lifetime",
        },
        {
            _key: "credential-expired",
            _type: "credential",
            title: "Solutions Architect",
            issuer: "Amazon Web Services",
            issuedOn: "2020-04-01",
            expiresOn: "2023-04-01",
            lifetime: false,
            lifecycleStatus: "expired",
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

const fixturePosts: PostWithBody[] = [
    {
        _id: "fixture-post-1",
        _updatedAt: "2026-06-26T00:00:00Z",
        title: "Notes from a small Kubernetes cluster",
        slug: "small-kubernetes-cluster-notes",
        description:
            "A few things I learned by running infrastructure that is deliberately too small to hide its failure modes.",
        publishedAt: "2026-06-26",
        tags: ["kubernetes", "homelab"],
        wordCount: 78,
        body: [
            textBlock(
                "A small cluster makes every assumption visible. There is nowhere for a noisy workload, a bad storage decision, or a brittle upgrade to hide.",
            ),
            textBlock("What stayed useful", "h2"),
            textBlock(
                "The most useful result was not a perfect configuration. It was a short recovery path that I could still understand six months later.",
            ),
            {
                _key: nextKey(),
                _type: "code",
                language: "bash",
                filename: "check-nodes.sh",
                code: "kubectl get nodes -o wide\nkubectl get pods -A --field-selector=status.phase!=Running",
            },
            linkedTextBlock(
                "Related: ",
                [
                    "things worth keeping on the open web",
                    "/blog/things-worth-keeping-on-the-open-web",
                ],
                ", and the ",
                ["Kubernetes documentation", "https://kubernetes.io/docs/"],
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
        title: "The documentary I kept thinking about",
        slug: "documentary-i-kept-thinking-about",
        description:
            "A personal note about observation, editing, and why a quiet documentary stayed with me.",
        publishedAt: "2026-05-12",
        tags: ["film", "notes"],
        wordCount: 52,
        body: [
            textBlock(
                "The film trusts the audience enough to leave pauses intact. That changed how I thought about explanation in places far outside filmmaking.",
            ),
            textBlock(
                "Sometimes the clearest account of a complicated thing is the one that gives it room.",
                "blockquote",
            ),
        ] as ContentBody,
    },
    {
        _id: "fixture-post-3",
        _updatedAt: "2026-04-02T00:00:00Z",
        title: "Things worth keeping on the open web",
        slug: "things-worth-keeping-on-the-open-web",
        description:
            "Why I still want a small personal website even when almost nobody is looking at it.",
        publishedAt: "2026-04-02",
        tags: ["personal-web"],
        wordCount: 44,
        body: [
            textBlock(
                "A personal site can be an address rather than a funnel: a durable place for work, half-formed interests, and writing that does not need an audience strategy.",
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
 * A renderer-only project fixture. It deliberately exercises every custom
 * contentBody member but is never returned by the public project-list query.
 */
export const PROJECT_ESSAY_FIXTURE: ProjectWithBody = {
    _id: "fixture-project-essay",
    _updatedAt: "2026-07-11T00:00:00Z",
    title: "Portable Text project essay fixture",
    slug: "portable-text-project-fixture",
    summary: "A non-published fixture for exercising rich project prose.",
    status: "completed",
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
            return (
                params.slug === PROJECT_ESSAY_FIXTURE.slug
                    ? PROJECT_ESSAY_FIXTURE
                    : null
            ) as T;
        }
        if (query.includes(".slug.current")) return [] as T;
        return [] as T;
    }

    if (!query.includes('_type == "post"')) return null;

    const today = typeof params.today === "string" ? params.today : "9999";
    const posts = newestFirst(
        fixturePosts.filter((post) => post.publishedAt <= today),
    );

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
