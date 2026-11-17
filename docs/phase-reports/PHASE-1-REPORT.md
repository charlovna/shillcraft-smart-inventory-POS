# Phase 1 report: Setup and approval

Date: 17 November 2026

**Verdict:** Complete with open items. The app is built and live on Cloudflare staging, but local Supabase, the keep-alive, preview deploys and the Takowaki data are not done, and the Cloudflare work is not yet committed.

## What just happened

- The app was scaffolded: Next.js 16 with strict TypeScript, ESLint, Prettier, Vitest and Playwright. The scripts from CLAUDE.md exist in `package.json`.
- Money helper code (`lib/domain/money.ts`) and four unit tests were added.
- A GitHub Actions file runs install, lint, typecheck and unit tests on pull requests and on pushes to `main`.
- Because of the hosting policy (admin directive, 17 Nov 2026), the app now deploys to Cloudflare Workers Free using the OpenNext adapter and `wrangler`. Vercel is not set up, as the policy requires.
- A Cloudflare Hyperdrive binding (a free connection pool in front of the database) points at the Supabase Free staging project.
- The staging site answers at https://shillcraft-pos-staging.shillcraft2019.workers.dev.
- The user says a throwaway database query through Hyperdrive worked on 17 Nov 2026 (PostgreSQL 17.12). The test route was then deleted. I could not re-run it. I only checked that the route no longer exists.
- The user says both Supabase projects (`staging`, `production`) exist with the Data API off. This cannot be seen from the repo.

## Checklist

| Task or gate | Status | Evidence |
|---|---|---|
| Repo scaffold: Next.js, strict TypeScript, ESLint, Prettier, Vitest, Playwright, npm scripts | Done | `package.json` has dev, lint, typecheck, test, test:e2e, db:migrate, db:seed, check:rls. `.prettierrc`, `playwright.config.ts`, `vitest.config.ts`, `tests/e2e/home.spec.ts`, `tests/unit/money.test.ts` exist. |
| `npm run lint` | Done (2 warnings) | 0 errors, 2 warnings: unused disable comments in the generated `cloudflare-env.d.ts`. |
| `npm run typecheck` | Done | `tsc --noEmit` finished with no errors. |
| `npm test` | Done | 1 file, 4 tests passed. |
| `npm run test:e2e` | Not verified | Not run (it needs a browser and a running app). The spec file exists. |
| Scripts `db:migrate`, `db:seed`, `check:rls` | Partly done | They exist but are placeholders that exit with an error until Phase 2. This is expected. |
| Local Supabase (`supabase init`, `supabase start`) | Partly done | `supabase/config.toml` exists (init done). The task is still unchecked in `PHASES.md`. I saw no proof that `supabase start` was ever run (it needs Docker). Note: the local `[api] enabled = true` in `config.toml`. This is local only, but the rule is that the Data API is not used. |
| `.env.example` with every variable name and a comment | Done | File seen: database, Supabase, Sentry and base URL entries, all with placeholder values. |
| `.env.local` and `.dev.vars` git-ignored | Done | `git check-ignore` lists both. `git ls-files` shows only `.env.example` tracked. |
| GitHub Actions CI file | Done (file only) | `.github/workflows/ci.yml` runs `npm ci`, lint, typecheck, test. The branch is on GitHub, but I could not see any CI run result. Cannot verify it is green. |
| Cloudflare Workers project (Free) via OpenNext and wrangler | Done | `wrangler.jsonc`, `open-next.config.ts`, `npm run deploy` script. `curl` to the staging root returned HTTP 200. |
| Preview deploys on pull requests | Not done | No workflow deploys previews. The only workflow is `ci.yml`. |
| Cloudflare-specific code isolated (`lib/platform/`) | Partly done | Config is in `wrangler.jsonc` and `open-next.config.ts`. `lib/platform/` does not exist yet, which is fine because there is no platform code yet. |
| Hyperdrive binding to Supabase staging | Partly done | The `HYPERDRIVE` binding is in `wrangler.jsonc`. The one-off successful query is a user report, not seen by me. |
| Test DB route removed | Done | `curl` returned HTTP 404 for `/api/health/db` and for `/api/health`. No `app/api` folder in the repo. |
| Two Supabase Free projects in Singapore, Data API off | Human task / can't verify | Dashboard-only. The user confirmed it. |
| Weekly keep-alive so staging is not paused | Not done | No scheduled workflow exists in `.github/workflows/`. |
| Collect Takowaki menu, stock items and recipes into CSV templates | Human task / can't verify | The templates arrive in Phase 7. The setup guide says to start a spreadsheet now. |
| G1 Plan approved | Done | `DECISIONS.md`: "2026-11-16: Blueprint v3.1 approved (GO)". |

