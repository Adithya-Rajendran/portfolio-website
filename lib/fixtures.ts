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

export const FIXTURE_PROFILE: ProfileData = {
    _id: "profile",
    _updatedAt: "2026-07-11T00:00:00Z",
    name: "Adithya Rajendran",
    headline: "Cloud Field Engineer @ Canonical",
    introduction:
        "I work on infrastructure and security, build things to understand them, and write about whatever keeps my attention.",
    bio: "My best work starts with a system that is technically possible but operationally unclear. I like learning in public, building small systems at home, and keeping useful notes on the open web.\n\nWriting here does not follow a content strategy. It is simply a record of the things I care enough to understand and remember.",
    location: "United States",
    socialLinks: [
        {
            _key: "profile-github",
            _type: "externalLink",
            label: "GitHub",
            url: "https://github.com/Adithya-Rajendran",
        },
        {
            _key: "profile-linkedin",
            _type: "externalLink",
            label: "LinkedIn",
            url: "https://www.linkedin.com/in/adithya-rajendran/",
        },
    ],
    currentCuriosities: [],
    timeline: [
        {
            _key: "timeline-canonical",
            _type: "timelineEntry",
            kind: "work",
            title: "Cloud Field Engineer",
            organization: "Canonical",
            location: "Remote",
            startDate: "2023-08-01",
            summary:
                "Customer-facing engineering across private cloud and Kubernetes.",
            highlights: [
                "Turn ambiguous infrastructure problems into testable paths forward.",
                "Explain platform decisions across engineering and operator audiences.",
                "Build repeatable delivery and troubleshooting practices.",
                "Feed lessons from real environments back into documentation and tooling.",
                "Work across Linux, OpenStack, Kubernetes, storage, and networking.",
            ],
            skills: ["OpenStack", "Kubernetes", "Linux"],
        },
        {
            _key: "timeline-ucsc",
            _type: "timelineEntry",
            kind: "education",
            title: "B.S. Computer Science",
            organization: "University of California, Santa Cruz",
            startDate: "2023-06-01",
            endDate: "2023-06-01",
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
