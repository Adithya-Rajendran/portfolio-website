## What and why

<!-- One or two sentences: the change, and the finding or issue it closes. -->

## Gate (CLAUDE.md)

- [ ] `pnpm lint && pnpm typecheck && pnpm format:check && pnpm test`
- [ ] `NEXT_PUBLIC_STORE_SANITY_PROJECT_ID=fallback pnpm build`
- [ ] `pnpm test:e2e`
- [ ] A schema or `defineQuery` change: `pnpm typegen`, with `schema.json` and `sanity.types.ts` committed; after the merge, `pnpm exec sanity schema deploy`
- [ ] CLAUDE.md and the comments that state a contract say what the code now does
- [ ] The Vercel preview checked
