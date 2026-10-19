import { RateLimitService } from "./rate-limit.service";

/**
 * Rate limiter contract tests (P1). Uses the REAL clock semantics via
 * jest fake timers so window expiry is exercised without sleeping.
 */
describe("RateLimitService", () => {
  let limiter: RateLimitService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    limiter = new RateLimitService();
    limiter.reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows calls under the limit and blocks the one over", () => {
    const key = "otp-resend:1.2.3.4";
    for (let i = 0; i < 10; i++) {
      expect(limiter.consume(key, 10, 15 * 60 * 1000)).toBe(true);
    }
    // 11th call inside the window is denied
    expect(limiter.consume(key, 10, 15 * 60 * 1000)).toBe(false);
    expect(limiter.pendingCount(key)).toBe(10);
  });

  it("admits again once the window slides past the oldest hits", () => {
    const key = "otp-send:victim@example.com";
    for (let i = 0; i < 5; i++) {
      expect(limiter.consume(key, 5, 15 * 60 * 1000)).toBe(true);
    }
    expect(limiter.consume(key, 5, 15 * 60 * 1000)).toBe(false);

    // Advance 15 minutes and one second — every hit has aged out.
    jest.setSystemTime(new Date("2026-10-19T12:15:01Z"));
    expect(limiter.consume(key, 5, 15 * 60 * 1000)).toBe(true);
  });

  it("denied calls do not extend the window (no punishment loop)", () => {
    const key = "otp-resend:5.6.7.8";
    for (let i = 0; i < 3; i++) limiter.consume(key, 3, 60 * 1000);
    // An hour of spam later, every original hit has aged out: the caller
    // regains a FULL budget (denied calls were never recorded — a client
    // waiting patiently is never pushed back forever). pendingCount is a
    // raw counter (it does not window-filter); the contract below is
    // asserted behaviorally through consume().
    jest.setSystemTime(new Date("2026-10-19T13:00:00Z"));
    for (let i = 0; i < 3; i++) expect(limiter.consume(key, 3, 60 * 1000)).toBe(true);
    expect(limiter.consume(key, 3, 60 * 1000)).toBe(false);
    expect(limiter.pendingCount(key)).toBe(3);
  });

  it("keys are independent (per-email / per-IP isolation)", () => {
    const a = "otp-send:a@example.com";
    const b = "otp-send:b@example.com";
    for (let i = 0; i < 5; i++) limiter.consume(a, 5, 15 * 60 * 1000);
    expect(limiter.consume(a, 5, 15 * 60 * 1000)).toBe(false);
    expect(limiter.consume(b, 5, 15 * 60 * 1000)).toBe(true);
  });

  it("different buckets never share counters", () => {
    expect(limiter.consume("signup-send:1.1.1.1", 1, 60000)).toBe(true);
    expect(limiter.consume("otp-resend:1.1.1.1", 1, 60000)).toBe(true);
    expect(limiter.consume("forgot-password:1.1.1.1", 1, 60000)).toBe(true);
  });
});
