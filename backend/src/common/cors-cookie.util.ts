// src/common/utils/cors-cookie.util.ts

import { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { CookieOptions } from "express";

/**
 * Explicit allowlist of production frontend origins.
 *
 * The production frontend lives on 101drivers.com (www included);
 * localhost is allowed for development. Without this list in the repo, a
 * backend deploy would fall back to whatever configuration the server
 * happens to carry — the .com frontend must never be an afterthought here.
 */
const ALLOWED_CORS_ORIGINS = new Set<string>([
  "https://101drivers.com",
  "https://www.101drivers.com",
]);

/**
 * Shared auth-cookie domain — the ROOT_DOMAIN env var when set, otherwise
 * the 101drivers.com primary. Cookies carrying a Domain that does not
 * match the responding host are SILENTLY DROPPED by browsers, so this
 * must always match where the API actually runs (set ROOT_DOMAIN on any
 * non-default deployment).
 */
function authCookieDomain(): string {
  const root = (process.env.ROOT_DOMAIN || "101drivers.com")
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  return `.${root}`;
}

export function configureCors(app: INestApplication) {
  app.use(cookieParser());

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      const normalized = origin.trim().toLowerCase();
      const ok =
        ALLOWED_CORS_ORIGINS.has(normalized) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized);

      if (ok) return cb(null, true);

      console.warn(`🚫 Blocked CORS from: ${origin}`);
      return cb(new Error("CORS blocked"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Tenant-Code",
      "x-tenant-code",
      "X-Portal-Password",
      "x-portal-password",
      // Refresh-token fallback header: sent by the web app when the browser
      // blocks the cross-site httpOnly refresh cookie (iOS PWA standalone
      // mode, Safari ITP, Chrome with third-party cookies disabled).
      "x-refresh-token",
      "X-Refresh-Token",
      // Admin-gate token fallback: same story as the refresh cookie — the
      // SPA presents the signed gate value it stored at unlock time when
      // the browser refuses the cross-site gate cookie.
      "x-admin-gate-token",
      "X-Admin-Gate-Token",
    ],
  });
}

/** Default cookie options (no request context) */
export function getCookieOptions(isSecureEnv = false): CookieOptions {
  const isHttps = isSecureEnv || process.env.NODE_ENV !== "development";

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    domain: isHttps ? authCookieDomain() : undefined,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

/** Derive cookie options from the incoming request (works behind proxies/TLS) */
export function getCookieOptionsFromRequest(req: {
  headers?: any;
  hostname?: string;
}): CookieOptions {
  const xfProto = String(req.headers?.["x-forwarded-proto"] || "").toLowerCase();
  const reallyHttps = xfProto === "https";
  const nodeEnv = (process.env.NODE_ENV || "production")
    .trim()
    .toLowerCase();

  const isHttps = reallyHttps || nodeEnv !== "development";

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    domain: isHttps ? authCookieDomain() : undefined,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}