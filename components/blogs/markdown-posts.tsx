import path from "path";
import { PostType } from "@/lib/types";
import matter from "gray-matter";

const repoOwner = process.env.GITHUB_NAME;
const repoName = process.env.GITHUB_REPO;
const folderPath = process.env.GITHUB_PATH;
const accessToken = process.env.GITHUB_TOKEN;

export async function getSlugs(): Promise<string[] | undefined> {
    try {
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

        if (!response.ok) {
            throw new Error("Failed to fetch files from GitHub");
        }

        const data = await response.json();
        const slugs = data
            .filter((file: any) => file.type !== "dir")
            .map((file: any) => path.parse(file.name).name);

        return slugs;
    } catch (error) {
        console.error("Error fetching files from GitHub:", error);
        return;
    }
}

export async function getPostContent(
    slug: string
): Promise<PostType | undefined> {
    try {
        if (!slug) {
            const errorMessage = "Slug not provided in the request body.";
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        if (!folderPath) {
            const errorMessage = "Please set GITHUB_PATH env variable.";
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        const filePath = path.join(folderPath, `${slug}.md`);

        // Fetch markdown content from GitHub
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

        if (!response.ok) {
            if (response.status === 404) {
                const errorMessage = "Requested resource is not found.";
                console.error(errorMessage);
                throw new Error(errorMessage);
            }
            const error = `Error fetching markdown content: ${response.statusText}`;
            console.error(error);
            throw new Error(error);
        }

        const fileData = await response.json();
        const markdownContent = atob(fileData.content); // Decode Base64 content
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
        return;
    }
}
