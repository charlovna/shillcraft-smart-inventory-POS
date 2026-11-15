# Build phases and gates (Blueprint v3.1: 9 phases, 20 weeks, 9 gates)

Work top to bottom. Each task = one branch + one pull request. **At a gate, stop.** Run its checks, show the human the results, and continue only when they say it passed. Paste the "Prompt" block into Claude Code to start each phase.

| # | Phase | Weeks | Dev-days | Gate(s) at the end |
|---|---|---|---|---|
| 1 | Setup and approval | 1 | 3 | G1 Plan approved (done 16 Nov 2026) |
| 2 | Core and data isolation | 2–5 | 20 | G2 Isolation tests pass · G3 Isolation holds in the database |
| 3 | Menu, recipes, inventory | 6–7 | 10 | none |
| 4 | POS and shifts | 8–10 | 15 | G4 Stock deducts per recipe · G5 Pay is safe |
| 5 | Customer QR ordering | 11–14 | 18 | G6 Online orders are safe |
| 6 | Dashboard and reports | 15–16 | 10 | none |
| 7 | Onboarding tools | 17 | 5 | none (Takowaki loaded through them) |
| 8 | Takowaki pilot | 18–19 | 6 | G7 Restore tested · G8 Pilot signed off |
| 9 | Takowaki go-live | 20 | 3 | G9 Takowaki live |

---

## Phase 1: Setup (week 1)

Tasks
- [x] Repo scaffold: Next.js + TypeScript strict, ESLint, Prettier, Vitest, Playwright, the npm scripts listed in CLAUDE.md.
- [ ] Local Supabase via the Supabase CLI (`supabase init`, `supabase start`).
- [x] `.env.example` with every variable name and a comment; real values only in `.env.local` (git-ignored) and in Vercel/GitHub secrets.
- [x] GitHub Actions CI (file written; needs GitHub push): install, lint, typecheck, unit tests on every pull request.
- [ ] Vercel project linked to the repo; Function Region = Singapore (`sin1`); preview deploys on PRs.
- [ ] Two Supabase projects in **Southeast Asia (Singapore)**: `staging` and `production`. In both: Data API disabled.
- [ ] Collect Takowaki's menu, stock items and recipes into the CSV templates (human task).

Prompt
> Read CLAUDE.md, docs/SPEC.md and this Phase 1 section. Explain the plan in plain words, then scaffold the repo step by step. After each step, tell me what to run to check it works. Do not create any cloud resources yourself; give me click-by-click instructions for Vercel, Supabase and GitHub instead.

## Phase 2: Core and data isolation (weeks 2–5)

Tasks
- [ ] Prisma schema for all 15 tables in SPEC.md (money in centavos, UTC timestamps, indexes on business_id and foreign keys).
- [ ] SQL migration: enable **and force** RLS on every table; tenant policies using `current_setting('app.business_id', true)`; create the runtime role (login, no BYPASSRLS, not table owner) with only the grants it needs.
- [ ] `lib/db`: scoped client that wraps each request's queries in a transaction which first runs `select set_config('app.business_id', $1, true)`, plus the Prisma extension that adds `business_id` to every query.
- [ ] Two connection strings: pooled (transaction mode) for the app as the runtime role; direct for migrations as the owner.
- [ ] Supabase Auth login for staff; `lib/auth` maps the session to business, role and location on the server.
- [ ] Role and location checks on every server action and route.
- [ ] `npm run check:rls` script + CI step.
- [ ] Seed: two test businesses with locations, users, menu, stock.
- [ ] CI deploy pipeline: migrations to staging on merge to main; production on manual approval.
- [ ] Sentry wired in; uptime check placeholder.

**G2 Isolation tests pass:** automated tests log in as business A and try to read and change business B's data through every route and server action. All must fail.
**G3 Isolation holds in the database:** tests connect as the runtime role, set `app.business_id` to A, and query B's rows directly. Zero rows; writes rejected. `check:rls` passes. Data API confirmed off on staging and production.

Prompt
> Phase 2. Read the Non-negotiable rules in CLAUDE.md again. Propose the Prisma schema and the RLS migration first and wait for my OK. Then build the scoped DB client and the isolation tests before any feature code. Explain RLS to me in two or three sentences as you go.

## Phase 3: Menu, recipes, inventory (weeks 6–7)

Tasks
- [ ] Owner screens: categories, products, add-ons (products with `is_addon`), which products offer which add-ons, active toggles.
- [ ] Recipe editor with recipe cost (Owner only).
- [ ] Stock items with units and conversion; stock overview per location (OK, Low, Out).
- [ ] Restock (updates weighted average; rule for on_hand ≤ 0), adjustment, waste, stock count with variance, movement history.
- [ ] Unit tests for unit conversion and weighted average cost (including on_hand ≤ 0 and negative stock).

