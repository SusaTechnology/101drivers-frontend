// src/common/user-agent.util.ts
//
// DESKTOPS-BLOCKED classification for the driver signup rule — phones AND
// tablets are welcome (iPhone, Android phones, iPad, Android tablets,
// Kindle/Silk); only desktops and laptops are turned away.
//
//   PASS  = phone or tablet UA (mobile OS tokens, tablet tokens)
//   PASS  = an Apple-tablet touch client: Macintosh/macOS UA + the
//           client's x-device-touch: 1 hint — the iPadOS 13+ desktop-mode
//           iPad ("Request Desktop Website" is the DEFAULT on iPadOS)
//           reports a macOS Safari UA ("Macintosh; ...") that is
//           byte-for-byte a real Mac's UA. Touch capability is the only
//           honest discriminator: a Mac has navigator.maxTouchPoints ===
//           0, an iPad reports 5. The FE (src/lib/device.ts) sends the
//           hint with every API call.
//   BLOCK = a desktop-OS UA carrying the touch hint EXCEPT the
//           Apple-tablet signature — Windows/Linux/ChromeOS + touch is a
//           TOUCHSCREEN LAPTOP (reason DESKTOP_TOUCH_UA)
//   BLOCK = clear desktop-OS UA without the touch hint, or empty UA
//   OPEN  = unrecognized UA (curl, exotic viewers) — same contract as
//           before: the gate never guesses, normal validation handles
//           whatever comes next.
//
//   • iPhone / iPod / "Mobile" token: PASS.
//   • Android (phone or tablet — every Android device is touch-capable):
//     PASS.
//   • iPad (iOS/iPadOS, "Request Desktop Website" off): UA carries "iPad"
//     → PASS (tablets are welcome).
//   • Other tablets (Kindle/Fire "Silk", generic "Tablet" token): PASS.
//   • Real desktop Mac / Windows / Linux / ChromeOS, no touch hint:
//     DESKTOP_UA → BLOCK.
//   • Touchscreen laptop (Windows/Linux/ChromeOS UA + touch hint):
//     DESKTOP_TOUCH_UA → BLOCK — same class, now caught even with touch.
//   • iPadOS 13+ desktop-mode iPad: "Macintosh" UA + x-device-touch: 1
//     → PASS. A laptop that spoofs a Mac UA was always able to spoof the
//     whole UA — no header rule can beat a liar; every blocked attempt is
//     audited to the BlockedSignup table so abuse stays visible.
//
// The one honest limitation (unchanged): UA and header are self-reported.
// MUST stay in sync with the client mirror (src/lib/device.ts).

/** Tokens that only phone browsers carry. Android phones always carry
 *  the explicit "Mobile" token; Android tablets always omit it. */
const PHONE_SIGNAL_RE =
  /(Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini)/i;

/** Tablet tokens — iPad always identifies itself when not in
 *  desktop mode; generic Android tablets are caught by the plain
 *  Android rule below. */
const TABLET_SIGNAL_RE = /(iPad|Tablet|Kindle|Silk|PlayBook)/i;

/** Desktop OS tokens. Phone and tablet browsers never send these —
 *  except the desktop-mode iPad (handled by the touch hint before this
 *  list is ever consulted). */
const DESKTOP_OS_RE =
  /(Windows NT|Macintosh|Mac OS X|Linux x86_64|x86_64|X11; Linux|CrOS)/i;

const ANDROID_RE = /Android/i;

/** Apple-tablet signature inside a touch-capable client. An iPad sends
 *  "iPad" (ordinary mode) or a Macintosh/macOS UA (desktop mode — the
 *  iPadOS default). A real Mac never has touch points, so Macintosh +
 *  touch hint can only be an iPad. Any OTHER desktop OS token on a
 *  touch-capable client (Windows NT, Linux x86_64, CrOS) is a
 *  touchscreen laptop — the class this gate turns away. */
const APPLE_TABLET_UA_RE = /(iPad|Macintosh|Mac OS X)/i;

/** The FE sends x-device-touch: 1 from touch-capable browsers (see
 *  src/lib/device.ts deviceTouchHint). Header values arrive as
 *  string | string[] | undefined — normalize defensively. */
export function touchHintFromHeader(
  value: string | string[] | undefined | null
): boolean {
  const v = Array.isArray(value)
    ? value.join(",")
    : (value ?? "").toString().trim().toLowerCase();
  return v === "1" || v === "true";
}

export type SignupUaVerdict = {
  blocked: boolean;
  /** DESKTOP_UA | DESKTOP_TOUCH_UA | EMPTY_UA | MOBILE_UA (tablets pass as MOBILE_UA) */
  reason: "DESKTOP_UA" | "DESKTOP_TOUCH_UA" | "EMPTY_UA" | "MOBILE_UA";
};

export function classifySignupUserAgent(
  userAgent: string | string[] | undefined | null,
  touchCapableHint?: string | string[] | null
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

  // Touch-capable client. An iPad (any UA mode — including the
  // desktop-mode iPad whose UA is a real Mac's) passes; touch + any
  // other desktop OS (Windows NT, Linux x86_64, CrOS) is a touchscreen
  // laptop → blocked (DESKTOP_TOUCH_UA), the same class the gate exists
  // to turn away. This closes the old loophole where ANY desktop UA
  // passed just by sending the touch hint.
  if (touchHintFromHeader(touchCapableHint)) {
    if (DESKTOP_OS_RE.test(ua) && !APPLE_TABLET_UA_RE.test(ua)) {
      return { blocked: true, reason: "DESKTOP_TOUCH_UA" };
    }
    return { blocked: false, reason: "MOBILE_UA" };
  }

  // Phones and tablets (iPad, Android tablets, Kindle/Silk, generic
  // "Tablet") — all welcome.
  if (TABLET_SIGNAL_RE.test(ua)) {
    return { blocked: false, reason: "MOBILE_UA" };
  }

  // Android phone or tablet (the Mobile-token split no longer matters —
  // both ends of the Android family are touch devices).
  if (ANDROID_RE.test(ua)) {
    return { blocked: false, reason: "MOBILE_UA" };
  }

  if (PHONE_SIGNAL_RE.test(ua)) {
    return { blocked: false, reason: "MOBILE_UA" };
  }

  // No touch hint + desktop OS = the only class we block (real
  // desktops/laptops).
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
      "Driver signup is available on phones and tablets only. Please open 101drivers.com/download on your phone or tablet to continue.",
    storeUrl:
      process.env.PUBLIC_APP_DOWNLOAD_URL || "https://101drivers.com/download",
  };
}
