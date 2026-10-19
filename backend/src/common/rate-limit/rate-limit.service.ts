import { Global, Injectable, Module, HttpException, HttpStatus } from "@nestjs/common";
import { Request } from "express";

/**
 * In-memory sliding-window rate limiter — a GLOBAL LEAF dependency
 * (mirrors common/appEvents): zero imports, so any module can inject
 * RateLimitService without creating a dependency cycle.
 *
 * WHY IT EXISTS (P1 hardening): the signup/resend/forgot-password flows
 * trigger REAL EMAILS on every call and had no budget at all. An
 * unauthenticated attacker could (a) bomb one victim's inbox, or (b)
 * drain the mail provider's quota. The quote endpoints already had an
 * IP budget (QuoteUsageLimitService); this closes the same hole for
 * every other outbound-email surface.
 *
 * SCOPE / LIMITS (tuned to be invisible to real users):
 *   - per EMAIL  (service level, inside EmailVerificationService):
 *     5 sends / 15 min — covers driver, private, business signups,
 *     every resend path, and password reset from one choke point.
 *   - per IP     (controller level, send paths only):
 *     signup sends 20 / 15 min (a dealership onboards several drivers
 *     from one office IP), resends + password resets 10 / 15 min.
 * Real users never approach these (the FE already cools resends down
 * to once per 60s); abusers hit 429 with a friendly message.
 *
 * SINGLE-INSTANCE NOTE: state is per-process memory. The current
 * deployment is a single backend instance, so this is exact. If the
 * backend ever scales horizontally, swap the Map for Redis with the
 * same consume() contract — call sites don't change.
 */
export const RATE_LIMITS = {
  /** OTP sends per email address (all audiences, incl. password reset). */
  OTP_SEND_PER_EMAIL: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Signup OTP sends per client IP (send path only — verify is not limited). */
  SIGNUP_SEND_PER_IP: { limit: 20, windowMs: 15 * 60 * 1000 },
  /** Resend-OTP calls per client IP. */
  RESEND_PER_IP: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Forgot-password calls per client IP. */
  PASSWORD_RESET_PER_IP: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;

export const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a few minutes and try again.";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class RateLimitService {
  /** key -> timestamps of allowed calls inside the current window(s). */
  private readonly hits = new Map<string, number[]>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Bound memory: drop expired timestamps periodically. unref() so the
    // timer never keeps the process alive in tests or graceful shutdowns.
    if (typeof setInterval === "function") {
      const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
      if (typeof timer.unref === "function") timer.unref();
      this.sweepTimer = timer;
    }
  }

  /**
   * Record ONE call against `key` under a sliding window.
   * Returns true when the call is allowed (and recorded), false when the
   * caller is over `limit` within `windowMs` (and nothing is recorded —
   * denied calls never push back the window, so a waiting client is
   * admitted as soon as the oldest real hits age out).
   */
  consume(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;

    const previous = this.hits.get(key);
    const recent = previous ? previous.filter((t) => t > windowStart) : [];

    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Test/debug helper: how many allowed calls are currently counted. */
  pendingCount(key: string): number {
    return this.hits.get(key)?.length ?? 0;
  }

  /** Drop every recorded hit (used between tests; harmless in prod). */
  reset(): void {
    this.hits.clear();
  }

  private sweep(): void {
    const now = Date.now();
    // Longest window we ship is 15 minutes; anything with no hit newer
    // than an hour is dead by construction.
    const cutoff = now - 60 * 60 * 1000;
    for (const [key, timestamps] of this.hits) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
        this.hits.delete(key);
      }
    }
  }
}

/**
 * Client IP exactly like the quote budget uses it (nginx sets
 * x-forwarded-for; fall back to the socket address) so ALL public
 * budgets agree on WHO is being limited.
 */
export function clientIpFromRequest(request: Request | undefined | null): string {
  const forwarded = request?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request?.ip ?? "unknown-ip";
}

/**
 * Consume one unit of an IP budget or throw a 429 with a user-friendly
 * message. Used at controller level on the public send paths only —
 * verification/OTP-typing calls are never budgeted, so honest users
 * can never be locked out of finishing a signup they already started.
 */
export function assertIpBudget(
  request: Request | undefined | null,
  bucket: string,
  limiter: RateLimitService,
  budget: { limit: number; windowMs: number }
): void {
  const ip = clientIpFromRequest(request);
  const allowed = limiter.consume(`${bucket}:${ip}`, budget.limit, budget.windowMs);
  if (!allowed) {
    throw new HttpException(RATE_LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Global()
@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
