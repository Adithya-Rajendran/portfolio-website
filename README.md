# Adithya Rajendran — Personal Website

Public Website: [https://adithya-rajendran.com](https://adithya-rajendran.com)

## Overview

A writing-first personal website about systems, robotic vision, AI, and possible futures. The design pairs quiet stars and an imagined lunar settlement with readable field notes. Professional experience, projects, and a résumé remain one click away.

## Features and Technologies

- **Next.js**: App Router, Server Components, and tagged Sanity caching.
- **React & TypeScript**: Robust, scalable, and type-safe development environment.
- **Tailwind CSS**: Responsive layouts with shared charcoal, cream, and copper design tokens; self-hosted fonts and reduced-motion support.
- **Sanity CMS**: Code-defined Profile, Blog Post, Project, and structured rich-prose schemas.
- **SEO Optimized**: Implements structured data (JSON-LD) and semantic HTML for optimal search engine visibility.
- **Blog**: Chronological posts, optional topics, archive search, readable code blocks, article contents, and a full-content RSS feed. Follow actions connect to LinkedIn and RSS.
- **Automated Testing**: GitHub Actions runs lint, type checks, Vitest unit tests, a production build, and Playwright browser tests (smoke, no-JavaScript, axe accessibility, layout, a byte report, review screenshots and the embedded Studio) against a fixture build, then again against each Vercel preview.
- **Contact Handling**: A Resend-backed contact form protected by Vercel BotID and WAF rate limiting, with Zod validation and MX record checks.

## Getting Started

### Prerequisites

- Node.js 24.x (`engines` in `package.json`)
- pnpm 10.34.5, pinned by `packageManager` in `package.json` (`corepack enable` picks it up)

### Installation

```bash
pnpm install
```

### Running the Project

**Development:**

```bash
pnpm dev
```

**Production:**

```bash
pnpm build
pnpm start
```

**Tests:**

```bash
pnpm test                               # Vitest unit tests
pnpm exec playwright install chromium   # once, for the browser tests
pnpm test:e2e                           # builds the fixture site and runs Playwright
BASE_URL=https://<preview-url> pnpm test:e2e:preview   # the same specs against a deployment
```

`CLAUDE.md` lists the full pre-merge gate and what each browser spec checks. Reports are written to `playwright-report/`.

## Content and deployment

- Copy `.env.example` to `.env.local` and set the public Sanity project and dataset values. Published content needs no read token. Keep local environment files out of Git.
- Edit your profile, résumé PDF, posts, and projects in `/studio`. Publishing a profile, post or project calls the Sanity webhook, which refreshes every page that shows it, including project pages (the webhook's filter in Sanity must include `project`). The daily scheduled-post refresh releases future-dated posts the same way.
- In **Profile → Identity**, edit the current headline, short introduction, and search description. These flow through the homepage, About, search metadata, and social previews. The optional **Tagline** is stored for the redesigned home page.
- In **Profile → Status**, set **Availability** (status, what you are open to, and when you last confirmed it) and **Launch** (the date and event the redesign's mission clock counts from). Leave **Open to Consulting** off until the site is on the Vercel Pro plan. These fields, **Talks & Papers**, **Start Here Posts**, the kind and related post or project of each Right Now item, and the kind of each link are stored now and shown by the redesign.
- In **Profile → Homepage & Writing**, edit focus areas, Work summary, writing introduction, featured article, and the optional closing contact invitation. The featured selection falls back to the latest published post; unpublished and future-dated posts stay hidden. Recent notes update automatically.
- In **Profile → About / Right Now**, edit the biography, location, profile links, portrait, and current interests. Removing a link or optional content hides it on the site.
- In **Profile → Portfolio**, maintain experience, education, skills, credentials, and the résumé PDF. Use **Currently Here** for ongoing work or study and **Expected Graduation Year** for a year-only estimate. When you know only the year a role or degree started or ended, enter any day in that year and set **Start Date Precision** or **End Date Precision** to **Year only**: the site then prints the year alone. Each entry also takes a short organization name for the Trajectory map, a website, an employment type, and an optional change of direction. The optional **Résumé Note** identifies an older PDF while a replacement is being prepared. Profile edits do not rewrite the uploaded PDF.
- Posts own their title, description, body, publication date, and topic tags; Projects own their case studies. Topic pages and archive filters follow published tags automatically. In the Studio, posts are under **Flight Log · Posts** (with a **Scheduled** list of posts dated after today, which the daily refresh releases) and projects under **Missions · Projects**, ordered by mission number.
- Each post can also take a **Cover** (with alt text, caption, credit and kind), up to three **Related Projects**, and a **Revised At** date for substantive revisions. The redesign shows them; the current pages do not yet.
- Each project has a **Mission Number** (MSN-01 to MSN-99; a new project takes the next free one, and two projects cannot share one), one to three **Types**, and an optional **Featured Slot** for the home page and Missions stage (the Studio warns when two missions share a slot). Status adds **Planned** and **Stopped**, and **Completed** is shown as "Complete". When you know only the years, enter any day in each year and set **Date Precision** to **Year only**; turn on **Dates Are Estimates** to print them as "c. 2023". The optional status note, role, parameters, brief, results, lessons, next steps, portrait cover and **3D Model** (a poster, a description and numbered callouts that link to an essay or post heading, which the Studio checks) are stored now and shown by the redesign.
- Your four résumé projects (the Gmail filter, the homelab, the Kubernetes cluster and this website) are drafted from the résumé, the homelab post and your answers, and a named migration creates them as Studio drafts. You run it, review each draft, fill in what only you know and publish it; `migrations/README.md` lists the commands and the review steps. A second migration turns the one legacy link in the homelab post into the link type the Studio writes.
- The visual theme, navigation, section labels, artwork, and stable site identity stay in code. No code change or redeploy is needed for the content fields above.
- The approved artwork is the Lunar Shared Horizon scene. `public/images/lunar-horizon-v2/` contains the smaller pre-encoded AVIF/WebP sizes and mobile crops. The 3840px variants in `public/images/lunar-horizon-v3/` are encoded directly from the lossless original in `assets/artwork/` at higher quality, preserving fine texture and full chroma detail in AVIF. An inline preview appears while the selected image loads. Responsive preloads fetch only the format and size needed. Regenerate the assets and `lib/hero-artwork.json` with `node scripts/generate-hero-artwork.mjs`; bump the output directory version when changing artwork or encoding settings because these URLs are cached immutably. The source is 1672 × 941, so the 4K delivery dimensions do not imply native 4K detail. The WebP master that reproduces the existing smaller variants, `assets/artwork/lunar-shared-horizon-v1.webp`, sits next to the original and outside `public/`, so neither is served.
- The existing Vercel project builds GitHub branches as previews and `main` as production. Keep the existing Sanity, Resend, BotID, webhook, and cron settings. No new service or environment variable is required by this redesign. Vercel honours the `packageManager` pnpm pin only when `ENABLE_EXPERIMENTAL_COREPACK=1` is set in the project; otherwise it infers pnpm from the lockfile.
- The browser tests also run against every successful Vercel preview (`.github/workflows/e2e-preview.yml`). If previews are protected, create a **Protection Bypass for Automation** secret in Vercel (Settings → Deployment Protection) and store it as the GitHub Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET`; until it exists, that workflow skips with a notice.
- Before merging, run the checks documented in `CLAUDE.md` and verify a Vercel preview. Existing `/blog`, `/portfolio`, `/resume`, RSS, and résumé PDF routes are preserved.

## Contribution

Contributions are welcome (idk why you'd want to lol just fork it for yourself)! Please submit any issues or pull requests through GitHub. Thank you.

## Credits

Inspired by a ByteGrad tutorial on TypeScript and NextJS. Further details and acknowledgments can be found [here](https://youtu.be/sUKptmUVIBM?si=ygmF29AB9rJ99pOW). Changed quite a bit since then.

## Contact

Feel free to send feedback through the contact form on my website or directly via [LinkedIn](https://www.linkedin.com/in/adithya-rajendran/).
