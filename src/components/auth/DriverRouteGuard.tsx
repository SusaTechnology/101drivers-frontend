"use client";
import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  isAuthenticated,
  getUser,
} from "@/lib/tanstack/dataQuery";
import { AlertTriangle } from "lucide-react";

/**
 * CENTRAL driver access decision — owner rule: ONLY an APPROVED driver
 * whose onboarding is complete may see dashboard pages. Every other
 * driver status goes to ONE screen, the status board
 * (/driver-application-submitted), which renders each status's card and
 * specific message. This function is the single source of truth; the
 * guard wraps the /driver layout AND every standalone driver page, so
 * page-level checks can no longer drift out of sync with each other.
 *
 * Pure synchronous check — isAuthenticated/getUser are synchronous
 * localStorage reads, executed in the useState initializer during the
 * FIRST render. Authorized navigations render the page on the first
 * paint; no spinner frame ever paints between pages.
 *
 * Freshness: localStorage holds the status snapshot from login time, so
 * a mid-session status change (admin suspends the driver) is enforced by
 * the DriverLayout's server revalidation, which refreshes the stored
 * user and lands here on the next render — this guard never needs an
 * async check (that would reintroduce the flicker).
 */
type GuardState =
  | "authenticated"      // APPROVED + onboarded → render children
  | "needs_signin"       // no session → /driver-signin
  | "forbidden_role"     // session exists, not a DRIVER role → access denied
  | "needs_onboarding"   // APPROVED but onboarding incomplete → the form
  | "status_board";      // every non-approved status → the board

function computeDriverGuardAccess(): { state: GuardState; message: string } {
  // Step 1: authentication
  if (!isAuthenticated()) {
    return { state: "needs_signin", message: "" };
  }

  const user = getUser();

  // Step 2: role — an authorization question, not a status question.
  if (!user?.roles?.includes("DRIVER")) {
    return {
      state: "forbidden_role",
      message: "You don't have driver access.",
    };
  }

  // Step 3: status — the owner's rule in one place.
  if (user.driverStatus === "APPROVED") {
    // Approved: the only status with a dashboard. They must still finish
    // onboarding first — the form, not the board, is where their work is.
    return user.onboardingCompleted
      ? { state: "authenticated", message: "" }
      : { state: "needs_onboarding", message: "" };
  }

  // WAITLISTED, INVITED, PENDING, PENDING_APPROVAL, MEETING_REQUESTED,
  // ON_HOLD, SUSPENDED, REJECTED — and any future status — all land on
  // the status board, which renders each status's card and message. One
  // destination: a status added to the board needs no guard change.
  return { state: "status_board", message: "" };
}

/**
 * DriverRouteGuard wraps the protected driver pages.
 *   1. Authenticated  → otherwise redirect to /driver-signin
 *   2. DRIVER role    → otherwise the access-denied screen
 *   3. APPROVED + onboarding completed → the page renders
 *   4. APPROVED, onboarding pending → /driver-onboarding-complete?token=…
 *   5. Any other status → /driver-application-submitted (status board)
 */
export function DriverRouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  // Resolved synchronously in the useState initializer — once per guard
  // mount (once per navigation), during the first render.
  const [guard] = useState<ReturnType<typeof computeDriverGuardAccess>>(
    computeDriverGuardAccess
  );
  const guardState = guard.state;
  const statusMessage = guard.message;

  // Redirect states — render nothing while the router moves.
  useEffect(() => {
    if (guardState === "needs_signin") {
      navigate({ to: "/driver-signin" });
    } else if (guardState === "needs_onboarding") {
      const user = getUser();
      if (user?.onboardingToken) {
        navigate({
          to: "/driver-onboarding-complete",
          // routeTree typing doesn't surface the route's validateSearch
          // shape; the runtime route accepts { token } (same cast the
          // status board's Link uses).
          search: { token: user.onboardingToken } as never,
        });
      } else {
        navigate({ to: "/driver-signin" });
      }
    } else if (guardState === "status_board") {
      // The board is not wrapped by this guard and its beforeLoad only
      // redirects APPROVED drivers — no bounce-back loop.
      navigate({ to: "/driver-application-submitted" });
    }
  }, [guardState, navigate]);

  // Non-driver role: access denied (a role problem, not a status one).
  if (guardState === "forbidden_role") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
            Access Denied
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {statusMessage}
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (guardState === "authenticated") {
    return <>{children}</>;
  }

  // needs_signin / needs_onboarding / status_board — the effect above
  // owns the navigation; paint nothing meanwhile (no flicker).
  return null;
}
