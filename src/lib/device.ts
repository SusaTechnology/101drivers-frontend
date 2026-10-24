// src/lib/device.ts
//
// PHONES-ONLY classification for the mobile-only driver signup
// (tightened from the original OS-based rule that let tablets pass).
// MUST stay in sync with the backend gate
// (backend src/common/user-agent.util.ts) — the two checks are
// independent (client gate for UX, server gate for truth) and must
// agree, or tablet/desktop users would see a card for a form that
// would actually pass, or vice versa.
//
// The rule is the USER AGENT ONLY — never screen size, never touch
// capability:
//   • iPad: UA carries "iPad" → blocked (card shows).
//   • Android tablet: UA carries "Android" but omits the "Mobile"
//     token (the official phone-vs-tablet convention) → blocked.
//   • Android phone / iPhone / iPod: pass.
//   The one honest limitation: an iPadOS 13+ iPad with "Request
//   Desktop Website" enabled reports itself as macOS Safari, so it is
//   treated as a Mac — blocked, exactly as the server blocks it.
//   A spoofed UA can always lie; the server audits every block.
//
// No localStorage cache (deliberate): the check below is synchronous,
// so the signup page's very first render already branches — the form
// cannot flash before the card, and there is no cached verdict to go
// stale (a desktop-site toggle or browser UA change takes effect on
// the next visit instead of being frozen for 30 days).

/** Tokens that only phone browsers carry (Android phones always carry
 *  the explicit "Mobile" token; Android tablets always omit it). */
const PHONE_SIGNAL_RE =
  /(Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini)/i;

/** Tablet tokens — iPad always identifies itself. */
const TABLET_SIGNAL_RE = /(iPad|Tablet|Kindle|Silk|PlayBook)/i;

/** Desktop OS tokens (phone browsers never send these alone). */
const DESKTOP_OS_RE =
  /(Windows NT|Macintosh|Mac OS X|Linux x86_64|x86_64|X11; Linux|CrOS)/i;

/**
 * True only when the UA identifies a PHONE. Mirrors the server's
 * classifySignupUserAgent exactly: tablet / desktop / empty → false;
 * unrecognized UA → true (the gate never guesses — mirrors the
 * server's open-door contract for exotic viewers).
 */
export function isPhoneUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").toString().trim();
  if (!ua) return false; // server blocks EMPTY_UA — the card is the consistent face
  if (TABLET_SIGNAL_RE.test(ua)) return false;
  if (/Android/i.test(ua) && !PHONE_SIGNAL_RE.test(ua)) return false; // Android tablet
  if (PHONE_SIGNAL_RE.test(ua)) return true;
  if (DESKTOP_OS_RE.test(ua)) return false;
  return true; // unrecognized → gate open (mirrors the server)
}

/**
 * Should this browser see the "Signup is phone only" card instead of
 * the driver signup form? SYNCHRONOUS by design: called in the signup
 * page's component body, so the first render already branches and the
 * form never paints before the card. Always computed fresh from the
 * live user agent — no cached verdict to go stale or lock anyone out.
 */
export function shouldShowMobileOnlySignup(): boolean {
  return !isPhoneUserAgent(navigator.userAgent);
}
