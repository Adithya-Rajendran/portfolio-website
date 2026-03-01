import Image from "next/image";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
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
            const language = value.language || "text";
            return (
                <div className="my-4">
                    {value.filename && (
                        <div className="bg-slate-800 text-slate-400 text-xs px-4 py-2 rounded-t-md border-b border-slate-700">
                            {value.filename}
                        </div>
                    )}
                    <SyntaxHighlighter
                        style={atomDark}
                        language={language}
                        PreTag="div"
                        wrapLines={true}
                        wrapLongLines={true}
                        customStyle={{
                            marginTop: value.filename ? 0 : undefined,
                            borderTopLeftRadius: value.filename ? 0 : undefined,
                            borderTopRightRadius: value.filename
                                ? 0
                                : undefined,
                        }}
                    >
                        {value.code}
                    </SyntaxHighlighter>
                </div>
            );
        },
    },
    block: {
        h2: ({ children }) => (
            <h2 className="text-3xl font-bold mt-8 mb-4">{children}</h2>
        ),
        h3: ({ children }) => (
            <h3 className="text-2xl font-bold mt-6 mb-3">{children}</h3>
        ),
        h4: ({ children }) => (
            <h4 className="text-xl font-bold mt-4 mb-2">{children}</h4>
        ),
        normal: ({ children }) => (
            <p className="my-1 text-base">{children}</p>
        ),
        blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-500 pl-4 my-4 italic text-slate-600 dark:text-slate-400">
                {children}
            </blockquote>
        ),
    },
    marks: {
        strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
            <span className="text-emerald-300 dark:text-emerald-400 bg-slate-900 dark:bg-slate-800 rounded-md px-1.5">
                {children}
            </span>
        ),
        underline: ({ children }) => <u>{children}</u>,
        "strike-through": ({ children }) => <s>{children}</s>,
        link: ({ children, value }) => {
            const href = value?.href || "";
            const isExternal =
                href.startsWith("http://") || href.startsWith("https://");
            return (
                <a
                    href={href}
                    className="text-emerald-600 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
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
            <ul className="list-disc my-4 ml-4">{children}</ul>
        ),
        number: ({ children }) => (
            <ol className="list-decimal my-4 ml-4">{children}</ol>
        ),
    },
    listItem: {
        bullet: ({ children }) => (
            <li className="list-disc ml-4">{children}</li>
        ),
        number: ({ children }) => (
            <li className="list-decimal ml-4">{children}</li>
        ),
    },
};
