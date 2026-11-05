# Cloudflare security configuration

Reviewed November 5, 2026 (America/Los_Angeles). Applies to `adithya-rajendran.com`, its `www` alias, and Worker `portfolio-v2` on branch `v2-rewrite`. The owner authorized domain-wide hardening, keeping the non-US challenge for Studio, and retaining every existing country block. No paid upgrade was added.

## Edge protections

| Control               | Configuration                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS                 | Always Use HTTPS remains enabled; Full (strict) SSL mode; minimum TLS 1.2; TLS 1.3 enabled.                                                                                 |
| Replay exposure       | TLS 0-RTT disabled.                                                                                                                                                         |
| HSTS                  | Two years, including subdomains; existing preload directive retained. No new preload-list submission was made.                                                              |
| DNSSEC                | Already active; public DS record and validating resolver AD flag verified.                                                                                                  |
| Managed WAF           | Cloudflare Free Managed Ruleset explicitly deployed with its default rules and automatic version updates.                                                                   |
| DDoS / bots           | Existing DDoS protection, Bot Fight Mode, Browser Integrity Check and crawler policy retained.                                                                              |
| Contact burst limit   | Five requests per IP per Cloudflare data center in ten seconds; block for ten seconds. Replaces the unused `/login` rate limit.                                             |
| Contact Worker limit  | Five submissions per IP per minute, now before body parsing; fail closed when the binding or client IP is unavailable. 429 replies include `Retry-After: 60`.               |
| Contact validation    | Same-origin URL-encoded submissions only, 16 KiB streaming body cap, bounded fields, Turnstile action and hostname verification, fixed mail recipient.                      |
| Turnstile             | Existing v2 widget restricted to `adithya-rajendran.com`; production hostname binding supplied by Workers Builds. Secret and sitekey unchanged.                             |
| Alternate entrypoints | `workers.dev` and version preview URLs disabled in Cloudflare and Wrangler source configuration.                                                                            |
| Canonical host        | Edge 308 redirects every `www` path to the apex, preserving path and query. This includes static Studio files that bypass Astro middleware.                                 |
| Studio                | Existing owner-only Cloudflare Access policy retained. Non-US requests to `/studio` and descendants receive a managed challenge as requested. The country block runs first. |
| Cache                 | Studio and API paths explicitly bypass edge caching; nonce-bearing HTML and contact responses use `no-store`.                                                               |
| Script rewriting      | Rocket Loader disabled to keep the application script policy and execution order predictable.                                                                               |

Rate limits are approximate and distributed per Cloudflare location. They supplement Turnstile; they are not a global transaction counter. Cloudflare documents these limits in [rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/).

## Custom firewall rules

The five rules, in order:

1. **Block OFAC and high-risk countries** (`0eb1cde72b5045c9b985c30e5112c420`). Blocks the geographic policy below.
2. **Challenge non-US access to Sanity Studio** (`9ef2e81cf84242d5b19030d547590e6e`). Matches non-US sources on `/studio` and `/studio/*`. Replaces the old login/signup/admin-path expression without removing the rule.
3. **Block private-file and unused CMS probes** (`01a41462a9a44609a5c222b5b013aef9`). Blocks requests for `.git`, `.env`, `.dev.vars`, dependency/config files and unused WordPress/phpMyAdmin endpoints. It does not block `.well-known`.
4. **Allow only website methods and contact POST** (`0c6c4a8ee5b94017ba9cc8027fdfa3eb`). Allows GET, HEAD and OPTIONS, plus POST to `/api/contact` and `/api/contact/`. Cloudflare-owned `/cdn-cgi/` endpoints are excluded from this method restriction.
5. **Reject cross-site or unsupported contact submissions** (`43e8b0da71f54d0f860a6c90713479a0`). Rejects POSTs to the contact endpoint without the canonical Origin or URL-encoded content type, before Worker execution. The application repeats these checks.

The retired Next.js `/api/revalidate` skip rule was disabled after verifying the handler was absent and returned 404. The owner subsequently removed it. No broad replacement of the custom ruleset was performed.

## Geographic policy audit

All 15 original entries remain: Bahrain (`BH`), China (`CN`), Cuba (`CU`), Iran (`IR`), North Korea (`KP`), Libya (`LY`), Myanmar (`MM`), Pakistan (`PK`), Sudan (`SD`), Suriname (`SR`), Syria (`SY`), Tunisia (`TN`), Yemen (`YE`), Zimbabwe (`ZW`) and Russia (`RU`). Suriname (`SR`) is distinct from South Sudan (`SS`); the existing code was preserved literally.

Four additions bring the total to 19 geographic codes:

