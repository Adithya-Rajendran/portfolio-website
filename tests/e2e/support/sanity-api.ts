import type { Page, Route } from "@playwright/test";

/**
 * A minimal stand-in for the Sanity HTTP API the Studio calls from the
 * browser (`<projectId>.api.sanity.io`), so the embedded Studio can boot in
 * the fixture build, whose project id is the `fallback` sentinel, without
 * leaving the machine. It answers only what the Studio needs to reach its
 * login screen (`signedIn: false`) or its structure with empty lists
 * (`signedIn: true`); every other call gets an empty object.
 *
 * The shapes follow what the Studio reads. If a Sanity upgrade makes the
 * Studio throw on one of them, extend the matching answer here.
 */
export async function stubSanityApi(
    page: Page,
    { signedIn }: { signedIn: boolean },
): Promise<void> {
    const json = (route: Route, body: unknown) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(body),
        });

    // The Visual Editing bridge the Studio loads from Sanity's CDN.
    await page.route(/^https:\/\/core\.sanity-cdn\.com\//, (route) =>
        route.fulfill({ contentType: "text/javascript", body: "" }),
    );

    await page.route(/^https:\/\/[a-z0-9-]+\.api\.sanity\.io\//, (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/users/me")) {
            // An anonymous visitor gets an empty object, as from the real API.
            return json(
                route,
                signedIn
                    ? {
                          id: "p-fixture-editor",
                          name: "Fixture editor",
                          role: "administrator",
                          roles: [
                              { name: "administrator", title: "Administrator" },
                          ],
                      }
                    : {},
            );
        }
        if (path.endsWith("/auth/providers")) {
            return json(route, {
                providers: [
                    {
                        name: "sanity",
                        title: "E-mail / password",
                        url: "https://api.sanity.io/v1/auth/login/sanity",
                    },
                ],
            });
        }
        if (path.includes("/data/listen/")) {
            return route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body: 'event: welcome\ndata: {"listenerName":"fixture"}\n\n',
            });
        }
        if (path.includes("/data/query/")) {
            return json(route, { ms: 0, query: "", result: [] });
        }
        if (path.includes("/acl") || path.endsWith("/grants")) {
            return json(route, [
                {
                    path: "**",
                    config: { filter: '_id in path("**")' },
                    grants: ["read", "update", "create", "history"].map(
                        (name) => ({ name, params: {} }),
                    ),
                },
            ]);
        }
        if (/\/projects\/[^/]+\/?$/.test(path)) {
            return json(route, {
                id: "fallback",
                displayName: "Fixture",
                members: [],
                features: [],
            });
        }
        // Lists the Studio reduces over.
        if (
            /\/(datasets|user-applications|features)$/.test(path) ||
            path.includes("/journey/announcements") ||
            path.includes("/keyvalue/")
        ) {
            return json(route, []);
        }
        return json(route, {});
    });
}
