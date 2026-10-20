// src/lib/device.ts
//
// OS-based mobile/desktop classification for the mobile-only driver
// signup. MUST stay in sync with the backend gate
// (backend src/common/user-agent.util.ts) — the two checks are
// independent (client gate for UX, server gate for truth) and must
// agree, or desktop users would see a card for a form that would
// actually pass, or vice versa.
//
// The rule is the USER AGENT ONLY — never screen size, never touch
// capability. Tablets pass: iPad UAs carry "iPad", Android tablet UAs
// carry "Android" (they just omit the "Mobile" token). The one honest
// limitation: an iPadOS 13+ iPad with "Request Desktop Website" enabled
// reports itself as macOS Safari, so by the OS-only rule it is treated
// as a Mac — inherent to "user agent is the gate".
//
// No localStorage cache (deliberate): the check below is synchronous,
// so the signup page's very first render already branches — the form
// cannot flash before the card, and there is no cached verdict to go
// stale (a desktop-site toggle or browser UA change takes effect on
// the next visit instead of being frozen for 30 days).

/** Anything in here means the browser reports a mobile OS. */
const MOBILE_SIGNAL_RE =
  /(Mobile|Android|iPhone|iPod|iPad|Windows Phone|IEMobile|Opera Mini)/i;

/** Desktop OS tokens (phone browsers never send these alone). */
const DESKTOP_OS_RE =
  /(Windows NT|Macintosh|Mac OS X|Linux x86_64|x86_64|X11; Linux|CrOS)/i;

/** Server-mirrored classification of a single UA string. */
export function isDesktopUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").toString().trim();
  if (!ua) return false; // no UA is a server-side concern, not a client one
  if (MOBILE_SIGNAL_RE.test(ua)) return false;
  return DESKTOP_OS_RE.test(ua);
}

/**
 * Should this browser see the "Signup is mobile only" card instead of
 * the driver signup form? SYNCHRONOUS by design: called in the signup
 * page's component body, so the first render already branches and the
 * form never paints before the card. Always computed fresh from the
 * live user agent — no cached verdict to go stale or lock anyone out.
 */
export function shouldShowMobileOnlySignup(): boolean {
  return isDesktopUserAgent(navigator.userAgent);
}
