import { hostOf } from "@/lib/cv";
import { getProfileLinks } from "@/lib/profile-content";
import type { ProfileData } from "@/lib/sanity-client";

/** A profile link as a plain link row (structurally a `RouteItem`). */
export interface ProfileRow {
    key: string;
    href: string;
    plain: string;
    /** The address without its scheme: "github.com/…". */
    blurb: string;
    external: true;
}

/**
 * The owner's profiles as plain link rows: /contact's Profiles. Web
 * addresses only.
 */
export function profileRows(profile: ProfileData | null): ProfileRow[] {
    return getProfileLinks(profile)
        .filter((link) => /^https?:\/\//.test(link.url))
        .map((link) => ({
            key: link._key,
            href: link.url,
            plain: link.label,
            blurb: hostOf(link.url),
            external: true,
        }));
}
