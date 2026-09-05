/**
 * ReferralCodeInput — reusable 3-state referral code input.
 *
 * Used in the dealer, individual, and driver signup forms.
 *
 * States:
 *   1. EMPTY     — no input, plain placeholder
 *   2. VALIDATING — debounced (400ms), calling /api/referrals/public/resolve/:code
 *   3. RESOLVED  — green checkmark + privacy-masked referrer name
 *                  ("Referred by John S." / "Referred by Acme Auto")
 *   4. INVALID   — red X + "We couldn't find that referral code"
 *   5. PAUSED    — amber info — code is valid but program is paused
 *                  ("Referral program is currently paused")
 *
 * Auto-fills from the `?ref=CODE` URL query parameter on mount.
 * Calls `onChange(validatedCode | null)` whenever the resolved state
 * changes — parents should only attach `referralCode` to the submit
 * payload when the value is non-null.
 *
 * Public endpoint — no auth required (uses fetchWithoutRefresh +
 * publicEndpoint flags on useDataQuery, matching forgot-password.tsx).
 */
import { useEffect, useState } from "react";
import { CheckCircle2, X, Gift, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useDataQuery } from "@/lib/tanstack/dataQuery";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL;

type ResolveResponse = {
  found: boolean;
  referrerName: string | null;
  referrerType: "DRIVER" | "CUSTOMER" | null;
  referrerSubtype: "PERSONAL" | "BUSINESS" | null;
  programActive: boolean;
  /** V3.1: config-driven role matrix row for this referrer's role. */
  allows: { DRIVER: boolean; PERSONAL: boolean; BUSINESS: boolean } | null;
};

type ValidationState = "empty" | "validating" | "resolved" | "invalid" | "paused" | "not-allowed";

/**
 * V3.1 — the role this signup form CREATES (the referred party):
 *   - driver onboarding → "DRIVER"
 *   - individual (personal) signup → "PERSONAL"
 *   - dealer (business) signup → "BUSINESS"
 *
 * Whether the resolved referrer's ROLE may refer this target is decided
 * by the backend's CONFIG-DRIVEN role matrix (referralRoleMatrix — the
 * single source of truth, admin-tunable) and arrives in the resolve
 * response as `allows`. This component NEVER hardcodes the matrix — it
 * only renders the verdict, so editing the matrix in admin updates
 * every surface with no code change.
 */
type ReferralTargetRole = "DRIVER" | "PERSONAL" | "BUSINESS";

const TARGET_ROLE_LABEL: Record<ReferralTargetRole, string> = {
  DRIVER: "drivers",
  PERSONAL: "personal customers",
  BUSINESS: "business customers",
};

type Props = {
  /** Called with the validated, uppercased code when resolved, or null when empty/invalid/paused/not-allowed. */
  onChange: (code: string | null) => void;
  /** Optional controlled initial value. */
  initialValue?: string;
  /** Disable the input (e.g. when the parent form is submitting). */
  disabled?: boolean;
  /** Optional class to override the outer wrapper. */
  className?: string;
  /**
   * V3.1: which role this form's signup CREATES (DRIVER | PERSONAL |
   * BUSINESS). When set, the resolved code is checked against the
   * backend role matrix (`allows` in the resolve response) — if the
   * referrer's role can't refer this target, the input shows a red X
   * with a specific message and onChange(null) is called. Omit to skip
   * the matrix check (all referrer roles allowed).
   */
  referralTargetRole?: ReferralTargetRole;
};

