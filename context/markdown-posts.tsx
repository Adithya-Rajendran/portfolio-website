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

        const currentDate = new Date().getTime();

        let updatedContent = content;

        //If post date is later than the current date we set the content to Coming Soon
        if (data.date && new Date(data.date).getTime() > currentDate) {
            const formattedDate = `${new Date(data.date).toLocaleDateString()}`;
            updatedContent = `# Coming soon on ${formattedDate}`;
        }

        const post: PostType = {
            slug,
            title: data.title,
            desc: data.desc,
            date: data.date,
            image: data.image,
            content: updatedContent,
        };

        return post;
    } catch (error: any) {
        console.error(`Error reading content for slug '${slug}':`, error);
        throw error;
    }
}

export async function getAllPosts(sorted = true) {
    const slugsmd = await getSlugs();
    const allPostsPromises = slugsmd.map((slug) => getPostContent(slug));
    const allPosts = await Promise.all(allPostsPromises);

    if (sorted) {
        // Sort posts by date in descending order (most recent first)
        const sortedPosts = allPosts.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });

        return sortedPosts;
    } else {
        return allPosts;
    }
}
