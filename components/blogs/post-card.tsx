import Image from "next/image";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Post as TPost } from "@/sanity.types";
import {
    formatDate,
    getPostImageUrl,
    getPostSlug,
    readingTimeFor,
    POST_IMAGE_DIMENSIONS,
} from "./utils";

export type PostCardVariant = "hero" | "medium" | "side" | "list";

interface PostCardProps {
    post: TPost;
    /**
     * hero   — full-width featured lead card
     * medium — half-width featured card (2-up grid)
     * side   — compact featured card (3-up grid)
     * list   — archive grid card (lazy image, clamped title)
     */
    variant?: PostCardVariant;
}

interface VariantConfig {
    image: { width: number; height: number; sizes: string };
    aspect: string;
    pad: string;
    title: string;
    desc: string;
    clampTitle: boolean;
    eager: boolean;
    priority: boolean;
    overlay: boolean;
}

const variants: Record<PostCardVariant, VariantConfig> = {
    hero: {
        image: {
            ...POST_IMAGE_DIMENSIONS.hero,
            sizes: "(max-width: 768px) 100vw, 1200px",
        },
        aspect: "aspect-[2/1] sm:aspect-[21/9]",
        pad: "p-6 sm:p-8 md:p-10",
        title: "text-2xl sm:text-3xl md:text-4xl tracking-tight",
        desc: "text-base sm:text-lg line-clamp-3",
        clampTitle: false,
        eager: true,
        priority: true,
        overlay: true,
    },
    medium: {
        image: {
            ...POST_IMAGE_DIMENSIONS.medium,
            sizes: "(max-width: 768px) 100vw, 50vw",
        },
        aspect: "aspect-[16/10]",
        pad: "p-6 sm:p-7",
        title: "text-xl sm:text-2xl tracking-tight",
        desc: "text-sm line-clamp-2",
        clampTitle: false,
        eager: true,
        priority: false,
        overlay: true,
    },
    side: {
        image: {
            ...POST_IMAGE_DIMENSIONS.side,
            sizes: "(max-width: 768px) 100vw, 33vw",
        },
        aspect: "aspect-[16/10]",
        pad: "p-5 sm:p-6",
        title: "text-base sm:text-lg",
        desc: "text-sm line-clamp-2",
        clampTitle: false,
        eager: true,
        priority: false,
        overlay: true,
    },
    list: {
        image: {
            ...POST_IMAGE_DIMENSIONS.list,
            sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
        },
        aspect: "aspect-[5/3]",
        pad: "p-5 sm:p-6",
        title: "text-base sm:text-lg",
        desc: "text-sm line-clamp-2",
        clampTitle: true,
        eager: false,
        priority: false,
        overlay: false,
    },
};

/**
 * Shared blog post card — one implementation of the card body (image,
 * date + reading-time meta row, title, clamped description) used by both
 * the featured grid and the archive list. Surface styling (os-card +
 * os-hover, radius) comes from the Card primitive.
 */
export default function PostCard({ post, variant = "list" }: PostCardProps) {
    const v = variants[variant];
    const slug = getPostSlug(post);
    const title = post.title || "";
    const readingTime = readingTimeFor(post);
    const imageUrl = getPostImageUrl(post, v.image.width, v.image.height);

    return (
        <Card
            href={`/blogs/${slug}`}
            aria-label={`Read more about ${title}`}
            title={`Read more about ${title}`}
            flush
            className="flex flex-col h-full"
        >
            {imageUrl && (
                <div className={`relative overflow-hidden ${v.aspect}`}>
                    <Image
                        src={imageUrl}
                        alt={post.image?.alt || title}
                        fill
                        sizes={v.image.sizes}
                        loading={v.eager ? "eager" : "lazy"}
                        priority={v.priority}
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    {v.overlay && (
                        <div
                            aria-hidden
                            className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                        />
                    )}
                </div>
            )}
            <div className={`flex-1 flex flex-col ${v.pad}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-2 flex items-center gap-2 flex-wrap">
                    {post.date && <span>{formatDate(post.date)}</span>}
                    {post.date && (
                        <span
                            aria-hidden
                            className="w-1 h-1 rounded-full bg-accent opacity-50"
                        />
                    )}
                    <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {readingTime} min read
                    </span>
                </p>
                <h3
                    className={`font-display font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-accent transition-colors ${v.title}${v.clampTitle ? " line-clamp-2" : ""}`}
                >
                    {title}
                </h3>
                {post.description && (
                    <p
                        className={`mt-2 text-slate-600 dark:text-slate-400 ${v.desc}`}
                    >
                        {post.description}
                    </p>
                )}
            </div>
        </Card>
    );
}
