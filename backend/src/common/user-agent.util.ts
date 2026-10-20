// src/common/user-agent.util.ts
//
// OS-based mobile/desktop classification for the mobile-only driver
// signup rule. The gate is the USER AGENT ONLY — never screen size,
// never touch capability — exactly as specified:
//
//   Desktop = reports a desktop OS (Windows / macOS / Linux / ChromeOS)
//   AND carries no mobile signal ("Mobile", "Android", "iPhone", "iPod",
//   "iPad", "Windows Phone").
//
// Tablets pass because the rule is OS-based, not screen-based:
//   • iPad (iOS/iPadOS, "Request Desktop Site" off): UA contains "iPad"
//     → mobile signal → PASS.
//   • Android tablet: UA contains "Android" (tablets just omit the
//     "Mobile" token) → mobile signal → PASS.
//   • The one honest limitation: an iPadOS 13+ iPad with "Request
//     Desktop Website" enabled reports itself as macOS Safari
//     ("Macintosh; Intel Mac OS X") and carries no touch info we are
//     allowed to use — by the OS-only rule it is a Mac and is blocked.
//     Same for a desktop browser's UA override. That is inherent to the
//     user-agent-is-the-gate contract.

/** Anything in here means the browser reports a mobile OS. */
const MOBILE_SIGNAL_RE =
  /(Mobile|Android|iPhone|iPod|iPad|Windows Phone|IEMobile|Opera Mini)/i;

/** Desktop OS tokens (phone browsers never send these alone). */
const DESKTOP_OS_RE =
  /(Windows NT|Macintosh|Mac OS X|Mac OS X|Linux x86_64|x86_64|X11; Linux|CrOS)/i;

export type SignupUaVerdict = {
  blocked: boolean;
  /** DESKTOP_UA | EMPTY_UA | MOBILE_UA */
  reason: "DESKTOP_UA" | "EMPTY_UA" | "MOBILE_UA";
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

  if (MOBILE_SIGNAL_RE.test(ua)) {
    return { blocked: false, reason: "MOBILE_UA" };
  }

  if (DESKTOP_OS_RE.test(ua)) {
    return { blocked: true, reason: "DESKTOP_UA" };
  }

  // Unrecognized UA (curl, exotic viewers): not a mobile OS → gate open,
  // normal validation handles whatever comes next. Only clear desktop
  // signals are rejected.
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
      "Driver signup is available on mobile devices only. Please open 101drivers.com/download on your phone to continue.",
    storeUrl:
      process.env.PUBLIC_APP_DOWNLOAD_URL || "https://101drivers.com/download",
  };
}
