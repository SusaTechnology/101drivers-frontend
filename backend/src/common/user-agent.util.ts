// src/common/user-agent.util.ts
//
// DESKTOPS-BLOCKED classification for the driver signup rule — phones AND
// tablets are welcome (iPhone, Android phones, iPad, Android tablets,
// Kindle/Silk); only desktops and laptops are turned away.
//
//   PASS  = phone or tablet UA (mobile OS tokens, tablet tokens)
//   PASS  = a desktop-OS UA carrying the client's x-device-touch: 1 hint
//           — the iPadOS 13+ desktop-mode iPad ("Request Desktop Website"
//           is the DEFAULT on iPadOS) reports a macOS Safari UA
//           ("Macintosh; ...") that is byte-for-byte a real Mac's UA.
//           Touch capability is the only honest discriminator: a Mac has
//           navigator.maxTouchPoints === 0, an iPad reports 5. The FE
//           (src/lib/device.ts) sends the hint with every API call.
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
//   • iPadOS 13+ desktop-mode iPad: "Macintosh" UA + x-device-touch: 1
//     → PASS. A laptop that spoofs the hint was always able to spoof the
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
  /** DESKTOP_UA | EMPTY_UA | MOBILE_UA (tablets pass as MOBILE_UA) */
  reason: "DESKTOP_UA" | "EMPTY_UA" | "MOBILE_UA";
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

  // Touch-capable client → never a desktop. This is the iPadOS
  // desktop-mode iPad's only way in: its UA is a real Mac's UA, its
  // fingers are not. Covers phones and every tablet in every UA mode.
  if (touchHintFromHeader(touchCapableHint)) {
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
