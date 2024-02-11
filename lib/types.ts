import { StaticImageData } from "next/image";
import { links } from "./data";

export interface PostType {
    slug: string;
    title: string;
    desc: string;
    date: string;
    image: string;
    content: string;
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
