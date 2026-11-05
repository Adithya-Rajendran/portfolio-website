/** Framework-independent Sanity content contracts. */
import type {
    AvailabilityStatus,
    CuriosityKind,
    DatePrecision,
    EmploymentType,
    LinkKind,
    TalkKind,
    TimelineDatePrecision,
} from "@/lib/profile-fields";
import type { ChangeKind } from "@/lib/post-fields";
import type {
    ImageKind,
    ModelKind,
    ProjectStatus,
    ProjectType,
    RealWorldDimension,
    RealWorldUnit,
} from "@/lib/project-fields";

type ContentBlock = {
    _key?: string;
    _type: string;
    [key: string]: unknown;
};

export type ContentBody = ContentBlock[];

export type SanityImageValue = {
    _type?: "image";
    asset?: { _ref?: string; _type?: "reference" };
    alt?: string | null;
    caption?: string | null;
    lqip?: string | null;
    dimensions?: { width?: number; height?: number } | null;
};

export type ExternalLink = {
    _key: string;
    _type?: "externalLink";
    label: string;
    url: string;
    kind?: LinkKind | null;
};

export type CuriosityItem = {
    _key: string;
    _type?: "curiosity";
    /** Missing on items saved before kinds existed: treat as a question. */
    kind?: CuriosityKind | null;
    title: string;
    note?: string | null;
    url?: string | null;
    projectId?: string | null;
    postId?: string | null;
};

export type TimelineEntry = {
    _key: string;
    _type?: "timelineEntry";
    kind: "work" | "education";
    title: string;
    organization: string;
    orgShort?: string | null;
    orgUrl?: string | null;
    employment?: EmploymentType | null;
    location?: string | null;
    startDate?: string | null;
    /** `year`: only the year of `startDate` is known; never print a month. */
    startPrecision?: TimelineDatePrecision | null;
    endDate?: string | null;
    /** `year`: only the year of `endDate` is known; never print a month. */
    endPrecision?: TimelineDatePrecision | null;
    isCurrent?: boolean | null;
    expectedEndYear?: number | null;
    summary?: string | null;
    highlights?: string[] | null;
    skills?: string[] | null;
    logo?: SanityImageValue | null;
    burn?: { label: string; note?: string | null } | null;
};

export type SkillGroup = {
    _key: string;
    _type?: "skillGroup";
    title: string;
    skills: string[];
};

export type CredentialListItem = {
    _key: string;
    _type?: "credential";
    title: string;
    issuer: string;
    issuedOn: string;
    lifetime: boolean;
    expiresOn?: string | null;
    credentialId?: string | null;
    verificationUrl?: string | null;
    badge?: SanityImageValue | null;
    lifecycleStatus: "active" | "lifetime" | "expired";
};

/** One line of what the owner is open to: "Summer 2027 internships". */
export type Opening = {
    _key: string;
    label: string;
};

export type Availability = {
    status: AvailabilityStatus;
    /** One line per opening, printed as written and joined with " · ". */
    seeking?: Opening[] | null;
    /** The older single line; shown only while `seeking` is empty. */
    openTo?: string | null;
    /** The button that answers the Open To lines ("Write about a role"). */
    cta?: string | null;
    consultingOpen?: boolean | null;
    /** For the owner's records; never printed. */
    updatedAt?: string | null;
};

export type Launch = {
    date: string;
    /** Missing means an exact date; `year` means print the year alone. */
    precision?: DatePrecision | null;
    event: string;
};

/** The words of one contact route (Profile → Site copy). */
type ContactRouteCopy = {
    title?: string | null;
    prompt?: string | null;
};

type ContactRoutesCopy = {
    hiring?: ContactRouteCopy | null;
    research?: ContactRouteCopy | null;
    consulting?: ContactRouteCopy | null;
    hello?: ContactRouteCopy | null;
};

export type TalkOrPaper = {
    _key: string;
    _type?: "talkOrPaper";
    title: string;
    kind: TalkKind;
    venue?: string | null;
    date?: string | null;
    authors?: string | null;
    links?: ExternalLink[] | null;
    abstract?: string | null;
    projectId?: string | null;
};

