import path from "path";
import { PostType } from "@/lib/types";
import matter from "gray-matter";

const repoOwner = process.env.GITHUB_NAME;
const repoName = process.env.GITHUB_REPO;
const folderPath = process.env.GITHUB_PATH;
const accessToken = process.env.GITHUB_TOKEN;

function isConfigured(): boolean {
    return Boolean(repoOwner && repoName && folderPath && accessToken);
}

export async function getSlugs(): Promise<string[]> {
    if (!isConfigured()) {
        console.warn(
            "Blog: GitHub env variables not set (GITHUB_NAME, GITHUB_REPO, GITHUB_PATH, GITHUB_TOKEN). Returning empty slugs."
        );
        return [];
    }

    try {
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folderPath}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                next: {
                    revalidate: 900,
                },
            }
        );

        if (!response.ok) {
            console.error(`GitHub API error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        const slugs = data
            .filter((file: any) => file.type !== "dir")
            .map((file: any) => path.parse(file.name).name);

        return slugs;
    } catch (error) {
        console.error("Error fetching files from GitHub:", error);
        return [];
    }
}

export async function getPostContent(
    slug: string
): Promise<PostType | undefined> {
    if (!isConfigured()) {
        return undefined;
    }

    if (!slug) {
        console.error("Slug not provided in the request body.");
        return undefined;
    }

    try {
        const filePath = path.join(folderPath!, `${slug}.md`);

        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                next: {
                    revalidate: 900,
                },
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                console.error(`Blog post not found: ${slug}`);
            } else {
                console.error(
                    `Error fetching markdown content: ${response.status} ${response.statusText}`
                );
            }
            return undefined;
        }

        const fileData = await response.json();
        const markdownContent = Buffer.from(fileData.content, "base64").toString("utf-8");
        const { data, content } = matter(markdownContent);
        const scheduledDate = new Date(`${data.date}T00:00:00.000-08:00`);
        const formattedDate = scheduledDate.toLocaleDateString("en-US", {
            timeZone: "America/Los_Angeles",
        });

        // Hide content from posts that are scheduled to be released later.
        const currentDatePST = new Date(
            new Date().toLocaleString("en-US", {
                timeZone: "America/Los_Angeles",
            })
        );

        let updatedContent = content;
        if (data.date) {
            if (scheduledDate > currentDatePST) {
                updatedContent = `# Coming soon on ${formattedDate}`;
            }
        }

        const post: PostType = {
            slug: slug,
            title: data.title,
            desc: data.description,
            date: formattedDate,
            image: data.image,
            content: updatedContent,
        };

        return post;
    } catch (error) {
        console.error("Error fetching data from GitHub:", error);
        return undefined;
    }
}
