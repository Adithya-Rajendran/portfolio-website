"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { codeInput } from "@sanity/code-input";
import { schemaTypes } from "./sanity/schemas";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

export default defineConfig({
    name: "portfolio-blog",
    title: "Portfolio Blog",
    projectId,
    dataset,
    plugins: [structureTool(), visionTool(), codeInput()],
    schema: {
        types: schemaTypes,
    },
});
