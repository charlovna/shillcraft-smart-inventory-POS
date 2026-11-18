# Handoff: staff login screen (last open build task of Phase 2)

You are a fresh agent. Do ONLY this task, then stop. Read `CLAUDE.md` first (the non-negotiable rules and the temporary free-tier pivot), then `docs/SPEC.md` (Users and Access sections), `docs/PHASES.md` (Phase 2) and `docs/phase-reports/PHASE-2-NOTES.md`. The developer is a beginner: explain in plain words before acting, keep changes small, ask before anything that touches production or adds a paid service. This repo is public: never commit secrets, emails or user ids.

## Goal
A staff member opens the app, signs in with email and password (Supabase Auth), and every later request carries a session the server can verify. Wrong passwords fail cleanly. Signing out works. Unauthenticated visitors cannot reach staff pages.

## Already built (do not rebuild)
- `lib/auth/verify.ts`: verifies a Supabase access token against the project's public keys.
- `lib/auth/session.ts`: token to `{ businessId, userId, role, locationId }` using the database (`resolve_staff`).
- `lib/auth/request.ts`: reads the token from `Authorization: Bearer` or the cookie **`sb-access-token`** (constant `SESSION_COOKIE`).
- `lib/auth/guards.ts`: `requireRole`, `requireLocation`.
- `GET /api/me` (`lib/api/me.ts`, `app/api/me/route.ts`): the guarded route pattern to copy.
- Tests: `tests/unit/auth.test.ts`, `tests/integration/session.test.ts`, `tests/integration/me-route.test.ts`.

## To build
1. `/login` page: email, password, submit, clear error message, mobile friendly, large touch targets. Business, role and location are never typed or chosen here.
2. Server action or route handler that signs in by calling Supabase Auth over plain HTTPS: `POST {NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password` with header `apikey: {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`. **Do not use supabase-js or PostgREST for data** (rule 4). On success set `sb-access-token` and a refresh-token cookie: `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`.
3. Token refresh (`grant_type=refresh_token`) so a session lasts a working day without forcing a re-login, and a sign-out action that clears both cookies.
4. Route protection: staff pages redirect to `/login` when there is no valid session. Next.js 16 changed some conventions (for example `middleware` may now be called `proxy`): read `node_modules/next/dist/docs/` before writing this. Remember `/m/[code]` (customer menu) stays public.
5. A minimal signed-in landing page that calls the existing session code and shows the business name and role (a placeholder; the real POS comes in Phase 4).
6. Tests (real database, no mocks for security): wrong password gives no session and a generic error; cookies are HttpOnly; protected page redirects without a session; a disabled user cannot proceed (403 from existing code); a client-supplied business id is ignored. Follow red-first and break-it-to-prove-it from `CLAUDE.md`.

## Out of scope for you
- 2FA (TOTP) for owners is in SPEC.md but is **not** in the Phase 2 task list. Do not build it. Tell the admin it needs a decision.
- Cashier PIN login (parked until after the pilot), password reset, sign-up (out of scope entirely), user management screens (Phase 3 and later), Sentry (postponed).

## Environment (values are NOT in this repo)
- Local: `.env.local` on the developer PC (git-ignored) already holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for **staging**. The publishable key is designed to be public, but still keep it out of source files.
- Cloudflare Worker config lives in `wrangler.jsonc` (`vars`). The deploy workflow `.github/workflows/deploy.yml` needs `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` added to its build `env` (ask the admin for the value; it is a public key, but add it as a GitHub variable, not in the file).
- A staging test owner account exists and is linked to a test business. Ask the admin for the login; never write it down.
- Local database: PostgreSQL 17 on port 54322 (service `postgresql-x64-17`). `npm test` builds its own throwaway database.

## Known traps
- The Worker bundle is near the free-plan limit (risk R1 in the Phase 2 notes). Do not add heavy dependencies. Measure with `npx wrangler deploy --dry-run` before and after; report the change.
- `next typegen` runs inside `npm run typecheck`; CI needs it.
- On Windows, long shell heredocs can fail: write files with the editor tool.
- Never run anything against production. Merging to `main` triggers a staging deploy and then waits for the admin's approval for production: tell the admin not to approve the production step unless a migration is meant to go out.

## Done means
`npm run lint`, `npm run typecheck`, `npm test` pass; CI green; the admin can sign in on the staging Worker URL, see the landing page, sign out, and is bounced from a protected page when signed out. Then:
1. Tick the login item in `docs/PHASES.md`, add a line to `docs/DECISIONS.md`.
2. Add open items to `docs/phase-reports/PHASE-2-NOTES.md`.
3. Stop and tell the admin. The admin then asks for the Phase 2 gate run (G2 and G3 on staging), the `phase-reporter` run, and the Phase 3 handoff.
