# Security audit — November 6, 2026

The reviewed traffic contains genuine credential-file scanning. Existing controls blocked the sampled `.env` probes; other nonexistent endpoints returned 404. No demonstrated application exploit, exposed credential, or server failure was found in this review. That conclusion is limited to the code, configuration, alerts and telemetry inspected; it is not a forensic guarantee that no compromise has occurred.

The audit preserves public agent reading, human-only contact, the owner-only Studio policy, all 19 geographic restrictions and the free Cloudflare plan. No blanket crawler challenge or paid feature was enabled.

## Evidence and scope

Reviewed the production domain and alternate entry points, Cloudflare WAF/Access/TLS/bot/rate-limit configuration, Worker logs, published-content handlers, contact delivery, rendering and outbound URL handling, Sanity browser permissions, dependencies, repository alerts and deployment protections.

Cloudflare daily aggregates, as returned during the audit:

| UTC date                | Requests | Cloudflare-reported threats |
| ----------------------- | -------: | --------------------------: |
| November 4              |    8,340 |                         327 |
| November 5              |    6,331 |                         405 |
| November 6, partial day |    6,305 |                       1,416 |

These are requests and provider classifications, not counts of people or confirmed compromises. They do not establish whether an attacker used AI.

For November 5 at 23:40 UTC through November 6 at 23:40 UTC, adaptive HTTP analytics reported 1,975 responses with status 404 and 1,364 with status 403. Sampling applies, and this window differs from the daily table. Security-event samples showed a burst of requests including `/postgres/.env`, `/github/.env`, nested application `.env` files and environment backups, all blocked with 403 by the private-path rule. These probes came from outside the geographic blocklist, demonstrating why path and application controls matter independently of geography.

Worker telemetry for November 6, 00:00–23:40 UTC, showed 1,919 logged 404 responses and no logged 5xx response group or error event. There were 62 canceled invocations; cancellation alone is not evidence of an attack or application failure. Public pages, articles and projects also had successful responses. No load test or unbounded scanner was run.

## Findings and changes

| Finding                                                                   | Assessment                                                                           | Action                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retired Sanity browser origins still allowed authenticated requests       | Unnecessary trust after the Vercel migration; not an authentication bypass by itself | Removed the old Vercel production origin, its project-scoped preview wildcard and the disabled `workers.dev` origin. Only the production domain remains, with credentials allowed for Studio.                                                            |
| Administrators could bypass `v2-rewrite` protections                      | Deployment safeguard gap                                                             | Enabled administrator enforcement of the existing pull-request and required-check rules. Required checks, strict branch freshness, and force-push/deletion prohibitions are unchanged.                                                                   |
| Case variants and some observed secret-file/CMS probes reached the Worker | Low-impact avoidable work; requests returned 404, not secret data                    | Extended the existing block rule with case-insensitive matching, `/credentials.json`, `/service-account.json`, `/wordpress`, `/wp` and unused WordPress content paths. Cloudflare validation passed before applying the change.                          |
| Four high-severity CodeQL alerts referenced incomplete URL matching       | Test-only mock dispatch, not production URL validation                               | Replaced substring matching with exact provider URLs and an exact DNS origin/path. The successful-delivery test also asserts the complete list of outbound URLs. These changes target the alerts for the next CodeQL analysis; no alerts were dismissed. |
| Dependency and secret alerts                                              | No known issue found                                                                 | The current lockfile audit reported zero known vulnerabilities. GitHub had no open Dependabot or secret-scanning alerts. Secret scanning and push protection are enabled.                                                                                |

Cloudflare readback confirmed that only the private-path rule changed within the five-rule custom ruleset. GitHub readback confirmed that only administrator enforcement changed. Sanity readback confirmed the single retained origin. The managed WAF, contact limits and identity policy were retained.

Sanity explains why [credentialed CORS origins should be trusted and retired origins removed](https://www.sanity.io/docs/content-lake/cors). GitHub documents [administrator enforcement for protected branches](https://docs.github.com/en/rest/branches/branch-protection#set-admin-branch-protection). Both changes are reversible and add no paid service.

## Application protections checked

- Contact requires the canonical Origin, URL-encoded input, a bounded body and fields, a working rate-limit binding, and a server-verified Turnstile token for the exact hostname and action. Mail destinations and outbound provider endpoints are fixed by the application/configuration. Automated tests use injected providers and send no real email.
- Public HTML has a per-response script nonce and restrictive CSP, framing protection, HSTS and `nosniff`. Public pages do not inherit Studio's broader browser policy.
- Rendered content escapes text, restricts link schemes and embeds, and uses published content with request-time date filtering. No demonstrated XSS or SSRF path was found in the reviewed handlers.
- Studio redirects to Cloudflare Access, including a percent-encoded spelling of the route. An encoded-slash variant returns 404. The reusable Access policy allows one owner identity, with no universal include or bypass.
- `workers.dev` and version preview URLs are disabled. The `www` alias redirects to the canonical domain. DNSSEC, strict TLS, minimum TLS 1.2 and disabled 0-RTT remain in place.
- Public reading does not require a successful browser challenge. User-agent strings do not grant contact or Studio privileges. Robots exclusions remain directions to cooperative clients, not access controls.

## Verification

The current code passed lint, type checking and 597 unit tests with coverage thresholds satisfied, including 17 contact tests. Live checks verified readable public routes and discovery documents, denial of private-file requests, Access protection for Studio, and rejection of cross-origin or wrong-content-type contact requests. No real message was sent. Full build and browser checks also remain required before merging the test changes.

## Remaining considerations

1. **Account security:** this audit did not establish MFA/passkey enrollment, recovery-code handling, or the full member/token inventories for Cloudflare, GitHub, Sanity, Resend and the domain registrar. Verify those through the owner accounts. Site firewall rules cannot protect a compromised deployment or editorial account.
2. **Availability:** public content deliberately performs fresh Sanity reads. A distributed reader can consume Worker and CMS capacity without triggering contact controls. The Sanity usage snapshot recorded 5,570 API requests and 445 API-CDN requests for the month through the November 6 snapshot; no quota incident was demonstrated. Monitor request volume, upstream failures and usage before trading freshness or reader access for caching or broader limits. Contact limits are per Cloudflare location, not a global mail budget.
3. **Content confidentiality:** the Sanity dataset is public. Anonymous access to published documents is expected; application date filters are not a confidentiality boundary for already-published CMS documents. Keep embargoed content in drafts and credentials outside CMS content. No dataset privacy or content changes were made.
4. **Crawler policy:** a site that welcomes agents must allow unauthenticated reads of its public content. Agent identity and AI use cannot be established from a claimed user agent. Keep behavior, path, method and privilege checks as the enforcement boundaries. Cloudflare's free [Bot Fight Mode](https://developers.cloudflare.com/bots/plans/free/) is a domain-wide intervention and was left off to preserve the requested reading experience.

## Operations and rollback

Use the existing [Cloudflare security runbook](cloudflare-security.md) and investigate unexpected blocks by Ray ID before adding exceptions. This audit did not rotate credentials, alter CMS content, expand country blocks or change mail DNS.

Non-secret before/after snapshots and bounded probe results are saved on the working host under `/tmp/portfolio-security-audit-2026-11-06/`. That directory is temporary, not a durable backup. The private-path rule changed from version 1 to version 2; restore its prior expression from the saved snapshot if needed, without replacing the other rules. The retired Sanity origins and credential flags are recorded in `sanity-cors-before.json`; re-add only an origin that is actively needed and trusted. Administrator enforcement can be disabled separately without removing the branch's other protections. Revert the test-only commit through a normal pull request if necessary.
