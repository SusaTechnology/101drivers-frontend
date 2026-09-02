/**
 * CustomizeCodeDialog — lets the user customize their auto-generated
 * referral code to something readable like "JOESGARAGE".
 *
 * Features:
 *   - Input pre-filled with the current code
 *   - Live validation (debounced 400ms):
 *     - Format check: 4-16 chars, letters + digits 2-9 only (no 0 or 1)
 *     - Uniqueness check: calls GET /api/referrals/public/resolve/:code
 *       — if found=false, the code is available
 *   - Input border turns:
 *     - Gray (default, while typing/format invalid)
 *     - Amber (while checking uniqueness)
 *     - Green (code is valid + unique — submit button turns green)
 *     - Red (code is already taken or format is invalid)
 *   - Submit button is disabled until the code is green
 *   - On submit: calls POST /api/referrals/my-customer-referral-code
 *     or POST /api/referrals/my-driver-referral-code (depending on type)
 *   - Once set, the code is locked server-side — can't be changed again
 *
 * Used in:
 *   - ReferralCodeCard (dealer dashboard) — referrerType="CUSTOMER"
 *   - driver-wallet — referrerType="DRIVER"
 */
import { useState, useMemo, useCallback } from "react";
import { Gift, Check, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDataQuery, useDataMutation } from "@/lib/tanstack/dataQuery";
import { useDebouncedValue } from "@/hooks/useDebounce";

const API_URL = import.meta.env.VITE_API_URL;

// Client-side format validation — mirrors the backend's custom code rules
const CUSTOM_CODE_REGEX = /^[A-Za-z2-9]{4,16}$/;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current referral code (pre-fills the input). */
  currentCode: string;
  /** Which type of referrer — determines which POST endpoint to call. */
  referrerType: "DRIVER" | "CUSTOMER";
  /** Called after a successful update — parent should refetch the code. */
  onSuccess: () => void;
};

type ValidationState = "idle" | "checking" | "available" | "taken" | "invalid" | "same";

export function CustomizeCodeDialog({
  open,
  onOpenChange,
  currentCode,
  referrerType,
  onSuccess,
}: Props) {
  const [inputValue, setInputValue] = useState(currentCode);
  const debouncedCode = useDebouncedValue(inputValue.trim().toUpperCase(), 400);

  // Reset input to current code when dialog opens
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setInputValue(currentCode);
    }
    onOpenChange(open);
  }, [currentCode, onOpenChange]);

  // Live uniqueness check via the public resolve endpoint
  // If found=false → the code is available (no one has it)
  const upperCode = useMemo(() => inputValue.trim().toUpperCase(), [inputValue]);
  const isSameAsCurrent = upperCode === currentCode.toUpperCase();
  const formatValid = CUSTOM_CODE_REGEX.test(upperCode);

  const { data: resolveData, isFetching } = useDataQuery<{ found: boolean } | null>({
    apiEndPoint: `${API_URL}/api/referrals/public/resolve/${encodeURIComponent(debouncedCode)}`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    enabled: !!debouncedCode && debouncedCode.length >= 4 && !isSameAsCurrent,
    queryKey: ["customize-code-check", debouncedCode],
    staleTime: 30_000,
  });

  // Derive validation state
  let validationState: ValidationState = "idle";
  if (!inputValue.trim()) {
    validationState = "idle";
  } else if (isSameAsCurrent) {
    validationState = "same";
  } else if (!formatValid) {
    validationState = "invalid";
  } else if (upperCode !== debouncedCode) {
    // Still typing — debounce hasn't fired yet
    validationState = "checking";
  } else if (isFetching) {
    validationState = "checking";
  } else if (resolveData?.found === false) {
    validationState = "available";
  } else if (resolveData?.found === true) {
    validationState = "taken";
  }

  const canSubmit = validationState === "available";

  // Mutation to set the custom code
  const endpoint =
    referrerType === "DRIVER"
      ? `${API_URL}/api/referrals/my-driver-referral-code`
      : `${API_URL}/api/referrals/my-customer-referral-code`;

  const setCodeMutation = useDataMutation<{ referralCode: string }, { referralCode: string }>({
    apiEndPoint: endpoint,
    method: "POST",
    onSuccess: (data) => {
      toast.success("Referral code updated!", {
        description: `Your code is now ${data.referralCode}. It's locked — you can't change it again.`,
        duration: 5000,
      });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to set code", { description: error.message });
    },
  });

  const handleSubmit = () => {
    if (!canSubmit) return;
    setCodeMutation.mutate({ referralCode: upperCode });
  };

  // ── Visual state ──
  const inputBorder = (() => {
    switch (validationState) {
      case "available": return "border-emerald-400 dark:border-emerald-600";
      case "taken": return "border-red-400 dark:border-red-600";
      case "invalid": return "border-red-400 dark:border-red-600";
      case "checking": return "border-amber-400 dark:border-amber-600";
      case "same": return "border-slate-300 dark:border-slate-600";
      default: return "border-slate-200 dark:border-slate-700";
    }
  })();

  const helperText = (() => {
    switch (validationState) {
      case "available":
        return { text: "Code is available!", color: "text-emerald-600 dark:text-emerald-400" };
      case "taken":
        return { text: "This code is already taken. Try another.", color: "text-red-500" };
      case "invalid":
        return { text: "4-16 characters, letters + digits 2-9 only (no 0 or 1).", color: "text-red-500" };
      case "checking":
        return { text: "Checking availability…", color: "text-amber-600 dark:text-amber-400" };
      case "same":
        return { text: "This is your current code.", color: "text-slate-400" };
      default:
        return { text: "4-16 characters, letters + digits 2-9 only (no 0 or 1).", color: "text-slate-400" };
    }
  })();

  const StatusIcon = () => {
    if (validationState === "checking") {
      return <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />;
    }
    if (validationState === "available") {
      return <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />;
    }
    if (validationState === "taken" || validationState === "invalid") {
      return <X className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-500" />
            Customize Your Referral Code
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Pick a memorable code like "JOESGARAGE" or "ACME2026". This is a one-time
            change — once set, the code is locked and can't be changed again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Your referral code
            </Label>
            <div className="relative">
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter your custom code…"
                maxLength={16}
                autoComplete="off"
                className={`h-12 rounded-2xl pr-10 font-mono tracking-wider uppercase transition-colors ${inputBorder}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) handleSubmit();
                }}
              />
              <StatusIcon />
            </div>
            <p className={`text-xs font-medium ${helperText.color}`}>
              {helperText.text}
            </p>
          </div>

          {/* Warning about one-time lock */}
          <div className="flex gap-2 items-start p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Once you set a custom code, it's permanently locked. You won't be able
              to change it again. Double-check the spelling before submitting.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || setCodeMutation.isPending}
            className={`rounded-2xl font-extrabold transition ${
              canSubmit
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
          >
            {setCodeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                Setting…
              </>
            ) : canSubmit ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Lock in this code
              </>
            ) : (
              "Lock in this code"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomizeCodeDialog;
