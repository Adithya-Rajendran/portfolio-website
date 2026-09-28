/**
 * The four résumé projects ("Selected projects" in the résumé PDF), drafted
 * for the owner to review, correct and publish in the Studio. Nothing here is
 * invented: every value comes from one of these sources, named next to it.
 *
 * - Résumé: the résumé PDF served at /resume/view (uploaded 2026-09-24).
 * - Homelab post: "A Homelab Built to Be Rebuilt" (/blog/my-homelab).
 * - Owner: the owner's answers of 2026-09-28. The Gmail filter and the
 *   Kubernetes cluster are done, with dates he estimated (c. 2023 and
 *   c. 2024–2025); the homelab and this website are active; the ASUS Ascent
 *   in the rack is the NVIDIA DGX Spark of "Sharing the DGX Spark GPU with
 *   MicroK8s" (/blog/kubernetes-on-the-nvidia-dgx-spark).
 * - Repo: this repository (package.json, README.md, CLAUDE.md).
 * - Rack drawing: design/shared/rack.js, the schematic 12U rack read from the
 *   homelab post's rack photo, whose parts `lib/viewer/registry.ts` lists.
 *
 * Fields no source states stay empty for the owner (role, the homelab and
 * website start dates, the Kubernetes cluster's links and context). The
 * design record with the source of every value is
 * design/shared/content-real.md (§ missions). Mission numbers follow the
 * résumé's listing order; slugs are the permanent URLs /portfolio/<slug>.
 *
 * `build.ts` turns each entry into a Sanity draft; `index.ts` writes them.
 */
import type { LinkKind, TimelineDatePrecision } from "../../lib/profile-fields";
import type {
    ProjectStatus,
    ProjectType,
    RealWorldDimension,
    RealWorldUnit,
} from "../../lib/project-fields";
import type {
    ModelPartKey,
    ProceduralModelKey,
} from "../../lib/viewer/registry";

/** A paragraph of plain text, with `[text, href]` pairs for links. */
export type SeedParagraph = readonly (
    string | readonly [text: string, href: string]
)[];

/**
 * An image that already exists in a published post, so nothing is uploaded
 * again. The alt text and caption are the post's own, as published on
 * 2026-09-28. The migration checks that the asset is still in that post and
 * leaves the field out when it is not.
 */
export type SeedImage = {
    post: string;
    asset: string;
    alt: string;
    caption?: string;
};

/** A numbered balloon on the 3D model, linked to a heading of `anchorPost`. */
export type SeedCallout = {
    key: string;
    label: string;
    title: string;
    body: string;
    part: ModelPartKey;
    heading: string;
};

export type SeedProject = {
    slug: string;
    designation: number;
    title: string;
    summary: string;
    types: ProjectType[];
    status: ProjectStatus;
    featured?: 1 | 2 | 3;
    dates?: {
        start: string;
        end?: string;
        precision?: TimelineDatePrecision;
        approximate?: boolean;
    };
    technologies: string[];
    highlights: string[];
    parameters?: { key: string; label: string; value: string }[];
    links?: { key: string; label: string; url: string; kind: LinkKind }[];
    brief?: { problem: string; approach: string; outcome: string };
    results?: { key: string; metric: string; value: string; note?: string }[];
    lessons?: string[];
    next?: string[];
    cover?: SeedImage;
    model?: {
        procedural: ProceduralModelKey;
        title: string;
        alt: string;
        realWorld: {
            dimension: RealWorldDimension;
            value: number;
            unit: RealWorldUnit;
        };
        poster: SeedImage;
        /** The published post whose headings the callouts link to. */
        anchorPost: string;
        callouts: SeedCallout[];
    };
    body: SeedParagraph[];
};

const HOMELAB_POST = "my-homelab";
const DGX_SPARK_POST_URL = "/blog/kubernetes-on-the-nvidia-dgx-spark";

/** The rack photo in the homelab post: the homelab's cover and poster. */
const RACK_PHOTO: SeedImage = {
    post: HOMELAB_POST,
    asset: "image-05754647a9226f0938def18645edaef5169c8aec-3000x4000-jpg",
    alt: "Server rack with three Minisforum MS-01 systems and an ASUS Ascent.",
    caption:
        "Inside the server rack. Excuse the cables at the bottom—the dust is proof that I rarely touch this hardware when redeploying the lab.",
};

