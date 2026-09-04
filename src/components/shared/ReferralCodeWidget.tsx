/**
 * ReferralCodeWidget — 3-state referral capture (owner's spec).
 *
 * The three states are MUTUALLY EXCLUSIVE — never mixed:
 *
 *   1. CLOSED  — only the lime (brand) text link "Have a referral code?".
 *                No input. No chip.
 *   2. TYPING  — one field slides open. Placeholder:
 *                "joesgarage or your shop name". Clear X on the field.
 *                No chip yet. Live-validates as the user types
 *                (including the preserved paused-program and role-matrix
 *                messages — a code that resolves but can't be applied
 *                stays in TYPING with its explanation).
 *   3. LOCKED  — the code is valid (or the user arrived via a deep link
 *                such as /test-referral/joesgarage or /signup?ref=…).
 *                The field is HIDDEN. Only the chip
 *                "Referred by {referrer}" with an X is shown.
 *                Tapping X returns to state 1 and clears the session.
 *
 * Entry logic on mount (priority order):
 *   a) `?ref=` in the URL              → deep link → LOCKED immediately
 *   b) sessionStorage referral code    → LOCKED (re-validated)
 *   c) sessionStorage "referral_open"  → TYPING (login-card link sent us)
 *   d) otherwise                       → CLOSED
 *
 * Session keys (see REFERRAL_SESSION_KEYS):
 *   referral_code — written whenever the widget locks; cleared by the
 *                   chip X (and by the typing-field X).
 *   referral_open — intent flag written by the login card's
 *                   "Have a referral code?" link; consumed on mount.
 *
 * Public resolve endpoint is unchanged:
 *   GET /api/referrals/public/resolve/:code  (no auth, cached 60s).
 *
 * onChange contract (same as the legacy ReferralCodeInput):
 *   emits the validated uppercase code ONLY while LOCKED+resolved,
 *   null otherwise. Parents attach the value to their submit payload
 *   only when non-null.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, X, Gift, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useDataQuery } from "@/lib/tanstack/dataQuery";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL;

/** sessionStorage keys — shared with the login card link (DealerSignIn). */
export const REFERRAL_SESSION_KEYS = {
  /** Validated referral code while the widget is LOCKED. */
  CODE: "referral_code",
  /** Intent flag: the login card's referral link was tapped. */
  OPEN: "referral_open",
} as const;

type ResolveResponse = {
  found: boolean;
  referrerName: string | null;
  referrerType: "DRIVER" | "CUSTOMER" | null;
  referrerSubtype: "PERSONAL" | "BUSINESS" | null;
  programActive: boolean;
};

/** The three mutually exclusive widget states. */
type WidgetMode = "closed" | "typing" | "locked";

/** Validation outcomes for the live check (drives TYPING messages + locking). */
type ValidationState = "empty" | "validating" | "resolved" | "invalid" | "paused" | "not-allowed";

type AllowedReferrerType = "DRIVER" | "BUSINESS" | "PERSONAL";

/**
 * Slide-open row helper — module-level (NOT inline in the component) so
 * React keeps the same component type across renders. An inline definition
 * would remount the whole subtree on every keystroke and destroy input
 * state. All three rows stay mounted; inactive ones collapse to 0 height
 * so the grid-rows transition animates between states.
 */
