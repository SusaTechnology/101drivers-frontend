# Better Auth for Drivers — Implementation Plan (Task 74)

Scope per owner: **drivers only**. Customers, dealers, and admins stay on the
legacy auth stack untouched in this phase.

## 1. Existing authentication architecture (inspected)

| Layer | Today |
| --- | --- |
| Backend | NestJS 10 + Express, global prefix `/api`, REST + GraphQL (Apollo) |
| Password | bcrypt (`PasswordService`, rounds from `BCRYPT_SALT`), stored in `User.password` (`passwordHash` is legacy/unused dual field) |
| Sessions | Access JWT (`JWT_ACCESS_SECRET`/`JWT_SECRET`, 7d) in `Authorization: Bearer`; sliding 30d refresh token cookie (domain `.techbee.et`, `SameSite=None`) + `x-refresh-token` header fallback |
| Guards | `JwtAuthGuard` (passport, used on all protected REST routes), `adminAuth.guard`, `gqlAC.guard` (GraphQL), `MobileOnlySignupGuard` (driver signup UA gate) |
| Email | `MailService` (nodemailer SMTP) + `EmailVerificationService` (hashed OTP tokens, purposes SIGNUP / PASSWORD_RESET / ADMIN_INVITE) |
| Driver signup | `POST /api/auth/signup/driver`: CA-only ZIP gate → age 25+ → email uniqueness → OTP (call 1) → token + full DTO (call 2) → atomic `User`+`Driver` (status `WAITLISTED`) → referral + service-area verdict (non-blocking) |
| Driver status | `WAITLISTED → INVITED → PENDING_APPROVAL → MEETING_REQUESTED → APPROVED / SUSPENDED / REJECTED / ON_HOLD` — business states, fully separate from authentication |
| Frontend | React + Vite + TanStack Router; auth state cached in localStorage (`getUser`/`isAuthenticated` in `src/lib/tanstack/dataQuery.ts`), `DriverRouteGuard` state machine (needs_signin / waitlisted / on_hold / invited / pending_approval / rejected) |

## 2. What Better Auth replaces (drivers only)

- Driver **identity + sessions**: email/password sign-in, social sign-in
  (Google, Microsoft, Apple, Yahoo), email verification, password reset,
  account linking, logout — all through Better Auth at `/api/better-auth`.
- Legacy stack stays for customers/dealers/admins AND keeps working for
  existing drivers during the transition (hybrid guard, §8 below).

## 3. What must remain untouched

- Driver onboarding/approval workflow (incl. MobileOnlySignupGuard for the
  legacy email path, CA + age gates, WAITLISTED entry, invite → onboarding-token flow).
- All business authorization (roles from `User.roles`, driver status gates).
- Stripe, customer/dealer/admin flows, GraphQL guards, existing emails.

## 4. Database changes (additive only — migration SQL generated offline, never auto-applied)

- `User`: + `image String?`, + `emailVerified Boolean @default(false)`,
  `password @default("")`, `username @default(cuid())` (both just defaults —
  Better Auth creates users without them; legacy code always sets them).
- New models `Account`, `Session`, `Verification` (Better Auth shapes,
  `@@unique([providerId, accountId])` prevents one external identity → two users).
- Backfill script (ops-run, idempotent): mint credential `Account` rows from
  existing `User.password` for DRIVER-role users → existing passwords work
  unchanged (same bcrypt verify).

## 5. Integration decisions

- **Mount**: official `toNodeHandler` on the Express instance at
  `/api/better-auth`, registered before `app.listen` (same pattern as the
  Stripe raw-body mount). The docs' community NestJS module
  (`@thallesp/nestjs-better-auth`) is rejected: it requires
  `bodyParser: false` globally, which breaks Stripe webhooks + GraphQL here.
- **Prisma adapter** (`better-auth/adapters/prisma`) with model mapping:
  user → existing `User` (`name → fullName`, `emailVerified → emailVerified`),
  session/account/verification → new tables. No duplicate User model.
- **Password**: custom `hash`/`verify` delegating to the existing bcrypt
  `PasswordService` → one hash format, zero legacy-password migration.
- **Providers** (env-conditional — missing config = provider disabled, never a crash):
  Google (built-in), Microsoft (built-in, `tenantId` from env, default
  `common` = personal + any org), Apple (built-in; ES256 JWT client secret
  generated from `APPLE_PRIVATE_KEY`/`KEY_ID`/`TEAM_ID` via `jose`, or a
  pre-generated `APPLE_CLIENT_SECRET`), Yahoo (Generic OAuth with Yahoo's
  official discovery URL `https://api.login.yahoo.com/.well-known/openid-configuration`,
  scopes `openid email profile` — endpoints verified against developer.yahoo.com).
- **Account linking**: Better Auth defaults (auto-link only when provider email
  is verified; explicit `linkSocial` when signed in; last-credential unlink
  blocked). Microsoft deliberately NOT in `trustedProviders` (Entra emails are
  tenant-mutable and unverified). `@@unique([providerId, accountId])` at the DB.
- **Sessions**: HTTP-only cookies (`SameSite` env-driven to mirror existing
  behavior: `None`+`Secure` in production behind cross-site API, `Lax` in dev)
  + **bearer plugin** (Authorization header fallback for Safari/iOS PWA, same
  reality as the current refresh-cookie system). 30d expiry, cookieCache 5 min.
  Rate limiting via Better Auth's built-in limiter on auth endpoints.
- **Emails**: reuse `MailService`; Better Auth verification/reset callbacks send
  branded mail (no second SMTP implementation). Existing OTP flows untouched.
- **Frontend**: official React client (`better-auth/react`) pointed at
  `/api/better-auth`; `DealerSignIn` (driver mode) gains the four social
  buttons; new social-callback route mirrors the session into the existing
  localStorage cache via a new `GET /api/auth/ba/driver-context` endpoint, so
  `DriverRouteGuard`/`dataQuery` need zero changes; social-driver application
  form reuses the legacy gates for new social users; "Sign-in methods" security
  card (list/link/unlink/change password).

## 6. Security notes

- No secrets to frontend; enabled-providers list served from env.
- Trusted origins = existing CORS allowlist + `appleid.apple.com`.
- OAuth state/PKCE managed by Better Auth; origin checks = CSRF.
- Enumeration-safe sign-up (requireEmailVerification mode); rate limits on
  auth endpoints; no tokens in localStorage (bearer token held in memory only).

## 7. Risks

- Cross-site API ↔ frontend: cookies may be ITP-blocked (existing known issue)
  → bearer fallback keeps drivers signed in where cookies fail.
- Legacy JWT sessions keep working via the hybrid guard until cutover;
  guard removal is a documented follow-up after all drivers migrate.
- Apple email arrives only on first authorization — handled by Better Auth
  (account created at first sign-in carries it).
