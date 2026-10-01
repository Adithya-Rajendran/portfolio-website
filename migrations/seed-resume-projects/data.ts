/**
 * The four résumé projects ("Selected projects" in the résumé PDF), drafted
 * for the owner to review, correct and publish in the Studio. Nothing here is
 * invented: every value comes from one of these sources, named next to it.
 *
 * - Résumé: the résumé PDF served at /resume/view (uploaded 2026-09-24).
 * - Homelab post: "A Homelab Built to Be Rebuilt" (/blog/my-homelab).
 * - Owner: the owner's answers of 2026-09-28. The Gmail filter and the
 *   Kubernetes cluster are done (the cluster with years he estimated,
 *   c. 2024–2025); the homelab and this website are active; the ASUS Ascent
 *   in the rack is the NVIDIA DGX Spark of "Sharing the DGX Spark GPU with
 *   MicroK8s" (/blog/kubernetes-on-the-nvidia-dgx-spark).
 * - Published: the owner's corrections, as published on 2026-09-29. The
 *   Gmail project is described as the experiment it is, with the training
 *   notebook's evaluation on one held-out split in place of the résumé's
 *   "90%" (github.com/Adithya-Rajendran/Gmail-Filter, train-model.ipynb),
 *   and dated from the repository (December 2022 to August 2025). The
 *   homelab leads with rebuildability and shows no measurements that are
 *   not on the résumé.
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
 * again. The alt text is the post's own, as published on 2026-09-28. The
 * migration checks that the asset is still in that post and leaves the field
 * out when it is not.
 */
export type SeedImage = {
    post: string;
    asset: string;
    alt: string;
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

/**
 * The rack photo in the homelab post: the 3D model's poster. No project is
 * seeded with a cover: the owner picks one in the Studio (IMPLEMENTATION.md
 * §3.10), because the current project page prints a cover uncropped above
 * the essay and this photo is a tall portrait.
 */
const RACK_PHOTO: SeedImage = {
    post: HOMELAB_POST,
    asset: "image-05754647a9226f0938def18645edaef5169c8aec-3000x4000-jpg",
    alt: "Server rack with three Minisforum MS-01 systems and an ASUS Ascent.",
};

// Published (2026-09-29): the Gmail project's corrected highlights.
const GMAIL_HIGHLIGHTS = [
    "Built a Python service on the Gmail API that fetches incoming mail and applies allowlists, wildcard blocklists and a quarantine label.",
    "Added a TF-IDF and multilayer-perceptron classifier trained on the CEAS-08 corpus: 99.55% accuracy on one stratified, held-out split of 7,831 messages.",
];
const GMAIL_NOTEBOOK =
    "https://github.com/Adithya-Rajendran/Gmail-Filter/blob/main/train-model.ipynb";

// Résumé bullets, verbatim.
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
        // Résumé, project 1, as the owner corrected and published it
        // (2026-09-29): an experiment, with the notebook's evaluation.
        slug: "gmail-spam-filter",
        designation: 1,
        title: "Experimental Gmail spam classifier",
        summary:
            "A Python service on the Gmail API that filters incoming mail with allowlists, blocklists and a quarantine label, extended in 2025 with a TF-IDF and multilayer-perceptron classifier trained on the CEAS-08 email corpus.",
        types: ["software"],
        // Published: done; the repository runs from December 2022 (the
        // first version) to August 2025 (the classifier).
        status: "completed",
        dates: {
            start: "2022-12-01",
            end: "2025-08-31",
            precision: "month",
            approximate: false,
        },
        technologies: [
            "Python",
            "Gmail API",
            "scikit-learn",
            "TF-IDF",
            "MLP",
            "Docker",
        ],
        highlights: GMAIL_HIGHLIGHTS,
        parameters: [
            { key: "accuracy", label: "Held-out accuracy", value: "99.55%" },
            { key: "test", label: "Test messages", value: "7,831" },
            { key: "fp", label: "False positives", value: "15" },
        ],
        // The training notebook's evaluation, with its limits in the note.
        results: [
            {
                key: "accuracy",
                metric: "Held-out accuracy",
                value: "99.55%",
                note: "CEAS-08, one stratified 80/20 split (31,323 training / 7,831 test messages), no fixed random seed, no baseline comparison.",
            },
            {
                key: "fp",
                metric: "Legitimate mail marked as spam",
                value: "15 of 3,462",
            },
            { key: "fn", metric: "Spam missed", value: "20 of 4,369" },
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
                "The first version, built in December 2022, is a Python service on the Gmail API. It fetches incoming mail and sorts it with allowlists, wildcard blocklists and a quarantine label, and runs in Docker.",
            ],
            [
                "In August 2025 I added a machine-learning classifier: TF-IDF features over the 5,000 most frequent terms, feeding a multilayer perceptron with two hidden layers of 100 and 50 units, trained on the CEAS-08 email corpus. On one stratified 80/20 split it classified 99.55% of the 7,831 held-out messages correctly, marking 15 of 3,462 legitimate messages as spam and missing 20 of 4,369 spam messages.",
            ],
            [
                "That result comes from a single split of a public corpus, without a fixed random seed or a baseline model, so it describes this experiment rather than performance on a live inbox. The ",
                ["training notebook", GMAIL_NOTEBOOK],
                " records the full evaluation.",
            ],
        ],
    },
    {
        // Résumé, project 2; the homelab post for everything past the
        // résumé bullets. The flagship: it has the photos and the rack model.
        slug: "homelab",
        designation: 2,
        title: "Homelab with segmented networks and high availability",
        // Published (2026-09-29): the summary leads with rebuildability.
        summary:
            "A personal cloud built to be rebuilt: bare-metal provisioning over PXE, segmented networking, and storage kept outside the cluster, so the lab can be wiped and redeployed without losing data.",
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
        // No parameters or results: the résumé states no measurements for
        // the homelab, and the site shows none that it does not.
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
                "The lab runs Canonical OpenStack, hyperconverged across the three MS-01s. The x86 tier can be rebuilt over PXE without a USB stick, and the NAS stays outside Ceph, so its data survives a full redeployment.",
        },
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
                    title: "Power",
                    body: "The rack's power distribution for every tier.",
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
                "The NAS stays outside the cluster and out of Ceph, so its data survives a full redeployment. The AI/ML tier is an NVIDIA Jetson Nano and an NVIDIA DGX Spark: the ASUS Ascent in the rack, described in ",
                ["Sharing the DGX Spark GPU with MicroK8s", DGX_SPARK_POST_URL],
                ".",
            ],
            [
                "The full write-up, including where the network has failed and what that taught me, is ",
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
