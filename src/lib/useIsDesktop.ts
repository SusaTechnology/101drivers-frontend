import { useEffect, useState } from 'react';

// Detect if the user is on a device without a real camera (desktop/laptop).
// On mobile, `<input capture>` triggers the native camera. On desktop,
// browsers silently ignore `capture` and fall back to the file picker —
// camera-only flows (driver onboarding, preferences) must block that and
// tell the driver to open the page on their phone instead.
//
// Heuristic: no touch capability AND a large viewport = desktop/laptop.
// Tablets and phones (touch or small screen) are treated as camera devices.
// Rendered as a hook (not a one-shot check) so a resize / device switch
// re-evaluates; initial false matches SSR and avoids hydration flashes.
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    // maxTouchPoints is the trusted signal — desktop Chrome DECLARES the
    // `ontouchstart` property on window even with zero touch hardware, so
    // a bare `'ontouchstart' in window` check misclassifies every Chrome
    // desktop as a camera device. See lib/device.ts hasTouchCapability.
    const hasTouchScreen =
      (navigator.maxTouchPoints ?? 0) > 0 ||
      typeof (window as unknown as Record<string, unknown>).ontouchstart ===
        "function";
    const isSmallScreen = window.innerWidth < 1024;
    setIsDesktop(!hasTouchScreen && !isSmallScreen);
  }, []);
  return isDesktop;
}
