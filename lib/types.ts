import { links } from "./data";

export interface PostType {
    slug: string;
    title: string;
    desc: string;
    date: string;
    image: string;
    content: string;
}

export type SectionName = (typeof links)[number]["name"];
