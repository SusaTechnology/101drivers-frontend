// createBetterAuth — the Better Auth instance factory for the drivers-only
// identity layer. Pure function: takes its collaborators as arguments so it
// is unit-testable without Nest DI. See docs/auth/better-auth-plan.md.
//
// Key decisions (all verified against better-auth.com docs, 1.7.x):
//   • Prisma adapter mapped onto the EXISTING User model (no duplicate user
//     table): user.name → User.fullName, emailVerified → User.emailVerified.
//   • Passwords: SAME bcrypt as the legacy PasswordService (BCRYPT_SALT
//     rounds) → existing driver hashes keep working; the backfill script
//     (scripts/backfill-better-auth-accounts.ts) mints credential accounts.
//   • Providers are env-conditional — an unconfigured provider is simply
//     absent (the UI reads GET /api/auth/ba/providers for the live list).
//   • Yahoo rides the Generic OAuth plugin via Yahoo's OFFICIAL discovery
//     document (endpoints verified against developer.yahoo.com).
//   • Account linking stays on Better Auth's secure defaults: auto-link only
//     when the provider email is VERIFIED, explicit linkSocial otherwise,
//     last-credential unlink blocked. Microsoft is deliberately NOT a
//     trusted provider (Entra emails are tenant-mutable and unverified).
//   • Sessions: 30 days, HTTP-only cookie (SameSite mirrors the existing
//     cookie posture), 5-minute cookie cache + the bearer plugin so Safari/
//     iOS-PWA users can present the session via Authorization header.

import { compare as bcryptCompare, hash as bcryptHash } from "bcrypt";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, genericOAuth } from "better-auth/plugins";
import type { PrismaService } from "../prisma/prisma.service";
import type { MailService } from "../common/mail/mail.service";
import { parseSalt } from "../auth/password.service";
import type { BetterAuthEnv } from "./ba-env";
import { EnumDriverStatus, EnumUserRoles } from "@prisma/client";

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

export interface CreateBetterAuthDeps {
  prisma: PrismaService;
  mail: MailService;
  env: BetterAuthEnv;
}

