/**
 * Storage access that never throws.
 *
 * WHY THIS EXISTS
 * Some browsers and embedded webviews expose `localStorage` / `sessionStorage`
 * as null, or throw SecurityError the moment they are touched: iOS private
 * browsing, in-app browsers (Gmail, Instagram, Facebook, Messenger), and
 * webviews with site data disabled. A raw `localStorage.getItem(...)` there
 * dies with:
 *
 *   TypeError: null is not an object (evaluating 'localStorage.getItem')
 *
 * which React surfaces as the router's "Something went wrong" crash screen.
 * That is the intermittent "submitted successfully, then Something went
 * wrong" report from drivers who open the app from an email link inside an
 * in-app browser: signup worked in their normal browser, the follow-up page
 * crashed in the webview.
 *
 * CONTRACT
 * Every helper is safe to call unconditionally:
 *   - reads  -> value, or null when storage is unavailable
 *   - writes -> silently dropped when storage is unavailable
 * The app degrades to "not remembered" instead of "broken". Callers that
 * need to distinguish "no storage" from "no value" cannot — by design.
 */

function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const safeLocalStorage = {
  get(key: string): string | null {
    // `?.` covers storage being null/undefined; try/catch covers
    // SecurityError / quota-style throws on the property access itself.
    return attempt(() => window.localStorage?.getItem(key) ?? null, null);
  },
  set(key: string, value: string): void {
    attempt(() => void window.localStorage?.setItem(key, value), undefined);
  },
  remove(key: string): void {
    attempt(() => void window.localStorage?.removeItem(key), undefined);
  },
};

export const safeSessionStorage = {
  get(key: string): string | null {
    return attempt(() => window.sessionStorage?.getItem(key) ?? null, null);
  },
  set(key: string, value: string): void {
    attempt(() => void window.sessionStorage?.setItem(key, value), undefined);
  },
  remove(key: string): void {
    attempt(() => void window.sessionStorage?.removeItem(key), undefined);
  },
};
