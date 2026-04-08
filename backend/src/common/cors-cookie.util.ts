// src/common/utils/cors-cookie.util.ts

import { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { CookieOptions } from "express";

export function configureCors(app: INestApplication) {
  app.use(cookieParser());

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      const ok =
        origin === "https://101drivers.techbee.et" ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

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
    domain: isHttps ? ".techbee.et" : undefined,
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
    domain: isHttps ? ".techbee.et" : undefined,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}