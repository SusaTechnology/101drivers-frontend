/**
 * Last-resort client error capture.
 *
 * WHY THIS EXISTS
 * React Query catches query errors, RouteErrorScreen catches render errors,
 * the boot watchdogs catch pre-bundle failures — but errors that escape all
 * layers (an un-awaited promise inside an event handler, a timeout in
 * non-React code, a third-party callback) die SILENTLY: the user sees a
 * button that does nothing and nobody can explain why afterwards. This
 * module records those escapees so support conversations stop being
 * "it didn't work" and become "the last 3 rejections were X at /deliveries".
 *
 * DESIGN
 *  - installErrorCapture() wires window 'error' + 'unhandledrejection'.
 *    Non-bubbling resource errors (img/script) never reach these listeners,
 *    so asset failures stay owned by index.html's capture-phase handler.
 *  - The last 20 entries persist through safeLocalStorage (never throws —
 *    survives private browsing / disabled storage) under 'clientErrorLog'.
 *    Identical consecutive errors dedupe into a count instead of spamming.
 *  - Optional beacon: when VITE_CLIENT_LOG_URL is configured at build time,
 *    entries flush via navigator.sendBeacon at ≥10 stored entries, on
 *    pagehide, and when the tab hides — the classic "never lose the crash
 *    report" pattern. Unconfigured (today) it is 100% local, zero network.
 *  - Everything is wrapped: the capture layer itself must never become the
 *    crash. It never preventDefaults — console logs stay untouched.
 *
 * Same contract as resume-sync.ts: install once, disposer for StrictMode/
 * HMR/test isolation.
 */
import { safeLocalStorage } from "./safeStorage";

const STORAGE_KEY = "clientErrorLog";
const MAX_ENTRIES = 20;
const MAX_MSG_CHARS = 300;
const MAX_STACK_CHARS = 500;
/** Flush to the beacon once this many entries are stored (when configured). */
const BEACON_THRESHOLD = 10;

export interface ClientErrorEntry {
  /** Epoch ms of the last occurrence. */
  t: number;
  type: "error" | "rejection";
  msg: string;
  stack?: string;
  route?: string;
  /** Times this exact message repeated consecutively. */
  count: number;
}

let installed = false;
let beaconUrl = "";

function readLog(): ClientErrorEntry[] {
  try {
    const raw = safeLocalStorage.get(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ClientErrorEntry =>
        !!e && typeof e === "object" && typeof (e as ClientErrorEntry).msg === "string",
    );
  } catch {
    return [];
  }
}

function writeLog(entries: ClientErrorEntry[]): void {
  safeLocalStorage.set(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

function currentRoute(): string | undefined {
  try {
    return typeof location !== "undefined" ? location.pathname : undefined;
  } catch {
    return undefined;
  }
}

/** Serialize any rejection reason without ever throwing. */
function describe(reason: unknown): { msg: string; stack?: string } {
  try {
    if (reason instanceof Error) {
      return {
        msg: reason.message.slice(0, MAX_MSG_CHARS) || reason.name || "Empty error",
        stack: reason.stack?.slice(0, MAX_STACK_CHARS),
      };
    }
    if (reason == null) {
      return { msg: "Unknown (empty rejection)" };
    }
    const s = String(reason);
    return { msg: s.slice(0, MAX_MSG_CHARS) || "Unknown (empty rejection)" };
  } catch {
    return { msg: "Unserializable error reason" };
  }
}

function record(type: ClientErrorEntry["type"], reason: unknown): void {
  try {
    const { msg, stack } = describe(reason);
    const entries = readLog();
    const last = entries[entries.length - 1];
    if (last && last.type === type && last.msg === msg) {
      last.count += 1;
      last.t = Date.now();
    } else {
      entries.push({
        t: Date.now(),
        type,
        msg,
        stack,
        route: currentRoute(),
        count: 1,
      });
    }
    const trimmed = entries.slice(-MAX_ENTRIES);
    writeLog(trimmed);
    if (beaconUrl && trimmed.length >= BEACON_THRESHOLD) {
      flushToBeacon();
    }
  } catch {
    // Capture must never become the crash.
  }
}

function flushToBeacon(): void {
  try {
    if (!beaconUrl) return;
    const entries = readLog();
    if (entries.length === 0) return;
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return;
    }
    const payload = JSON.stringify({
      app: "101drivers-pwa",
      sentAt: Date.now(),
      href: typeof location !== "undefined" ? location.href : undefined,
      entries,
    });
    navigator.sendBeacon(beaconUrl, new Blob([payload], { type: "application/json" }));
  } catch {
    // Never throw from a best-effort beacon.
  }
}

function onWindowError(event: ErrorEvent): void {
  // Real uncaught JS exceptions carry error/message. (Resource load failures
  // don't bubble to window in bubble-phase listeners, so they never land here.)
  if (event && (event.error || event.message)) {
    record("error", event.error ?? new Error(event.message));
  }
}

/**
 * Record an error that an upper layer already caught (React error
 * boundary / router CatchBoundary / route loader try-catch).
 *
 * window.onerror NEVER fires for these — React swallows them — so without
 * this hook a route crash would be invisible to the client error log and
 * support conversations would go back to "it didn't work". Same dedupe
 * and persistence contract as the uncaught path (identical consecutive
 * messages collapse into a count).
 */
export function captureCaughtError(reason: unknown): void {
  record("error", reason);
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  record("rejection", event?.reason);
}

function onVisibilityChange(): void {
  try {
    if (document.visibilityState === "hidden") {
      flushToBeacon();
    }
  } catch {
    // ignore
  }
}

function onPageHide(): void {
  flushToBeacon();
}

export function installErrorCapture(options: { beaconUrl?: string } = {}): () => void {
  if (installed || typeof window === "undefined") {
    return () => {};
  }
  installed = true;

  // Build-time env wins for production; the option exists for tests.
  beaconUrl =
    options.beaconUrl ??
    (typeof import.meta !== "undefined"
      ? ((import.meta as { env?: Record<string, string> }).env?.VITE_CLIENT_LOG_URL ?? "")
      : "");

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  if (beaconUrl) {
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return () => {
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    installed = false;
    beaconUrl = "";
  };
}

/** Read the persisted ring buffer — for diagnostics UIs / support tooling. */
export function getRecentClientErrors(): ClientErrorEntry[] {
  return readLog();
}

export function clearRecentClientErrors(): void {
  safeLocalStorage.remove(STORAGE_KEY);
}
