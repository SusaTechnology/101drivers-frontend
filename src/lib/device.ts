// src/lib/device.ts
//
// DESKTOPS-BLOCKED classification for the driver signup gate — phones AND
// tablets are welcome (iPhone, Android phones, iPad, Android tablets,
// Kindle/Silk); only desktops and laptops are turned away.
// MUST stay in sync with the backend gate
// (backend src/common/user-agent.util.ts) — the two checks are
// independent (client gate for UX, server gate for truth) and must
// agree, or a mobile visitor would see a card for a form that would
// actually pass, or vice versa.
//
// The PRIMARY rule is TOUCH CAPABILITY + SCREEN CLASS — deliberately NOT
// user-agent parsing:
//   • Every phone and every tablet is touch-capable, so hasTouch() is
//     an immediate pass. This is what fixes the iPadOS desktop-UA trap:
//     an iPad with "Request Desktop Website" enabled (the iPadOS 13+
//     DEFAULT) reports itself as macOS Safari ("Macintosh; ..."), so any
//     rule that blocks the "Mac" token kills every such iPad. Touch
//     capability never lies about that — a real Mac has
//     navigator.maxTouchPoints === 0, an iPad reports 5.
//   • A no-touch viewer on a desktop-class screen (viewport >= 1024px)
//     is a desktop/laptop → blocked.
//   • A no-touch viewer with a desktop-OS user agent (Windows NT,
//     Macintosh, CrOS, Linux x86_64) is blocked EVEN in a narrow window
//     — a desktop browser resized small is still a desktop. This clause
//     can never touch a touch device, so it can never re-create the
//     iPad trap.
//   • A no-touch viewer with a small window and a non-desktop UA (e.g.
//     devtools mobile emulation) passes — the gate never guesses, same
//     open-door contract as the server for exotic viewers.
// A spoofed signal can always lie; the server audits every block.
//
// No localStorage cache (deliberate): the check below is synchronous,
// so the signup page's very first render already branches — the form
// cannot flash before the card, and there is no cached verdict to go
// stale (a desktop-site toggle or device change takes effect on the
// next visit instead of being frozen for 30 days).

/** Desktop OS tokens in a user agent. Phone/tablet browsers never send
 *  these — except the iPadOS desktop-mode iPad, which is exactly why
 *  this token list is only ever consulted for no-touch viewers. */
const DESKTOP_OS_RE =
  /(Windows NT|Macintosh|Mac OS X|Linux x86_64|x86_64|X11; Linux|CrOS)/i;

/** True when this browser can feel touch. Every real phone and tablet
 *  (including every iPad, in every UA mode) is touch-capable; desktops
 *  and laptops are not.
 *  Order matters: desktop Chrome DECLARES the `ontouchstart` property
 *  on window even with zero touch hardware ('in' is true, value
 *  undefined), so maxTouchPoints is the trusted signal and the
 *  event-property fallback is only honored when it is actually wired
 *  — or when maxTouchPoints is unsupported outright (ancient browsers). */
export function hasTouchCapability(): boolean {
  if (typeof navigator === "undefined") return false;
  if ((navigator.maxTouchPoints ?? 0) > 0) return true;
  const w = window as unknown as Record<string, unknown>;
  if (typeof w.ontouchstart === "function") return true;
  if (typeof navigator.maxTouchPoints !== "number" && "ontouchstart" in window) {
    return true; // ancient browser with no maxTouchPoints at all
  }
  return false;
}

/**
 * Value for the x-device-touch header the FE sends with every API call:
 * "1" when the browser is touch-capable, "0" otherwise. The server's
 * signup gate uses it to tell the iPadOS desktop-mode iPad (touch —
 * allowed) apart from a real Mac (no touch — blocked), something a
 * user-agent string alone can never do. Self-reported, but so is the
 * UA string itself; the server audits every block either way.
 */
export function deviceTouchHint(): "1" | "0" {
  return hasTouchCapability() ? "1" : "0";
}

/**
 * True only when this browser looks like a DESKTOP/LAPTOP — the only
 * class the signup gate blocks. Mirrors the server's
 * classifySignupUserAgent contract: phones and tablets (touch) always
 * pass; a no-touch viewer passes only when it shows neither a
 * desktop-class screen nor a desktop-OS user agent.
 */
export function isDesktopDevice(): boolean {
  if (hasTouchCapability()) return false; // phones + tablets (incl. iPads in every mode)
  const ua = (navigator.userAgent ?? "").toString().trim();
  if (DESKTOP_OS_RE.test(ua)) return true; // no touch + desktop OS = laptop/desktop
  return window.innerWidth >= 1024; // no touch + desktop-class screen
}

/**
 * Should this browser see the "Signup is mobile only" card instead of
 * the driver signup form? SYNCHRONOUS by design: called in the signup
 * page's component body, so the first render already branches and the
 * form never paints before the card. Always computed fresh — no cached
 * verdict to go stale or lock anyone out.
 */
export function shouldShowMobileOnlySignup(): boolean {
  return isDesktopDevice();
}