function Row({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!active}
      className={cn(
        "grid transition-all duration-300 ease-out",
        active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

type Props = {
  /** Emits the validated uppercase code when LOCKED+resolved, null otherwise. */
  onChange: (code: string | null) => void;
  /** Optional controlled initial value (treated like a session code). */
  initialValue?: string;
  /** Disable the input (e.g. when the parent form is submitting). */
  disabled?: boolean;
  /** Optional class to override the outer wrapper. */
  className?: string;
  /**
   * Which referrer types are allowed on this form (same role matrix as
   * ReferralCodeInput). Default: all types allowed.
   */
  allowedReferrerTypes?: AllowedReferrerType[];
};

export function ReferralCodeWidget({
  onChange,
  initialValue = "",
  disabled = false,
  className,
  allowedReferrerTypes = ["DRIVER", "BUSINESS", "PERSONAL"],
}: Props) {
  // ── Core state ─────────────────────────────────────────────────────
  const [mode, setMode] = useState<WidgetMode>("closed");
  const [inputValue, setInputValue] = useState<string>(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Mount: decide the entry state (deep link / session / intent) ──
  useEffect(() => {
    if (initialValue) {
      // Parent provided a code — treat it like a session code: lock.
      setInputValue(initialValue.trim().toUpperCase());
      setMode("locked");
      return;
    }

    // a) Deep link — ?ref= in the URL wins over everything.
    const urlRef = new URLSearchParams(window.location.search).get("ref");
    // b) Session code from a previous lock (e.g. deep link earlier in session).
    const sessionCode = sessionStorage.getItem(REFERRAL_SESSION_KEYS.CODE);
    // c) Intent flag — the login card's "Have a referral code?" link.
    const intentOpen =
      sessionStorage.getItem(REFERRAL_SESSION_KEYS.OPEN) === "1";

    const initial = (urlRef ?? sessionCode ?? "").trim();
    if (initial) {
      const code = initial.toUpperCase();
      setInputValue(code);
      setMode("locked");
      // Persist so refreshes keep the chip until the user clears it.
      sessionStorage.setItem(REFERRAL_SESSION_KEYS.CODE, code);
      sessionStorage.removeItem(REFERRAL_SESSION_KEYS.OPEN);
    } else if (intentOpen) {
      sessionStorage.removeItem(REFERRAL_SESSION_KEYS.OPEN);
      setMode("typing");
    } else {
      setMode("closed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus the field whenever TYPING opens.
  useEffect(() => {
    if (mode === "typing") inputRef.current?.focus();
  }, [mode]);

  // ── Live validation (identical rules to ReferralCodeInput) ────────
  const debouncedCode = useDebouncedValue(inputValue.trim().toUpperCase(), 400);
  const queryEnabled = !!debouncedCode && debouncedCode.length >= 4 && !disabled;

  const { data, isFetching, isError } = useDataQuery<ResolveResponse | null>({
    apiEndPoint: `${API_URL}/api/referrals/public/resolve/${encodeURIComponent(
      debouncedCode,
    )}`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    enabled: queryEnabled,
    queryKey: ["referral-resolve-widget", debouncedCode],
    staleTime: 60_000,
  });

  let state: ValidationState = "empty";
  if (!inputValue.trim()) {
    state = "empty";
  } else if (inputValue.trim().toUpperCase() !== debouncedCode) {
    state = "validating";
  } else if (isFetching) {
    state = "validating";
  } else if (isError) {
    state = "invalid";
  } else if (data) {
    if (!data.found) {
      state = "invalid";
    } else if (!data.programActive) {
      state = "paused";
    } else {
      // Role matrix — same mapping as ReferralCodeInput:
      //   DRIVER → "DRIVER"; CUSTOMER+BUSINESS → "BUSINESS"; else "PERSONAL".
      const referrerAllowedType: AllowedReferrerType =
        data.referrerType === "DRIVER"
          ? "DRIVER"
          : data.referrerSubtype === "BUSINESS"
            ? "BUSINESS"
            : "PERSONAL";
      if (!allowedReferrerTypes.includes(referrerAllowedType)) {
        state = "not-allowed";
      } else {
        state = "resolved";
      }
    }
  }

  // TYPING → LOCKED: the code fully resolved (valid + active + allowed).
  useEffect(() => {
    if (mode === "typing" && state === "resolved" && debouncedCode) {
      sessionStorage.setItem(REFERRAL_SESSION_KEYS.CODE, debouncedCode);
      setMode("locked");
    }
  }, [mode, state, debouncedCode]);

  // LOCKED → TYPING fallback: the locked code failed validation
  // (invalid / paused / not-allowed) — show the field with the
  // explanatory message instead of silently accepting a dead code.
  useEffect(() => {
    if (
      mode === "locked" &&
      (state === "invalid" || state === "paused" || state === "not-allowed")
    ) {
      sessionStorage.removeItem(REFERRAL_SESSION_KEYS.CODE);
      setMode("typing");
    }
  }, [mode, state]);

  // Parent notification — same contract as ReferralCodeInput.
  useEffect(() => {
    if (mode === "locked" && state === "resolved" && debouncedCode) {
      onChange(debouncedCode);
    } else {
      onChange(null);
    }
  }, [mode, state, debouncedCode, onChange]);

  // ── Transitions ────────────────────────────────────────────────────

  /** Strip ?ref= from the URL without navigating. */
  const stripRefFromUrl = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("ref")) {
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  /** State 3 X — back to state 1 and clear the session (spec). */
  const handleChipRemove = () => {
    if (disabled) return;
    sessionStorage.removeItem(REFERRAL_SESSION_KEYS.CODE);
    stripRefFromUrl();
    setInputValue("");
    setMode("closed");
  };

  /**
   * State 2 X — clear the field (and any session/URL residue).
   * If the field is already empty, collapse back to state 1.
   */
  const handleFieldClear = () => {
    if (disabled) return;
    if (!inputValue.trim()) {
      sessionStorage.removeItem(REFERRAL_SESSION_KEYS.CODE);
      stripRefFromUrl();
      setMode("closed");
      return;
    }
    setInputValue("");
    sessionStorage.removeItem(REFERRAL_SESSION_KEYS.CODE);
    stripRefFromUrl();
    inputRef.current?.focus();
  };

  // ── Helpers for the preserved validation messages ─────────────────
  const notAllowedMessage = (() => {
    const referrerDesc =
      data?.referrerSubtype === "PERSONAL"
        ? "Personal customers"
        : data?.referrerSubtype === "BUSINESS"
          ? "Business customers"
          : data?.referrerType === "DRIVER"
            ? "Drivers"
            : "This referrer";
    const targetDesc =
      allowedReferrerTypes.length === 0
        ? "Business customers can't be referred — they sign up directly."
        : `${referrerDesc} can't invite ${allowedReferrerTypes.includes("DRIVER") ? "drivers" : "this type of account"}.`;
    return `${targetDesc} Clear the code or use a different one.`;
  })();

  // ── Visual pieces ──────────────────────────────────────────────────

  // Slide-open helper is module-level (see Row above) — defining it inline
  // would remount the input on every keystroke and destroy typed state.

  // Validation message under the field (TYPING state) — preserved from
  // the legacy component so users still get the paused + role-matrix
  // explanations instead of a bare valid/invalid signal.
  const ValidationMessage = () => {
    if (state === "validating") {
      return (
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Spinner className="size-3.5 text-slate-400" />
          Checking referral code…
        </p>
      );
    }
    if (state === "invalid") {
      return (
        <p className="text-xs font-medium text-red-500 dark:text-red-400">
          We couldn't find that referral code. Please double-check it.
        </p>
      );
    }
    if (state === "not-allowed") {
      return (
        <p className="flex items-start gap-1.5 text-xs font-medium text-red-500 dark:text-red-400">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {notAllowedMessage}
        </p>
      );
    }
    if (state === "paused") {
      return (
        <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This referral code is valid but the referral program is currently
          paused. You can still sign up — the code won't be applied.
        </p>
      );
    }
    return (
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
        Optional — enter a friend's code to give them a referral bonus.
      </p>
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* ── State 1: CLOSED — lime text link only ─────────────────── */}
      <Row active={mode === "closed"}>
        <button
          type="button"
          tabIndex={mode === "closed" ? 0 : -1}
          disabled={disabled}
          onClick={() => setMode("typing")}
          className="text-sm font-semibold text-primary hover:underline underline-offset-4 transition-colors"
        >
          Have a referral code?
        </button>
      </Row>

      {/* ── State 2: TYPING — one field slid open, no chip ────────── */}
      <Row active={mode === "typing"}>
        <div className="space-y-2 pt-1">
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="joesgarage or your shop name"
              maxLength={16}
              autoComplete="off"
              disabled={disabled}
              aria-label="Referral code"
              aria-invalid={state === "invalid" || state === "not-allowed"}
              className={cn(
                "h-12 rounded-2xl border pr-12 text-sm transition-colors",
                (state === "invalid" || state === "not-allowed") &&
                  "border-red-400 dark:border-red-600",
                state === "paused" && "border-amber-400 dark:border-amber-700",
                state === "resolved" && "border-emerald-400 dark:border-emerald-700",
                state !== "invalid" &&
                  state !== "not-allowed" &&
                  state !== "paused" &&
                  state !== "resolved" &&
                  "border-slate-200 dark:border-slate-700",
              )}
            />
            {/* Clear X on the field */}
            <button
              type="button"
              tabIndex={mode === "typing" ? 0 : -1}
              disabled={disabled}
              onClick={handleFieldClear}
              aria-label="Clear referral code"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ValidationMessage />
        </div>
      </Row>

      {/* ── State 3: LOCKED — chip only, field hidden ─────────────── */}
      <Row active={mode === "locked"}>
        <div className="pt-1">
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              state === "resolved"
                ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-200"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300",
            )}
          >
            {state === "resolved" ? (
              <Gift className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            {state === "resolved" ? (
              <span className="truncate">
                Referred by {data?.referrerName ?? "a 101drivers referrer"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-3.5 text-slate-400" />
                Checking referral code…
              </span>
            )}
            <button
              type="button"
              tabIndex={mode === "locked" ? 0 : -1}
              disabled={disabled}
              onClick={handleChipRemove}
              aria-label="Remove referral code"
              className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      </Row>
    </div>
  );
}

export default ReferralCodeWidget;
