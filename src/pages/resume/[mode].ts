import type { APIRoute } from "astro";
import { getProfile } from "../../lib/sanity";
import { resolveResumeAssetUrl } from "../../../lib/resume";
export const GET: APIRoute = async ({ params }) => {
    if (params.mode !== "view" && params.mode !== "download")
        return new Response("Not found", { status: 404 });
    const profile = await getProfile();
    const url = resolveResumeAssetUrl(profile?.resumeUrl, params.mode);
    return new Response(null, {
        status: url ? 307 : 303,
        headers: {
            Location: url || "/resume",
            "Cache-Control": "private, no-store",
        },
    });
};
