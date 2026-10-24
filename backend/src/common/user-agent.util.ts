// src/common/user-agent.util.ts
//
// PHONES-ONLY classification for the mobile-only driver signup rule
// (tightened from the original OS-based rule that let tablets pass).
// The gate is the USER AGENT ONLY — never screen size, never touch
// capability:
//
//   PASS  = the UA identifies a PHONE
//   BLOCK = tablet signal, desktop OS, or empty UA
//   OPEN  = unrecognized UA (curl, exotic viewers) — same contract as
//           before: the gate never guesses, normal validation handles
//           whatever comes next.
//
//   • iPhone / iPod: UA carries the token → PASS.
//   • Android phone: Chrome/Firefox/Samsung always append the explicit
//     "Mobile" token on phones and always omit it on tablets — that
//     token is the official Android phone/tablet discriminator → PASS.
//   • iPad (iOS/iPadOS, "Request Desktop Website" off): UA carries
//     "iPad" → TABLET_UA → BLOCK.
//   • Android tablet: UA carries "Android" but omits "Mobile" → BLOCK.
//   • Other tablets (Kindle/Fire "Silk", generic "Tablet" token) → BLOCK.
//   • iPadOS 13+ with "Request Desktop Website": reports a macOS
//     Safari UA ("Macintosh; ...") — indistinguishable from a real Mac
//     by UA alone → blocked as a desktop, same as it always was.
//
// The one honest limitation (unchanged): a UA string is self-reported.
// Someone on a laptop who spoofs an iPhone UA can still submit; no
// UA rule can beat a spoofed UA. Every blocked attempt is audited to
// the BlockedSignup table, so abuse stays visible on the admin radar.
//
// MUST stay in sync with the client mirror (src/lib/device.ts).

/** Tokens that only phone browsers carry. Android phones always carry
 *  the explicit "Mobile" token; Android tablets always omit it. */
const PHONE_SIGNAL_RE =
  /(Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini)/i;

/** Tablet tokens. iPad always identifies itself; generic Android
 *  tablets are caught by the Android-without-Mobile rule below. */
const TABLET_SIGNAL_RE = /(iPad|Tablet|Kindle|Silk|PlayBook)/i;

/** Desktop OS tokens (phone browsers never send these alone). */
const DESKTOP_OS_RE =
  /(Windows NT|Macintosh|Mac OS X|Linux x86_64|x86_64|X11; Linux|CrOS)/i;

const ANDROID_RE = /Android/i;

export type SignupUaVerdict = {
  blocked: boolean;
  /** DESKTOP_UA | EMPTY_UA | TABLET_UA | MOBILE_UA */
  reason: "DESKTOP_UA" | "EMPTY_UA" | "TABLET_UA" | "MOBILE_UA";
};

export function classifySignupUserAgent(
  userAgent: string | string[] | undefined | null
): SignupUaVerdict {
  const ua = Array.isArray(userAgent)
    ? userAgent.join(" ")
    : (userAgent ?? "").toString().trim();

  // No user agent at all is not a real browser — a phone always sends
  // one. Blocking (and logging) keeps the spam radar honest about
  // scripted probes; the FE always sends a UA.
  if (!ua) {
    return { blocked: true, reason: "EMPTY_UA" };
  }

  // iPads and every other named tablet are out — signup is phones-only.
  if (TABLET_SIGNAL_RE.test(ua)) {
    return { blocked: true, reason: "TABLET_UA" };
  }

  // Android tablet: reports "Android" but omits the "Mobile" token
  // (the official Chrome/Firefox/Samsung phone-vs-tablet convention).
  if (ANDROID_RE.test(ua) && !PHONE_SIGNAL_RE.test(ua)) {
    return { blocked: true, reason: "TABLET_UA" };
  }

  if (PHONE_SIGNAL_RE.test(ua)) {
    return { blocked: false, reason: "MOBILE_UA" };
  }

  if (DESKTOP_OS_RE.test(ua)) {
    return { blocked: true, reason: "DESKTOP_UA" };
  }

  // Unrecognized UA (curl, exotic viewers): no phone, tablet, or
  // desktop signal → gate open, normal validation handles whatever
  // comes next. Only clear non-phone signals are rejected.
  return { blocked: false, reason: "MOBILE_UA" };
}

/** The 403 body for a blocked signup attempt (message + storeUrl). */
export function mobileOnlySignupPayload(): {
  statusCode: number;
  error: string;
  message: string;
  storeUrl: string;
} {
  return {
    statusCode: 403,
    error: "Forbidden",
    message:
      "Driver signup is available on phones only. Please open 101drivers.com/download on your phone to continue.",
    storeUrl:
      process.env.PUBLIC_APP_DOWNLOAD_URL || "https://101drivers.com/download",
  };
}
