"use server";

import fs from "fs/promises";
import path from "path";

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
        const content = await fs.readFile(filePath, "utf-8");
        return content;
    } catch (error: any) {
        if (error.code === "ENOENT") {
            // File not found error, treat as invalid slug
            return "404 Not Found";
        } else {
            console.error(`Error reading content for slug '${slug}':`, error);
            throw error;
        }
    }
}
