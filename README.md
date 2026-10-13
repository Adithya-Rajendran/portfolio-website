# Adithya Rajendran — Personal Website

Public Website: [https://adithya-rajendran.com](https://adithya-rajendran.com)

## Overview

A writing-first personal website about systems, robotic vision, AI, and possible futures. The design pairs NASA's photograph of an orbital sunrise and a quiet starfield with readable field notes. Professional experience, projects, and a résumé remain one click away.

## Features and Technologies

- **Next.js**: App Router, Server Components, and tagged Sanity caching.
- **React & TypeScript**: Robust, scalable, and type-safe development environment.
- **Tailwind CSS**: CSS-first Tailwind 4 over the Deep Field design tokens in `styles/`: two themes, Void (dark, the default) and Flight Manual (light), chosen from the header, the menu or the footer (Dark · Light · System), with no flash on load; self-hosted Jost, Newsreader, DM Mono and Michroma; a Pause motion control and reduced-motion support.
- **Sanity CMS**: Code-defined Profile, Blog Post, Project, and structured rich-prose schemas.
- **SEO Optimized**: Implements structured data (JSON-LD) and semantic HTML for optimal search engine visibility.
- **Plain names**: the header, menu, footer, page titles, breadcrumbs and buttons name the five sections Projects, Writing, Experience, About and Contact. Each section's themed name (Missions, Flight Log, Trajectory, Crew File, Comms) is only a small tag above its page title and on its share card, and no heading is numbered.
- **Home**: the name, the profile's headline and availability, and Projects · CV · Contact over NASA's orbital sunrise; then the strongest project (led by its summary, without stats), the next two as rows and the rest as one line; the latest three posts; a one-line statement of research interests (the tagline, else the introduction's first sentence) with a link to the current questions on About; and a call to get in touch (your own Contact Button, when set, beside Send a message).
- **Writing**: `/blog` lists every post directly, newest first and grouped by year (date, "Updated" only after a real revision, title and standfirst, tags, reading time), with RSS, LinkedIn and "Search the archive" in its head. Tag chips appear, on the index and the archive, once a tag gathers two or more posts. Tag pages, an archive with search, and a full-content RSS feed titled "Adithya Rajendran — Writing". Each entry is a paper-grade long read: its first paragraph on the first screen, a 68-character measure, a sticky contents rail (a closed box on phones), its LOG number as a quiet identifier in the crumb, numbered code listings with a Copy button that break out wide when a line is long, numbered plates and figures, callouts, footnotes in the margin and in the notes at the end, the revisions, previous and next entries, and a print layout. Follow actions connect to LinkedIn and RSS.
- **Projects**: `/portfolio` shows the featured project on its stage beside its photograph, the next two as text-first tiles and the rest as quieter rows, so the last project is the least prominent; there are no counts, register or stats on the index. Its old section links (`#experience`, `#skills`, `#certifications`, `#engineering-writing`, `#contact`) lead on to where those sections live now. Each project has a page at `/portfolio/<slug>`. A project with evidence to lay out (a brief, results, lessons or next steps, model callouts, a photograph, or an essay in sections) gets the full file: its short name (when set) over its title, its summary, the way to its write-up, its stack, then its brief, results with their notes, lessons and next steps, callouts, write-up, links and related posts, each shown only when it is filled in and, for the brief and the write-up, only when it says more than the summary and highlights. Any other project is a short note: its title, summary, the highlights that add to it, its stack and links. The mission number (MSN-02) is only in the page's crumb. After the featured slots, projects follow their mission numbers.
- **Experience**: `/resume` is the record in two views under a head with what you are open to, Download CV (PDF) when a PDF is uploaded, and Contact: Timeline, the flight through it in 3D (the default where motion runs), and List, the CV (education, experience, projects, writing and talks, skills, certifications; the default under reduced motion and without JavaScript, and always in the HTML). Dates are printed as given, with no derived lengths of time. The page prints as a two-sheet CV whose masthead points to the contact page; `/resume/trajectory` redirects to it.
- **About**: `/about` opens on the site's patch, then a profile record (name, studies, previous role, focus, links, last update), the full biography, the Right Now list grouped by kind, the latest posts and any talks, and links to experience, skills, certifications and projects. There is no portrait.
- **Automated Testing**: GitHub Actions runs lint, type checks, Vitest unit tests, a production build, and Playwright browser tests (smoke, no-JavaScript, axe accessibility in both themes, layout, theme and menu behaviour, the contact page, the writing index, the projects, the home page, the About page, a byte report, review screenshots and the embedded Studio) against a fixture build, then again against each Vercel preview once the bypass secret below is set, and weekly against the production site.
- **Contact Handling**: `/contact` puts the message form first, under what you are open to, with the routes by intent beside it as short rows: internships and roles (shown while the profile says what you are open to), research and collaboration (shown when the profile has a contact invitation), consulting (only while it is switched on) and hello. The form's optional Topic is the one control that picks a route (`/contact#hiring` picks it on arrival), and the topic prefixes the email subject; a route's prompt is only the message field's optional placeholder. The whole form fits the first screen on a laptop. The Resend-backed form is protected by Vercel BotID and the WAF rate limit (while that rule is missing, an in-memory limit that each server instance keeps on its own, which slows a burst but is no site-wide limit), with Zod validation and MX record checks. It needs JavaScript for BotID, so without it the page offers LinkedIn. There is no public email address or phone number. Contact is in the header on every page (in the bar itself on phones), and `/portfolio#contact` still answers, with a link to `/contact`.

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
- Edit your profile, résumé PDF, posts, and projects in `/studio`. Publishing a profile, post or project calls the Sanity webhook, which refreshes every page that shows it, including project pages (the webhook's filter in Sanity must include `project`). The daily scheduled-post refresh releases future-dated posts the same way, on their date in UTC, and catches up within a week if a run is missed.
- In **Profile → Identity**, edit the current headline, short introduction, and search description. These flow through the homepage, About, search metadata, and social previews. The headline is the line under your name on the home page. The optional **Tagline** is the home page's one-line Research interests statement; without one, the introduction's first sentence is used.
- In **Profile → Status**, set **Availability**: the status, **Open To** (one line per opening, printed as written, for example "Summer 2027 internships" and "Full-time opportunities in 2028"; the site joins them with a dot), an optional **Contact Button** (for example "Write about a role") and, for your records, when you last confirmed it. The Open To line is shown under your name on the home page and its share card, in the About record, in the heads of the CV and of `/contact` (and its share card), and as the Timeline flight's last stop; while it is shown, `/contact` offers the Hiring route, and the Contact Button closes the home page and the Timeline flight, leading there. Without Open To lines, or with a Closed status, all of them are hidden. **Launch** (a date and event) is stored for reference; the site does not show it. Leave **Open to Consulting** off until the site is on the Vercel Pro plan; switching it on shows the Consulting route. These fields, **Talks & Papers**, the kind and related post or project of each Right Now item, and the kind of each link are shown by the redesign.
- In **Profile → Homepage & Writing**, edit focus areas, the Experience introduction, writing introduction and the optional contact invitation, which is the Research route on `/contact`. The featured article and Start Here posts are stored for later use; the home page lists the latest three posts automatically, and unpublished and future-dated posts stay hidden.
- **Profile → Site copy** gathers every page introduction that describes your work: the CV (Experience Introduction), the Blog (writing introduction), **Projects Introduction** (`/portfolio`) and **Contact Introduction** (`/contact`), plus **Contact Routes**: the title and prompt of the Hiring, Research, Consulting and Hello routes (the prompt is the message field's optional placeholder once that topic is chosen). An empty introduction or prompt is simply not shown; a route without a title uses its topic's name.
- In **Profile → About / Right Now**, edit the biography, location, profile links, and the Right Now list. Each Right Now item has a **Kind** (question, building, reading or learning): About groups the list by kind, dated by **Right Now Updated At**, and the home page links to it from the research interests statement. About shows the whole biography. The portrait field is not shown on the site. Removing a link or optional content hides it on the site.
- In **Profile → Portfolio**, maintain experience, education, skills, credentials, and the résumé PDF. Use **Currently Here** for ongoing work or study and **Expected Graduation Year** for a year-only estimate. When you know only the year a role or degree started or ended, enter any day in that year and set **Start Date Precision** or **End Date Precision** to **Year only**: the site then prints the year alone. Each entry also takes a short organization name for the Timeline flight, a website, an employment type, and an optional change of direction. The optional **Résumé Note** identifies an older PDF while a replacement is being prepared. Profile edits do not rewrite the uploaded PDF.
- Posts own their title, description, body, publication date, and topic tags; Projects own their case studies. Topic pages and archive filters follow published tags automatically. In the Studio, posts are under **Flight Log · Posts** (with a **Scheduled** list of posts dated after today, which the daily refresh releases) and projects under **Missions · Projects**, ordered by mission number.
- Each post can also take a **Cover** (with alt text, caption, credit and kind), up to three **Related Projects**, a **Revised At** date for substantive revisions (shown as "Updated" on the post), and a **Changelog** of dated updates and corrections, listed at the end of the post and in the RSS feed. Related projects show on the post as its mission, and the cover as its lead plate after the first paragraph.
- In a post's text, the **Footnote** button (¹) attaches a note to the selected words: the post numbers notes in reading order, sets each beside its line on wide screens and lists them at the end. Images take an optional **Credit**, a **Kind** (photographs are numbered as plates, Pl. I; diagrams, plots and screenshots as figures, Fig. 1) and a **Width** (text width, wide or the full reading column). Callouts add a **Caution** tone for steps that can break a setup or lose data. Code blocks need nothing new: a listing is numbered and breaks out wide by itself when a line is longer than 72 characters.
- Each project has a **Title** and an optional **Short Name** ("Homelab"), set in capitals over the title on its page and card and used in the breadcrumb and the previous / next links; without one, the title leads. Each has a **Mission Number** (MSN-01 to MSN-99; a new project takes the next free one, and two projects cannot share one), one to three **Types**, and an optional **Featured Slot**: slot 1 is the stage of the home page and `/portfolio`, and slots 2 and 3 come next (the two rows under it on the home page); the other projects follow by mission number, so the last is the least prominent (the Studio warns when two projects share a slot). Status adds **Planned** and **Stopped**, and **Completed** is shown as "Complete". When you know only the years, enter any day in each year and set **Date Precision** to **Year only**; turn on **Dates Are Estimates** to print them as "c. 2023". The optional status note, role, parameters, brief, results, lessons, next steps, portrait cover and **3D Model** (a poster, a description and numbered callouts that link to an essay or post heading, which the Studio checks) are stored now and shown by the redesign. A parameter whose value starts with a number ("3", "99.55%", "Zero") is shown as a stat in the project page's head, unless the project has results: then the results table shows the numbers, each with its note. Tiles and the featured stage show no stats. A named value ("Okta OIDC") is listed under the stack, or not at all when the stack already lists it. A project with no brief that adds to its summary and highlights, and no results, lessons, next steps, callouts, photograph or sectioned essay, is shown as a short note. A project essay that only restates the summary, highlights and brief is left out, and so is "Read the write-up" when it would lead there.
- Your four résumé projects (the Gmail filter, the homelab, the Kubernetes cluster and this website) are drafted from the résumé, the homelab post and your answers, and a named migration creates them as Studio drafts. You run it, review each draft, fill in what only you know and publish it; `migrations/README.md` lists the commands and the review steps. A second migration turns the one legacy link in the homelab post into the link type the Studio writes.
- The visual theme, navigation, section labels, button wording, artwork, and stable site identity stay in code. Everything that describes you or changes over time comes from the profile, and is left out when its field is empty. No code change or redeploy is needed for the content fields above.
- The mission patch (the AR monogram used as the favicon, the Apple touch icon and the header mark) is drawn by `scripts/generate-patch.mjs`; run `node scripts/generate-patch.mjs` after changing it.
- The home hero is NASA's photograph ISS072-E-30246 (an orbital sunrise, Expedition 72; public domain, credited on the page as "Photo: NASA / Expedition 72"). The original and its crop boxes, credit and fitted limb geometry live in `assets/artwork/` (`nasa-iss072e030246.jpg`, `hero-sunrise.json`), outside `public/`, so they are not served. `node scripts/generate-hero-sunrise.mjs` writes the 21:9 desktop and 9:16 mobile encodes (AVIF and WebP, with the credit in their XMP metadata) to `public/images/hero-sunrise-v1/` and `lib/hero-sunrise.json`; bump the directory version whenever you re-encode, because `/public` images are cached immutably. Responsive preloads fetch one size in one format, and an inline preview shows until it arrives. In Flight Manual, and in print, the same limb is drawn in ink from the fitted geometry instead.
- The existing Vercel project builds GitHub branches as previews and `main` as production. Keep the existing Sanity, Resend, BotID, webhook, and cron settings. No new service or environment variable is required by this redesign. Vercel honours the `packageManager` pnpm pin only when `ENABLE_EXPERIMENTAL_COREPACK=1` is set in the project; otherwise it infers pnpm from the lockfile.
- The browser tests also run against every successful Vercel preview (`.github/workflows/e2e-preview.yml`). If previews are protected, create a **Protection Bypass for Automation** secret in Vercel (Settings → Deployment Protection) and store it as the GitHub Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET`; until it exists, its test job shows as skipped, with a notice, not as passed. Before adding that secret, confirm that the project's **Git Fork Protection** is on in Vercel: a deployed commit runs its own copy of the workflow, so it is what keeps a fork's pull request away from the repository's secrets. Read a fork's whole diff before approving its deployment, because the deployment runs the fork's code with the repository's secrets and the Preview environment variables.
- Before merging, run the checks documented in `CLAUDE.md` and verify a Vercel preview. Existing `/blog`, `/portfolio` (its old section fragments included), `/resume`, RSS, and résumé PDF routes are preserved; `/comms` redirects to `/contact`.

## Contribution

Contributions are welcome (idk why you'd want to lol just fork it for yourself)! Please submit any issues or pull requests through GitHub. Thank you.

## Credits

Inspired by a ByteGrad tutorial on TypeScript and NextJS. Further details and acknowledgments can be found [here](https://youtu.be/sUKptmUVIBM?si=ygmF29AB9rJ99pOW). Changed quite a bit since then.

## Contact

Feel free to send feedback through the contact form on my website or directly via [LinkedIn](https://www.linkedin.com/in/adithya-rajendran/).
