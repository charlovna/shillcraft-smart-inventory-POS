# Decisions log

One line per decision: date, decision, why. Newest last.

- 2026-11-15: One app, one shared database for all clients; each row carries business_id. Why: one codebase, one bill; separate DBs only if a contract demands it.
- 2026-11-15: Add-ons are products flagged `is_addon`. Why: same price, recipe and stock logic, no second code path.
- 2026-11-15: Price and cost stored on each order line at the moment of sale. Why: past profit never changes when ingredient prices change.
- 2026-11-16: Isolation enforced twice: Prisma extension + PostgreSQL RLS; app DB role has no BYPASSRLS; Supabase Data API off. Why: one forgotten filter must not leak a client's data.
- 2026-11-16: Sales are idempotent (`client_sale_id`) and queue offline on the device. Why: flaky shop Wi-Fi must not stop selling or double-count.
- 2026-11-16: Out-of-stock warns, never blocks, at the counter; negative stock allowed. Why: the counter knows what is really left; recipes can be imprecise.
- 2026-11-16: Average cost = incoming unit cost when on_hand ≤ 0. Why: the weighted formula breaks at zero or negative stock.
- 2026-11-16: Staging + preview builds; migrations only from CI; Singapore region for app and DB; Sentry + uptime + spend alerts. Why: safe releases, low latency for PH clients.
- 2026-11-16: No BIR compliance. Receipts are "order slips". Why: stay a simple web app for small businesses that handle their own invoicing.
- 2026-11-16: The app never processes payments. Customers pay cash or the business's own bank/e-wallet QR; cashier confirms on the business's phone + reference number. Why: no money handling; guards against fake screenshots.
- 2026-11-16: Build the full multi-client baseline (onboarding tools, settings, six reports) regardless of Takowaki's answers.
- 2026-11-16: Customer QR ordering in scope (v3.1): public menu per location, staff accept, prices recalculated on server, stock deducted on completed sale, 15-min expiry, rate limits, polling not websockets. Why: customers order from their own phones without an app.
- 2026-11-16: Cashier PIN login parked until after the pilot.
- 2026-11-16: Blueprint v3.1 approved (GO). 20 weeks, 9 gates, 720 hours.
- 2026-11-16: LOCKED (owner-confirmed truth): customer ordering flow = we generate the QR and give it to the business; the customer scans it; the business's menu opens in the browser; the customer orders there. No app, no login. Changes need the owner's say-so.
- 2026-11-16: Phase 1 scaffold built locally by Claude while owner was away (repo: Next.js 16, Vitest 5, Playwright, Prettier, supabase CLI as dev dep). Cloud setup left to owner via docs/PHASE1-SETUP-GUIDE.md.
- 2026-11-17: HOSTING POLICY (admin directive): Cloudflare (Workers Free, OpenNext) + Supabase Free for development, staging and pilot prep; Vercel hosting (`sin1`) and Supabase Pro apply only at production, once clients are acquired (the move comes before Takowaki's production load in Phase 8). Why: executives cannot pay for paid plans before there are clients. Notes: Cloudflare Pages is static-only, so the Next.js app runs on Cloudflare Workers; free-tier risks (DB pauses after 1 week idle, no backups so G7 is blocked, 10 ms CPU, 100k requests/day) mean no live client traffic on the free setup; code stays portable (config-only move).
- 2026-11-17: Cloudflare staging Worker `shillcraft-pos-staging` deployed (OpenNext, Hyperdrive binding to Supabase staging). Next.js `cacheComponents` and `partialPrefetching` are switched off in next.config.ts because they make the OpenNext Worker hang; re-enable on Vercel. Worker uses compat flag `no_handle_cross_request_promise_resolution`. Bundle 979 KiB gzip (under the free-plan limit).
- 2026-11-17: Added `phase-reporter` subagent. Runs only at the end of a phase, verifies tasks and gates with evidence, writes `docs/phase-reports/PHASE-N-REPORT.md`. Why: plain-language record of what happened for the executives.
- 2026-11-17: Phase 2 proposal approved by admin. Composite foreign keys (business_id, parent_id) so a row can never point at another business's row. Why: second wall behind RLS.
- 2026-11-17: Two SECURITY DEFINER lookups (resolve_menu_code, resolve_staff) are the only deliberate RLS step-around; they return ids only. Why: the business must be known before app.business_id can be set.
- 2026-11-17: Runtime role app_runtime created without password in migration; stock_movements and order_items are insert-only for it. Password is set outside git.
- 2026-11-17: Local test database is PostgreSQL 17 on port 54322 (not Docker). Integration tests build a fresh database from the real migrations.
- 2026-11-17: Runtime app must use its own Hyperdrive config (app_runtime login, query caching OFF); the existing shillcraft-staging config uses postgres and is for migrations or tests only.
