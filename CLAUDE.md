# CLAUDE.md: ShillCraft Food-Service POS & Inventory Platform

You are helping a **beginner developer** build this product. Explain what you are about to do in plain words before doing it, keep changes small, and stop at every gate in `docs/PHASES.md` until its checks pass.

## What we are building (one paragraph)

A simple web app for small food businesses (stalls, kiosks, cafés, small restaurants). Staff sell at a touch-screen counter (POS), stock is tracked per ingredient per location using recipes, and the Owner sees gross profit per location. Customers can also scan a QR code, open the business's menu in their phone browser and order; staff accept the order at the counter. One app and one database serve every client business. **Takowaki** is the launch client. Source of truth: `docs/SPEC.md` (product), `docs/PHASES.md` (build order and gates), `docs/DECISIONS.md` (why). The full plan is *Blueprint and Functionality Plan v3.1*.

## HOSTING POLICY (admin directive, 2026-11-17): Cloudflare now, Vercel only at production

**Read this first.** It overrides the "Stack" and "Environments" sections below wherever they conflict. All Non-negotiable rules still apply unchanged.

**The rule:** until we have acquired clients and go to production, this app is hosted on **Cloudflare (free plan)** with **Supabase Free**. **Vercel hosting applies only at production, once we have acquired clients.** Before then, do not set up Vercel, add Vercel deploy steps, or use Vercel-only features. Reason: the fellow executives cannot pay for Vercel or paid Supabase until clients bring in revenue.

| | Now: development, staging, pilot prep (Phases 1 to 7) | At production: clients acquired, real client data live (the move happens before Phase 8's production load) |
|---|---|---|
| App hosting | **Cloudflare Workers (Free plan)** via the OpenNext adapter (`@opennextjs/cloudflare`) + `wrangler`. Region is not pinned; enable Smart Placement if it helps latency to Singapore | **Vercel**, functions pinned to `sin1` (Singapore) |
| Database | **Supabase Free**, 2 projects in Singapore: `staging` and `production` (the free-tier maximum of 2 active projects) | **Supabase Pro** (paid) for `production`, for backups and no idle pause; `staging` may stay on Free |
| Preview deploys | Cloudflare Workers preview/version URLs, or `wrangler deploy` from CI | Vercel preview deploys on pull requests |
| Secrets | `wrangler secret put` + `.dev.vars` locally (git-ignored) + GitHub secrets | Vercel env vars + GitHub secrets |
| DB connection | Workers reach Postgres through **Cloudflare Hyperdrive** (free) or the Supabase pooler on port 6543, using Prisma with `@prisma/adapter-pg` and the `nodejs_compat` flag | Supabase pooler (transaction mode); Prisma and RLS setup unchanged |

**About "Cloudflare Pages":** when the admin says "Cloudflare Pages", they mean this free Cloudflare hosting. This app is server-rendered Next.js, and Cloudflare Pages only hosts static exports (checked 17 Nov 2026), so it deploys to Cloudflare's Workers runtime. Which Next.js adapter to use (OpenNext, or Cloudflare's newer vinext, still beta) is the admin's call; the default is OpenNext. Do not switch products or adapters without asking.

**Free-tier limits we must design around (checked 17 Nov 2026, re-check before relying):**
- Workers Free: 100,000 requests/day, **10 ms CPU per request**, 50 subrequests per request, 128 MB memory. Hyperdrive Free: 100,000 queries/day. Bundle size limit is reported inconsistently in docs (64 MiB vs 3 MB compressed): **test the first deploy early**. If the Next.js bundle is refused, tell the admin; do not work around it silently.
- Supabase Free: 500 MB database, 5 GB egress, **project pauses after 1 week of inactivity**, **no automatic backups, no point-in-time restore**.

**Consequences (tell the admin, do not hide them):**
1. **Not production-grade for a live client.** A paused DB or a day over the request cap stops sales. Takowaki's production load (Phase 8) and go-live (Phase 9) must not happen on the free setup: do the production move below first, with the admin's go. Phases 1 to 7 on staging are fine.
2. **Gate G7 (restore tested) cannot be met on free Supabase** (no backups). Until the production move (Supabase Pro), run a scheduled `pg_dump` to storage the admin controls and record that as the interim backup.
3. Keep the staging project alive (weekly keep-alive ping via a scheduled GitHub Action) so it is not paused.
4. Keep Prisma/RLS design identical: the runtime role without BYPASSRLS, `set_config('app.business_id', ..., true)` per transaction, Data API off. The move to Vercel + Supabase Pro must need **config changes only, no code changes**. Keep Cloudflare-specific code isolated in `wrangler.jsonc`, `open-next.config.ts` and one small `lib/platform/` file. `vercel.json` (`sin1`) is already in the repo for the production move: leave it alone; Cloudflare ignores it.
5. Do not use Cloudflare-only features (KV, D1, Durable Objects) for business data. Postgres stays the single source of truth.

