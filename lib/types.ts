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

export type SectionName = (typeof links)[number]["name"];

// --- Sanity portfolio types ---

export interface SanityExperienceType {
    _id: string;
    title: string;
    org: string;
    location: string;
    description: string[];
    icon?: SanityImageType;
    date: string;
    order: number;
}

export interface SanityProjectType {
    _id: string;
    title: string;
    description: string;
    tags: string[];
    image: SanityImageType;
    linkTitle?: string;
    linkUrl?: string;
    order: number;
}

export interface SanityCertificationType {
    _id: string;
    title: string;
    org: string;
    startDate: string;
    endDate?: string;
    badge: SanityImageType;
    verifyUrl: string;
    order: number;
}

export interface SanitySkillCategoryType {
    _id: string;
    title: string;
    slug: string;
    skills: string[];
    colorVariant: "emerald" | "cyan" | "violet";
    order: number;
}

export interface SanityAboutType {
    _id: string;
    body: PortableTextBlock[];
}
