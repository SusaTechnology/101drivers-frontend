/**
 * Service-area states — SINGLE SOURCE OF TRUTH.
 *
 * 101 Drivers currently operates in California only. Every screen that must
 * steer users toward (or block) business addresses outside the service area
 * reads from this module, so expanding to a new state is a ONE-LINE change:
 * add the state to SERVICE_STATES below and every check, red helper, block
 * message and label updates automatically — no component edits needed.
 *
 * Consumers (today): DealerSignupForm business directory guard.
 */

export interface ServiceState {
  /** USPS 2-letter code, e.g. "CA" — what Google Places short_name gives. */
  code: string;
  /** Full state name, e.g. "California" — what Google Places long_name gives. */
  name: string;
}

export const SERVICE_STATES: readonly ServiceState[] = [
  { code: "CA", name: "California" },
  // ── Add future states here (one line each), e.g.:
  // { code: "NV", name: "Nevada" },
];

/** Human-readable list: "California" | "California or Nevada" |
 *  "California, Nevada or Arizona". */
export function serviceStateListLabel(): string {
  const names = SERVICE_STATES.map((s) => s.name);
  if (names.length === 0) return "our service area";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * Check a state identifier against the service area. Accepts whatever
 * Google Places returns (short_name "CA" / long_name "California"), any
 * casing, and surrounding whitespace.
 */
export function isAllowedServiceState(state?: string | null): boolean {
  if (!state) return false;
  const value = state.trim().toLowerCase();
  if (!value) return false;
  return SERVICE_STATES.some(
    (s) => s.code.toLowerCase() === value || s.name.toLowerCase() === value
  );
}

/**
 * True ONLY when we positively know the state is outside the service area.
 * Unknown / missing state returns false — a Google Places data gap must
 * never silently block a legitimate dealer (they simply get no warning).
 */
export function isKnownOutOfServiceState(
  state?: string | null
): boolean {
  return (
    typeof state === "string" &&
    state.trim().length > 0 &&
    !isAllowedServiceState(state)
  );
}

/** Red helper under the business-address field (non-blocking warning). */
export function outOfServiceStateHelper(stateName?: string): string {
  const area = serviceStateListLabel();
  return stateName
    ? `This address is in ${stateName} — we don't work outside of ${area}.`
    : `We don't work outside of ${area}.`;
}

/** Blocking message shown at the submit step (banner + toast). */
export function outOfServiceStateBlockMessage(): string {
  const area = serviceStateListLabel();
  return `Choose a business address in ${area} — we don't work outside of ${area}.`;
}
