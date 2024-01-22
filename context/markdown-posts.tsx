"use server";

import fs from "fs/promises";
import path from "path";
import { PostType } from "@/lib/types";
import matter from "gray-matter";

const postsFolder = path.join(process.cwd(), "posts");

async function getPosts() {
    try {
        const files = await fs.readdir(postsFolder);
        const markdownPosts = files.filter((file) => file.endsWith(".md"));
        return markdownPosts;
    } catch (error) {
        console.error("Error reading posts folder:", error);
        throw error;
    }
}

export async function getSlugs() {
    try {
        const markdownPosts = await getPosts();
        const slugs = markdownPosts.map(
            (fileName) => path.parse(fileName).name
        );
        return slugs;
    } catch (error) {
        console.error("Error getting slugs:", error);
        throw error;
    }
}

export async function getPostContent(slug: string) {
    try {
        const filePath = path.join(postsFolder, `${slug}.md`);
        const fileContent = await fs.readFile(filePath, "utf-8");
        const { data, content } = matter(fileContent);

        const post: PostType = {
            slug,
            title: data.title,
            desc: data.desc,
            date: data.date,
            content,
        };

        return post;
    } catch (error: any) {
        console.error(`Error reading content for slug '${slug}':`, error);
        throw error;
    }
}
