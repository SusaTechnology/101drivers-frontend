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

// ── Driver self-service gate (onboarding-complete / onboarding-data) ──
//
// The driver endpoints are gated STRICTER than public signup, because the
// attacker here is not an anonymous spammer but a signed-in driver on a
// desktop browser who wants the phone-only flow on a big screen — most
// cheaply by DevTools' device toolbar or a UA-switcher extension:
//
//   1. The touch hint is REQUIRED. The FE attaches x-device-touch: 1/0 to
//      every driver-onboarding call (see src/lib/device.ts deviceTouchHint),
//      so a real phone/tablet always carries it — a curl/Postman/scripted
//      replay with a spoofed iPhone UA does not know to. (Signup cannot
//      require it because the header is only sent on FE calls that opt in.)
//   2. Chrome's own client hints must agree with the claimed device.
//      Desktop Chrome sends sec-ch-ua-mobile (?0/?1) and
//      sec-ch-ua-platform ("Windows" | "macOS" | "Linux" | "Chrome OS" |
//      "Android" | "iOS") on every request, derived from the REAL browser —
//      a UA-switcher extension rewrites navigator.userAgent and the UA
//      header but NOT these. An iPhone UA arriving with ?0 / "Windows" is
//      a liar and is blocked. DevTools' device toolbar rewrites UA AND
//      client hints coherently, so it still passes — that residual gap is
//      physical (the request line is the only evidence the server ever
//      gets), and it is why every block is audited: spoofing is cheap,
//      getting caught is the deterrent.
//   3. The iPadOS desktop-mode iPad stays safe: Safari and Chrome-on-iOS
//      are WebKit and send NO client hints at all, so the touch hint alone
//      admits them exactly as before. A platform hint claiming "macOS"
//      can only come from a real desktop Chromium claiming touch — blocked.

/** Values Chrome sends in sec-ch-ua-platform. Quotes arrive intact —
 *  Chrome sends `sec-ch-ua-platform: "Windows"`. */
const CLIENT_HINT_DESKTOP_PLATFORMS = ["windows", "macos", "linux", "chrome os"];

/** Normalize a sec-ch-* header value: headers may arrive as string |
 *  string[] | undefined; strip the surrounding quotes Chrome adds. */
function clientHintValue(value: string | string[] | undefined | null): string {
  const v = (Array.isArray(value) ? value.join(",") : (value ?? ""))
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^"|"$/g, "");
  return v;
}

export type DriverDeviceVerdict = {
  blocked: boolean;
  /** Signup reasons + NO_TOUCH_HINT | CLIENT_HINT_MISMATCH */
  reason:
    | "DESKTOP_UA"
    | "DESKTOP_TOUCH_UA"
    | "EMPTY_UA"
    | "MOBILE_UA"
    | "NO_TOUCH_HINT"
    | "CLIENT_HINT_MISMATCH";
};

export function classifyDriverDeviceRequest(
  userAgent: string | string[] | undefined | null,
  touchCapableHint?: string | string[] | null,
  secChUaMobile?: string | string[] | null,
  secChUaPlatform?: string | string[] | null
): DriverDeviceVerdict {
  const ua = Array.isArray(userAgent)
    ? userAgent.join(" ")
    : (userAgent ?? "").toString().trim();

  // The FE's device.ts attaches the hint to EVERY driver-onboarding call,
  // so its absence means a non-FE client (scripted replay, curl with a
  // borrowed UA). Checked before the UA rules: even a perfect iPhone UA
  // without the hint is not this app's own client.
  if (!touchHintFromHeader(touchCapableHint)) {
    return { blocked: true, reason: "NO_TOUCH_HINT" };
  }

  // Same phone/tablet/desktop classification as signup — desktops and
  // touchscreen laptops stay blocked here too.
  const verdict = classifySignupUserAgent(ua, touchCapableHint);
  if (verdict.blocked) {
    return verdict;
  }

  // Client-hint coherence: the browser describing ITSELF contradicts the
  // (spoofed) UA. Only positive evidence blocks — absence of hints is the
  // WebKit norm (Safari, Chrome-on-iOS), never a strike.
  const mobileHint = clientHintValue(secChUaMobile);
  const platformHint = clientHintValue(secChUaPlatform);

  if (mobileHint === "?0") {
    // Chrome says "this is not a mobile device" while the UA claims one.
    return { blocked: true, reason: "CLIENT_HINT_MISMATCH" };
  }
  if (platformHint && CLIENT_HINT_DESKTOP_PLATFORMS.includes(platformHint)) {
    // A desktop Chromium's own platform report — with or without a spoofed
    // phone UA. This also closes the old "Mac UA + touch hint = iPad"
    // shortcut for desktop Chrome, whose platform hint would say "macOS".
    return { blocked: true, reason: "CLIENT_HINT_MISMATCH" };
  }
  if (
    platformHint === "android" &&
    PHONE_SIGNAL_RE.test(ua) &&
    !ANDROID_RE.test(ua)
  ) {
    // An Android device's own platform report next to an iPhone UA —
    // UA-switcher extension, not a real phone.
    return { blocked: true, reason: "CLIENT_HINT_MISMATCH" };
  }

  return { blocked: false, reason: "MOBILE_UA" };
}

/** The 403 body for a blocked driver-portal request (message + storeUrl). */
export function mobileOnlyDriverPayload(): {
  statusCode: number;
  error: string;
  message: string;
  storeUrl: string;
} {
  return {
    statusCode: 403,
    error: "Forbidden",
    message:
      "The driver portal is available on phones and tablets only. Please open 101drivers.com/download on your phone or tablet to continue.",
    storeUrl:
      process.env.PUBLIC_APP_DOWNLOAD_URL || "https://101drivers.com/download",
  };
}
