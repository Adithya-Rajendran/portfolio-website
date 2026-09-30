import { describe, expect, it } from "vitest";
import {
    CONTACT_TOPICS,
    contactRoutes,
    contactSubject,
    isContactTopic,
    remainingNotice,
    reportedMessage,
    shownErrors,
    topicFromHash,
    topicOptions,
    validateContactFields,
} from "@/lib/contact";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import type { Availability, ProfileData } from "@/lib/sanity-client";

function profileOf(overrides: Partial<ProfileData> = {}): ProfileData {
    return {
        _id: "profile",
        name: "Adithya Rajendran",
        headline: "Headline",
        introduction: "Introduction.",
        bio: "Bio.",
        ...overrides,
    };
}

function availabilityOf(overrides: Partial<Availability> = {}): Availability {
    return {
        status: "open",
        seeking: [
            { _key: "a", label: "Summer 2027 internships" },
            { _key: "b", label: "Full-time opportunities in 2028" },
        ],
        updatedAt: "2026-09-24",
        ...overrides,
    };
}

const topicsOf = (profile: ProfileData | null) =>
    contactRoutes(profile).map((route) => route.topic);

describe("contact routes", () => {
    it("shows Hiring, Research and Hello for the published profile, with Consulting off", () => {
        const routes = contactRoutes(FIXTURE_PROFILE);
        expect(routes.map((route) => route.topic)).toEqual([
            "hiring",
            "research",
            "hello",
        ]);
        // Facts are the profile's own words, printed as written; what the
        // owner is open to is the page head's, not a route's.
        expect(routes[1].body).toBe(FIXTURE_PROFILE.contactInvitation);
        expect(routes[0]).not.toHaveProperty("openTo");
    });

    it("words each route with the profile's title and prompt, and gives it no button", () => {
        const routes = contactRoutes(FIXTURE_PROFILE);
        expect(routes.map((route) => [route.title, route.prompt])).toEqual([
            [
                "Internships & roles",
                FIXTURE_PROFILE.contactRoutes?.hiring?.prompt,
            ],
            [
                "Research & collaboration",
                FIXTURE_PROFILE.contactRoutes?.research?.prompt,
            ],
            ["Hello", FIXTURE_PROFILE.contactRoutes?.hello?.prompt],
        ]);
        // The form's topic is the one control: no route carries a button.
        expect(routes.some((route) => "cta" in route)).toBe(false);
    });

    it("names a route by its topic without a title, and leaves out an empty prompt", () => {
        const [hiring, hello] = contactRoutes(
            profileOf({
                availability: availabilityOf(),
                contactRoutes: {
                    hiring: { title: "  ", prompt: "The role." },
                    hello: { title: "Hi", prompt: " " },
                },
            }),
        );
        expect(hiring).toMatchObject({ title: "Hiring", prompt: "The role." });
        expect(hello.title).toBe("Hi");
        expect(hello).not.toHaveProperty("prompt");
        // No profile: the topic's name, and no prompt.
        expect(contactRoutes(null).map((route) => route.title)).toEqual([
            "Hello",
        ]);
        expect(contactRoutes(null).some((route) => "prompt" in route)).toBe(
            false,
        );
    });

    it("hides Consulting until availability.consultingOpen is on", () => {
        const profile = profileOf({ availability: availabilityOf() });
        expect(topicsOf(profile)).not.toContain("consulting");
        expect(
            topicsOf(
                profileOf({
                    availability: availabilityOf({ consultingOpen: false }),
                }),
            ),
        ).not.toContain("consulting");
        expect(
            topicsOf(
                profileOf({
                    availability: availabilityOf({ consultingOpen: true }),
                }),
            ),
        ).toEqual(["hiring", "consulting", "hello"]);
    });

    it("shows Hiring only while the profile says what the owner is open to", () => {
        expect(
            topicsOf(
                profileOf({
                    availability: availabilityOf({ status: "closed" }),
                }),
            ),
        ).toEqual(["hello"]);
        // No availability, or a status with no Open To line: no Hiring,
        // as on the home page and the CV.
        expect(topicsOf(profileOf())).toEqual(["hello"]);
        expect(
            topicsOf(
                profileOf({
                    availability: availabilityOf({ seeking: [] }),
                }),
            ),
        ).toEqual(["hello"]);
        const [hiring] = contactRoutes(
            profileOf({ availability: availabilityOf() }),
        );
        expect(hiring.topic).toBe("hiring");
        expect(hiring).not.toHaveProperty("openTo");
    });

    it("shows Research only with the owner's invitation", () => {
        expect(topicsOf(profileOf({ contactInvitation: "  " }))).toEqual([
            "hello",
        ]);
        expect(
            topicsOf(profileOf({ contactInvitation: "Working on vision?" })),
        ).toEqual(["research", "hello"]);
    });

    it("keeps Hello without a profile", () => {
        expect(topicsOf(null)).toEqual(["hello"]);
    });

    it("links the résumé PDF only when one is uploaded, and LinkedIn from the profile", () => {
        const withPdf = contactRoutes(
            profileOf({
                availability: availabilityOf(),
                resumeUrl: "https://cdn.sanity.io/files/x/y/cv.pdf",
                socialLinks: [
                    {
                        _key: "in",
                        label: "LinkedIn",
                        url: "https://www.linkedin.com/in/someone",
                    },
                ],
            }),
        );
        expect(withPdf[0].links.map((link) => link.href)).toEqual([
            "/resume/view",
            "/resume",
        ]);
        expect(withPdf.at(-1)?.links).toEqual([
            { href: "/feed.xml", label: "RSS" },
            {
                href: "https://www.linkedin.com/in/someone",
                label: "LinkedIn",
                external: true,
            },
        ]);
        expect(
            contactRoutes(
                profileOf({ availability: availabilityOf() }),
            )[0].links.map((link) => link.href),
        ).toEqual(["/resume"]);
    });

    it("never offers an email address or phone number", () => {
        const text = JSON.stringify(
            contactRoutes(
                profileOf({
                    availability: availabilityOf({ consultingOpen: true }),
                    contactInvitation: "Hello.",
                }),
            ),
        );
        expect(text).not.toMatch(/mailto:|tel:|@[a-z0-9-]+\./i);
    });

    it("offers one topic per route, with its prompt", () => {
        const options = topicOptions(contactRoutes(FIXTURE_PROFILE));
        expect(options.map((option) => option.label)).toEqual([
            "Internships & roles",
            "Research & collaboration",
            "Hello",
        ]);
        expect(options.map((option) => option.prompt)).toEqual([
            FIXTURE_PROFILE.contactRoutes?.hiring?.prompt,
            FIXTURE_PROFILE.contactRoutes?.research?.prompt,
            FIXTURE_PROFILE.contactRoutes?.hello?.prompt,
        ]);
        expect(topicOptions(contactRoutes(null))[0]).not.toHaveProperty(
            "prompt",
        );
    });
});

