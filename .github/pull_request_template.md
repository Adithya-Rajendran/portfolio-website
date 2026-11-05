## What and why

<!-- One or two sentences: the change, and the finding or issue it closes. -->

## Gate (CLAUDE.md)

- [ ] `pnpm lint && pnpm typecheck && pnpm format:check && pnpm test:coverage`
- [ ] `SANITY_STUDIO_PROJECT_ID=fallback SANITY_STUDIO_DATASET=production pnpm build`
- [ ] `pnpm exec wrangler deploy --dry-run`
- [ ] `pnpm test:e2e`
- [ ] A schema or `defineQuery` change: `pnpm typegen`, with `schema.json` and `sanity.types.ts` committed; after the merge, the Sanity schema workflow's run is green
- [ ] CLAUDE.md and the comments that state a contract say what the code now does
- [ ] The built Worker checked on desktop and mobile
