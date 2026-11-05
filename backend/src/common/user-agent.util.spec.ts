/**
 * Unit tests for classifySignupUserAgent — the driver-signup device gate.
 *
 * The rule: phones AND tablets are welcome; only desktops and laptops
 * are blocked. The critical case is the iPadOS 13+ desktop-mode iPad,
 * whose user agent is byte-for-byte a real Mac's ("Macintosh; ...") —
 * only the FE's x-device-touch: 1 header (navigator.maxTouchPoints > 0)
 * can tell them apart. A Mac never has touch points; an iPad always does.
 *
 * Matrix (real-world UA strings):
 *   PASS    iPhone Safari, Android phone Chrome/Samsung, Android tablet
 *           Chrome, iPad Safari (old UA), iPadOS desktop-mode iPad + hint,
 *           Kindle/Silk, generic "Tablet", curl/exotic (open door)
 *   BLOCK   Windows desktop, real Mac Safari, Linux x86_64, ChromeOS,
 *           TOUCHSCREEN LAPTOP (Windows/Linux/CrOS UA + touch hint),
 *           iPadOS desktop-mode iPad WITHOUT the hint (old cached bundle),
 *           empty UA
 */
import {
  classifySignupUserAgent,
  classifyDriverDeviceRequest,
  touchHintFromHeader,
} from "./user-agent.util";

// ── Real user agents ────────────────────────────────────────────────
const UAS = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidPhoneChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidPhoneSamsung:
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  androidTabletChrome:
    "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  ipadSafari:
    "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  // iPadOS 13+ with "Request Desktop Website" (the DEFAULT) — reports
  // itself as macOS Safari. This string is what a real Mac sends too.
  ipadosDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  linuxFirefox:
    "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  kindleSilk:
    "Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.1.1 like Chrome/126.0.0.0 Safari/537.36",
  genericTablet:
    "Mozilla/5.0 (Linux; U; Android 12; en-us; Tab M10 Plus Build/SKQ1) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 Safari/537.36",
  curl: "curl/8.5.0",
};

// Real macOS Safari UA for the Mac-side assertions (kept explicit here so
// the iPadOS desktop-mode case above stays visually identical).
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15";

describe("classifySignupUserAgent — phones and tablets pass", () => {
  const passing: Array<[string, string]> = [
    ["iPhone Safari", UAS.iphoneSafari],
    ["Android phone (Chrome)", UAS.androidPhoneChrome],
    ["Android phone (Samsung)", UAS.androidPhoneSamsung],
    ["Android tablet (Chrome, no Mobile token)", UAS.androidTabletChrome],
    ["iPad (classic UA)", UAS.ipadSafari],
    ["Kindle / Silk", UAS.kindleSilk],
    ["generic Android tablet", UAS.genericTablet],
    ["unrecognized UA (curl) — open door", UAS.curl],
  ];

  it.each(passing)("allows %s", (_name, ua) => {
    const verdict = classifySignupUserAgent(ua);
    expect(verdict.blocked).toBe(false);
    expect(verdict.reason).toBe("MOBILE_UA");
  });
});

describe("classifySignupUserAgent — desktops are blocked", () => {
  const blocked: Array<[string, string]> = [
    ["Windows 10 Chrome", UAS.windowsChrome],
    ["macOS Safari (real Mac)", MAC_SAFARI],
    ["Linux x86_64 Firefox", UAS.linuxFirefox],
    ["ChromeOS", UAS.chromeOs],
  ];

  it.each(blocked)("blocks %s (DESKTOP_UA)", (_name, ua) => {
    const verdict = classifySignupUserAgent(ua);
    expect(verdict.blocked).toBe(true);
    expect(verdict.reason).toBe("DESKTOP_UA");
  });

  it("blocks an empty UA (EMPTY_UA)", () => {
    expect(classifySignupUserAgent("")).toEqual({
      blocked: true,
      reason: "EMPTY_UA",
    });
    expect(classifySignupUserAgent(undefined)).toEqual({
      blocked: true,
      reason: "EMPTY_UA",
    });
  });
});

describe("classifySignupUserAgent — the iPadOS desktop-mode trap", () => {
  it("lets a desktop-mode iPad IN when the FE touch hint arrives", () => {
    const verdict = classifySignupUserAgent(UAS.ipadosDesktopMode, "1");
    expect(verdict.blocked).toBe(false);
    expect(verdict.reason).toBe("MOBILE_UA");
  });

  it("blocks a touchscreen laptop even when it sends the touch hint", () => {
    // Windows/Linux/ChromeOS + touch = a touchscreen laptop — the exact
    // class the gate exists to turn away. Only the Apple-tablet
    // signature (a desktop-mode iPad's Macintosh UA) is let through by
    // the hint.
    expect(classifySignupUserAgent(UAS.windowsChrome, "1")).toEqual({
      blocked: true,
      reason: "DESKTOP_TOUCH_UA",
    });
    expect(classifySignupUserAgent(UAS.linuxFirefox, "1")).toEqual({
      blocked: true,
      reason: "DESKTOP_TOUCH_UA",
    });
  });

  it("still blocks a desktop-mode iPad whose old bundle sends no hint", () => {
    // UA alone cannot distinguish it from a real Mac — the safe verdict
    // for a no-touch "Macintosh" stays BLOCK until the fresh bundle
    // loads and starts sending the hint.
    expect(classifySignupUserAgent(UAS.ipadosDesktopMode).blocked).toBe(true);
  });

  it("treats hint '0' as no hint (a no-touch Mac stays blocked)", () => {
    expect(classifySignupUserAgent(MAC_SAFARI, "0").blocked).toBe(true);
  });
});

