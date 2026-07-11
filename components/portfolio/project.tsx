import Image from "next/image";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { urlForImage } from "@/lib/sanity-image";
import type { Project as TProject } from "@/sanity.types";

/**
 * Project card, terminal-tempered: opaque surface with a hairline
 * border (no glass), display-face title, Inter description, mono
 * bracket link, and mono bracket tag chips (same anatomy as
 * components/blogs/tag-chips.tsx, minus the links — project tags
 * aren't pages).
 *
 * Server component — the reveal is the shared RevealOnScroll client
 * wrapper; the card markup itself ships no hydration JS.
 */
export default function Project({
    title,
    description,
    tags,
    image,
    linkTitle,
    linkUrl,
}: TProject) {
    const imageUrl = image
        ? urlForImage(image).width(900).quality(95).url()
        : null;

    return (
        <RevealOnScroll className="w-full">
            <article className="group relative h-full flex flex-col overflow-hidden rounded-card border border-slate-400/30 dark:border-white/10 bg-white dark:bg-[#0b0d10]">
                {imageUrl && (
                    <div className="relative aspect-[16/10] overflow-hidden border-b border-slate-400/25 dark:border-white/10">
                        <Image
                            src={imageUrl}
                            alt={image?.alt || `Screenshot of ${title || ""}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px"
                            loading="lazy"
                            className="object-cover saturate-[0.92] transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                        />
                    </div>
                )}
                <div className="flex flex-col flex-1 p-6 sm:p-7">
                    <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                        {title || ""}
                    </h3>
                    {description && (
                        <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">
                            {description}
                        </p>
                    )}
                    {linkTitle && linkUrl && (
                        <a
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex w-fit font-term text-sm font-bold text-accent hover:opacity-80 transition-opacity"
                        >
                            <span aria-hidden>[ </span>
                            {linkTitle} ↗<span aria-hidden> ]</span>
                        </a>
                    )}
                    {tags && tags.length > 0 && (
                        <ul
                            className="flex flex-wrap mt-5 gap-x-4 gap-y-2 sm:mt-auto sm:pt-5"
                            aria-label="Related skills"
                        >
                            {tags.map((tag, index) => (
                                <li
                                    key={index}
                                    className="font-term text-[0.8rem] whitespace-nowrap text-slate-600 dark:text-slate-400"
                                >
                                    <span aria-hidden>[ </span>
                                    {tag}
                                    <span aria-hidden> ]</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </article>
        </RevealOnScroll>
    );
}