| Addition                       | Basis for the owner's broader risk policy                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Belarus (`BY`)                 | ESET reported continued 2026 activity by the Belarus-linked FrostyNeighbor/Ghostwriter group, building on Mandiant's attribution research.                                        |
| Venezuela (`VE`)               | Included in DOJ's Data Security Program countries-of-concern guidance. This is a policy risk signal, not a claim that the portfolio handles transactions covered by that program. |
| Hong Kong (`HK`), Macau (`MO`) | Separately geolocated jurisdictions included alongside China in the same DOJ guidance; covered explicitly for consistency with the owner's existing China policy.                 |

Sources reviewed: [ESET's 2026 research](https://www.welivesecurity.com/en/eset-research/frostyneighbor-fresh-mischief-digital-shenanigans/), [Mandiant attribution research](https://cloud.google.com/blog/topics/threat-intelligence/unc1151-linked-to-belarus-government), [DOJ compliance guide](https://www.justice.gov/opa/media/1396356/dl), and [OFAC FAQ 10](https://ofac.treasury.gov/faqs/10). OFAC describes jurisdictional and targeted programs; this blocklist is the owner's combined geographic risk policy, not an authoritative OFAC list or a complete sanctions-compliance mechanism.

The additions are preventive policy choices. The initial attempt to read recent Cloudflare security-event analytics returned a temporary GraphQL budget-limit error. No claim is made that these locations were observed attacking this website. Source-IP geography can also reflect proxies or compromised infrastructure; the WAF, Access and contact controls apply independently of this geographic filter. Further expansion should use actual security events and the cost of blocking legitimate visitors.

## Public reading and human-only contact

The public HTML contains its text and navigation without requiring JavaScript or WebGL. `/llms.txt` now provides a request-time index of all published posts and projects, the main reading pages, the full RSS feed and sitemap. HTML head links and a robots.txt comment make that guide discoverable. The index shares the site's published perspective, date filtering and `no-store` freshness contract; an upstream failure remains an error.

Crawler directions exclude `/contact`, its legacy `/comms` alias, `/api/` and `/studio`; contact is also omitted from the sitemap and agent guide. These directions do not grant a security bypass. Contact submissions still require same-origin input, the existing rate limits and a server-verified Turnstile token for the exact hostname and `contact` action. No user-agent string grants submission privileges. The unused Turnstile widget is retained; the live contact widget and its credentials are unchanged.

## Application browser policy

Public production HTML uses a fresh cryptographic nonce for each response. Only explicitly trusted clock, theme, structured-data, relay-preview and contact-success scripts receive the nonce. Astro's processed scripts remain external assets. Arbitrary response HTML is never rewritten to grant script execution.

Public scripts no longer allow `unsafe-inline` or `unsafe-eval`. Sanity Studio retains its separate, compatible policy, while public pages no longer receive Studio's broad API, WebSocket, font or frame permissions. Turnstile frame/connection permissions are restricted to the contact routes. Blob fetches remain restricted to the two pages that require embedded model textures. Inline styles remain allowed for existing layouts and syntax highlighting.

The existing Cloudflare managed security-header preset remains enabled. It supplies edge-response headers and can override the application's X-Frame-Options and Referrer-Policy values. The public application's `frame-ancestors 'none'` CSP still prevents framing. Per-response CSP stays in the application so its nonce matches the HTML.

Redirects and explicit error responses receive the same security headers. Cloudflare's [Bot Fight Mode guidance](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/#javascript-detections) confirms its injected scripts can inherit a nonce from the CSP response header.

## Verification and operations

- Production build, lint and type checking passed; existing Three.js deprecation hints remain.
- 565 unit tests passed with coverage thresholds satisfied.
- Seven browser security tests passed against the production-built Worker: fresh nonces, working trusted boot scripts, blocked injected script and inline handler, and no observed CSP violations on home, experience, projects, writing, about and contact.
- Live edge checks confirmed HTTPS redirect, HSTS, 403 for private-file/unused-CMS probes and unsupported methods, the private Studio Access redirect, `www` canonical redirect, disabled Worker address, and a short contact-endpoint burst receiving 429.
- No real contact email was sent during these checks. A completed human Turnstile challenge, email delivery, and an authenticated Studio editing session are separate from the browser-policy checks.

Use [Security rules](https://dash.cloudflare.com/0bd607b9c2e2254ab290285fbf41b2c9/adithya-rajendran.com/security/security-rules) and [Security events](https://dash.cloudflare.com/0bd607b9c2e2254ab290285fbf41b2c9/adithya-rajendran.com/security/events) to investigate a blocked visitor by Ray ID before changing a rule. Prefer correcting the specific rule over broad skip exceptions. Geography additions were merged into the existing rule, retaining all prior entries.

The pre-change non-secret configuration snapshot is `/tmp/portfolio-security-before.json` on the working host. Existing rule versions also retain their prior expressions. Application rollback should revert the security commit and redeploy; edge settings require separate changes. Re-enabling public Worker URLs would restore a route around the domain's controls and should only accompany equivalent Access protection. Mail DNS, existing private-network DNS records, credentials and the Studio identity policy were not changed.
