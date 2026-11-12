// SocialAuthButtons — "Continue with …" buttons for the Better Auth
// providers (drivers only). Only providers that are actually configured on
// the backend render (GET /api/auth/ba/providers returns the live,
// secret-free map) — an unconfigured provider can never appear in the UI.
// Sign-in and first-time registration are the same action for Better Auth
// social flows: the provider authorizes, the backend creates/links the
// identity, and /auth/social-callback routes by the resulting state.

import { useEffect, useState } from "react";
import { authClient } from "@/lib/betterAuth/auth-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type ProviderId = "google" | "microsoft" | "apple" | "yahoo";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple",
  yahoo: "Yahoo",
};

const PROVIDER_STYLES: Record<ProviderId, string> = {
  google: "border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800",
  microsoft: "border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800",
  apple: "border-slate-800 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-200",
  yahoo: "border-purple-500 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900/20",
};

interface SocialAuthButtonsProps {
  /** Where Better Auth should land the browser after the provider round-trip. */
  callbackURL: string;
  className?: string;
}

export function SocialAuthButtons({ callbackURL, className }: SocialAuthButtonsProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);
  const [pending, setPending] = useState<ProviderId | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.VITE_API_URL}/api/auth/ba/providers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setEnabled(data ?? {});
      })
      .catch(() => {
        if (!cancelled) setEnabled({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (enabled && !Object.values(enabled).some(Boolean)) {
    // No social provider configured on the backend — render nothing rather
    // than a section of dead buttons.
    return null;
  }

  const signInWith = async (provider: ProviderId) => {
    setPending(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL,
      });
      // On success Better Auth has already redirected the browser — this
      // line only runs if the redirect was blocked.
    } catch {
      setPending(null);
      toast.error("Could not start the sign-in. Please try again.");
    }
  };

  const order: ProviderId[] = ["google", "microsoft", "apple", "yahoo"];

  return (
    <div className={className}>
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background-light dark:bg-background-dark px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            or continue with
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {order
          .filter((p) => enabled?.[p])
          .map((p) => (
            <button
              key={p}
              type="button"
              disabled={pending !== null}
              onClick={() => signInWith(p)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition disabled:opacity-60 ${PROVIDER_STYLES[p]}`}
            >
              {pending === p ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {PROVIDER_LABELS[p]}
            </button>
          ))}
      </div>
      <p className="mt-2.5 text-center text-[11px] leading-snug text-slate-400">
        Sign-up and sign-in are the same tap — we detect it automatically.
      </p>
    </div>
  );
}
