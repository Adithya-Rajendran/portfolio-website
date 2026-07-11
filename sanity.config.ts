"use client";

import { codeInput } from "@sanity/code-input";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool, type StructureBuilder } from "sanity/structure";
import { schemaTypes } from "./sanity/schemas";

const projectId = process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_STORE_SANITY_DATASET || "production";

const PROFILE_ID = "profile";

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
            S.documentTypeListItem("post").title("Blog Posts"),
            S.documentTypeListItem("project").title("Projects"),
        ]);

export default defineConfig({
    name: "portfolio-blog",
    title: "Adithya's Site",
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