describe("contact topics", () => {
    it("recognises the four topics only", () => {
        expect(CONTACT_TOPICS.every(isContactTopic)).toBe(true);
        expect(isContactTopic("role")).toBe(false);
        expect(isContactTopic(undefined)).toBe(false);
    });

    it("prefixes the subject with the topic", () => {
        expect(contactSubject("hiring")).toBe(
            "[Hiring] Contact Form for My Website",
        );
        expect(contactSubject("hello")).toBe(
            "[Hello] Contact Form for My Website",
        );
    });

    it("reads a shown route's topic from the fragment", () => {
        const shown = ["hiring", "hello"] as const;
        expect(topicFromHash("#hiring", shown)).toBe("hiring");
        expect(topicFromHash("hello", shown)).toBe("hello");
        // Hidden, unknown or empty fragments pick nothing.
        expect(topicFromHash("#consulting", shown)).toBeNull();
        expect(topicFromHash("#message", shown)).toBeNull();
        expect(topicFromHash("", shown)).toBeNull();
    });
});

describe("contact form checks", () => {
    it("asks for an email address and a message", () => {
        expect(validateContactFields({ senderEmail: "", message: "" })).toEqual(
            {
                senderEmail: "Enter your email address.",
                message: "Write a message before sending.",
            },
        );
        expect(
            validateContactFields({
                senderEmail: "  you@example.com ",
                message: "Hi",
            }),
        ).toEqual({});
    });

    it("refuses a malformed address and an over-long message", () => {
        const errors = validateContactFields({
            senderEmail: "you@example",
            message: "x".repeat(1001),
        });
        expect(errors.senderEmail).toMatch(/you@example\.com/);
        expect(errors.message).toBe(
            "Shorten the message to 1,000 characters or fewer.",
        );
        expect(
            validateContactFields({
                senderEmail: `${"a".repeat(496)}@b.co`, // 501 characters
                message: "x",
            }).senderEmail,
        ).toBeDefined();
    });

    it("checks the email when it is left filled, and every field from the first submit", () => {
        const empty = { senderEmail: "", message: "" };
        const malformed = { senderEmail: "you@example", message: "" };
        // Before anything: no errors, however the fields stand.
        expect(shownErrors(malformed, "none")).toEqual({});
        // The email left filled: its shape only, never an empty field.
        expect(shownErrors(malformed, "email")).toEqual({
            senderEmail: "Enter an email address like you@example.com.",
        });
        expect(shownErrors(empty, "email")).toEqual({});
        // From the first submit: every rule.
        expect(shownErrors(empty, "all")).toEqual(validateContactFields(empty));
    });

    it("starts a broken link's report with its address, and nothing else", () => {
        expect(reportedMessage("?broken=%2Fblog%2Fno-such-post")).toBe(
            "Broken link: /blog/no-such-post",
        );
        // Only a path on this site: a crafted link cannot write the message.
        for (const search of [
            "",
            "?broken=",
            "?broken=https%3A%2F%2Fexample.com",
            "?broken=%2F%2Fexample.com",
            "?broken=Hello%20there",
            `?broken=%2F${"a".repeat(301)}`,
        ]) {
            expect(reportedMessage(search), search).toBeNull();
        }
    });

    it("announces the characters left once per band", () => {
        expect(remainingNotice(0)).toBe("");
        expect(remainingNotice(899)).toBe("");
        expect(remainingNotice(900)).toBe("100 characters or fewer left.");
        expect(remainingNotice(949)).toBe("100 characters or fewer left.");
        expect(remainingNotice(950)).toBe("50 characters or fewer left.");
        expect(remainingNotice(1000)).toBe("Character limit reached.");
    });
});