Prompt
> Phase 3. Put the stock math in lib/domain as pure functions with unit tests first, then build the screens on top.

## Phase 4: POS and shifts (weeks 8–10)

Tasks
- [ ] Touch-first POS screen (menu left, cart right, big Pay button). Header shows business, location, cashier; cannot be changed.
- [ ] Add-on picker, notes, quantity, dine-in or take-out, hold and recall, discounts.
- [ ] Pay: cash with change; QR methods show the business's QR image and require a reference number.
- [ ] The sale transaction exactly as in SPEC.md, with `client_sale_id` idempotency.
- [ ] Offline: app shell cached (service worker), completed sales queued in IndexedDB and sent when back online, each saved once. Banner while offline.
- [ ] Out-of-stock items marked Out but still sellable.
- [ ] Receipt via browser print, labelled "Order slip, not an official receipt".
- [ ] Owner void with reason (reverses stock); cashier can only clear the open cart.
- [ ] Shifts: open, close, variance.

**G4 Stock deducts per recipe:** test sales deduct exact recipe quantities for products and add-ons; a void restores them.
**G5 Pay is safe:** sending the same sale twice, and a sale queued offline then replayed, each produce exactly one order and one deduction (test with concurrent requests too).

Prompt
> Phase 4. Build and test the sale transaction and idempotency in lib/domain before the UI. Then the POS UI, then offline queueing. Show me how to simulate going offline in the browser to test it.

## Phase 5: Customer QR ordering (weeks 11–14)

Tasks
- [ ] `menu_code` per location; printable QR sheet (per location, and per table label if set).
- [ ] Public `/m/[code]` menu: categories, products, add-ons, notes, dine-in or take-out, first name; Out items hidden; works well on a small phone.
- [ ] Submit order: server recalculates all prices; creates a `new` QR order; honeypot field; rate limit per device hash and per minute; reject if ordering is off.
- [ ] Status page for the customer (received, accepted, ready, declined).
- [ ] POS "Online orders" tab: polls every 5 seconds, sound alert, accept / decline / mark ready. Accepted order opens as a cart for payment; stock deducts only when the sale completes.
- [ ] Job or on-read check that expires `new` orders after 15 minutes.
- [ ] Owner switch: online ordering on or off per location.

**G6 Online orders are safe:** tests prove a phone cannot change a price or total, cannot read or order from another business's menu, cannot see cost data, and that rate limits and expiry work.

Prompt
> Phase 5. Treat every request to /m/* as coming from a stranger on the internet. Write the price-recalculation and rate-limit tests first. Keep it simple: polling, not websockets.

## Phase 6: Dashboard and reports (weeks 15–16)

Tasks
- [ ] Filters: location (All or one), date range (Today, 7 days, 30 days, custom) in the business's time zone.
- [ ] KPI cards, sales trend (revenue and gross profit), location comparison, best sellers incl. add-ons, payment mix, dine-in vs take-out, source (counter vs QR), alerts.
- [ ] Six CSV reports from SPEC.md, checked against seeded test sales.

Prompt
> Phase 6. Write SQL or Prisma queries for each KPI with tests against seeded data that has known totals, then build the dashboard.

## Phase 7: Onboarding tools (week 17)

Tasks
- [ ] `scripts/setup-business.ts`: creates business, locations, first Owner; prints what it did. Run via a manual GitHub Actions workflow so every run is logged.
- [ ] CSV import with templates and row-level errors; all-or-nothing save.
- [ ] Business settings screen (incl. payment method QR upload).
- [ ] Load Takowaki on **staging** using only these tools.

Prompt
> Phase 7. The operator scripts must refuse to run against production unless I pass an explicit flag and type the business name to confirm.

## Phase 8: Takowaki pilot (weeks 18–19)

Tasks (mostly human, with Claude Code fixing issues)
- [ ] Write `docs/RUNBOOK-restore.md`: restore whole DB to a new project; restore one business by copying its rows from a restored copy.
- [ ] Run the restore drill on staging.
- [ ] Load Takowaki on production; one location live alongside the current method for two weeks; daily stock count check; fixes; cashier training.

**G7 Restore tested:** the whole database, and one business on its own, restored and checked.
**G8 Pilot signed off:** end-of-day stock count matches the system within the tolerance Takowaki agrees.

## Phase 9: Go-live (week 20)

- [ ] Second Takowaki location onboarded; old method retired; Owner walkthrough.

**G9 Takowaki live:** both locations trade on the system and daily totals match the cash counted.
