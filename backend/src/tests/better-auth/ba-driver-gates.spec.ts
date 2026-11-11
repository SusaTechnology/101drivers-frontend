// Unit tests for the social driver application gates — the pure copies of
// the legacy signup rules (California-only ZIP, age 25+). These are the
// exact business constraints enforced by POST /api/auth/ba/social-driver-signup.

import {
  assertCaliforniaHomeArea,
  evaluateCaliforniaHomeArea,
  parseSignupDateOfBirth,
} from "../../better-auth/ba-driver-gates";

function dobYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

describe("California home-area gate", () => {
  it("accepts the California ZIP range 90001–96199", () => {
    expect(evaluateCaliforniaHomeArea("90001")).toEqual({
      valid: true,
      zip: "90001",
      reason: null,
    });
    expect(evaluateCaliforniaHomeArea("96199")!.valid).toBe(true);
    expect(evaluateCaliforniaHomeArea("90210")!.valid).toBe(true);
  });

  it("rejects out-of-state ZIPs (Oregon 97000+, Washington, Alaska, East Coast)", () => {
    expect(evaluateCaliforniaHomeArea("97001")!.reason).toBe("OUT_OF_STATE");
    expect(evaluateCaliforniaHomeArea("98101")!.reason).toBe("OUT_OF_STATE");
    expect(evaluateCaliforniaHomeArea("10001")!.reason).toBe("OUT_OF_STATE");
  });

  it("rejects malformed ZIPs before any state check", () => {
    expect(evaluateCaliforniaHomeArea("9001")!.reason).toBe("INVALID_FORMAT");
    expect(evaluateCaliforniaHomeArea("900011")!.reason).toBe("INVALID_FORMAT");
    expect(evaluateCaliforniaHomeArea("abcdg")!.reason).toBe("INVALID_FORMAT");
    expect(evaluateCaliforniaHomeArea("")!.reason).toBe("INVALID_FORMAT");
    expect(evaluateCaliforniaHomeArea(null)!.reason).toBe("INVALID_FORMAT");
  });

  it("assertCaliforniaHomeArea throws the same messages as the legacy guard", () => {
    expect(() => assertCaliforniaHomeArea("9001")).toThrow(
      "A valid 5-digit ZIP code is required to register as a driver."
    );
    expect(() => assertCaliforniaHomeArea("97001")).toThrow(
      "We currently only operate in California. Your ZIP code is outside California, so we can't accept your driver registration."
    );
    expect(() => assertCaliforniaHomeArea("12345")).toThrow(
      "We currently only operate in California."
    );
    expect(() => assertCaliforniaHomeArea("90012")).not.toThrow();
  });
});

describe("driver age gate", () => {
  it("accepts a driver who is 25 or older", () => {
    expect(() => parseSignupDateOfBirth(dobYearsAgo(25))).not.toThrow();
    expect(() => parseSignupDateOfBirth(dobYearsAgo(40))).not.toThrow();
  });

  it("rejects a driver younger than 25 with the legacy message", () => {
    expect(() => parseSignupDateOfBirth(dobYearsAgo(24))).toThrow(
      "Driver must be at least 25 years old"
    );
  });

  it("stores the DOB as UTC midnight (server-timezone independent)", () => {
    const parsed = parseSignupDateOfBirth("01/15/1990");
    expect(parsed.toISOString()).toBe("1990-01-15T00:00:00.000Z");
  });
});
