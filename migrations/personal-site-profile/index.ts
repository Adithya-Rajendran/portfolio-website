import {
    at,
    createIfNotExists,
    defineMigration,
    patch,
    set,
    setIfMissing,
    transaction,
    type Mutation,
    type NodePatch,
} from "sanity/migrate";
import { isLifetime, parseLegacyDate, parseLegacyRange } from "./legacyDate";

type LegacyDocument = {
    _createdAt?: string;
    _id: string;
    _type: string;
    [key: string]: unknown;
};

type PortableTextSpan = { text?: unknown };
type PortableTextBlock = {
    _type?: unknown;
    children?: PortableTextSpan[];
};

type TimelineEntry = {
    _key: string;
    _type: "timelineEntry";
    kind: "education" | "work";
    title: string;
    organization: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
    skills?: string[];
    logo?: unknown;
};

type SkillGroup = {
    _key: string;
    _type: "skillGroup";
    title: string;
    skills: string[];
};

type Credential = {
    _key: string;
    _type: "credential";
    title: string;
    issuer: string;
    issuedOn?: string;
    lifetime: boolean;
    expiresOn?: string;
    credentialId?: string;
    verificationUrl?: string;
    badge?: unknown;
};

const PROFILE_ID = "profile";
const UCSC_DATE = "2023-06-01";

const PROFILE_LINKS = [
    {
        _key: "linkedin",
        _type: "externalLink",
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/adithya-rajendran",
    },
    {
        _key: "github",
        _type: "externalLink",
        label: "GitHub",
        url: "https://github.com/Adithya-Rajendran",
    },
    {
        _key: "credly",
        _type: "externalLink",
        label: "Credly",
        url: "https://www.credly.com/users/adithya-rajendran",
    },
    {
        _key: "hackthebox",
        _type: "externalLink",
        label: "Hack The Box",
        url: "https://app.hackthebox.com/users/514798",
    },
    {
        _key: "tryhackme",
        _type: "externalLink",
        label: "TryHackMe",
        url: "https://tryhackme.com/p/Cagmas",
    },
] as const;

function asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
    return Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

function asObjectArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter(
              (item): item is Record<string, unknown> =>
                  Boolean(item) &&
                  typeof item === "object" &&
                  !Array.isArray(item),
          )
        : [];
}

function stableKey(prefix: string, value: string) {
    const safe = value.replace(/[^A-Za-z0-9_-]/g, "-");
    return `${prefix}-${safe}`.slice(0, 96);
}

function plainText(value: unknown) {
    if (typeof value === "string") return value.trim();
    if (!Array.isArray(value)) return "";

    return value
        .map((candidate) => {
            const block = candidate as PortableTextBlock;
            if (block?._type !== "block" || !Array.isArray(block.children)) {
                return "";
            }
            return block.children
                .map((child) =>
                    typeof child.text === "string" ? child.text : "",
                )
                .join("")
                .trim();
        })
        .filter(Boolean)
        .join("\n\n");
}

function withImageAlt(value: unknown, fallback: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    const image = value as Record<string, unknown>;
    return image.alt ? image : { ...image, alt: fallback };
}

function isPublished(document: LegacyDocument) {
    return !document._id.startsWith("drafts.");
}

function byLegacyOrder(left: LegacyDocument, right: LegacyDocument) {
    const leftOrder = typeof left.order === "number" ? left.order : Infinity;
    const rightOrder = typeof right.order === "number" ? right.order : Infinity;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return (left._createdAt || "").localeCompare(right._createdAt || "");
}

function isUcSantaCruz(...values: unknown[]) {
    const text = values
        .map((value) => asString(value) || "")
        .join(" ")
        .toLowerCase();
    return (
        text.includes("university of california santa cruz") ||
        text.includes("university of california, santa cruz") ||
        text.includes("uc santa cruz") ||
        text.includes("ucsc")
    );
}