// Résumé bullets, verbatim.
const GMAIL_BULLETS = [
    "Built a Gmail API integration to fetch and classify incoming messages using a multilayer perceptron (MLP), achieving 90% spam-detection accuracy.",
    "Tuned the classifier architecture to reduce false positives and improve classification speed.",
];
const HOMELAB_BULLETS = [
    "Built a personal cloud environment spanning bare-metal provisioning, networking, storage, and secure application deployment.",
    "Segmented traffic with VLANs and policy-based firewall rules; configured link aggregation for redundancy and jumbo frames for Ceph replication.",
];
const KUBERNETES_BULLETS = [
    "Built a highly available three-node Kubernetes cluster with zero downtime during upgrades and maintenance.",
    "Applied CIS Level 1 hardening and integrated Okta OIDC authentication with NFS persistent storage.",
];
const WEBSITE_BULLETS = [
    "Built and maintained a Next.js and React website using server-side rendering for search discoverability and page performance.",
    "Publishes Sanity-managed articles and profile content through Vercel, with a searchable archive and RSS feed.",
];

export const SEED_PROJECTS: readonly SeedProject[] = [
    {
        // Résumé, project 1.
        slug: "gmail-spam-filter",
        designation: 1,
        title: "Gmail spam detection with machine learning",
        summary: GMAIL_BULLETS[0],
        types: ["software"],
        // Owner: done, around 2023 (his estimate, printed "c. 2023").
        status: "completed",
        dates: {
            start: "2023-01-01",
            end: "2023-12-31",
            precision: "year",
            approximate: true,
        },
        technologies: ["Gmail API", "Multilayer perceptron (MLP)"],
        highlights: GMAIL_BULLETS,
        parameters: [
            {
                key: "accuracy",
                label: "Spam-detection accuracy",
                value: "90%",
            },
            { key: "classifier", label: "Classifier", value: "MLP" },
            { key: "source", label: "Mail source", value: "Gmail API" },
        ],
        results: [
            {
                key: "accuracy",
                metric: "Spam-detection accuracy",
                value: "90%",
            },
        ],
        links: [
            {
                key: "repo",
                label: "GitHub repository",
                url: "https://github.com/Adithya-Rajendran/Gmail-Filter",
                kind: "repo",
            },
        ],
        body: [
            [
                "I built a Gmail API integration that fetches incoming messages and classifies them with a multilayer perceptron (MLP), achieving 90% spam-detection accuracy.",
            ],
            [
                "I tuned the classifier architecture to reduce false positives and improve classification speed. The code is on ",
                ["GitHub", "https://github.com/Adithya-Rajendran/Gmail-Filter"],
                ".",
            ],
        ],
    },
    {
        // Résumé, project 2; the homelab post for everything past the
        // résumé bullets. The flagship: it has the photos and the rack model.
        slug: "homelab",
        designation: 2,
        title: "Homelab with segmented networks and high availability",
        summary: HOMELAB_BULLETS[0],
        types: ["infrastructure"],
        // Homelab post: "Today, that lab runs a Canonical OpenStack cluster."
        status: "active",
        featured: 1,
        technologies: [
            "MAAS",
            "Ubuntu Core",
            "MicroCloud (LXD)",
            "Landscape",
            "Juju",
            "Canonical OpenStack",
            "Ceph",
            "VLANs",
            "PXE",
        ],
        highlights: HOMELAB_BULLETS,
        // Only values the homelab post states.
        parameters: [
            { key: "power", label: "Rack power, measured", value: "195.1 W" },
            { key: "openstack", label: "OpenStack nodes", value: "3 × MS-01" },
            { key: "by-hand", label: "Installed by hand", value: "3 × Pi 5" },
            { key: "nas", label: "NAS storage", value: "12 TB" },
        ],
        links: [
            {
                key: "write-up",
                label: "A Homelab Built to Be Rebuilt",
                url: "https://adithya-rajendran.com/blog/my-homelab",
                kind: "article",
            },
        ],
        // Paraphrased from the homelab post.
        brief: {
            problem:
                "I wanted a homelab where I could experiment and break things without worrying about how long it would take to rebuild. Reinstalling an OS across three MS-01s every time got old, and MAAS and Landscape, which manage the machines, need a place to run too.",
            approach:
                "A three-tier bootstrap chain. Three Raspberry Pi 5s, the only machines installed by hand, run MAAS and Landscape on Ubuntu Core with MicroCloud. MAAS provisions a Dell Inspiron, which hosts the Juju controller, and three Minisforum MS-01s over PXE.",
            outcome:
                "The lab runs Canonical OpenStack, hyperconverged across the three MS-01s, and the x86 tier can be rebuilt without a USB stick. The 12 TB NAS stays outside Ceph so its data survives a redeployment, and the rack idles at around 200 W.",
        },
        results: [
            {
                key: "power",
                metric: "Power at the wall",
                value: "195.1 W",
                note: "With the rack running normally, not while every CPU is under benchmark load.",
            },
            {
                key: "by-hand",
                metric: "Machines installed by hand",
                value: "3",
                note: "The Raspberry Pi 5s. MAAS provisions the rest of the chain over PXE.",
            },
            {
                key: "rebuild",
                metric: "Rebuilding the x86 tier",
                value: "No USB stick needed",
            },
            {
                key: "ceph-latency",
                metric: "Ceph traffic latency",
                value: "0.4 ms",
                note: "On the direct path; 7 ms when the traffic took the gateway instead.",
            },
            {
                key: "ceph-quorum",
                metric: "Ceph monitor hosts that can fail",
                value: "1",
                note: "Three nodes give the Ceph monitor layer enough quorum.",
            },
            {
                key: "workloads",
                metric: "Load-bearing workloads",
                value: "None yet",
                note: "A handful of VMs support the lab itself.",
            },
        ],
        // Quoted from the homelab post.
        lessons: [
            "Most of the failures in this lab have started at Layer 2.",
            "The L2/L3 boundary is where I have burned the most hours.",
            "Most of the time, I can learn more by improving how the existing systems fit together than by buying another box.",
            "The interesting work is not making the cluster bigger; it is making the existing pieces fit together better and contributing what I learn back to the projects that power it.",
        ],
        next: [
            "Enough hardware and redundancy to keep the services I need available, before depending on the lab for day-to-day workloads.",
            "A broader compute layer that includes Arm and AMD systems.",
            "The Jetson Nano: a future project involving a small ground robot and, eventually, a drone.",
        ],
        cover: RACK_PHOTO,
        model: {
            procedural: "homelab-rack",
            title: "The homelab rack",
            alt: "A schematic drawing of the 12U homelab rack: the Raspberry Pi 5 mount, the network switch and patch panel, the three Minisforum MS-01s, the ASUS Ascent (the NVIDIA DGX Spark) and the rack PDU.",
            realWorld: { dimension: "height", value: 12, unit: "U" },
            poster: RACK_PHOTO,
            anchorPost: HOMELAB_POST,
            // One callout per part of the rack drawing, each linked to the
            // homelab post section that describes it.
            callouts: [
                {
                    key: "tier0",
                    label: "1",
                    title: "Tier 0: the Raspberry Pis",
                    body: "Three Raspberry Pi 5s run Ubuntu Core with MicroCloud. On that cluster: MAAS, Landscape Server, and Docker inside a system container.",
                    part: "tier0",
                    heading: "tier-0-the-raspberry-pis",
                },
                {
                    key: "network",
                    label: "2",
                    title: "Networking",
                    body: "OAM and management traffic, including PXE, uses the 2.5 GbE links; Ceph replication has its own VLAN over the 10 GbE SFP+ uplinks.",
                    part: "network",
                    heading: "networking-where-most-of-the-pain-actually-lives",
                },
                {
                    key: "ms01",
                    label: "3",
                    title: "Tier 2: the MS-01s",
                    body: "Three Minisforum MS-01s run Canonical OpenStack in a hyperconverged topology, with control, compute and storage across all three nodes.",
                    part: "ms01",
                    heading: "tier-2-the-ms-01s",
                },
                {
                    // Owner: the ASUS Ascent is the DGX Spark.
                    key: "ascent",
                    label: "4",
                    title: "The DGX Spark",
                    body: "The ASUS Ascent in the rack is the NVIDIA DGX Spark. It runs MicroK8s with the GPU Operator and time-slicing, and mounts the NAS over NFS.",
                    part: "ascent",
                    heading:
                        "what-lives-outside-the-cluster-nas-and-the-gpu-tier",
                },
                {
                    key: "power",
                    label: "5",
                    title: "Two hundred watts",
                    body: "195.1 W with the rack running normally, not while every CPU is under benchmark load. The whole rack idles at around 200 W.",
                    part: "power",
                    heading: "two-hundred-watts",
                },
            ],
        },
        // The summary and highlights carry the résumé bullets, so the
        // essay summarises the homelab post instead of repeating them.
        body: [
            [
                "Today the lab runs a Canonical OpenStack cluster. Three Raspberry Pi 5s, the only machines installed by hand, run MAAS, which provisions a Dell Inspiron and three Minisforum MS-01s over PXE, so the x86 tier can be rebuilt without plugging in a USB stick.",
            ],
            [
                "A self-built 12 TB NAS stays outside the cluster and out of Ceph, so its data survives a full redeployment. The AI/ML tier is an NVIDIA Jetson Nano and an NVIDIA DGX Spark: the ASUS Ascent in the rack, described in ",
                ["Sharing the DGX Spark GPU with MicroK8s", DGX_SPARK_POST_URL],
                ".",
            ],
            [
                "The whole rack idles at around 200 W. The full write-up is ",
                ["A Homelab Built to Be Rebuilt", "/blog/my-homelab"],
                ".",
            ],
        ],
    },
    {
        // Résumé, project 3.
        slug: "kubernetes-cluster",
        designation: 3,
        title: "Kubernetes cluster with NFS and OIDC",
        summary: KUBERNETES_BULLETS[0],
        types: ["infrastructure"],
        // Owner: done, around 2024–2025 (his estimate).
        status: "completed",
        dates: {
            start: "2024-01-01",
            end: "2025-12-31",
            precision: "year",
            approximate: true,
        },
        technologies: ["Kubernetes", "NFS", "Okta OIDC", "CIS Level 1"],
        highlights: KUBERNETES_BULLETS,
        parameters: [
            { key: "nodes", label: "Nodes", value: "3" },
            {
                key: "downtime",
                label: "Downtime during upgrades",
                value: "Zero",
            },
            { key: "hardening", label: "Hardening", value: "CIS Level 1" },
            { key: "identity", label: "Identity", value: "Okta OIDC" },
        ],
        body: [
            [
                "I built a highly available three-node Kubernetes cluster with zero downtime during upgrades and maintenance.",
            ],
            [
                "I applied CIS Level 1 hardening and integrated Okta OIDC authentication with NFS persistent storage.",
            ],
        ],
    },
    {
        // Résumé, project 4; the repo for the stack and the brief.
        slug: "personal-website",
        designation: 4,
        title: "Personal website and technical notebook",
        summary: WEBSITE_BULLETS[0],
        types: ["software"],
        // Résumé, in the present tense; the site is live.
        status: "active",
        technologies: [
            "Next.js",
            "React",
            "TypeScript",
            "Sanity",
            "Vercel",
            "Tailwind CSS",
        ],
        highlights: WEBSITE_BULLETS,
        parameters: [
            { key: "framework", label: "Framework", value: "Next.js + React" },
            { key: "content", label: "Content", value: "Sanity" },
            { key: "hosting", label: "Hosting", value: "Vercel" },
            { key: "feed", label: "Feed", value: "RSS" },
        ],
        links: [
            {
                key: "repo",
                label: "GitHub repository",
                url: "https://github.com/Adithya-Rajendran/portfolio-website",
                kind: "repo",
            },
            {
                key: "site",
                label: "adithya-rajendran.com",
                url: "https://adithya-rajendran.com",
                kind: "other",
            },
        ],
        brief: {
            problem:
                "Publish Sanity-managed articles and profile content with server-side rendering, for search discoverability and page performance.",
            approach:
                "Next.js and React on Vercel, with the Sanity Studio embedded in the site. A signed Sanity webhook and a daily cron refresh the cached pages by content type, so an edit goes live without a redeploy.",
            outcome:
                "Articles and profile content published from Sanity, with a searchable archive and an RSS feed.",
        },
        // The summary and highlights carry the résumé bullets; the essay
        // says how the site is built, from the repo.
        body: [
            [
                "This site runs on Next.js and React on Vercel. Articles and profile content are edited in a Sanity Studio embedded in the site, and a signed Sanity webhook and a daily cron refresh the cached pages, so an edit goes live without a redeploy.",
            ],
            [
                "The source code is on ",
                [
                    "GitHub",
                    "https://github.com/Adithya-Rajendran/portfolio-website",
                ],
                ".",
            ],
        ],
    },
];
