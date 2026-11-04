import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
    site: "https://adithya-rajendran.com",
    output: "server",
    adapter: cloudflare(),
});