function timelineFromExperience(
    document: LegacyDocument,
): TimelineEntry | null {
    const title = asString(document.title);
    const organization =
        asString(document.organization) || asString(document.org);
    if (!title || !organization) return null;

    const ucsc = isUcSantaCruz(
        title,
        organization,
        document.location,
        ...asStringArray(document.description),
        ...asStringArray(document.highlights),
    );
    const range = parseLegacyRange(document.date);
    const startDate = ucsc
        ? UCSC_DATE
        : parseLegacyDate(document.startDate) || range?.startDate;
    const endDate = ucsc
        ? UCSC_DATE
        : parseLegacyDate(document.endDate) || range?.endDate;
    const highlights = [
        ...asStringArray(document.highlights),
        ...asStringArray(document.description),
    ].filter((value, index, values) => values.indexOf(value) === index);
    const logo = withImageAlt(document.icon, `${organization} logo`);

    return {
        _key: stableKey("timeline", document._id),
        _type: "timelineEntry",
        kind: ucsc ? "education" : "work",
        title,
        organization,
        ...(asString(document.location)
            ? { location: asString(document.location) }
            : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(asString(document.summary)
            ? { summary: asString(document.summary) }
            : {}),
        ...(highlights.length ? { highlights } : {}),
        ...(asStringArray(document.skills).length
            ? { skills: asStringArray(document.skills) }
            : {}),
        ...(logo ? { logo } : {}),
    };
}

function educationFromIntro(
    intro: LegacyDocument | undefined,
    existingOrganizations: Set<string>,
) {
    if (!intro) return [];

    return asObjectArray(intro.education).flatMap((education, index) => {
        const organization = asString(education.name);
        if (!organization) return [];

        const normalized = organization.toLowerCase();
        if (existingOrganizations.has(normalized)) return [];

        const ucsc = isUcSantaCruz(organization);
        return [
            {
                _key: stableKey("education", `${organization}-${index}`),
                _type: "timelineEntry" as const,
                kind: "education" as const,
                title: "Education",
                organization,
                ...(ucsc ? { startDate: UCSC_DATE, endDate: UCSC_DATE } : {}),
            },
        ];
    });
}

function skillGroupsFromDocuments(documents: LegacyDocument[]): SkillGroup[] {
    return documents
        .filter(
            (document) =>
                isPublished(document) && document._type === "skillCategory",
        )
        .sort(byLegacyOrder)
        .flatMap((document) => {
            const title = asString(document.title);
            const skills = asStringArray(document.skills);
            if (!title || !skills.length) return [];
            return [
                {
                    _key: stableKey("skills", document._id),
                    _type: "skillGroup" as const,
                    title,
                    skills,
                },
            ];
        });
}

function credentialsFromDocuments(documents: LegacyDocument[]): Credential[] {
    return documents
        .filter(
            (document) =>
                isPublished(document) && document._type === "certification",
        )
        .sort(byLegacyOrder)
        .flatMap((document) => {
            const title = asString(document.title);
            const issuer = asString(document.issuer) || asString(document.org);
            if (!title || !issuer) return [];

            const legacyExpiry =
                asString(document.expiresOn) || asString(document.endDate);
            const lifetime =
                typeof document.lifetime === "boolean"
                    ? document.lifetime
                    : !legacyExpiry || isLifetime(legacyExpiry);
            const issuedOn =
                parseLegacyDate(document.issuedOn) ||
                parseLegacyDate(document.startDate);
            const expiresOn = lifetime
                ? undefined
                : parseLegacyDate(legacyExpiry);
            const badge = withImageAlt(
                document.badge,
                `${title} credential badge`,
            );

            return [
                {
                    _key: stableKey("credential", document._id),
                    _type: "credential" as const,
                    title,
                    issuer,
                    ...(issuedOn ? { issuedOn } : {}),
                    lifetime,
                    ...(expiresOn ? { expiresOn } : {}),
                    ...(asString(document.credentialId)
                        ? { credentialId: asString(document.credentialId) }
                        : {}),
                    ...(asString(document.verificationUrl) ||
                    asString(document.verifyUrl)
                        ? {
                              verificationUrl:
                                  asString(document.verificationUrl) ||
                                  asString(document.verifyUrl),
                          }
                        : {}),
                    ...(badge ? { badge } : {}),
                },
            ];
        });
}

function profilePatches(documents: LegacyDocument[]): NodePatch[] {
    const published = documents.filter(isPublished);
    const intro = published.find((document) => document._type === "intro");
    const about = published.find((document) => document._type === "about");
    const experiences = published
        .filter((document) => document._type === "experience")
        .sort(byLegacyOrder);
    const timeline = experiences
        .map(timelineFromExperience)
        .filter((entry): entry is TimelineEntry => Boolean(entry));
    const existingOrganizations = new Set(
        timeline.map((entry) => entry.organization.toLowerCase()),
    );
    timeline.push(...educationFromIntro(intro, existingOrganizations));

    const introBody = plainText(intro?.body);
    const introduction =
        asString(intro?.heroDescription) || introBody || "Welcome to my site.";
    const biography = plainText(about?.body) || introBody || introduction;
    const headline =
        asString(intro?.subtitle) ||
        asString(intro?.role) ||
        "Cloud Field Engineer @ Canonical";
    const portrait = withImageAlt(
        about?.portrait,
        "Portrait of Adithya Rajendran",
    );

    const patches: NodePatch[] = [
        at("name", setIfMissing("Adithya Rajendran")),
        at("headline", setIfMissing(headline)),
        at("introduction", setIfMissing(introduction)),
        at("bio", setIfMissing(biography)),
        at("socialLinks", setIfMissing([...PROFILE_LINKS])),
        at("currentCuriosities", setIfMissing([])),
        at("timeline", setIfMissing(timeline)),
        at("skillGroups", setIfMissing(skillGroupsFromDocuments(published))),
        at("credentials", setIfMissing(credentialsFromDocuments(published))),
    ];

    const location = asString(about?.location);
    if (location) patches.push(at("location", setIfMissing(location)));
    if (portrait) patches.push(at("portrait", setIfMissing(portrait)));
    if (intro?.resume) {
        patches.push(at("resume", setIfMissing(intro.resume)));
    }

    return patches;
}

function postPatches(document: LegacyDocument): NodePatch[] {
    const publishedAt =
        parseLegacyDate(document.publishedAt) || parseLegacyDate(document.date);
    const patches: NodePatch[] = [];
    if (publishedAt) patches.push(at("publishedAt", set(publishedAt)));
    return patches;
}

export default defineMigration({
    title: "Create the personal-site Profile and modernize post dates",
    documentTypes: [
        "intro",
        "about",
        "experience",
        "certification",
        "skillCategory",
        "post",
        "homePage",
        "profile",
    ],
    async *migrate(documents) {
        const sourceDocuments: LegacyDocument[] = [];

        for await (const document of documents()) {
            sourceDocuments.push(document as LegacyDocument);
        }

        for (const document of sourceDocuments) {
            if (document._type !== "post") continue;
            const patches = postPatches(document);
            if (patches.length) yield patch(document._id, patches);
        }

        const profileMutations: Mutation[] = [
            createIfNotExists({ _id: PROFILE_ID, _type: "profile" }),
            patch(PROFILE_ID, profilePatches(sourceDocuments)),
        ];
        yield transaction(profileMutations);
    },
});