export function createBetterAuth(deps: CreateBetterAuthDeps) {
  const { prisma, mail, env } = deps;

  // Same salt/rounds source as PasswordService — one hash format everywhere.
  const bcryptSalt = parseSalt(process.env.BCRYPT_SALT);

  const providers: BetterAuthOptions["socialProviders"] = {};
  if (env.providers.google) {
    providers.google = {
      clientId: env.providers.google.clientId,
      clientSecret: env.providers.google.clientSecret,
    };
  }
  if (env.providers.microsoft) {
    providers.microsoft = {
      clientId: env.providers.microsoft.clientId,
      clientSecret: env.providers.microsoft.clientSecret,
      tenantId: env.providers.microsoft.tenantId,
      // Force the account picker — never silently reuse a stale session.
      prompt: "select_account",
    };
  }
  if (env.providers.apple) {
    // Apple's client secret is an ES256 JWT — when the key material is
    // configured we generate it at runtime via better-auth's async provider
    // form; a pre-generated static secret (env) is passed through as-is.
    const appleCfg = env.providers.apple;
    providers.apple = (async () => ({
      clientId: appleCfg.clientId,
      clientSecret:
        typeof appleCfg.clientSecret === "function"
          ? await appleCfg.clientSecret()
          : appleCfg.clientSecret,
    })) as unknown as NonNullable<
      BetterAuthOptions["socialProviders"]
    >["apple"];
  }

  const socialProviders = Object.keys(providers).length
    ? providers
    : (undefined as unknown as BetterAuthOptions["socialProviders"]);

  return betterAuth({
    ...(env.baseURL ? { baseURL: env.baseURL } : {}),
    secret: env.secret,
    trustedOrigins: env.trustedOrigins,

    database: prismaAdapter(prisma, { provider: "postgresql" } as never),

    // ── Model mapping onto the existing schema ──────────────────────────
    user: {
      // The EXISTING User model — no second user table.
      modelName: "User",
      fields: {
        name: "fullName",
      },
    },
    session: {
      modelName: "Session",
      expiresIn: 60 * 60 * 24 * 30, // 30 days — matches the legacy sliding window
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // per §8: no DB hit on every frontend render
      },
    },
    account: {
      modelName: "Account",
      accountLinking: {
        enabled: true,
        // Auto-link ONLY on a provider-verified email match. Microsoft is
        // deliberately absent — Entra never vouches for the email claim.
        // Everything else links explicitly via linkSocial while signed in.
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
      },
    },
    verification: {
      modelName: "Verification",
    },

    // ── Email + password (drivers) ─────────────────────────────────────
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: {
        hash: (password: string) => bcryptHash(password, bcryptSalt),
        verify: (data: { password: string; hash: string }) =>
          bcryptCompare(data.password, data.hash),
      },
      sendResetPassword: async ({ user, url, token }) => {
        const link =
          env.frontendOrigin && env.frontendOrigin.startsWith("http")
            ? `${env.frontendOrigin}/driver-signin?resetToken=${token}`
            : url;
        // Fire-and-forget per docs (avoid awaiting — timing attacks).
        void mail
          .sendMail({
            to: user.email,
            subject: "Reset your 101 Drivers password",
            text: [
              `Hi ${user.name ?? "driver"},`,
              "",
              "We received a request to reset your 101 Drivers password.",
              "Open this link to choose a new one (valid for 1 hour):",
              link,
              "",
              "If you didn't request this, you can ignore this email.",
            ].join("\n"),
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto;">
              <h2>Reset your 101 Drivers password</h2>
              <p>Hi ${user.name ?? "driver"},</p>
              <p>We received a request to reset your 101 Drivers password.</p>
              <p><a href="${link}" style="display:inline-block;background:#a3e635;color:#0f172a;font-weight:bold;padding:12px 20px;border-radius:12px;text-decoration:none;">Choose a new password</a></p>
              <p>The link is valid for 1 hour. If you didn't request this, you can ignore this email.</p>
            </div>`,
          })
          .catch(() => undefined);
      },
      resetPasswordTokenExpiresIn: 3600,
    },

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        // `url` is the API verify endpoint; it redirects to the driver
        // sign-in page once verification completes (callbackURL at signup).
        void mail
          .sendMail({
            to: user.email,
            subject: "Verify your email — 101 Drivers",
            text: [
              `Hi ${user.name ?? "driver"},`,
              "",
              "Welcome to 101 Drivers! Confirm your email address to activate",
              "your account:",
              url,
            ].join("\n"),
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to 101 Drivers</h2>
              <p>Hi ${user.name ?? "driver"},</p>
              <p>Confirm your email address to activate your account.</p>
              <p><a href="${url}" style="display:inline-block;background:#a3e635;color:#0f172a;font-weight:bold;padding:12px 20px;border-radius:12px;text-decoration:none;">Verify my email</a></p>
            </div>`,
          })
          .catch(() => undefined);
      },
    },

    // Mirror Better Auth's emailVerified into the legacy emailVerifiedAt
    // column so every existing reader stays correct.
    databaseHooks: {
      user: {
        create: {
          after: async (user: { id: string; emailVerified?: boolean }) => {
            await prisma.user
              .update({
                where: { id: user.id },
                data: { emailVerifiedAt: user.emailVerified ? new Date() : null },
              })
              .catch(() => undefined);
          },
        },
        update: {
          after: async (user: { id: string; emailVerified?: boolean }) => {
            if (user.emailVerified) {
              await prisma.user
                .update({
                  where: { id: user.id },
                  data: { emailVerifiedAt: new Date() },
                })
                .catch(() => undefined);
            }
          },
        },
      },
    },

    // ── Social providers (env-conditional) ─────────────────────────────
    ...(socialProviders ? { socialProviders } : {}),

    plugins: [
      // Authorization-header session transport — the reliable path where
      // browsers block cross-site cookies (iOS PWA standalone, Safari ITP),
      // mirroring the legacy x-refresh-token fallback design.
      bearer(),
      // Yahoo via OAuth 2.0 / OIDC discovery (https://api.login.yahoo.com).
      // accountSubject defaults to the OIDC `sub` claim; PKCE + state are on
      // by default and managed by the plugin.
      ...(env.providers.yahoo
        ? [
            genericOAuth({
              config: [
                {
                  providerId: "yahoo",
                  clientId: env.providers.yahoo.clientId,
                  clientSecret: env.providers.yahoo.clientSecret,
                  discoveryUrl:
                    "https://api.login.yahoo.com/.well-known/openid-configuration",
                  scopes: ["openid", "email", "profile"],
                },
              ],
            }),
          ]
        : []),
    ],

    advanced: {
      cookiePrefix: "101d",
      useSecureCookies: env.secureCookies,
      cookies: {
        session_token: {
          attributes: {
            sameSite: env.cookieSameSite,
            secure: env.secureCookies,
            path: "/",
          },
        },
      },
    },

    // Built-in limiter on all auth endpoints (brute-force protection).
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      specialRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 10 },
        "/forget-password": { window: 60, max: 10 },
      },
    },
  });
}

// Re-exported for the driver-context controller — keeps the identity →
// business-role mapping (auth ≠ approval) in one visible place.
export const DRIVER_DEFAULT_CONTEXT = {
  roles: [EnumUserRoles.DRIVER],
  driverStatus: EnumDriverStatus.WAITLISTED,
};
