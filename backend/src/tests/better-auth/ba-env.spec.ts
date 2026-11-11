// Unit tests for the Better Auth environment configuration (drivers):
// providers must be env-conditional (missing config disables a provider,
// never crashes), trusted origins mirror the CORS allowlist, and the cookie
// posture mirrors the existing SameSite/Secure logic.

import {
  generateAppleClientSecret,
  readBetterAuthEnv,
} from "../../better-auth/ba-env";

// jose v6 is ESM-only — jest's CJS runtime cannot import it directly. The
// mock preserves the chainable SignJWT API so the test still verifies the
// JWT claims our code constructs (header.kid, iss, sub, aud, exp window).
jest.mock("jose", () => {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return {
    importPKCS8: jest.fn(async () => ({ mocked: true })),
    SignJWT: class {
      payload: Record<string, unknown> = {};
      header: Record<string, unknown> = {};
      setProtectedHeader(h: Record<string, unknown>) {
        this.header = h;
        return this;
      }
      setIssuer(v: string) {
        this.payload.iss = v;
        return this;
      }
      setSubject(v: string) {
        this.payload.sub = v;
        return this;
      }
      setAudience(v: string) {
        this.payload.aud = v;
        return this;
      }
      setIssuedAt(v: number) {
        this.payload.iat = v;
        return this;
      }
      setExpirationTime(v: number) {
        this.payload.exp = v;
        return this;
      }
      async sign(): Promise<string> {
        return `${b64(this.header)}.${b64(this.payload)}.mock-signature`;
      }
    },
  };
});

const BASE_ENV = {
  NODE_ENV: "development",
  BCRYPT_SALT: "10",
  JWT_ACCESS_SECRET: "test-secret",
} as NodeJS.ProcessEnv;

