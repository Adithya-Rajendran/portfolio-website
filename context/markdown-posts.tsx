"use server";

import fs from "fs";

const folder = "posts/";

function getPosts() {
    const files = fs.readdirSync(folder);
    const markdowmPosts = files.filter((file) => file.endsWith(".md"));
    return markdowmPosts;
}

export async function getSlugs() {
    const markdowmPosts = getPosts();
    const slugs = markdowmPosts.map((fileNames) =>
        fileNames.replace(".md", "")
    );
    return slugs;
}

export async function getPostContent(slug: string) {
    const file = `${folder}${slug}.md`;
    const content = fs.readFileSync(file, "utf8");
    return content;
}
