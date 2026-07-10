import type { Post } from "@/sanity.types";

/**
 * Dev-only fixture content for working on the blog without Sanity
 * credentials (sandboxed environments, visual work, screenshot tooling).
 *
 * Activation requires BOTH:
 *   1. SANITY_USE_FIXTURES=1 in the environment, and
 *   2. Sanity NOT configured (the `isSanityConfigured` gate) — the
 *      resolver is only consulted on the fallback path in
 *      lib/sanity-client.ts, so a deployment with real credentials can
 *      never serve fixtures regardless of env flags.
 */

export function fixturesEnabled(): boolean {
    return process.env.SANITY_USE_FIXTURES === "1";
}

// ---- Portable Text builders (keys must be unique per document) ----

let keyCounter = 0;
const key = () => `fx${(keyCounter++).toString(36)}`;

type Span = { _type: "span"; _key: string; text: string; marks: string[] };
type MarkDef = { _key: string; _type: string; href?: string };

function span(text: string, marks: string[] = []): Span {
    return { _type: "span", _key: key(), text, marks };
}

function block(
    style: "normal" | "h2" | "h3" | "h4" | "blockquote",
    children: Span[],
    markDefs: MarkDef[] = [],
    listItem?: "bullet" | "number",
) {
    return {
        _type: "block" as const,
        _key: key(),
        style,
        markDefs,
        children,
        ...(listItem ? { listItem, level: 1 } : {}),
    };
}

const p = (text: string) => block("normal", [span(text)]);
const h2 = (text: string) => block("h2", [span(text)]);
const h3 = (text: string) => block("h3", [span(text)]);
const bullet = (text: string) => block("normal", [span(text)], [], "bullet");

function code(
    language: string,
    codeText: string,
    filename?: string,
    highlightedLines?: number[],
) {
    return {
        _type: "code" as const,
        _key: key(),
        language,
        ...(filename ? { filename } : {}),
        ...(highlightedLines ? { highlightedLines } : {}),
        code: codeText,
    };
}

// ---- Fixture posts ----

const inferenceBody = [
    p(
        "Running large language models on hardware you own changes how you think about inference. There is no per-token bill, no rate limit, and no data leaving the rack — but every gigabyte of VRAM suddenly matters, and the scheduler becomes your problem.",
    ),
    p(
        "This post walks through the cluster I run at home: three GPU nodes on Kubernetes, vLLM for serving, and a routing layer that keeps the small models hot while paging the big ones in on demand.",
    ),
    h2("Hardware and topology"),
    p(
        "The cluster is deliberately boring: consumer GPUs, used enterprise CPUs, and a flat 10GbE network. Boring is what you want at 2 a.m. when a node drops.",
    ),
    bullet("3× nodes with a 24 GB GPU each (two RTX 3090s, one 4090)"),
    bullet("128 GB RAM per node, NVMe scratch for model weights"),
    bullet("10GbE with jumbo frames; weights sync via a local registry"),
    block("blockquote", [
        span(
            "Rule of thumb: if a model doesn't fit in one node's VRAM with headroom for the KV cache, serve a quantized variant instead of sharding. Tensor parallelism over consumer networking is pain.",
        ),
    ]),
    h2("Serving layer"),
    p(
        "Each model gets a vLLM deployment pinned to a GPU class via node labels. The interesting part is the pod spec — the scheduler needs to know GPUs are whole-device resources:",
    ),
    code(
        "yaml",
        `apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-qwen-32b
  namespace: inference
spec:
  replicas: 1
  template:
    spec:
      nodeSelector:
        gpu.class: "24gb"
      containers:
        - name: vllm
          image: registry.lan/vllm:v0.8.4
          args:
            - --model=/models/qwen-32b-awq
            - --max-model-len=16384
            - --gpu-memory-utilization=0.92
          resources:
            limits:
              nvidia.com/gpu: 1`,
        "vllm-qwen.deploy.yaml",
        [9, 10, 17],
    ),
    h3("Why gpu-memory-utilization matters"),
    p(
        "vLLM pre-allocates the KV cache from whatever fraction you hand it. Set it too high and the first burst of long prompts OOMs the node; too low and you are wasting the VRAM you bought the card for. 0.92 has been stable for months on the 3090s.",
    ),
    h2("Routing and warm starts"),
    p(
        "A tiny gateway maps model names to services and tracks which deployments are scaled to zero. Cold starts are dominated by weight loading, so the gateway streams a queue position while the pod pulls from the local registry:",
    ),
    code(
        "python",
        `async def route(request: InferenceRequest) -> StreamingResponse:
    backend = registry.lookup(request.model)
    if backend.replicas == 0:
        await scaler.scale_up(backend, replicas=1)
        async for tick in scaler.wait_ready(backend):
            yield status_event(position=tick.queue_depth)
    async for chunk in backend.stream(request):
        yield chunk`,
        "gateway/router.py",
    ),
    h3("Measuring what matters"),
    p(
        "Track time-to-first-token and tokens-per-second separately. TTFT is a scheduling and cache story; TPS is a quantization and batching story. Conflating them hides regressions.",
    ),
    h2("What I would do differently"),
    p(
        "Start with the registry. Pulling 20 GB of weights from the internet on every reschedule was the single biggest source of downtime until the local mirror existed.",
    ),
];

