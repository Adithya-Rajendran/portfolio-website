"use server";

import path from "path";
import { PostType } from "@/lib/types";
import matter from "gray-matter";

const repoOwner = process.env.GITHUB_NAME;
const repoName = process.env.GITHUB_REPO;
const folderPath = process.env.GITHUB_PATH;
const accessToken = process.env.GITHUB_TOKEN;

async function getPosts(): Promise<string[]> {
    // Fetch list of files in the folder from GitHub API
    const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folderPath}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            next: {
                revalidate: 3600,
            },
        }
    );

    if (response.ok) {
        const data = await response.json();
        // Extract file names from the response
        const fileNames = data.map((file: any) => file.name);
        return fileNames;
    } else {
        console.error("Error fetching folder content:", response.statusText);
        return [];
    }
}

export async function getSlugs() {
    try {
        const markdownPosts = await getPosts();
        const slugs = markdownPosts.map(
            (fileName: string) => path.parse(fileName).name
        );
        return slugs;
    } catch (error) {
        console.error("Error getting slugs:", error);
        throw error;
    }
}

export async function getPostContent(slug: string) {
    try {
        if (!folderPath) {
            const errorMessage =
                "Invalid folder path. Please provide a valid folder path.";
            console.error(errorMessage);
            throw new Error(errorMessage);
        }
        const filePath = path.join(folderPath, `${slug}.md`);

        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                next: {
                    revalidate: 3600,
                },
            }
        );
        if (response.ok) {
            const fdata = await response.json();
            const markdownContent = atob(fdata.content); // Decode Base64 content
            const { data, content } = matter(markdownContent);

            const currentDate = new Date().getTime();

            let updatedContent = content;

            //If post date is later than the current date we set the content to Coming Soon
            if (data.date && new Date(data.date).getTime() > currentDate) {
                const formattedDate = `${new Date(
                    data.date
                ).toLocaleDateString()}`;
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
        } else {
            const error = `Error fetching markdown content: ${response.statusText}`;
            console.error(error);
            throw error;
        }
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