export function ReferralCodeInput({
  onChange,
  initialValue = "",
  disabled = false,
  className,
  referralTargetRole,
}: Props) {
  // Local state — the raw input as the user types.
  const [inputValue, setInputValue] = useState<string>(initialValue);

  // Auto-fill from ?ref= URL param on mount (only if no initialValue provided).
  useEffect(() => {
    if (initialValue) return; // parent already provided a value — don't override
    const urlParams = new URLSearchParams(window.location.search);
    const refFromUrl = urlParams.get("ref");
    if (refFromUrl) {
      // Uppercase + trim — backend stores case-insensitively and uppercases on apply.
      setInputValue(refFromUrl.trim().toUpperCase());
    }
  }, [initialValue]);

  // Debounce — don't fire the resolve API call on every keystroke.
  // 400ms feels responsive without being chatty.
  const debouncedCode = useDebouncedValue(inputValue.trim().toUpperCase(), 400);

  // Only fire the query when the debounced code is plausibly complete
  // (≥ 4 chars — our codes are 8 chars but users may paste shorter invalid
  // values briefly). The backend's resolve endpoint is case-insensitive
  // and accepts any string, returning { found: false } for unknowns.
  const queryEnabled =
    !!debouncedCode && debouncedCode.length >= 4 && !disabled;

  const { data, isFetching, isError } = useDataQuery<ResolveResponse | null>({
    apiEndPoint: `${API_URL}/api/referrals/public/resolve/${encodeURIComponent(
      debouncedCode,
    )}`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    enabled: queryEnabled,
    queryKey: ["referral-resolve", debouncedCode],
    staleTime: 60_000, // cache resolved codes for 1 minute
  });

  // Derive the validation state from the query result.
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
      // ── ROLE MATRIX CHECK ──────────────────────────────────────
      // The code is valid + program is active. Whether THIS referrer's
      // role may refer THIS form's target role is decided by the
      // backend role matrix and arrives pre-computed as `allows` —
      // no matrix logic lives in the frontend.
      // Missing `allows` (old backend / cache) → treat as allowed.
      const allowsTarget =
        data.allows && referralTargetRole
          ? data.allows[referralTargetRole]
          : true;

      if (!allowsTarget) {
        state = "not-allowed";
      } else {
        state = "resolved";
      }
    }
  }

  // Notify the parent whenever the resolved state changes.
  // We pass the uppercased code when resolved, null otherwise.
  useEffect(() => {
    if (state === "resolved") {
      onChange(debouncedCode);
    } else {
      onChange(null);
    }
  }, [state, debouncedCode, onChange]);

  // ── Visual state ─────────────────────────────────────────────────
  const wrapperBorder = cn(
    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
    (state === "invalid" || state === "not-allowed") && "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20",
    state === "resolved" && "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10",
    state === "paused" && "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/10",
    state !== "invalid" && state !== "not-allowed" && state !== "resolved" && state !== "paused" && "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30",
  );

  const inputBorder = cn(
    "w-full h-14 pl-12 pr-12 rounded-2xl border dark:bg-slate-800/40 input-focus-ring text-sm transition-colors font-mono tracking-wider uppercase",
    (state === "invalid" || state === "not-allowed") && "border-red-400 dark:border-red-600",
    state === "resolved" && "border-emerald-400 dark:border-emerald-700",
    state === "paused" && "border-amber-400 dark:border-amber-700",
    state !== "invalid" && state !== "not-allowed" && state !== "resolved" && state !== "paused" && "border-slate-200 dark:border-slate-700",
  );

  // Right-side status icon
  const StatusIcon = () => {
    if (state === "validating") {
      return <Spinner className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />;
    }
    if (state === "resolved") {
      return <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />;
    }
    if (state === "invalid" || state === "not-allowed") {
      return <X className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />;
    }
    if (state === "paused") {
      return <AlertTriangle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />;
    }
    return null;
  };

  // Helper text below the input
  const HelperText = () => {
    if (state === "validating") {
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Checking referral code…
        </p>
      );
    }
    if (state === "resolved" && data?.referrerName) {
      return (
        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" />
          Referred by {data.referrerName}
        </p>
      );
    }
    if (state === "resolved" && !data?.referrerName) {
      return (
        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" />
          Referral code accepted
        </p>
      );
    }
    if (state === "invalid") {
      return (
        <p className="text-xs text-red-500 dark:text-red-400 font-medium">
          We couldn't find that referral code. Please double-check it.
        </p>
      );
    }
    if (state === "not-allowed") {
      // Config-driven role matrix said no — specific message from the
      // referrer's role + this form's target role.
      const referrerDesc =
        data?.referrerSubtype === "PERSONAL"
          ? "Personal customers"
          : data?.referrerSubtype === "BUSINESS"
            ? "Business customers"
            : data?.referrerType === "DRIVER"
              ? "Drivers"
              : "This referrer";
      const targetDesc = referralTargetRole
        ? TARGET_ROLE_LABEL[referralTargetRole]
        : "this type of account";
      return (
        <p className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" />
          {referrerDesc} can't refer {targetDesc} — clear the code or use a different one.
        </p>
      );
    }
    if (state === "paused") {
      return (
        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
          This referral code is valid but the referral program is currently
          paused. You can still sign up — the code won't be applied.
        </p>
      );
    }
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
        Optional — enter a friend's code to give them a referral bonus.
      </p>
    );
  };

  return (
    <div className={cn(wrapperBorder, className)}>
      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
        Referral Code (optional)
      </Label>
      <div className="relative">
        <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="ABCD2345"
          maxLength={8}
          autoComplete="off"
          disabled={disabled}
          className={inputBorder}
          aria-invalid={state === "invalid"}
        />
        <StatusIcon />
      </div>
      <HelperText />
    </div>
  );
}

export default ReferralCodeInput;
