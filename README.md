# Adithya Rajendran — Personal Website

Public Website: [https://adithya-rajendran.com](https://adithya-rajendran.com)

## Overview

A writing-first personal website about systems, robotic vision, AI, and possible futures. The design pairs NASA's photograph of an orbital sunrise and a quiet starfield with readable field notes. Professional experience, projects, and a résumé remain one click away.

## Features and Technologies

- **Next.js**: App Router, Server Components, and tagged Sanity caching.
- **React & TypeScript**: Robust, scalable, and type-safe development environment.
- **Tailwind CSS**: CSS-first Tailwind 4 over the Deep Field design tokens in `styles/`: two themes, Void (dark, the default) and Flight Manual (light), chosen from the header, the menu or the footer (Auto follows the system), with no flash on load; self-hosted Jost, Newsreader, DM Mono and Michroma; a Pause motion control and reduced-motion support.
- **Sanity CMS**: Code-defined Profile, Blog Post, Project, and structured rich-prose schemas.
- **SEO Optimized**: Implements structured data (JSON-LD) and semantic HTML for optimal search engine visibility.
- **Blog**: The Flight Log index at `/blog`: every entry numbered LOG 001 onwards in the order it was filed, grouped by year on shared columns (entry, date, title and standfirst, reading time), with tag chips and their counts and a chart of every entry on a time axis. Tag pages, an archive with search, and a full-content RSS feed. Each entry is a paper-grade long read: its first paragraph on the first screen, a 68-character measure, a sticky "In this entry" record (LOG number, filed and revised dates, length, what it holds, the linked mission) with its contents, numbered code listings with a Copy button that break out wide when a line is long, numbered plates and figures, callouts, footnotes in the margin and in the notes at the end, the revisions, previous and next entries, and a print layout. Follow actions connect to LinkedIn and RSS.
- **Missions**: `/portfolio` shows the featured project on its stage beside its photograph, the others as text-first tiles, and a register of every project (code, mission, type, status, dates, links); its old section links (`#experience`, `#skills`, `#certifications`, `#engineering-writing`, `#contact`) lead on to where those sections live now. Each project has a mission file at `/portfolio/<slug>`: its name, title and summary, its parameters as stats, a title block, and its model's callouts, brief, write-up, results, lessons and next steps, links and related Flight Log entries, each shown only when it is filled in.
- **Automated Testing**: GitHub Actions runs lint, type checks, Vitest unit tests, a production build, and Playwright browser tests (smoke, no-JavaScript, axe accessibility in both themes, layout, theme and menu behaviour, the contact page, the Flight Log index, the missions, a byte report, review screenshots and the embedded Studio) against a fixture build, then again against each Vercel preview.
- **Contact Handling**: `/contact` (Comms) routes a message by intent: internships and roles, research and collaboration (shown when the profile has a contact invitation), consulting (only while it is switched on) and hello. Each route picks the form's topic, which prefixes the email subject. The Resend-backed form is protected by Vercel BotID and WAF rate limiting, with Zod validation and MX record checks. It needs JavaScript for BotID, so without it the page offers LinkedIn. There is no public email address or phone number; `/portfolio#contact` still answers, with a link to `/contact`.

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
- In **Profile → Identity**, edit the current headline, short introduction, and search description. These flow through the homepage, About, search metadata, and social previews. The optional **Tagline** is the line under your name on the home page; without one, the introduction's first sentence is used.
- In **Profile → Status**, set **Availability** (status, what you are open to, and when you last confirmed it) and **Launch** (the date and event the redesign's mission clock counts from). Availability feeds the Internships & roles route on `/contact` (a Closed status hides that route). Leave **Open to Consulting** off until the site is on the Vercel Pro plan; switching it on shows the Consulting route. These fields, **Talks & Papers**, **Start Here Posts**, the kind and related post or project of each Right Now item, and the kind of each link are stored now and shown by the redesign.
- In **Profile → Homepage & Writing**, edit focus areas, Work summary, writing introduction, featured article, and the optional contact invitation, which is the Research & collaboration route on `/contact` and in the home page's contact section. The featured selection falls back to the latest published post; unpublished and future-dated posts stay hidden. The home page lists the latest three posts automatically.
- In **Profile → About / Right Now**, edit the biography, location, profile links, portrait, and current interests. The current interests are the home page's Open questions, dated by **Right Now Updated At**, and the biography's first paragraph closes its About section. Removing a link or optional content hides it on the site.
- In **Profile → Portfolio**, maintain experience, education, skills, credentials, and the résumé PDF. Use **Currently Here** for ongoing work or study and **Expected Graduation Year** for a year-only estimate. When you know only the year a role or degree started or ended, enter any day in that year and set **Start Date Precision** or **End Date Precision** to **Year only**: the site then prints the year alone. Each entry also takes a short organization name for the Trajectory map, a website, an employment type, and an optional change of direction. The optional **Résumé Note** identifies an older PDF while a replacement is being prepared. Profile edits do not rewrite the uploaded PDF.
- Posts own their title, description, body, publication date, and topic tags; Projects own their case studies. Topic pages and archive filters follow published tags automatically. In the Studio, posts are under **Flight Log · Posts** (with a **Scheduled** list of posts dated after today, which the daily refresh releases) and projects under **Missions · Projects**, ordered by mission number.
- Each post can also take a **Cover** (with alt text, caption, credit and kind), up to three **Related Projects**, a **Revised At** date for substantive revisions (shown as "Updated" on the post), and a **Changelog** of dated updates and corrections, listed at the end of the post and in the RSS feed. Related projects show on the post as its mission, and the cover as its lead plate after the first paragraph.
- In a post's text, the **Footnote** button (¹) attaches a note to the selected words: the post numbers notes in reading order, sets each beside its line on wide screens and lists them at the end. Images take an optional **Credit**, a **Kind** (photographs are numbered as plates, Pl. I; diagrams, plots and screenshots as figures, Fig. 1) and a **Width** (text width, wide or the full reading column). Callouts add a **Caution** tone for steps that can break a setup or lose data. Code blocks need nothing new: a listing is numbered and breaks out wide by itself when a line is longer than 72 characters.
- Each project has a **Mission Number** (MSN-01 to MSN-99; a new project takes the next free one, and two projects cannot share one), one to three **Types**, and an optional **Featured Slot** for the home page and Missions stage (the Studio warns when two missions share a slot). Status adds **Planned** and **Stopped**, and **Completed** is shown as "Complete". When you know only the years, enter any day in each year and set **Date Precision** to **Year only**; turn on **Dates Are Estimates** to print them as "c. 2023". The optional status note, role, parameters, brief, results, lessons, next steps, portrait cover and **3D Model** (a poster, a description and numbered callouts that link to an essay or post heading, which the Studio checks) are stored now and shown by the redesign.
- Your four résumé projects (the Gmail filter, the homelab, the Kubernetes cluster and this website) are drafted from the résumé, the homelab post and your answers, and a named migration creates them as Studio drafts. You run it, review each draft, fill in what only you know and publish it; `migrations/README.md` lists the commands and the review steps. A second migration turns the one legacy link in the homelab post into the link type the Studio writes.
- The visual theme, navigation, section labels, artwork, and stable site identity stay in code. No code change or redeploy is needed for the content fields above.
- The mission patch (the AR monogram used as the favicon, the Apple touch icon and the header mark) is drawn by `scripts/generate-patch.mjs`; run `node scripts/generate-patch.mjs` after changing it.
- The home hero is NASA's photograph ISS072-E-30246 (an orbital sunrise, Expedition 72; public domain, credited on the page as "Photo: NASA / Expedition 72"). The original and its crop boxes, credit and fitted limb geometry live in `assets/artwork/` (`nasa-iss072e030246.jpg`, `hero-sunrise.json`), outside `public/`, so they are not served. `node scripts/generate-hero-sunrise.mjs` writes the 21:9 desktop and 9:16 mobile encodes (AVIF and WebP, with the credit in their XMP metadata) to `public/images/hero-sunrise-v1/` and `lib/hero-sunrise.json`; bump the directory version whenever you re-encode, because `/public` images are cached immutably. Responsive preloads fetch one size in one format, and an inline preview shows until it arrives. In Flight Manual, and in print, the same limb is drawn in ink from the fitted geometry instead.
- The existing Vercel project builds GitHub branches as previews and `main` as production. Keep the existing Sanity, Resend, BotID, webhook, and cron settings. No new service or environment variable is required by this redesign. Vercel honours the `packageManager` pnpm pin only when `ENABLE_EXPERIMENTAL_COREPACK=1` is set in the project; otherwise it infers pnpm from the lockfile.
- The browser tests also run against every successful Vercel preview (`.github/workflows/e2e-preview.yml`). If previews are protected, create a **Protection Bypass for Automation** secret in Vercel (Settings → Deployment Protection) and store it as the GitHub Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET`; until it exists, that workflow skips with a notice.
- Before merging, run the checks documented in `CLAUDE.md` and verify a Vercel preview. Existing `/blog`, `/portfolio` (its old section fragments included), `/resume`, RSS, and résumé PDF routes are preserved; `/comms` redirects to `/contact`.

## Contribution

Contributions are welcome (idk why you'd want to lol just fork it for yourself)! Please submit any issues or pull requests through GitHub. Thank you.

## Credits

Inspired by a ByteGrad tutorial on TypeScript and NextJS. Further details and acknowledgments can be found [here](https://youtu.be/sUKptmUVIBM?si=ygmF29AB9rJ99pOW). Changed quite a bit since then.

## Contact

Feel free to send feedback through the contact form on my website or directly via [LinkedIn](https://www.linkedin.com/in/adithya-rajendran/).
