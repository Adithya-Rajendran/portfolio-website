import React, { ReactNode, FunctionComponent, HTMLAttributes } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Components } from "react-markdown";
import Image from "next/image";
import Link from "next/link";
import { getImageData } from "@/context/markdown-posts";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
    children: ReactNode;
}

const Heading: Record<string, FunctionComponent<HeadingProps>> = {
    H1: ({ children }: HeadingProps) => (
        <h1 className="text-4xl font-bold">{children}</h1>
    ),
    H2: ({ children }: HeadingProps) => (
        <h2 className="text-3xl font-bold">{children}</h2>
    ),
    H3: ({ children }: HeadingProps) => (
        <h2 className="text-2xl font-bold">{children}</h2>
    ),
    H4: ({ children }: HeadingProps) => (
        <h2 className="text-xl font-bold">{children}</h2>
    ),
    H5: ({ children }: HeadingProps) => (
        <h2 className="text-l font-bold">{children}</h2>
    ),
};

function Para({
    children,
    ...props
}: { children: ReactNode } & HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p className="my-1 text-base" {...props}>
            {children}
        </p>
    );
}

function ListItem({
    children,
    ...props
}: { children: ReactNode } & HTMLAttributes<HTMLLIElement>) {
    return (
        <li className="list-disc ml-4" {...props}>
            {children}
        </li>
    );
}

function UnorderedList({
    children,
    ...props
}: { children: ReactNode } & HTMLAttributes<HTMLUListElement>) {
    return (
        <ul className="list-disc my-4" {...props}>
            {children}
        </ul>
    );
}

function OrderedList({
    children,
    ...props
}: { children: ReactNode } & HTMLAttributes<HTMLOListElement>) {
    return (
        <ol className="list-decimal my-4" {...props}>
            {children}
        </ol>
    );
}

interface ImageProps extends HTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    width: number;
    height: number;
}

async function ImageComponent({
    src,
    alt,
    width,
    height,
    ...props
}: ImageProps) {
    let image: string | undefined = src;
    if (src.startsWith("images/")) {
        image = await getImageData(src);
    }

    return image ? (
        <Image
            src={image}
            alt={alt}
            width="1000"
            height="500"
            loading="lazy"
            {...props}
        />
    ) : (
        <div>No image available</div>
    );
}

interface LinkProps extends HTMLAttributes<HTMLAnchorElement> {
    href: string;
    children: ReactNode;
}

function LinkComponent({ href, children, ...props }: LinkProps) {
    return (
        <a
            href={href}
            className="text-blue-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
        >
            {children}
        </a>
    );
}

function CodeBlock({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");

    return !inline && match ? (
        <SyntaxHighlighter
            style={atomDark}
            language={match[1]}
            PreTag="div"
            {...props}
        >
            {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
    ) : (
        <span
            className={`text-red-300 bg-gray-700 dark:bg-black rounded-md px-1.5 ${className}`}
            {...props}
        >
            {children}
        </span>
    );
}

export const components: Components = {
    h1: Heading.H1 as any,
    h2: Heading.H2 as any,
    h3: Heading.H3 as any,
    h4: Heading.H4 as any,
    h5: Heading.H5 as any,
    p: Para as any,
    li: ListItem as any,
    ul: UnorderedList as any,
    ol: OrderedList as any,
    img: ImageComponent as any,
    a: LinkComponent as any,
    code: CodeBlock as any,
};
