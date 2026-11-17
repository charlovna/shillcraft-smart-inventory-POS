# Phase 2 proposal: schema and data isolation (for approval, nothing built yet)

Status: **waiting for admin OK.** Source: `docs/SPEC.md` data model (15 tables) and the Non-negotiable rules in `CLAUDE.md`.

## 1. Tables (15, exactly as in SPEC.md)

All tables: `id uuid` (default `gen_random_uuid()`), `created_at timestamptz` (UTC), and `business_id` on every table except `businesses`. Names are snake_case in the database. Money is whole centavos (`Int`). Stock quantities are `Decimal(14,3)`. Average cost is `Decimal(14,6)`.

| Table | Notes |
|---|---|
| businesses | no `business_id`; RLS compares `id` |
| locations | `menu_code` unique across all businesses, random, used in QR link |
| users | `auth_user_id` (uuid from Supabase Auth, no cross-schema foreign key), `role` owner or cashier, `location_id` null for owner |
| payment_methods, categories, products, product_addons | as in SPEC |
| stock_items, recipe_lines, location_stock | `on_hand` may be negative |
| orders | unique (`business_id`, `client_sale_id`); status and source as enums |
| order_items | `price_at_sale_centavos`, `cost_at_sale_centavos` stored per line |
| stock_movements | append-only audit trail |
| shifts, order_rate_limits | as in SPEC |

Indexes: `business_id` on every table, plus every foreign key.

**Extra protection I propose (small addition):** child tables use *composite* foreign keys `(business_id, parent_id)`. A row in business A can then never point at a parent in business B, even through a bug. This does not change any SPEC behaviour.

## 2. Row-level security (RLS), in plain words

RLS makes the database itself refuse to show or change rows that belong to another business, even if the app code forgets a filter.

- `ENABLE` and `FORCE` RLS on all 15 tables.
- One policy per table: `business_id = current_setting('app.business_id', true)::uuid`, for both reading (`USING`) and writing (`WITH CHECK`). For `businesses` it compares `id`.
- If the setting is missing, the comparison is NULL and **no rows are visible** (fails closed).
- Each request runs inside a transaction that first calls `select set_config('app.business_id', $1, true)`.

## 3. Database roles

- `postgres` (owner, bypasses RLS): migrations only, from CI.
- `app_runtime`: `LOGIN`, `NOBYPASSRLS`, not the owner, no `CREATE`. Created in a SQL migration **without a password**; you set the password once in Supabase's SQL editor (I give the exact line), so no secret enters git.
- Grants only what is needed. `stock_movements` gets `SELECT, INSERT` only (no update, no delete), so the audit trail cannot be edited. `orders` and `order_items` get no `DELETE`.

## 4. Two narrow lookup functions (needed because RLS needs the business first)

A customer scanning a QR has no session yet, and a staff login only gives an `auth_user_id`. The app must find the business before it can set `app.business_id`. I propose two `SECURITY DEFINER` functions owned by `postgres`, runnable by `app_runtime`:

- `resolve_menu_code(code)` returns only `business_id` and `location_id`.
- `resolve_staff(auth_user_id)` returns only `business_id`, `user_id`, `role` and `location_id`.

Each returns at most one row and exposes nothing else. This is the only place RLS is deliberately stepped around, and tests will cover it.

## 5. App layer (`lib/db`)

- Prisma with the `@prisma/adapter-pg` driver (needed on Workers), schema in `prisma/schema.prisma`, config in `prisma.config.ts`.
- Scoped client: each request opens a transaction, sets `app.business_id`, then runs queries through a Prisma extension that adds `business_id` to every read and write.
- Role and location come from the server session only (rule 2).

## 6. Connections (changes caused by the free-tier pivot)

- **Found an issue:** the Hyperdrive config we made earlier connects as `postgres`, which bypasses RLS. The running app must **not** use it. I will ask you to create a second Hyperdrive config (`shillcraft-staging-app`) that logs in as `app_runtime`, with **query caching turned off** (Hyperdrive caches reads by default, which is unsafe for stock and orders).
- Migrations: GitHub Actions runners cannot reach Supabase Free's direct connection (IPv6 only). Migrations will use the **Session pooler** string (port 5432 on the pooler host).

## 7. Order of work (each step: test first, show it failing, then pass)

1. Prisma schema + first migration (tables, indexes, composite keys).
2. SQL migration: RLS, role, grants, the two functions.
3. `check:rls` script and CI step.
4. `lib/db` scoped client + Prisma extension.
5. Isolation tests, run against a real local database: app layer (G2) and direct as `app_runtime` (G3).
6. Supabase Auth login + `lib/auth` session mapping; role and location checks.
7. Seed (two test businesses).
8. CI migration pipeline (staging on merge, production after manual approval).
9. Sentry and uptime placeholder.
10. G2 and G3 gate checks, then the `phase-reporter` subagent writes the Phase 2 report.

## 8. Questions for you (defaults in bold, I proceed with them if you say "approved")

1. **Discount:** store as `discount_type` (percent or fixed) plus `discount_value` and the resulting `discount_centavos` on the order. SPEC only says "discount".
2. **Local database:** the plan says local Supabase needs Docker. If Docker is not installed on this PC, I would use a local PostgreSQL install instead. **Please tell me which you have.**
3. **Enums:** `role`, `order_status`, `order_source`, `order_type`, `movement_type` as PostgreSQL enums. **Yes.**
4. **Takowaki prices and time zone defaults:** `currency = 'PHP'`, `time_zone = 'Asia/Manila'`. **Yes.**
