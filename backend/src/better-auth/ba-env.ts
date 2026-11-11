// Environment-driven configuration for the Better Auth (drivers-only)
// integration. Everything is read from process.env — a missing provider
// configuration DISABLES that provider (it never crashes the app), while
// the core session machinery falls back to the existing JWT secret so a
// deploy without the new env vars still boots. See docs/auth/better-auth-plan.md.

export const BA_MOUNT_PATH = "/api/better-auth";

export type BaProviderId = "google" | "microsoft" | "apple" | "yahoo";

export interface BaProviderConfig {
  google?: { clientId: string; clientSecret: string };
  microsoft?: { clientId: string; clientSecret: string; tenantId: string };
  apple?: {
    clientId: string;
    /** Static pre-generated JWT, or a runtime ES256 generator. */
    clientSecret: string | (() => Promise<string>);
  };
  yahoo?: { clientId: string; clientSecret: string };
}

export interface BetterAuthEnv {
  /** Better Auth session-cookie signing secret. */
  secret: string;
  /** Explicit API base URL (recommended in production, behind proxies). */
  baseURL?: string;
  trustedOrigins: string[];
  secureCookies: boolean;
  cookieSameSite: "none" | "lax";
  frontendOrigin?: string;
  providers: BaProviderConfig;
  enabledProviderIds: BaProviderId[];
}

const str = (v: string | undefined): string | undefined => {
  const t = (v ?? "").trim();
  return t.length ? t : undefined;
};

/**
 * Apple's client secret MUST be a JWT (ES256) signed with the .p8 key,
 * valid ≤ 180 days. When the key material is present we generate it at
 * runtime (nothing expires silently); otherwise a pre-generated secret
 * from APPLE_CLIENT_SECRET is accepted — ops must rotate it before expiry.
 */
export async function generateAppleClientSecret(
  clientId: string,
  teamId: string,
  keyId: string,
  privateKeyPem: string
): Promise<string> {
  const { importPKCS8, SignJWT } = await import("jose");
  const key = await importPKCS8(privateKeyPem.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 15777000) // 180 days (Apple's hard maximum)
    .sign(key);
}

export async function readBetterAuthEnv(
  env: NodeJS.ProcessEnv = process.env
): Promise<BetterAuthEnv> {
  const nodeEnv = (env.NODE_ENV || "production").trim().toLowerCase();
  const isDev = nodeEnv === "development" || nodeEnv === "dev";

  // Secret: prefer a dedicated BETTER_AUTH_SECRET; fall back to the existing
  // access-token secret so a deploy without the new variable still boots
  // (documented in docs/auth/better-auth-drivers.md — set the dedicated one).
  const secret =
    str(env.BETTER_AUTH_SECRET) ?? str(env.JWT_ACCESS_SECRET) ?? str(env.JWT_SECRET);
  if (!secret) {
    throw new Error(
      "Better Auth: no secret available (set BETTER_AUTH_SECRET, or JWT_ACCESS_SECRET/JWT_SECRET)"
    );
  }

  // Trusted origins: the frontend origins that may call the auth endpoints.
  // Mirrors the CORS allowlist in common/cors-cookie.util.ts + Apple's
  // requirement that appleid.apple.com is trusted during its flows.
  const frontendOrigin = str(env.BETTER_AUTH_FRONTEND_ORIGIN) ?? str(env["101_DOMAIN"]);
  const trustedOrigins = [
    ...(str(env.BETTER_AUTH_TRUSTED_ORIGINS)?.split(",") ?? []),
    frontendOrigin,
    "https://101drivers.com",
    "https://www.101drivers.com",
    "https://101drivers.techbee.et",
    "https://appleid.apple.com",
  ]
    .map((o) => (o ?? "").trim())
    .filter((o) => o.length > 0)
    .filter((o, i, a) => a.indexOf(o) === i);

  // Cookie posture mirrors common/cors-cookie.util.ts: the API is reached
  // cross-site from the frontends in production (SameSite=None + Secure),
  // Lax in local development.
  const secureCookies = !isDev;
  const cookieSameSite: "none" | "lax" = secureCookies ? "none" : "lax";

  // ── Providers (env-conditional; missing = disabled, never a crash) ──
  const providers: BaProviderConfig = {};

  const googleId = str(env.GOOGLE_CLIENT_ID);
  const googleSecret = str(env.GOOGLE_CLIENT_SECRET);
  if (googleId && googleSecret) {
    providers.google = { clientId: googleId, clientSecret: googleSecret };
  }

  const msId = str(env.MICROSOFT_CLIENT_ID);
  const msSecret = str(env.MICROSOFT_CLIENT_SECRET);
  if (msId && msSecret) {
    // Default "common": personal Microsoft accounts AND any Entra org.
    // Narrow it deliberately via MICROSOFT_TENANT_ID ("organizations" /
    // "consumers" / a specific tenant GUID) — never accidentally restrict.
    providers.microsoft = {
      clientId: msId,
      clientSecret: msSecret,
      tenantId: str(env.MICROSOFT_TENANT_ID) ?? "common",
    };
  }

  const appleId = str(env.APPLE_CLIENT_ID);
  const appleKey = str(env.APPLE_PRIVATE_KEY);
  const appleKeyId = str(env.APPLE_KEY_ID);
  const appleTeamId = str(env.APPLE_TEAM_ID);
  const appleStaticSecret = str(env.APPLE_CLIENT_SECRET);
  if (appleId) {
    if (appleKey && appleKeyId && appleTeamId) {
      const clientId = appleId;
      const teamId = appleTeamId;
      const keyId = appleKeyId;
      const privateKey = appleKey;
      providers.apple = {
        clientId,
        clientSecret: () => generateAppleClientSecret(clientId, teamId, keyId, privateKey),
      };
    } else if (appleStaticSecret) {
      providers.apple = { clientId: appleId, clientSecret: appleStaticSecret };
    }
  }

  const yahooId = str(env.YAHOO_CLIENT_ID);
  const yahooSecret = str(env.YAHOO_CLIENT_SECRET);
  if (yahooId && yahooSecret) {
    providers.yahoo = { clientId: yahooId, clientSecret: yahooSecret };
  }

  const enabledProviderIds = Object.keys(providers) as BaProviderId[];

  return {
    secret,
    baseURL: str(env.BETTER_AUTH_URL),
    trustedOrigins,
    secureCookies,
    cookieSameSite,
    frontendOrigin,
    providers,
    enabledProviderIds,
  };
}