**Pivot implementation notes (17 Nov 2026):** staging Worker is `shillcraft-pos-staging` at https://shillcraft-pos-staging.shillcraft2019.workers.dev. `cacheComponents` and `partialPrefetching` are OFF in `next.config.ts` (they hang the OpenNext Worker); re-enable when back on Vercel. `wrangler.jsonc` holds the `HYPERDRIVE` binding and the `no_handle_cross_request_promise_resolution` flag. Deploy with `npm run deploy`.

**Production trigger (replaces the old "revert trigger"):** when a client is acquired and the admin gives the go for production, and before any real client data is loaded into `production`: (1) upgrade the `production` Supabase project to Pro, (2) deploy production on Vercel (`sin1`), (3) from then on the Stack and Environments sections below apply as written, and this block shrinks to a short history note, (4) rehearse on `staging` first and run the G7 restore drill, (5) add a line to `docs/DECISIONS.md`. Until that go, never move hosting on your own.

## Stack (production target; the hosting policy above says what applies now)

- Next.js (App Router) + TypeScript (strict), one app: POS, back office, customer menu and server code
- PostgreSQL on Supabase, **Singapore region**; Supabase Auth for staff login only
- Prisma ORM for queries and migrations
- Vercel hosting, functions pinned to `sin1` (Singapore): **production only, once clients are acquired**; until then Cloudflare free hosting (see the hosting policy above)
- Tests: Vitest (unit/integration), Playwright (end-to-end)
- Charts: Recharts. QR images: the `qrcode` npm package
- Error tracking: Sentry (or equivalent). Uptime check on the Pay endpoint

Check the current docs for each library before using an API you are unsure of. Versions move fast.

## Non-negotiable rules

1. **Every row belongs to a business.** Every table except `businesses` carries `business_id`, directly or through its parent.
2. **Never take `business_id`, `location_id` or role from the browser.** Read them from the server-side session (staff) or from the QR link code (customers), then look them up on the server.
3. **Two layers of isolation:**
   - App layer: a Prisma client extension adds the business filter to every query.
   - Database layer: PostgreSQL row-level security (RLS) on every table. Policies compare `business_id` to `current_setting('app.business_id', true)`, set with `set_config(..., true)` inside each transaction.
   - The app connects as a dedicated database role **without BYPASSRLS** that does not own the tables. The `postgres` role (owner, BYPASSRLS) is used **only** for migrations.
4. **Supabase Data API is disabled** (we never use PostgREST or supabase-js for data). A CI check fails if any table in the app schema has RLS off.
5. **Money is integers in centavos.** Never floats. Times are stored in UTC (`timestamptz`); reports use the business's time zone.
6. **A sale is one database transaction:** save the order and lines, deduct recipe ingredients for each product and add-on from that location's stock (atomic `UPDATE ... SET on_hand = on_hand - x`), and record price and cost at sale. If any step fails, nothing is saved.
7. **Sales are idempotent.** Each sale carries a `client_sale_id` (UUID made on the device), unique per business. Re-sending the same sale returns the existing order and never deducts stock twice.
8. **Out-of-stock warns, never blocks** at the counter. Stock may go negative and shows in the next stock count.
9. **Customer QR orders (the flow is locked, confirmed by the owner 16 Nov 2026):** we generate a QR code and give it to the business; the customer scans it, the business's own menu opens in the phone browser (no app, no login), and the customer orders from there. Do not change this flow without asking. Also: prices and totals are always recalculated on the server from the database, never trusted from the phone. A QR order deducts stock only when its sale is completed. Unaccepted orders expire after 15 minutes. Limit orders per device and per minute.
10. **The app never processes payments.** Payment methods are recorded only. QR payments go straight to the business's own bank or e-wallet QR; the cashier confirms them on the business's phone and enters a reference number.
11. **No BIR features.** Receipts print as "Order slip, not an official receipt/invoice".
12. **No client-specific code.** A client's difference is data (settings, menu, recipes, payment methods). No per-client branches, flags or forks.
13. **Cost and profit never reach a cashier session.** Strip those fields on the server, not just in the UI.
14. **Secrets live in environment variables only.** Never commit `.env*` files (except `.env.example`). Never print secrets in logs.

## Things you must ask the human before doing

