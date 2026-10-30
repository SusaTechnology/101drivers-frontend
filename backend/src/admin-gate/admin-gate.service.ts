import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * AdminGateService — the shared-secret door in front of the admin UI.
 *
 * The gate is a UI-privacy layer, NOT a replacement for authentication:
 * admin data endpoints stay protected by the JWT + AdminGuard stack. This
 * service only decides who is allowed to SEE the admin screens at all.
 *
 * How it works:
 *  - The access key for a month is HMAC(Secret, "admin-gate-key:YYYY-MM")
 *    trimmed to 32 hex chars — it CHANGES BY ITSELF at every month
 *    rollover, so a link that is shared once quietly dies ~30 days later
 *    with zero cron jobs and zero database rows. The current AND previous
 *    month are accepted, so a link sent on the 31st still works on the 1st
 *    while the new link makes the rounds.
 *  - A successful unlock sets a signed, expiring cookie ("admin_gate").
 *    The value is "<expiryMs>.<HMAC>" — the backend can verify it without
 *    storing anything, and the expiry is capped so no stolen cookie can
 *    outlive the promised 30 days.
 *  - ADMIN_GATE_SECRET is the master switch: changing it in the server
 *    env instantly invalidates every key and every cookie (kill switch).
 *    It falls back to JWT_SECRET so the gate works without new env setup.
 */

export const ADMIN_GATE_COOKIE = "admin_gate";
/** Same-origin UX mirror of the gate (readable by the SPA when the API is
 *  same-origin; cross-origin deployments use GET /admin-gate/status). */
export const ADMIN_GATE_MIRROR_COOKIE = "admin_gate_ok";

const KEY_LENGTH = 32;
/** Accept current + previous month keys (rollover grace). */
const MONTHS_GRACE = 1;
const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** Small clock-skew allowance on top of the TTL cap. */
const COOKIE_TTL_SKEW_MS = 60 * 1000;

@Injectable()
export class AdminGateService {
  private get secret(): string {
    const secret = process.env.ADMIN_GATE_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      // Without a secret the gate can neither issue nor validate anything
      // — fail closed rather than silently opening the admin UI.
      throw new UnauthorizedException("Admin gate is not configured");
    }
    return secret;
  }

  private monthStamp(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  /** The access key for a month — changes by itself at month rollover. */
  monthKey(stamp: string = this.monthStamp(new Date())): string {
    return createHmac("sha256", this.secret)
      .update(`admin-gate-key:${stamp}`)
      .digest("hex")
      .slice(0, KEY_LENGTH);
  }

  /** Current + previous month keys are accepted. */
  isValidAccessKey(key: unknown): boolean {
    if (typeof key !== "string" || key.length !== KEY_LENGTH) return false;
    const now = new Date();
    const previous = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS_GRACE, 1)
    );
    return [this.monthKey(), this.monthKey(this.monthStamp(previous))].some(
      (candidate) => this.safeEqual(candidate, key)
    );
  }

  /** A fresh signed gate cookie — "<expiryMs>.<hmac>". */
  issueCookie(): { name: string; value: string; maxAgeMs: number } {
    const expiry = Date.now() + COOKIE_TTL_MS;
    const signature = createHmac("sha256", this.secret)
      .update(`admin-gate-cookie:${expiry}`)
      .digest("hex");
    return {
      name: ADMIN_GATE_COOKIE,
      value: `${expiry}.${signature}`,
      maxAgeMs: COOKIE_TTL_MS,
    };
  }

  isCookieValid(raw: unknown): boolean {
    if (typeof raw !== "string") return false;
    const dot = raw.indexOf(".");
    if (dot < 0) return false;
    const expiry = Number(raw.slice(0, dot));
    const signature = raw.slice(dot + 1);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
    // Cap the promised lifetime so a replayed cookie can't outlive it.
    if (expiry - Date.now() > COOKIE_TTL_MS + COOKIE_TTL_SKEW_MS) return false;
    const expected = createHmac("sha256", this.secret)
      .update(`admin-gate-cookie:${expiry}`)
      .digest("hex");
    return this.safeEqual(expected, signature);
  }

  private safeEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return (
      bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
    );
  }
}
