// Business gates for the social driver application flow — EXACT copies of
// the legacy signup rules from auth.service.ts (evaluateCaliforniaHomeArea /
// validateDriverAge). Single-sourced there; duplicated here as pure functions
// so Better Auth's social path enforces the identical owner directive
// ("101 Drivers accepts California zips only", "drivers must be 25+").
// Auth.service still owns the legacy email path — do not change one without
// the other (they are unit-tested side by side in ba-driver-gates.spec.ts).

import { BadRequestException } from "@nestjs/common";

export function evaluateCaliforniaHomeArea(homeArea?: string | null): {
  valid: boolean;
  zip: string;
  reason: "INVALID_FORMAT" | "OUT_OF_STATE" | null;
} {
  const zip = (homeArea ?? "").trim();
  if (!/^\d{5}$/.test(zip)) {
    return { valid: false, zip, reason: "INVALID_FORMAT" };
  }
  const numeric = parseInt(zip, 10);
  if (numeric < 90001 || numeric > 96199) {
    return { valid: false, zip, reason: "OUT_OF_STATE" };
  }
  return { valid: true, zip, reason: null };
}

export function assertCaliforniaHomeArea(homeArea?: string | null): void {
  const verdict = evaluateCaliforniaHomeArea(homeArea);
  if (verdict.reason === "INVALID_FORMAT") {
    throw new BadRequestException(
      "A valid 5-digit ZIP code is required to register as a driver."
    );
  }
  if (!verdict.valid) {
    throw new BadRequestException(
      "We currently only operate in California. Your ZIP code is outside California, so we can't accept your driver registration."
    );
  }
}

export function parseSignupDateOfBirth(dateOfBirth: string): Date {
  const [month, day, year] = dateOfBirth.split("/");
  const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  if (age < 25) {
    throw new BadRequestException("Driver must be at least 25 years old");
  }
  // DOB stored as UTC midnight (same convention as signupDriver — every
  // reader treats it as UTC; server-local midnight drifts a calendar day).
  return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
}
