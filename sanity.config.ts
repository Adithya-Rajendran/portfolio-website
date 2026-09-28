"use client";

import { codeInput } from "@sanity/code-input";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool, type StructureBuilder } from "sanity/structure";
import { schemaTypes } from "./sanity/schemas";

const projectId = process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_STORE_SANITY_DATASET || "production";

const PROFILE_ID = "profile";

/** API version for the Studio's own filtered lists. */
const STRUCTURE_API_VERSION = "2025-02-19";

// Labels only: the `post` and `project` type names and the site URLs stay.
const structure = (S: StructureBuilder) =>
    S.list()
        .title("Adithya's Site")
        .items([
            S.listItem()
                .id("profile")
                .title("Profile")
                .schemaType("profile")
                .child(
                    S.document()
                        .schemaType("profile")
                        .documentId(PROFILE_ID)
                        .title("Profile"),
                ),
            S.divider(),
            S.listItem()
                .id("post")
                .title("Flight Log · Posts")
                .schemaType("post")
                .child(
                    S.list()
                        .title("Flight Log · Posts")
                        .items([
                            S.listItem()
                                .id("all-posts")
                                .title("All Posts")
                                .schemaType("post")
                                .child(
                                    S.documentTypeList("post")
                                        .title("All Posts")
                                        .defaultOrdering([
                                            {
                                                field: "publishedAt",
                                                direction: "desc",
                                            },
                                        ]),
                                ),
                            // Posts dated after today (UTC): the site hides
                            // them until the daily cron releases each one.
                            S.listItem()
                                .id("scheduled-posts")
                                .title("Scheduled")
                                .schemaType("post")
                                .child(() =>
                                    S.documentList()
                                        .id("scheduled-posts")
                                        .title("Scheduled")
                                        .schemaType("post")
                                        .apiVersion(STRUCTURE_API_VERSION)
                                        .filter(
                                            '_type == "post" && publishedAt > $today',
                                        )
                                        .params({
                                            today: new Date()
                                                .toISOString()
                                                .slice(0, 10),
                                        })
                                        .defaultOrdering([
                                            {
                                                field: "publishedAt",
                                                direction: "asc",
                                            },
                                        ]),
                                ),
                        ]),
                ),
            S.listItem()
                .id("project")
                .title("Missions · Projects")
                .schemaType("project")
                .child(
                    S.documentTypeList("project")
                        .title("Missions · Projects")
                        .defaultOrdering([
                            { field: "designation", direction: "asc" },
                        ]),
                ),
        ]);

export default defineConfig({
    name: "portfolio-blog",
    title: "Adithya's Site",
    // The Studio is embedded at /studio (app/studio/[[...tool]]). Without
    // this, it reads "studio" as a tool name ("Tool not found: studio") and
    // links its tools to /structure and /vision, outside the route.
    basePath: "/studio",
    projectId,
    dataset,
    plugins: [structureTool({ structure }), visionTool(), codeInput()],
    schema: {
        types: schemaTypes,
        templates: (templates) =>
            templates.filter((template) => template.schemaType !== "profile"),
    },
    document: {
        actions: (actions, context) =>
            context.schemaType === "profile"
                ? actions.filter(
                      (action) =>
                          action.action !== "delete" &&
                          action.action !== "duplicate",
                  )
                : actions,
    },
});
