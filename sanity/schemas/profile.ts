import { defineArrayMember, defineField, defineType } from "sanity";
import {
    AVAILABILITY_STATUSES,
    checkAvailabilitySeeking,
    DATE_PRECISIONS,
    listValuesOnly,
} from "@/lib/profile-fields";

type AvailabilityParent =
    | {
          status?: string;
          seeking?: { label?: string }[];
          openTo?: string;
      }
    | undefined;

export default defineType({
    name: "profile",
    title: "Profile",
    type: "document",
    groups: [
        { name: "identity", title: "Identity", default: true },
        { name: "status", title: "Status" },
        { name: "writing", title: "Homepage & Writing" },
        { name: "copy", title: "Site copy" },
        { name: "about", title: "About" },
        { name: "now", title: "Right Now" },
        { name: "portfolio", title: "Portfolio" },
        { name: "talks", title: "Talks & Papers" },
    ],
    initialValue: {
        name: "Adithya Rajendran",
        currentCuriosities: [],
    },
    fields: [
        defineField({
            name: "name",
            title: "Name",
            type: "string",
            group: "identity",
            validation: (Rule) => Rule.required().max(100),
        }),
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            group: "identity",
            description:
                "Your current role or studies, in one line. Shown under your name on the home page, in the footer, as the About introduction, on the printed CV, beside your name on posts, and on the home and About sharing images.",
            validation: (Rule) => Rule.required().max(140),
        }),
        defineField({
            name: "tagline",
            title: "Tagline",
            type: "string",
            group: "identity",
            description:
                "One sentence on what you are exploring: the Research interests statement on the home page. Leave blank to use the first sentence of the Introduction.",
            validation: (Rule) => Rule.max(120),
        }),
        defineField({
            name: "introduction",
            title: "Introduction",
            type: "text",
            rows: 4,
            group: "identity",
            description:
                "A short personal introduction. Its first sentence is the home page's Research interests statement when there is no Tagline; it is also the search description of About, and of the site when Site Search Description is empty.",
            validation: (Rule) => Rule.required().max(500),
        }),
        defineField({
            name: "availability",
            title: "Availability",
            type: "object",
            group: "status",
            description:
                "What you are open to right now. The Open To lines are shown under your name on the home page and its sharing image, in the About record, on the CV (on screen and printed), on Contact and its sharing image, and as the last stop of the Timeline flight. While they are shown, Contact offers the Hiring route.",
            fields: [
                defineField({
                    name: "status",
                    title: "Status",
                    type: "string",
                    options: {
                        list: [...AVAILABILITY_STATUSES],
                        layout: "radio",
                        direction: "horizontal",
                    },
                    validation: (Rule) => Rule.required(),
                }),
                defineField({
                    name: "seeking",
                    title: "Open To",
                    type: "array",
                    description:
                        "One line for each kind of role you are looking for and when, printed as written: for example “Summer 2027 internships” and “Full-time opportunities in 2028”. The site joins them with a dot. Required unless the status is Closed.",
                    of: [
                        defineArrayMember({
                            type: "object",
                            name: "opening",
                            title: "Opening",
                            fields: [
                                defineField({
                                    name: "label",
                                    title: "Line",
                                    type: "string",
                                    validation: (Rule) =>
                                        Rule.required().max(80),
                                }),
                            ],
                            preview: { select: { title: "label" } },
                        }),
                    ],
                    validation: (Rule) =>
                        Rule.max(4).custom((seeking, context) => {
                            const parent = context.parent as AvailabilityParent;
                            return checkAvailabilitySeeking(
                                parent?.status,
                                seeking as { label?: string }[] | undefined,
                                parent?.openTo,
                            );
                        }),
                }),
                defineField({
                    name: "openTo",
                    title: "Open To (single line)",
                    type: "string",
                    deprecated: {
                        reason: "Use Open To above, one line per opening. This line is shown only while that list is empty.",
                    },
                    hidden: ({ value }) => !value,
                    validation: (Rule) => Rule.max(140),
                }),
                defineField({
                    name: "from",
                    title: "Planned Orbit Starts",
                    type: "date",
                    deprecated: {
                        reason: "The CV's orbit map is retired, and nothing on the site reads this date. Clear it.",
                    },
                    hidden: ({ value }) => !value,
                }),
                defineField({
                    name: "cta",
                    title: "Contact Button",
                    type: "string",
                    description:
                        "Optional. The button that answers the Open To lines, for example “Write about a role”. It closes the home page and the Timeline flight, and opens Contact on the Hiring route. Leave blank for no button.",
                    validation: (Rule) => Rule.max(40),
                }),
                defineField({
                    name: "consultingOpen",
                    title: "Open to Consulting",
                    type: "boolean",
                    initialValue: false,
                    description:
                        "Shows the Consulting route on Contact. Move the site to the Vercel Pro plan before turning this on: the Hobby plan is for personal, non-commercial use.",
                }),
                defineField({
                    name: "updatedAt",
                    title: "Updated On",
                    type: "date",
                    description:
                        "Optional. When you last confirmed this status, for your own records; the site does not print it.",
                }),
            ],
        }),
        defineField({
            name: "launch",
            title: "Launch",
            type: "object",
            group: "status",
            description:
                "Optional. Where your story starts. Stored for later use: the site does not show it at present.",
            fields: [
                defineField({
                    name: "date",
                    title: "Date",
                    type: "date",
                    validation: (Rule) => Rule.required(),
                }),
                defineField({
                    name: "precision",
                    title: "Date Precision",
                    type: "string",
                    description:
                        "How much of the date you know. With Year only (enter any day in that year), the site prints the year alone and never a month or day. Empty means an exact date.",
                    options: {
                        list: [...DATE_PRECISIONS],
                        layout: "radio",
                        direction: "horizontal",
                    },
                    validation: listValuesOnly,
                }),
                defineField({
                    name: "event",
                    title: "Event",
                    type: "string",
                    description: "For example, Started at UC Santa Cruz.",
                    validation: (Rule) => Rule.required().max(60),
                }),
            ],
        }),
        defineField({
            name: "focusAreas",
            title: "Current Focus Areas",
            type: "array",
            group: "writing",
            description:
                "Short topics shown as Focus in the About record and used in search metadata. These are interests, not claims of expertise.",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(60),
                }),
            ],
            options: { layout: "tags" },
            validation: (Rule) => Rule.unique().max(4),
        }),
        defineField({
            name: "workSummary",
            title: "Experience Introduction",
            type: "text",
            rows: 3,
            group: ["writing", "copy"],
            description:
                "Connect your current direction with the experience behind it. The introduction of Experience & CV (/resume), and its search description and sharing image.",
            validation: (Rule) => Rule.max(500),
        }),
        defineField({
            name: "writingDescription",
            title: "Writing Introduction",
            type: "text",
            rows: 3,
            group: ["writing", "copy"],
            description:
                "What readers will find in your notebook. The introduction of the Blog (/blog), and its search description, sharing images and RSS feed.",
            validation: (Rule) => Rule.max(300),
        }),
        defineField({
            name: "contactInvitation",
            title: "Contact Invitation",
            type: "text",
            rows: 3,
            group: ["writing", "copy"],
            description:
                "Describe the conversations or opportunities you welcome. The text of the Research route on Contact, and Contact's search description. Leave blank to hide that route.",
            validation: (Rule) => Rule.max(300),
        }),
        defineField({
            name: "projectsIntro",
            title: "Projects Introduction",
            type: "text",
            rows: 2,
            group: "copy",
            description:
                "One sentence under the Projects heading (/portfolio), also its search description and sharing image. Leave blank to show none.",
            validation: (Rule) => Rule.max(200),
        }),
        defineField({
            name: "contactIntro",
            title: "Contact Introduction",
            type: "text",
            rows: 2,
            group: "copy",
            description:
                "One sentence under the Contact heading (/contact), also on its sharing image. Leave blank to show none.",
            validation: (Rule) => Rule.max(200),
        }),
        defineField({
            name: "contactRoutes",
            title: "Contact Routes",
            type: "object",
            group: "copy",
            description:
                "The words of each route on Contact. When each route shows is set elsewhere: Hiring while your availability has Open To lines (and is not Closed), Research with a Contact Invitation, Consulting with Open to Consulting on, and Hello always.",
            options: { collapsible: true, collapsed: false },
            fields: [
                defineField({
                    name: "hiring",
                    title: "Hiring",
                    type: "contactRoute",
                }),
                defineField({
                    name: "research",
                    title: "Research",
                    type: "contactRoute",
                }),
                defineField({
                    name: "consulting",
                    title: "Consulting",
                    type: "contactRoute",
                }),
                defineField({
                    name: "hello",
                    title: "Hello",
                    type: "contactRoute",
                }),
            ],
        }),
        defineField({
            name: "seoDescription",
            title: "Site Search Description",
            type: "text",
            rows: 3,
            group: "identity",
            description:
                "A concise description for search results and social sharing. Uses your Introduction when empty.",
            validation: (Rule) => Rule.max(200),
        }),
        defineField({
            name: "featuredPost",
            title: "Featured Homepage Post",
            type: "reference",
            group: "writing",
            to: [{ type: "post" }],
            description:
                "Stored for later use: the site does not show a featured post at present (the home page lists the three latest posts).",
        }),
        defineField({
            name: "startHere",
            title: "Start Here Posts",
            type: "array",
            group: "writing",
            description:
                "Up to three posts for new readers. Stored for later use: the site does not show them at present.",
            of: [
                defineArrayMember({
                    type: "reference",
                    to: [{ type: "post" }],
                    weak: true,
                }),
            ],
            validation: (Rule) => Rule.unique().max(3),
        }),
        defineField({
            name: "bio",
            title: "Biography",
            type: "text",
            rows: 12,
            group: "about",
            description:
                "Plain-text biography. Use blank lines to separate paragraphs.",
            validation: (Rule) => Rule.required().max(5000),
        }),
        defineField({
            name: "location",
            title: "Location",
            type: "string",
            group: "about",
            validation: (Rule) => Rule.max(120),
        }),
        defineField({
            name: "portrait",
            title: "Portrait",
            type: "image",
            group: ["identity", "about"],
            options: { hotspot: true },
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                    validation: (Rule) => Rule.required(),
                }),
            ],
        }),
        defineField({
            name: "resume",
            title: "Resume PDF",
            type: "file",
            group: "portfolio",
            options: { accept: ".pdf" },
            description:
                "The source file for the résumé viewer and download links. Changes to profile text do not edit this PDF; upload a revised file when needed.",
        }),
        defineField({
            name: "resumeNote",
            title: "Résumé Note",
            type: "text",
            rows: 3,
            group: "portfolio",
            description:
                "Optional context shown above the résumé, such as what version it is or which opportunities it covers.",
            validation: (Rule) => Rule.max(400),
        }),
        defineField({
            name: "socialLinks",
            title: "Profile Links",
            type: "array",
            group: "about",
            of: [defineArrayMember({ type: "externalLink" })],
            validation: (Rule) => Rule.unique(),
        }),
        defineField({
            name: "currentCuriosities",
            title: "Right Now",
            type: "array",
            group: "now",
            description:
                "Optional things you are reading, learning, making, or thinking about. Shown on About; the section is hidden when empty.",
            of: [defineArrayMember({ type: "curiosity" })],
            validation: (Rule) => Rule.max(6),
        }),
        defineField({
            name: "curiositiesUpdatedAt",
            title: "Right Now Updated At",
            type: "datetime",
            group: "now",
            description:
                "Update this when the Right Now list materially changes.",
            hidden: ({ document }) =>
                !Array.isArray(document?.currentCuriosities) ||
                document.currentCuriosities.length === 0,
            validation: (Rule) =>
                Rule.custom((value, context) => {
                    const curiosities = context.document?.currentCuriosities;
                    return Array.isArray(curiosities) &&
                        curiosities.length > 0 &&
                        !value
                        ? "Add the date when these items were last updated."
                        : true;
                }),
        }),
        defineField({
            name: "timeline",
            title: "Experience and Education",
            type: "array",
            group: "portfolio",
            of: [defineArrayMember({ type: "timelineEntry" })],
        }),
        defineField({
            name: "skillGroups",
            title: "Skill Groups",
            type: "array",
            group: "portfolio",
            of: [defineArrayMember({ type: "skillGroup" })],
        }),
        defineField({
            name: "credentials",
            title: "Credentials",
            type: "array",
            group: "portfolio",
            of: [defineArrayMember({ type: "credential" })],
        }),
        defineField({
            name: "talksAndPapers",
            title: "Talks & Papers",
            type: "array",
            group: "talks",
            description:
                "Talks you gave and papers you wrote. Shown on About and the CV; the section is hidden when empty.",
            of: [defineArrayMember({ type: "talkOrPaper" })],
            validation: (Rule) => Rule.max(20),
        }),
    ],
    preview: {
        select: { title: "name", subtitle: "headline", media: "portrait" },
    },
});