- Running anything against **production** (migrations, scripts, data fixes). Default to local, then staging.
- Deleting files, tables, columns or data; `git push --force`; rewriting history.
- Adding a new paid service, a new major library, or changing the stack.
- Changing anything in the Non-negotiable rules above.
- Anything that would change behaviour described in `docs/SPEC.md`. Propose the change and update the spec in the same pull request once approved.

## How we work

- Follow `docs/PHASES.md` in order. Work on one task at a time on its own git branch (`phase-2/rls-policies`, etc.).
- Before coding a task: restate it, list the files you will touch, and give a short plan. Wait for "go" on anything bigger than about 100 lines.
- After coding: run `npm run lint`, `npm run typecheck`, `npm test`, and the task's own checks. Show the results honestly. Never mark a task done with failing tests.
- Write tests with the code, especially for isolation, the sale transaction, idempotency, stock math and QR order pricing. Follow **Testing rules** below.
- Keep pull requests small (one task). Write a plain-language summary of what changed and how to test it.
- Database changes only through Prisma migrations committed to the repo. RLS policies, roles and grants go in SQL migrations too.
- When a decision is made, add one line to `docs/DECISIONS.md`.
- **Phase reports:** when a phase ends (all its tasks done, or its gate passed), run the `phase-reporter` subagent (`.claude/agents/phase-reporter.md`) once. It verifies the phase and writes `docs/phase-reports/PHASE-N-REPORT.md` in plain words. It does not run mid-phase and never edits code.
- **Test validation:** when the admin asks, run the `test-validator` subagent (`.claude/agents/test-validator.md`). It runs lint, typecheck, tests and `check:rls`, audits the tests against the Testing rules, and returns ranked findings. It is read-only and never edits code or tests.

## Testing rules: tests check the code, and the code checks the tests

A green test proves nothing unless the test itself is right. Check in both directions.

**Tests validate the code**
- Every task ships with tests for its behaviour in `docs/SPEC.md`, including edge cases: zero and negative stock, add-ons, voids, discounts, two businesses, offline replay, a tampered price.
- Tests must assert real values (exact centavos, exact stock quantities, exact row counts), not just "no error" or "is defined".
- Security tests (isolation, RLS, cashier cost hiding, QR price recalculation, rate limits) run against a real local database, never mocks.
- `npm run lint`, `npm run typecheck`, `npm test` and the task's checks must all pass before a task is done, and CI must be green before merge.

**The code validates the tests**
- **Red first.** For new behaviour, write the test, run it, and show it **failing** for the right reason before writing the code. Then make it pass.
- **Prove each important test can fail.** For money, stock, isolation and idempotency tests, briefly break the code (for example, remove the business filter or skip the stock deduction), show that the test fails, then restore the code. Report this in the PR.
- **Never change a test just to make it pass.** If a test looks wrong, stop and explain why with the line from `docs/SPEC.md` it should follow. Change it only after the human agrees, and say so in the PR.
- **Never skip, disable or delete a test** (`.skip`, `.only`, commented out, loosened assertions) without the human's approval.
- **Tests follow the spec, not the code.** Write expected values from `docs/SPEC.md` and worked examples, not by copying what the code currently returns.
- **Review tests like code.** In every PR, list the tests added or changed and, in one line each, what they prove.

## Commands (create these scripts in package.json during Phase 1)

```bash
npm run dev          # local app
npm run lint
npm run typecheck
npm test             # Vitest
npm run test:e2e     # Playwright
npm run db:migrate   # prisma migrate dev (local only)
npm run db:seed      # local test data: two test businesses
npm run check:rls    # fails if any app table lacks RLS
supabase start       # local Postgres + Auth (needs Docker)
```

## Folder layout (target)

```
app/(staff)/pos/...        cashier POS
app/(staff)/admin/...      Owner back office
app/m/[code]/...           public customer menu (QR)
app/api/...                route handlers
lib/db/                    Prisma client, scoped client, RLS helper
lib/domain/                sale transaction, stock math, pricing (pure, tested)
lib/auth/                  session -> business, role, location
prisma/                    schema.prisma, migrations/
scripts/                   operator scripts (setup business, import CSV); run with a log
tests/                     unit, integration (isolation), e2e
docs/                      SPEC.md, PHASES.md, DECISIONS.md, RUNBOOK-restore.md
```

## Environments

Now: local (Docker Supabase) → Cloudflare preview + staging Supabase (Free) → production on the same free setup until the production move. At production (clients acquired): local → Vercel preview + staging Supabase project → production on Vercel + Supabase Pro. Migrations run on staging and production **only from CI** (GitHub Actions), production after a manual approval.
