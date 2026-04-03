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
                <figure className="my-10">
                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-lg glow-cyber">
                        <Image
                            src={imageUrl}
                            alt={value.alt || "Blog post image"}
                            width={1000}
                            height={500}
                            className="w-full h-auto"
                            style={{ objectFit: "scale-down" }}
                            loading="lazy"
                        />
                    </div>
                    {value.caption && (
                        <figcaption className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4 italic">
                            {value.caption}
                        </figcaption>
                    )}
                </figure>
            );
        },
        code: ({ value }) => {
            return (
                <div className="my-8 rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700/50 glow-cyber">
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                            </div>
                            <span className="ml-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                {value.filename || "code"}
                            </span>
                        </div>
                        {value.language && (
                            <span className="text-emerald-600 dark:text-emerald-400 uppercase text-[10px] font-semibold tracking-wider bg-emerald-100 dark:bg-emerald-950/50 px-2 py-1 rounded">
                                {value.language}
                            </span>
                        )}
                    </div>
                    <pre className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm p-5 overflow-x-auto">
                        <code className="font-mono leading-relaxed">{value.code}</code>
                    </pre>
                </div>
            );
        },
    },
    block: {
        h2: ({ children }) => (
            <h2 className="text-3xl sm:text-4xl font-bold mt-16 mb-6 text-balance text-slate-900 dark:text-white relative">
                <span className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-emerald-300 rounded-full hidden sm:block" />
                {children}
            </h2>
        ),
        h3: ({ children }) => (
            <h3 className="text-2xl sm:text-3xl font-bold mt-12 mb-4 text-balance text-slate-900 dark:text-white">
                {children}
            </h3>
        ),
        h4: ({ children }) => (
            <h4 className="text-xl sm:text-2xl font-semibold mt-10 mb-3 text-slate-900 dark:text-white">
                {children}
            </h4>
        ),
        normal: ({ children }) => (
            <p className="my-5 text-base leading-relaxed text-slate-700 dark:text-slate-300">
                {children}
            </p>
        ),
        blockquote: ({ children }) => (
            <blockquote className="relative my-10 pl-8 pr-6 py-6 border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/30 dark:to-transparent rounded-r-xl">
                <svg
                    className="absolute top-4 left-4 w-8 h-8 text-emerald-300/50 dark:text-emerald-600/30"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <div className="relative italic text-slate-700 dark:text-slate-300 text-lg leading-relaxed">
                    {children}
                </div>
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
