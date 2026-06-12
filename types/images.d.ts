/**
 * Static image module declarations for build-less `tsc --noEmit`.
 *
 * CI's lint job runs tsc without a prior `next build`, so the generated
 * next-env.d.ts (which references Next's image types AND imports
 * ./.next/types/routes.d.ts) does not resolve there — it is intentionally
 * gitignored. These declarations mirror next/image-types/global for the
 * formats the repo actually imports.
 */

declare module "*.webp" {
    const content: import("next/image").StaticImageData;
    export default content;
}

declare module "*.png" {
    const content: import("next/image").StaticImageData;
    export default content;
}

declare module "*.jpg" {
    const content: import("next/image").StaticImageData;
    export default content;
}

declare module "*.jpeg" {
    const content: import("next/image").StaticImageData;
    export default content;
}