describe("readBetterAuthEnv", () => {
  it("disables every provider when no OAuth env vars are set (no crash)", async () => {
    const env = await readBetterAuthEnv(BASE_ENV);
    expect(env.enabledProviderIds).toEqual([]);
    expect(env.providers.google).toBeUndefined();
    expect(env.providers.microsoft).toBeUndefined();
    expect(env.providers.apple).toBeUndefined();
    expect(env.providers.yahoo).toBeUndefined();
  });

  it("enables Google only when BOTH client id and secret are present", async () => {
    const withIdOnly = await readBetterAuthEnv({
      ...BASE_ENV,
      GOOGLE_CLIENT_ID: "gid",
    } as NodeJS.ProcessEnv);
    expect(withIdOnly.providers.google).toBeUndefined();

    const withBoth = await readBetterAuthEnv({
      ...BASE_ENV,
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
    } as NodeJS.ProcessEnv);
    expect(withBoth.providers.google).toEqual({
      clientId: "gid",
      clientSecret: "gsecret",
    });
    expect(withBoth.enabledProviderIds).toEqual(["google"]);
  });

  it("defaults Microsoft tenant to common (personal + any organization)", async () => {
    const env = await readBetterAuthEnv({
      ...BASE_ENV,
      MICROSOFT_CLIENT_ID: "mid",
      MICROSOFT_CLIENT_SECRET: "msecret",
    } as NodeJS.ProcessEnv);
    expect(env.providers.microsoft?.tenantId).toBe("common");

    const narrowed = await readBetterAuthEnv({
      ...BASE_ENV,
      MICROSOFT_CLIENT_ID: "mid",
      MICROSOFT_CLIENT_SECRET: "msecret",
      MICROSOFT_TENANT_ID: "consumers",
    } as NodeJS.ProcessEnv);
    expect(narrowed.providers.microsoft?.tenantId).toBe("consumers");
  });

  it("accepts a static Apple client secret when no key material is set", async () => {
    const env = await readBetterAuthEnv({
      ...BASE_ENV,
      APPLE_CLIENT_ID: "com.101drivers.web.si",
      APPLE_CLIENT_SECRET: "static-jwt",
    } as NodeJS.ProcessEnv);
    expect(env.providers.apple).toBeDefined();
    if (typeof env.providers.apple?.clientSecret === "function") {
      throw new Error("expected a static secret");
    }
    expect(env.providers.apple?.clientSecret).toBe("static-jwt");
  });

  it("generates a runtime Apple ES256 JWT client secret from key material", async () => {
    // Valid ES256 P-256 key for the jose signer.
    const pkcs8 =
      "-----BEGIN PRIVATE KEY-----\n" +
      "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgGgv4MwRc1gWxKqfM\n" +
      "7dg5FtsFcc0PGWftFryE5m9h16GhRANCAASJdDrFSl7cW3hiWFTK+AFVwVIY2RRB\n" +
      "EDPlBwG\/TQZhF3cmYoJmQex\/6xk\/C9O1ZbF5fLrzprHiU9JfC9YmXk3I\n" +
      "-----END PRIVATE KEY-----";
    const secret = await generateAppleClientSecret(
      "com.101drivers.web.si",
      "TEAM123",
      "KEY123",
      pkcs8
    );
    expect(typeof secret).toBe("string");
    const parts = secret.split(".");
    expect(parts).toHaveLength(3); // JWT
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("KEY123");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.iss).toBe("TEAM123");
    expect(payload.sub).toBe("com.101drivers.web.si");
    expect(payload.aud).toBe("https://appleid.apple.com");
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(15777000);
  });

  it("configures Yahoo via Generic OAuth when env vars are present", async () => {
    const env = await readBetterAuthEnv({
      ...BASE_ENV,
      YAHOO_CLIENT_ID: "yid",
      YAHOO_CLIENT_SECRET: "ysecret",
    } as NodeJS.ProcessEnv);
    expect(env.providers.yahoo).toEqual({
      clientId: "yid",
      clientSecret: "ysecret",
    });
    expect(env.enabledProviderIds).toContain("yahoo");
  });

  it("mirrors the CORS cookie posture: SameSite=None+Secure in production, Lax in development", async () => {
    const dev = await readBetterAuthEnv({ ...BASE_ENV } as NodeJS.ProcessEnv);
    expect(dev.cookieSameSite).toBe("lax");
    expect(dev.secureCookies).toBe(false);

    const prod = await readBetterAuthEnv({
      ...BASE_ENV,
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "x".repeat(32),
    } as NodeJS.ProcessEnv);
    expect(prod.cookieSameSite).toBe("none");
    expect(prod.secureCookies).toBe(true);
  });

  it("falls back to the legacy JWT secret when BETTER_AUTH_SECRET is unset", async () => {
    const env = await readBetterAuthEnv({
      ...BASE_ENV,
      JWT_ACCESS_SECRET: "legacy-secret",
    } as NodeJS.ProcessEnv);
    expect(env.secret).toBe("legacy-secret");
  });

  it("assembles trusted origins without duplicates (allowlist + Apple)", async () => {
    const env = await readBetterAuthEnv({
      ...BASE_ENV,
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_TRUSTED_ORIGINS: "https://101drivers.com, https://staging.example.com",
    } as NodeJS.ProcessEnv);
    expect(env.trustedOrigins).toContain("https://101drivers.com");
    expect(env.trustedOrigins).toContain("https://staging.example.com");
    expect(env.trustedOrigins).toContain("https://appleid.apple.com");
    expect(env.trustedOrigins.filter((o) => o === "https://101drivers.com")).toHaveLength(1);
  });

  it("throws only when NO secret source exists at all", async () => {
    const noSecretEnv: NodeJS.ProcessEnv = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    delete (noSecretEnv as Record<string, string | undefined>).JWT_ACCESS_SECRET;
    delete (noSecretEnv as Record<string, string | undefined>).JWT_SECRET;
    await expect(readBetterAuthEnv(noSecretEnv)).rejects.toThrow(/no secret/);
  });
});
