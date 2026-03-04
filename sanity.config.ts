"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { codeInput } from "@sanity/code-input";
import { schemaTypes } from "./sanity/schemas";
import type { StructureBuilder } from "sanity/structure";

const projectId = process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_STORE_SANITY_DATASET || "production";

const structure = (S: StructureBuilder) =>
    S.list()
        .title("Content")
        .items([
            // Blog posts
            S.listItem()
                .title("Blog Posts")
                .schemaType("post")
                .child(S.documentTypeList("post").title("Blog Posts")),

            S.divider(),

            // Portfolio section
            S.listItem()
                .title("Portfolio")
                .child(
                    S.list()
                        .title("Portfolio")
                        .items([
                            // Intro singleton
                            S.listItem()
                                .title("Intro")
                                .child(
                                    S.document()
                                        .schemaType("intro")
                                        .documentId("intro"),
                                ),

                            // About singleton
                            S.listItem()
                                .title("About")
                                .child(
                                    S.document()
                                        .schemaType("about")
                                        .documentId("about"),
                                ),

                            S.listItem()
                                .title("Experience")
                                .schemaType("experience")
                                .child(
                                    S.documentTypeList("experience").title(
                                        "Experience",
                                    ),
                                ),

                            S.listItem()
                                .title("Projects")
                                .schemaType("project")
                                .child(
                                    S.documentTypeList("project").title(
                                        "Projects",
                                    ),
                                ),

                            S.listItem()
                                .title("Certifications")
                                .schemaType("certification")
                                .child(
                                    S.documentTypeList("certification").title(
                                        "Certifications",
                                    ),
                                ),

                            S.listItem()
                                .title("Skill Categories")
                                .schemaType("skillCategory")
                                .child(
                                    S.documentTypeList("skillCategory").title(
                                        "Skill Categories",
                                    ),
                                ),
                        ]),
                ),
        ]);

export default defineConfig({
    name: "portfolio-blog",
    title: "Portfolio & Blog",
    projectId,
    dataset,
    plugins: [structureTool({ structure }), visionTool(), codeInput()],
    schema: {
        types: schemaTypes,
    },
});