## Non-negotiable rules this phase touched

- Rule 14 (secrets in environment variables only): no breach seen. `.dev.vars` and `.env.local` are git-ignored and not tracked. `.env.example` has placeholders only. The Hyperdrive ID is committed in `wrangler.jsonc`. It is an identifier, not a credential, but check that you are happy with that.
- Hosting policy: no Vercel setup was added. `vercel.json` (`sin1`) is left alone. No breach.
- Rules 1 to 13 (isolation, money, sales, QR and the rest): there is no data code yet, so they cannot be breached or verified. The Phase 2 gates cover them.

## Open items and risks

1. **Uncommitted work.** `git status` shows many modified files plus new untracked files: `.claude/`, `wrangler.jsonc`, `open-next.config.ts`, `cloudflare-env.d.ts`, `public/_headers` and edits to `CLAUDE.md`, `PHASES.md` and `DECISIONS.md`. The deployed state is not in git. Only the first scaffold commit (`d93ac02`) is on the `phase-1/scaffold` branch. Commit and push, and check that CI goes green on GitHub.
2. **No keep-alive.** Supabase Free pauses a project after 1 week of inactivity. Without the scheduled ping, staging can pause and the database will go away from under the app.
3. **No preview deploys on pull requests**, so that task is open.
4. **Local Supabase not shown as working.** Phase 2 needs it for the RLS and isolation tests on a real local database.
5. **The database check is a report, not proof.** The route is gone, so the Hyperdrive link cannot be re-tested until a new health check is made. Dashboard facts (two projects, Singapore, Data API off) are also unverified.
6. **Takowaki data not collected** (human task). It is needed by Phase 7.
7. **Free-tier limits** still apply (10 ms CPU, 100,000 requests a day, no database backups). Gate G7 cannot be met on free Supabase. Do not load real client data until the production move.
8. `cacheComponents` and `partialPrefetching` are off in `next.config.ts` and must be switched on again when moving to Vercel.
9. Small notes: 2 harmless lint warnings; `.env.example` still describes `DIRECT_URL` and `DATABASE_URL` for the Phase 2 two-role design.

## Decisions made

- 2026-11-15: One app, one shared database for all clients; each row carries `business_id`.
- 2026-11-15: Add-ons are products flagged `is_addon`.
- 2026-11-15: Price and cost stored on each order line at the moment of sale.
- 2026-11-16: Isolation enforced twice (Prisma extension and RLS); app role has no BYPASSRLS; Data API off.
- 2026-11-16: Sales are idempotent (`client_sale_id`) and queue offline.
- 2026-11-16: Out-of-stock warns, never blocks; negative stock allowed.
- 2026-11-16: Average cost equals the incoming unit cost when on_hand is 0 or less.
- 2026-11-16: Staging and preview builds; migrations only from CI; Singapore region; Sentry, uptime and spend alerts.
- 2026-11-16: No BIR compliance; receipts are "order slips".
- 2026-11-16: The app never processes payments.
- 2026-11-16: Build the full multi-client baseline regardless of Takowaki's answers.
- 2026-11-16: Customer QR ordering in scope (v3.1).
- 2026-11-16: Cashier PIN login parked until after the pilot.
- 2026-11-16: Blueprint v3.1 approved (GO).
- 2026-11-16: LOCKED customer ordering flow (QR scan, browser menu, no app, no login).
- 2026-11-16: Phase 1 scaffold built locally (Next.js 16, Vitest 5, Playwright, Prettier, Supabase CLI as dev dependency).
- 2026-11-17: HOSTING POLICY: Cloudflare Workers Free and Supabase Free now; Vercel (`sin1`) and Supabase Pro only at production, before Phase 8's production load.
- 2026-11-17: Staging Worker `shillcraft-pos-staging` deployed; `cacheComponents` and `partialPrefetching` off; compat flag `no_handle_cross_request_promise_resolution`; bundle 979 KiB gzip.
- 2026-11-17: Added the `phase-reporter` subagent.

## What comes next

- Before Phase 2: commit and push the Cloudflare work, confirm CI is green, add the weekly keep-alive workflow, and get `supabase start` working locally (Docker needed).
- Phase 2 (Core and data isolation, weeks 2 to 5): the Prisma schema for 15 tables, RLS migration and runtime role, scoped DB client, Supabase Auth, `check:rls`, seed data, CI deploy pipeline, Sentry. Gates G2 and G3. `docs/PHASE2-PROPOSAL.md` already exists.
- The human must provide: the Supabase project credentials (kept in secrets only), confirmation of the Data API setting on both projects, the GitHub secrets, and the start of Takowaki's menu, stock and recipe spreadsheet.
