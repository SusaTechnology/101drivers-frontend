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
// Desktop verdicts are cached in localStorage for 30 days so repeat
// desktop visitors get the mobile-only card instantly on first paint —
// no form flash — and a returning phone never pays the re-check.

const DESKTOP_CACHE_KEY = "signup:desktop-blocked:v1";
const DESKTOP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

function readDesktopCache(): boolean | null {
  try {
    const raw = localStorage.getItem(DESKTOP_CACHE_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > DESKTOP_CACHE_TTL_MS) {
      localStorage.removeItem(DESKTOP_CACHE_KEY);
      return null;
    }
    return true;
  } catch {
    return null;
  }
}

function writeDesktopCache(): void {
  try {
    localStorage.setItem(DESKTOP_CACHE_KEY, String(Date.now()));
  } catch {
    // Private mode / storage full — the live UA check still answers.
  }
}

/**
 * Should this browser see the "Signup is mobile only" card instead of
 * the driver signup form? SYNCHRONOUS by design: the first render of
 * the signup page can branch before anything paints, so a returning
 * desktop visitor never sees the form flash.
 */
export function shouldShowMobileOnlySignup(): boolean {
  if (readDesktopCache()) return true;
  if (isDesktopUserAgent(navigator.userAgent)) {
    writeDesktopCache();
    return true;
  }
  return false;
}
