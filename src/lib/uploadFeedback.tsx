import { useSyncExternalStore } from "react";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";

/**
 * Global upload feedback — the fix for "users think the app is broken"
 * during photo/document uploads.
 *
 * WHY: every upload in the app goes through useFileUpload (dataQuery.ts),
 * which is a bare fetch wrapper — individual pages each roll their own
 * button spinners and toasts, and several upload surfaces give NO visible
 * feedback for seconds while a multi-MB photo crawls up a mobile network.
 * Users tap, nothing seems to happen, they think the app froze, and they
 * kill it mid-upload (which is also how uploads get silently lost).
 *
 * WHAT: a process-wide tracker + a small overlay mounted once at the app
 * root. useFileUpload auto-instruments every upload, so no call site needs
 * to change:
 *   1. The moment mutate() is called the overlay paints a pill with a
 *      spinner and "Uploading…" — a synchronous store update inside the
 *      tap's event handler, so it is on screen in the very first paint
 *      after the tap (well under the 100ms acceptance bar).
 *   2. On success the pill disappears. If the app is currently BACKGROUND
 *      (user switched apps / locked the screen while the upload ran) the
 *      completion is announced as a SYSTEM notification via the service
 *      worker — the only channel that reaches the user when the app is
 *      not on screen. In the foreground the per-page success toasts play
 *      their usual role, so nothing is silent in either state.
 *   3. On failure the pill turns into an error card with the reason and
 *      a Retry button that re-sends the exact same FormData through the
 *      same mutation — no re-picking files, no data re-entry.
 *
 * NOTE on "even if the app is closed": a browser cannot notify about an
 * upload that died with the app — if the process is killed mid-upload the
 * request never reaches the server, so there is nothing to announce. The
 * notification therefore covers the real-world case (app backgrounded but
 * alive, which is how PWA users actually switch away), and the retry card
 * covers the failed case. Notification permission is requested lazily on
 * the first upload tap (a user gesture, as browsers require) and a denial
 * degrades silently to toasts-only.
 */

export type UploadStatus = "active" | "error";

export interface UploadJob {
  id: number;
  /** Short description shown in the pill, e.g. "Photos" / "Profile photo". */
  label: string;
  status: UploadStatus;
  errorMessage?: string;
  /** Re-runs the exact same upload (same FormData, same endpoint). */
  retry?: () => void;
}

let nextId = 1;
const jobs = new Map<number, UploadJob>();
const listeners = new Set<() => void>();

function emit() {
  // Snapshot for useSyncExternalStore — a new array each change keeps
  // referential equality stable between changes.
  snapshotCache = Array.from(jobs.values());
  listeners.forEach((l) => l());
}

let snapshotCache: UploadJob[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): UploadJob[] {
  return snapshotCache;
}

function getServerSnapshot(): UploadJob[] {
  return [];
}

export const uploadTracker = {
  /**
   * Mark an upload as started. MUST be called synchronously inside the
   * tap's event-handler call chain so the spinner paints immediately.
   */
  begin(label = "Uploading"): number {
    const id = nextId++;
    jobs.set(id, { id, label, status: "active" });
    emit();
    // Fire-and-forget: system notifications need permission, and browsers
    // only grant it from a user gesture — an upload tap is exactly that.
    // A denial or an unsupported browser just skips notifications.
    void ensureNotificationPermission();
    return id;
  },

  /** Upload finished — remove the pill; notify when backgrounded. */
  succeed(id: number, label = "Upload") {
    jobs.delete(id);
    emit();
    notifyCompletionInBackground(`${label} uploaded successfully`);
  },

  /** Upload failed — flip the pill into an error card with a Retry. */
  fail(id: number, error: unknown, retry?: () => void, label = "Upload") {
    const job = jobs.get(id);
    if (!job) return;
    job.status = "error";
    job.errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "Something went wrong while uploading.";
    job.retry = retry
      ? () => {
          jobs.delete(id);
          emit();
          retry();
        }
      : undefined;
    jobs.set(id, job);
    emit();
    notifyCompletionInBackground(`${label} failed to upload`, true);
  },

  /** Manual dismiss of an error card (the X button). */
  dismiss(id: number) {
    jobs.delete(id);
    emit();
  },
};

// ── System notification helpers ──────────────────────────────────────

async function ensureNotificationPermission(): Promise<void> {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    // iOS < 16.4 PWA / private mode / etc. — notifications just stay off.
  }
}

/**
 * Announce an upload outcome via the service worker when the app is in
 * the background. Foreground outcomes are the page toasts' job — a
 * system notification while the user is LOOKING at the app is noise.
 */
async function notifyCompletionInBackground(body: string, isError = false) {
  try {
    if (typeof Notification === "undefined") return;
    if (!document.hidden) return; // foreground → toasts handle it
    if (Notification.permission !== "granted") return;
    const registration =
      await navigator.serviceWorker?.getRegistration?.();
    if (!registration) {
      // No SW (dev server) — fall back to the page-level Notification,
      // which still surfaces on mobile OSes while backgrounded.
      new Notification("101 Drivers", { body });
      return;
    }
    await registration.showNotification("101 Drivers", {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: isError ? "upload-error" : "upload-complete",
    });
  } catch {
    // Notification is best-effort — never let it throw into the upload flow.
  }
}

// ── The overlay (mount once, near the app root) ─────────────────────

export function UploadFeedbackOverlay() {
  const activeJobs = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (activeJobs.length === 0) return null;

  // Combine all active uploads into one pill — drivers often fire several
  // uploads back-to-back and a stack of identical pills is noise.
  const active = activeJobs.filter((j) => j.status === "active");
  const failed = activeJobs.filter((j) => j.status === "error");

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      {active.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
        >
          <Loader2 className="h-5 w-5 animate-spin text-lime-600 dark:text-lime-400" />
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {active.length > 1
              ? `Uploading ${active.length} items…`
              : `${active[0].label.startsWith("Uploading") || active[0].label.startsWith("Syncing") ? active[0].label : `${active[0].label}…`}`}
          </div>
        </div>
      )}

      {failed.map((job) => (
        <div
          key={job.id}
          role="alert"
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-red-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-red-900/60 dark:bg-slate-900/95"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {job.label === "Uploading"
                  ? "Upload failed"
                  : `${job.label} failed`}
              </p>
              <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">
                {job.errorMessage}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {job.retry && (
                  <button
                    onClick={job.retry}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                )}
                <button
                  onClick={() => uploadTracker.dismiss(job.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
