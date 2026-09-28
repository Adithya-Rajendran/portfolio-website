import { makeIntroOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { siteConfig } from "@/lib/config";

export const alt = "Adithya Rajendran — Personal website";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = siteConfig.url.replace(/^https?:\/\//, "");

export default makeIntroOgImage({
    eyebrow: "Personal notebook",
    footerRight: domain,
});
