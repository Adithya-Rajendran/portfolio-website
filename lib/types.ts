import { StaticImageData } from "next/image";
import { links } from "./data";
import type { PortableTextBlock } from "@portabletext/react";

// Legacy PostType for backward compatibility with GitHub markdown posts
export interface PostType {
    slug: string;
    title: string;
    desc: string;
    date: string;
    image: string;
    content: string;
}

// Sanity image reference
export interface SanityImageType {
    _type: "image";
    asset: {
        _ref: string;
        _type: "reference";
    };
    hotspot?: {
        x: number;
        y: number;
        height: number;
        width: number;
    };
    alt?: string;
}

// Sanity blog post type
export interface SanityPostType {
    slug: string;
    title: string;
    description: string;
    date: string;
    featured?: boolean;
    image?: SanityImageType;
    body?: PortableTextBlock[];
}

export interface ExperienceType {
    title: string;
    org: string;
    location: string;
    description: string[];
    icon: React.ReactElement;
    date: string;
}

export interface ProjectType {
    title: string;
    description: string;
    tags: string[];
    imageUrl: StaticImageData | string;
    link?: {
        title: string;
        link: string;
    };
}

export interface CertificateType {
    title: string;
    org: string;
    startDate: string;
    endDate: string | undefined;
    badge: StaticImageData | string;
    verify: string;
}

export type SectionName = (typeof links)[number]["name"];
