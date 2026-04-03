import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { PortableTextComponents } from "@portabletext/react";

export const portableTextComponents: PortableTextComponents = {
    types: {
        image: ({ value }) => {
            if (!value?.asset?._ref) return null;
            const imageUrl = urlForImage(value)
                .width(1000)
                .fit("max")
                .auto("format")
                .url();
            return (
                <figure className="my-6">
                    <Image
                        src={imageUrl}
                        alt={value.alt || "Blog post image"}
                        width={1000}
                        height={500}
                        className="rounded-lg"
                        style={{ objectFit: "scale-down" }}
                        loading="lazy"
                    />
                    {value.caption && (
                        <figcaption className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
                            {value.caption}
                        </figcaption>
                    )}
                </figure>
            );
        },
        code: ({ value }) => {
            return (
                <div className="my-6">
                    <div className="bg-slate-800 text-slate-400 text-xs px-4 py-2 rounded-t-md border-b border-slate-700 font-mono flex items-center justify-between">
                        <span>{value.filename || "Code"}</span>
                        {value.language && (
                            <span className="text-emerald-400 uppercase text-[10px] font-semibold tracking-wider">
                                {value.language}
                            </span>
                        )}
                    </div>
                    <pre className="bg-slate-900 text-slate-100 text-sm p-4 overflow-x-auto rounded-b-md border border-t-0 border-slate-700">
                        <code className="font-mono">{value.code}</code>
                    </pre>
                </div>
            );
        },
    },
    block: {
        h2: ({ children }) => (
            <h2 className="text-4xl font-bold mt-12 mb-6 text-balance text-slate-900 dark:text-white">
                {children}
            </h2>
        ),
        h3: ({ children }) => (
            <h3 className="text-3xl font-bold mt-10 mb-4 text-balance text-slate-900 dark:text-white">
                {children}
            </h3>
        ),
        h4: ({ children }) => (
            <h4 className="text-2xl font-bold mt-8 mb-3 text-slate-900 dark:text-white">
                {children}
            </h4>
        ),
        normal: ({ children }) => (
            <p className="my-5 text-base leading-relaxed text-slate-700 dark:text-slate-300">
                {children}
            </p>
        ),
        blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-500 pl-6 my-6 italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 py-4 rounded-r-lg">
                {children}
            </blockquote>
        ),
    },
    marks: {
        strong: ({ children }) => (
            <strong className="font-bold text-slate-900 dark:text-white">
                {children}
            </strong>
        ),
        em: ({ children }) => <em className="italic text-slate-700 dark:text-slate-300">{children}</em>,
        code: ({ children }) => (
            <code className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-md px-2 py-1 font-mono text-sm border border-emerald-200 dark:border-emerald-900">
                {children}
            </code>
        ),
        underline: ({ children }) => <u className="underline decoration-2">{children}</u>,
        "strike-through": ({ children }) => <s className="line-through text-slate-500">{children}</s>,
        link: ({ children, value }) => {
            const href = value?.href || "";
            const isExternal =
                href.startsWith("http://") || href.startsWith("https://");
            return (
                <a
                    href={href}
                    className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline decoration-1 underline-offset-2 transition-colors"
                    {...(isExternal
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                >
                    {children}
                </a>
            );
        },
    },
    list: {
        bullet: ({ children }) => (
            <ul className="list-disc my-6 ml-6 space-y-3 text-slate-700 dark:text-slate-300">
                {children}
            </ul>
        ),
        number: ({ children }) => (
            <ol className="list-decimal my-6 ml-6 space-y-3 text-slate-700 dark:text-slate-300">
                {children}
            </ol>
        ),
    },
    listItem: {
        bullet: ({ children }) => (
            <li className="ml-2 leading-relaxed">{children}</li>
        ),
        number: ({ children }) => (
            <li className="ml-2 leading-relaxed">{children}</li>
        ),
    },
};