export type ProfileData = {
    _id: string;
    _createdAt?: string;
    _updatedAt?: string;
    name: string;
    headline: string;
    tagline?: string | null;
    introduction: string;
    bio: string;
    availability?: Availability | null;
    launch?: Launch | null;
    focusAreas?: string[] | null;
    workSummary?: string | null;
    writingDescription?: string | null;
    contactInvitation?: string | null;
    /** The /portfolio introduction. */
    projectsIntro?: string | null;
    /** The /contact introduction. */
    contactIntro?: string | null;
    contactRoutes?: ContactRoutesCopy | null;
    seoDescription?: string | null;
    featuredPostId?: string | null;
    startHereIds?: string[] | null;
    /** City and region ("San José, California"): the Person's home, in
     *  the structured data only. */
    location?: string | null;
    resumeUrl?: string | null;
    /** When the résumé PDF was uploaded: the CV's revision. */
    resumeUploadedAt?: string | null;
    resumeNote?: string | null;
    socialLinks?: ExternalLink[] | null;
    currentCuriosities?: CuriosityItem[] | null;
    curiositiesUpdatedAt?: string | null;
    timeline?: TimelineEntry[] | null;
    skillGroups?: SkillGroup[] | null;
    credentials?: CredentialListItem[] | null;
    talksAndPapers?: TalkOrPaper[] | null;
};

/** A post's cover: image metadata plus its dominant colour (`bg`). */
type PostCover = SanityImageValue & {
    credit?: string | null;
    kind?: ImageKind | null;
    bg?: string | null;
};

export type PostListItem = {
    _id: string;
    title: string;
    slug: string;
    description: string;
    publishedAt: string;
    /** The last substantive revision; never before `publishedAt`. */
    revisedAt?: string | null;
    tags?: string[] | null;
    /** Related projects, as ids: join against the project list. */
    projectIds?: string[] | null;
    cover?: PostCover | null;
    socialImage?: SanityImageValue | null;
    wordCount: number;
};

/** A dated update or correction to a post (G7 errata). */
export type PostChange = {
    _key: string;
    date: string;
    kind: ChangeKind;
    note: string;
};

export type PostWithBody = PostListItem & {
    body: ContentBody;
    takeaways?: string[] | null;
    nextPostId?: string | null;
    nextReadReason?: string | null;
    _updatedAt?: string;
    /** Dated updates and corrections, oldest first as authored. */
    changelog?: PostChange[] | null;
};

export type PostMeta = Omit<PostListItem, "_id"> & {
    _updatedAt?: string;
};

type ProjectParameter = {
    _key: string;
    label: string;
    value: string;
};

export type ProjectListItem = {
    _id: string;
    _updatedAt?: string;
    /** The mission number: 2 prints as MSN-02. */
    designation: number;
    title: string;
    /** The optional short name set in capitals ("Homelab"). */
    name?: string | null;
    slug: string;
    summary: string;
    status: ProjectStatus;
    statusNote?: string | null;
    types: ProjectType[];
    /** 1 is the photographic stage; 2 and 3 are featured beside it. */
    featured?: number | null;
    /** Listed only as a quiet row on /portfolio (`missionTiers`): never
     *  the flagship, a tile or a home row, whatever `featured` says,
     *  unless every project is quiet. */
    quiet?: boolean | null;
    myRole?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    /** `year`: only the years of the dates are known; never print a month. */
    datePrecision?: TimelineDatePrecision | null;
    /** The dates are the owner's estimate: print them with "c.". */
    datesApproximate?: boolean | null;
    technologies?: string[] | null;
    highlights?: string[] | null;
    parameters?: ProjectParameter[] | null;
    cover?: SanityImageValue | null;
    coverPortrait?: SanityImageValue | null;
    links?: ExternalLink[] | null;
    hasModel: boolean;
};

type ProjectResult = {
    _key: string;
    metric: string;
    value: string;
    note?: string | null;
};

export type ModelHotspot = {
    _key: string;
    label: string;
    title: string;
    body?: string | null;
    /** Procedural models: the part the balloon points at. */
    part?: ModelPartKey | null;
    /** glTF models: where the balloon points, in model coordinates. */
    position?: { x: number; y: number; z: number } | null;
    /** A heading id in this project's essay, or in the post `postId`. */
    anchor?: { heading: string; postId?: string | null } | null;
};

export type ProjectModel = {
    kind: ModelKind;
    procedural?: ProceduralModelKey | null;
    fileUrl?: string | null;
    poster: SanityImageValue;
    title?: string | null;
    alt: string;
    realWorld?: {
        dimension: RealWorldDimension;
        value: number;
        unit: RealWorldUnit;
    } | null;
    hotspots?: ModelHotspot[] | null;
};

export type ProjectWithBody = ProjectListItem & {
    brief?: {
        problem?: string | null;
        approach?: string | null;
        outcome?: string | null;
    } | null;
    results?: ProjectResult[] | null;
    lessons?: string[] | null;
    next?: string[] | null;
    model?: ProjectModel | null;
    body: ContentBody;
};

export type PostDates = {
    slug: string;
    publishedAt: string;
    revisedAt?: string | null;
    changes?: (string | null)[] | null;
};
