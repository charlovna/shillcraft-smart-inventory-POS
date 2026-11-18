# Phase 2 running notes (input for the Phase 2 report)

The `phase-reporter` subagent reads this file when Phase 2 ends and must carry every open item into `PHASE-2-REPORT.md`. Add new items at the bottom. Never put secrets here (this repo is public).

## Open risks

| # | Risk | Found | Impact | Next action |
|---|---|---|---|---|
| R1 | **Worker bundle size.** Adding Prisma and the Postgres driver grew the Worker from 979 KiB to about 2,774 KiB gzip (9.9 MB uncompressed). Prisma's docs say the Workers Free limit is 3 MB; Cloudflare's own limits page does not mention a compressed limit. Headroom is roughly 0.2 MB. | 2026-11-19, PR #2 dry-run | A staging deploy may be refused. Every new feature adds size, so Phases 3 to 6 will hit it. | Watch the first deploy of PR #2. If refused: slim the bundle, or use the `pg` driver with plain SQL on Workers, or (executive decision) pay for Workers. Re-measure at every phase end with `npx wrangler deploy --dry-run`. |
| R2 | **Free Supabase has no backups and pauses after 1 week idle.** Gate G7 cannot pass; live clients are unsafe. | 2026-11-17 | Blocks Phase 8 and 9 without an executive decision. | Interim `pg_dump` plan and weekly keep-alive Action (neither built yet). |
| R3 | **Workers Free CPU cap of 10 ms per request** with Prisma and RLS transactions. | 2026-11-19 | Slow pages could be cut off under load. | Measure `/api/me` on staging; revisit before Phase 4 (POS). |
| R4 | **Supabase Data API toggle not confirmed in the dashboard.** The REST endpoint answers 503 (PGRST002), and the `anon`, `authenticated` and `service_role` roles have no table privileges (checked), so no data can leak either way. | 2026-11-19 | G3 requires it confirmed off. | Admin confirms in Supabase (staging and production) and records it here. |
| R5 | **Staging DB owner password was pasted into chat** and used by the agent. It is stored in the `STAGING_MIGRATE_URL` secret and in git-ignored `.env.local`. | 2026-11-19 | Exposed to the chat transcript only. | Admin chose to keep it. Rotate before any real client data. |
| R6 | **Production gate was missing.** The `production` GitHub environment had no required reviewer, so the first deploy started the production job unprompted. Cancelled before any migration ran; reviewer now set. | 2026-11-19 | Fixed. | Re-check the gate before the first production approval. |
| R7 | `cacheComponents` and `partialPrefetching` are OFF in `next.config.ts` (they hang the OpenNext Worker). | 2026-11-17 | Slightly less optimised pages. | Re-enable if moving back to Vercel. |

## Phase 2 task status at time of writing

| Task | Status |
|---|---|
| Prisma schema, 15 tables | Done |
| RLS migration, role, grants, lookups | Done (applied to staging) |
| `lib/db` scoped client | Done |
| Two connection strings | Done (owner via CI; `app_runtime` via Hyperdrive config `shillcraft-staging-app`, caching off) |
| Supabase Auth: server side (token check, session mapping) | Done |
| Supabase Auth: **login screen** | **Not started. Assigned to a separate agent** (see `docs/handoffs/PHASE-2-LOGIN-SCREEN-HANDOFF.md`) |
| Role and location checks | Helpers done; applied to `GET /api/me`; apply to each future route |
| `check:rls` + CI step | Done |
| Seed | Done (local) |
| CI deploy pipeline | Done; staging proven, production gated |
| Sentry | Postponed by admin |
| G2 | Admin decision: passes on data, auth and route layers now; every later route ships its own cross-business test |
| G3 | Open: needs the Data API confirmation (R4) and a final run of the isolation tests against staging |
