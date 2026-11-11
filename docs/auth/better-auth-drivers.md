# Better Auth — Drivers Authentication (Task 74)

Drivers-only identity layer built on **Better Auth 1.7** integrated into the
existing NestJS backend and React frontend. Customers, dealers and admins
remain on the legacy JWT stack — untouched. Plan + rationale:
`docs/auth/better-auth-plan.md`.

## What changed

| Area | Before | After |
| --- | --- | --- |
| Driver identity | Legacy JWT + bcrypt | Better Auth session (cookie + bearer fallback), same bcrypt format |
| Social providers | none | Google / Microsoft / Apple / Yahoo (env-conditional) |
| Sessions (legacy users) | JWT + refresh cookie | **unchanged** — hybrid guard accepts both |
| Driver approval | `Driver.status` | **unchanged** — authentication ≠ approval |
| Customers/dealers/admins | JWT | **unchanged** |

## Environment variables (backend)

See `backend/.env.example` (`Better Auth` section). Highlights:

- `BETTER_AUTH_SECRET` — dedicated 32+ char secret (falls back to
  `JWT_ACCESS_SECRET ?? JWT_SECRET` so existing deploys boot).
- `BETTER_AUTH_URL` — full URL of the mounted handler, e.g.
  `https://api.101drivers.com/api/better-auth` (recommended in production).
- `BETTER_AUTH_FRONTEND_ORIGIN` — frontend origin for email links (defaults
  to `101_DOMAIN`).
- `BETTER_AUTH_TRUSTED_ORIGINS` — extra trusted origins, comma-separated.
- Provider creds: `GOOGLE_CLIENT_ID/SECRET`,
  `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` (default `common` = personal +
  any organization), `APPLE_CLIENT_ID` + (`APPLE_PRIVATE_KEY`/`APPLE_KEY_ID`/
  `APPLE_TEAM_ID` **or** pre-generated `APPLE_CLIENT_SECRET`),
  `YAHOO_CLIENT_ID/SECRET`.

A provider with missing credentials is **disabled**, never a crash. The
frontend renders only what `GET /api/auth/ba/providers` reports.

## Mount point

`toNodeHandler(auth)` mounted on the Express instance at **`/api/better-auth`**
in `backend/src/main.ts` — registered before `app.listen`, ahead of the JSON
body parser (Better Auth reads the raw stream; same early-mount pattern as the
Stripe webhook). NestJS never routes `/api/better-auth/*`.

## OAuth application registration + redirect URIs

Register `https://<api-host>/api/better-auth/callback/<provider>` as the
redirect URI (e.g. `https://api.101drivers.com/api/better-auth/callback/google`):

| Provider | Console | Redirect URI path | Notes |
| --- | --- | --- | --- |
| Google | console.cloud.google.com → OAuth client (Web) | `/api/better-auth/callback/google` | Enable Google+ API not required; scope profile+email |
| Microsoft | portal.azure.com → App registration (Entra ID) | `/api/better-auth/callback/microsoft` | "Accounts in any organizational directory and personal Microsoft accounts" for `common`; add client secret |
| Apple | developer.apple.com → Identifiers → Services ID (+ Key with Sign in with Apple) | `/api/better-auth/callback/apple` | No localhost allowed; client secret is an ES256 JWT signed by the .p8 (auto-generated when `APPLE_PRIVATE_KEY`+`APPLE_KEY_ID`+`APPLE_TEAM_ID` are set; pre-generated secrets expire ≤180 days) |
| Yahoo | developer.yahoo.com/apps | `/api/better-auth/callback/yahoo` | Enable OpenID Connect permissions; scopes `openid email profile`; endpoints discovered from Yahoo's official OIDC discovery document |

## Database migration (non-destructive)

`backend/prisma/migrations/20261111193000_better_auth_identity/migration.sql`:

- `User` + `emailVerified` (bool, default false), + `image` (nullable),
  `password`/`username` get defaults (`''`/`cuid()`) — existing rows untouched.
- New tables `Account` (identities + credential hashes), `Session` (Better
  Auth sessions), `Verification` (email tokens) with FK cascade to `User`.
- `@@unique([providerId, accountId])` — one external identity can never map
  to two users.

Runbook (staging → production):

```bash
prisma migrate deploy                                          # apply migration
npx ts-node scripts/backfill-better-auth-accounts.ts --dry-run # preview (DRY_RUN=1 env)
npx ts-node scripts/backfill-better-auth-accounts.ts           # mint credential accounts
```

The backfill copies each DRIVER user's existing bcrypt hash into a
credential Account row → every existing driver password keeps working under
Better Auth with zero resets. Re-running is safe (idempotent). Drivers with
no password hash (admin-invited, never set one) are skipped and listed.

## Frontend

- `src/lib/betterAuth/auth-client.ts` — official React client
  (`better-auth/react` + bearer plugin), baseURL `<VITE_API_URL>/api/better-auth`.
- `src/lib/betterAuth/ba-session.ts` — mirrors Better Auth sessions into the
  legacy localStorage cache and registers the dataQuery bridge.
- `src/lib/tanstack/dataQuery.ts` — bridge-aware refresh/transport (legacy
  JWT users unchanged; Better Auth users never hit the legacy refresh token
  endpoint; session token stays in memory only — never localStorage).
- `DealerSignIn` (driver mode) — social buttons (configured providers only).
- `/auth/social-callback` — provider round-trip landing; routes by driver
  state (application form → onboarding → waitlist → dashboard).
- `/driver/social-application` — application form for social identities,
  same gates as email signup (California ZIP 90001–96199, age 25+, mobile UA).
- `/driver/signin-methods` — list/link/unlink providers + change password
  (menu → Settings → Sign-in methods).

## How authorization works

Better Auth establishes identity only. `JwtAuthGuard` (hybrid transition
guard) resolves a Better Auth session (cookie or `Authorization: Bearer`
session token) and loads the user FRESH from the database — roles,
`isSuperAdmin`, `isActive` — never trusting the session payload. No session
→ legacy passport JWT path, unchanged. Remove the Better Auth branch after
the driver cutover completes.

## Testing

- `backend/src/tests/better-auth/ba-env.spec.ts` — provider
  enable/disable, Microsoft tenant default, Apple secret generation (mocked
  jose — ESM-only in jest), cookie posture, secret fallback, trusted origins.
- `backend/src/tests/better-auth/ba-driver-gates.spec.ts` — CA ZIP + age
  gates (exact legacy messages), UTC-midnight DOB.
- Full sign-in flows (email + all four providers) require real provider
  credentials + a database — covered by the manual QA checklist in
  `docs/auth/better-auth-plan.md` §Testing; automated browser tests are not
  part of this repo's tooling.

## Known limitations / follow-ups

1. Legacy email driver signup (`/api/auth/signup/driver`) still issues legacy
   JWT sessions until the FE flow is migrated; the hybrid guard bridges both.
2. Microsoft emails are unverified by Entra → never implicitly auto-linked
   (deliberate; users link explicitly in Sign-in methods).
3. Cookies are cross-site while the API is not same-site with the frontend —
   Safari/iOS-PWA users rely on the bearer fallback (in-memory token). Moving
   the API to `api.101drivers.com` + `crossSubDomainCookies` makes sessions
   fully first-party (recommended follow-up).
4. `token.service.spec.ts` failure is pre-existing (compile-time, unrelated).
5. Old uppercase legacy emails would block implicit provider linking
   (emails are matched exactly); explicit linking still works.