describe("touchHintFromHeader", () => {
  it("accepts '1' and 'true' in any case, single or array", () => {
    expect(touchHintFromHeader("1")).toBe(true);
    expect(touchHintFromHeader("TRUE")).toBe(true);
    expect(touchHintFromHeader(["1"])).toBe(true);
  });

  it("rejects '0', garbage, and absence", () => {
    expect(touchHintFromHeader("0")).toBe(false);
    expect(touchHintFromHeader("yes")).toBe(false);
    expect(touchHintFromHeader(undefined)).toBe(false);
    expect(touchHintFromHeader(null)).toBe(false);
  });
});

// ── classifyDriverDeviceRequest — the DRIVER-PORTAL gate ─────────────
// Stricter than signup: the touch hint is REQUIRED (device.ts attaches it
// to every driver-onboarding call, so a scripted replay with a borrowed
// UA never has it), and Chrome's own sec-ch-ua client hints must agree
// with the claimed device — a UA-switcher extension rewrites the UA but
// not the hints.
describe("classifyDriverDeviceRequest — real phones and tablets pass", () => {
  const passing: Array<[string, string, string, string?, string?]> = [
    // [name, UA, x-device-touch, sec-ch-ua-mobile, sec-ch-ua-platform]
    ["iPhone Safari", UAS.iphoneSafari, "1", undefined, undefined],
    [
      "Android phone Chrome (hints agree)",
      UAS.androidPhoneChrome,
      "1",
      "?1",
      '"Android"',
    ],
    [
      "Android tablet Chrome (hints agree)",
      UAS.androidTabletChrome,
      "1",
      "?1",
      '"Android"',
    ],
    ["iPad classic UA (WebKit, no hints)", UAS.ipadSafari, "1", undefined, undefined],
    // iPadOS desktop-mode Safari/Chrome-on-iOS are WebKit and send NO
    // client hints — the touch hint alone must keep admitting them.
    [
      "iPadOS desktop-mode iPad (WebKit, no hints)",
      UAS.ipadosDesktopMode,
      "1",
      undefined,
      undefined,
    ],
  ];

  it.each(passing)("allows %s", (_name, ua, hint, mobile, platform) => {
    const verdict = classifyDriverDeviceRequest(ua, hint, mobile, platform);
    expect(verdict.blocked).toBe(false);
    expect(verdict.reason).toBe("MOBILE_UA");
  });
});

describe("classifyDriverDeviceRequest — the stricter driver rules", () => {
  it("blocks a borrowed iPhone UA with NO touch hint (scripted replay)", () => {
    // curl/Postman replaying a captured request: perfect phone UA, but
    // the FE always sends the hint, so its absence is the tell.
    expect(classifyDriverDeviceRequest(UAS.iphoneSafari)).toEqual({
      blocked: true,
      reason: "NO_TOUCH_HINT",
    });
    expect(classifyDriverDeviceRequest(UAS.iphoneSafari, "0")).toEqual({
      blocked: true,
      reason: "NO_TOUCH_HINT",
    });
  });

  it("blocks a UA-switcher extension: iPhone UA, desktop Chrome's own hints", () => {
    // The extension rewrites navigator.userAgent + the UA header but NOT
    // the sec-ch-ua headers Chrome derives from the REAL browser.
    expect(
      classifyDriverDeviceRequest(UAS.iphoneSafari, "1", "?0", '"Windows"')
    ).toEqual({ blocked: true, reason: "CLIENT_HINT_MISMATCH" });
    // Mobile hint says ?0 even with a coherent platform — still a lie.
    expect(
      classifyDriverDeviceRequest(UAS.iphoneSafari, "1", "?0")
    ).toEqual({ blocked: true, reason: "CLIENT_HINT_MISMATCH" });
  });

  it("blocks desktop Chrome claiming the iPad touch hint (macOS platform report)", () => {
    // Old shortcut: Mac UA + x-device-touch: 1 passed as a desktop-mode
    // iPad. A REAL desktop Chromium's own platform hint says "macOS" —
    // that positive evidence now blocks it.
    expect(
      classifyDriverDeviceRequest(MAC_SAFARI, "1", "?0", '"macOS"')
    ).toEqual({ blocked: true, reason: "CLIENT_HINT_MISMATCH" });
    // Platform hint alone (even without the mobile hint) also blocks.
    expect(
      classifyDriverDeviceRequest(UAS.ipadosDesktopMode, "1", undefined, '"macOS"')
    ).toEqual({ blocked: true, reason: "CLIENT_HINT_MISMATCH" });
  });

  it("blocks an Android platform report next to an iPhone UA", () => {
    expect(
      classifyDriverDeviceRequest(UAS.iphoneSafari, "1", "?1", '"Android"')
    ).toEqual({ blocked: true, reason: "CLIENT_HINT_MISMATCH" });
  });

  it("still blocks desktops and empty UAs before the hint check", () => {
    expect(classifyDriverDeviceRequest(UAS.windowsChrome, "1")).toEqual({
      blocked: true,
      reason: "DESKTOP_TOUCH_UA",
    });
    expect(classifyDriverDeviceRequest("")).toEqual({
      blocked: true,
      reason: "NO_TOUCH_HINT",
    });
  });

  it("keeps DevTools device-toolbar emulation passable (honest limitation)", () => {
    // DevTools rewrites UA AND client hints coherently — from HTTP
    // headers alone it IS the emulated device. The audit trail is the
    // deterrent; this test pins that we do not block real phones whose
    // hints happen to be coherent.
    expect(
      classifyDriverDeviceRequest(UAS.iphoneSafari, "1", "?1", '"iOS"')
    ).toEqual({ blocked: false, reason: "MOBILE_UA" });
  });
});
