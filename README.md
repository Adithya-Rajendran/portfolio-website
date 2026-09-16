# Adithya Rajendran — Personal Website

Public Website: [https://adithya-rajendran.com](https://adithya-rajendran.com)

## Overview

A writing-first personal website about systems, robotic vision, AI, and possible futures. The design pairs quiet stars and an imagined orbital habitat with readable field notes. Professional experience, projects, and a résumé remain one click away.

## Features and Technologies

- **Next.js**: App Router, Server Components, and tagged Sanity caching.
- **React & TypeScript**: Robust, scalable, and type-safe development environment.
- **Tailwind CSS**: Responsive layouts with shared charcoal, cream, and copper design tokens; self-hosted fonts and reduced-motion support.
- **Sanity CMS**: Code-defined Profile, Blog Post, Project, and structured rich-prose schemas.
- **SEO Optimized**: Implements structured data (JSON-LD) and semantic HTML for optimal search engine visibility.
- **Blog**: Chronological posts, optional topics, archive search, readable code blocks, article contents, and a full-content RSS feed. Follow actions connect to LinkedIn and RSS.
- **Automated Testing**: Integrated GitHub Actions CI/CD workflows to ensure code quality before merges.
- **Contact Handling**: A Resend-backed contact form protected by Vercel BotID and WAF rate limiting, with Zod validation and MX record checks.

## Getting Started

### Prerequisites

- Node.js (v24.x or later recommended)
- pnpm (v10.x or later)

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

## Content and deployment

- Copy `.env.example` to `.env.local` and set the public Sanity project and dataset values. Published content needs no read token. Keep local environment files out of Git.
- Edit your profile, résumé PDF, posts, and projects in `/studio`. Publishing retains the existing Sanity webhook and daily scheduled-post refresh; both also refresh the homepage.
- In **Profile → Identity**, edit the current headline, short introduction, and search description. These flow through the homepage, About, search metadata, and social previews.
- In **Profile → Homepage & Writing**, edit focus areas, Work summary, writing introduction, and featured article. The featured selection falls back to the latest published post; unpublished and future-dated posts stay hidden. Recent notes update automatically.
- In **Profile → About / Right Now**, edit the biography, location, profile links, portrait, and current interests. Removing a link or optional content hides it on the site.
- In **Profile → Portfolio**, maintain experience, education, skills, credentials, and the résumé PDF. Use **Currently Here** for ongoing work or study and **Expected Graduation Year** for a year-only estimate. The optional **Résumé Note** identifies an older PDF while a replacement is being prepared. Profile edits do not rewrite the uploaded PDF.
- Posts own their title, description, body, publication date, and topic tags; Projects own their case studies. Topic pages and archive filters follow published tags automatically.
- The visual theme, navigation, section labels, artwork, and stable site identity stay in code. No code change or redeploy is needed for the content fields above.
- The approved artwork is `public/images/living-future.webp`. Design explorations and artwork notes are in `design-previews/`.
- The existing Vercel project builds GitHub branches as previews and `main` as production. Keep the existing Sanity, Resend, BotID, webhook, and cron settings. No new service or environment variable is required by this redesign.
- Before merging, run the checks documented in `CLAUDE.md` and verify a Vercel preview. Existing `/blog`, `/portfolio`, `/resume`, RSS, and résumé PDF routes are preserved.

## Contribution

Contributions are welcome (idk why you'd want to lol just fork it for yourself)! Please submit any issues or pull requests through GitHub. Thank you.

## Credits

Inspired by a ByteGrad tutorial on TypeScript and NextJS. Further details and acknowledgments can be found [here](https://youtu.be/sUKptmUVIBM?si=ygmF29AB9rJ99pOW). Changed quite a bit since then.

## Contact

Feel free to send feedback through the contact form on my website or directly via [LinkedIn](https://www.linkedin.com/in/adithya-rajendran/).