const zeroTrustBody = [
    p(
        "The homelab perimeter is a lie the moment you port-forward anything. This post covers moving every internal service behind mutual TLS and identity-aware access, without buying anything.",
    ),
    h2("The problem with flat networks"),
    p(
        "One compromised container on a flat VLAN can reach the NAS, the hypervisor API, and the IoT junk drawer. Segmentation by VLAN alone stops lateral movement about as well as a polite note.",
    ),
    h2("Identity at the edge"),
    p(
        "Every request crosses an authenticating proxy before it reaches a service:",
    ),
    code(
        "bash",
        `# Issue a short-lived client certificate bound to a device
step ca certificate "laptop.adithya" laptop.crt laptop.key \\
  --not-after 24h --san laptop.lan`,
        undefined,
    ),
    h3("Service-to-service"),
    p(
        "Sidecar-free mTLS between services, with SPIFFE-style identities mapped to workloads. The CA rotates intermediates monthly; leaf certs live for a day.",
    ),
];

const openstackBody = [
    p(
        "Everyone says three nodes is too few for OpenStack. Here is the three-node control plane that has survived two disk failures and a power cut anyway.",
    ),
    h2("Layout"),
    bullet("Every node runs control plane + compute (converged)"),
    bullet("Galera for MySQL, RabbitMQ mirrored queues, OVN for networking"),
    p(
        "The trick is admitting it is a lab: you trade N+2 redundancy for power draw you can actually afford.",
    ),
];

/** Slugs are stable so screenshots and manual testing are repeatable. */
export const FIXTURE_POSTS: Post[] = [
    {
        _id: "fixture-1",
        _type: "post",
        _createdAt: "2026-06-26T00:00:00Z",
        _updatedAt: "2026-06-26T00:00:00Z",
        _rev: "fixture",
        title: "Self-hosting LLM inference on a three-node Kubernetes cluster",
        slug: { _type: "slug", current: "self-hosted-ai-inference-cluster" },
        description:
            "vLLM, GPU scheduling, and a routing layer that keeps small models hot while paging the big ones in on demand — a tour of my home inference cluster.",
        date: "2026-06-26",
        featured: true,
        tags: ["ai-infra", "kubernetes", "homelab"],
        body: inferenceBody as unknown as Post["body"],
    },
    {
        _id: "fixture-2",
        _type: "post",
        _createdAt: "2026-06-12T00:00:00Z",
        _updatedAt: "2026-06-12T00:00:00Z",
        _rev: "fixture",
        title: "Zero-trust for the homelab: mTLS everywhere, no budget",
        slug: { _type: "slug", current: "zero-trust-homelab-network" },
        description:
            "Moving every internal service behind mutual TLS and identity-aware proxies — segmentation that actually stops lateral movement.",
        date: "2026-06-12",
        featured: false,
        tags: ["security", "homelab", "networking"],
        body: zeroTrustBody as unknown as Post["body"],
    },
    {
        _id: "fixture-3",
        _type: "post",
        _createdAt: "2026-05-29T00:00:00Z",
        _updatedAt: "2026-05-29T00:00:00Z",
        _rev: "fixture",
        title: "A three-node OpenStack that refuses to die",
        slug: { _type: "slug", current: "openstack-on-three-nodes" },
        description:
            "The converged control plane layout that survived two disk failures and a power cut, and where it cheats on redundancy.",
        date: "2026-05-29",
        featured: false,
        tags: ["openstack", "homelab"],
        body: openstackBody as unknown as Post["body"],
    },
];

function wordCount(post: Post): number {
    return (post.body ?? [])
        .flatMap((b) =>
            "children" in b && Array.isArray(b.children)
                ? b.children.map((c) =>
                      "text" in c ? String(c.text ?? "") : "",
                  )
                : [],
        )
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length;
}

const slugOf = (post: Post) =>
    typeof post.slug === "object" ? (post.slug?.current ?? "") : "";

/**
 * Answer the known GROQ queries from fixtures. Matching is on structural
 * markers of the query strings in lib/sanity-client.ts — crude, but this
 * path only exists behind the double guard above and returning null just
 * falls through to the normal empty fallback.
 */
export function resolveFixtureQuery<T>(
    query: string,
    params: Record<string, unknown>,
): T | null {
    if (!query.includes('_type == "post"')) return null;

    const posts = FIXTURE_POSTS;

    // getPostBySlug / getPostMeta — single doc by $slug
    if (query.includes("slug.current == $slug")) {
        const match =
            posts.find((post) => slugOf(post) === params.slug) ?? null;
        if (!match) return null;
        if (query.includes("body")) return match as unknown as T;
        return {
            title: match.title,
            slug: slugOf(match),
            description: match.description,
            date: match.date,
            tags: match.tags,
            image: match.image,
        } as unknown as T;
    }

    // getAllSlugsWithDates (sitemap)
    if (query.includes("_updatedAt")) {
        return posts.map((post) => ({
            slug: slugOf(post),
            updatedAt: post._updatedAt,
        })) as unknown as T;
    }

    // getAllSlugs (generateStaticParams)
    if (query.includes(".slug.current")) {
        return posts.map(slugOf) as unknown as T;
    }

    // getRecentPostsWithBody (feed) — slice + full bodies
    if (query.includes("[0...")) {
        return posts.map((post) => ({
            _id: post._id,
            title: post.title,
            slug: slugOf(post),
            description: post.description,
            date: post.date,
            body: post.body,
        })) as unknown as T;
    }

    // getAllPosts (index/archive/tags) — list shape with wordCount
    if (query.includes("wordCount")) {
        return posts.map((post) => ({
            _id: post._id,
            title: post.title,
            slug: slugOf(post),
            description: post.description,
            date: post.date,
            featured: post.featured,
            tags: post.tags,
            image: post.image,
            wordCount: wordCount(post),
        })) as unknown as T;
    }

    return null;
}
