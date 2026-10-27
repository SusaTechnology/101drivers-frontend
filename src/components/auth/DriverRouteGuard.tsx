"use client";
import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  isAuthenticated,
  getUser,
} from "@/lib/tanstack/dataQuery";
import { Clock, AlertTriangle, CheckCircle, PauseCircle } from "lucide-react";

type GuardState =
  | "authenticated"
  | "needs_signin"
  | "needs_onboarding"
  | "pending_approval"
  | "waitlisted"
  | "on_hold"
  | "invited"
  | "rejected";

/**
 * Pure synchronous access check — the exact checks the guard always ran,
 * executed during the FIRST render instead of after it (isAuthenticated/
 * getUser are synchronous localStorage reads). The old after-mount flip
 * ("loading" → real state) guaranteed a full-screen spinner paint on
 * EVERY navigation to every guarded driver page — that was the page-change
 * flicker. Authorized navigations now render the page on the first paint.
 */
function computeDriverGuardAccess(): { state: GuardState; message: string } {
  // Step 1: Check authentication
  if (!isAuthenticated()) {
    return { state: "needs_signin", message: "" };
  }

  const user = getUser();

  // Step 2: Check driver role
  if (!user?.roles?.includes("DRIVER")) {
    return {
      state: "needs_signin",
      message: "You don't have driver access.",
    };
  }

  // Step 3: Check driver status
  const driverStatus = user.driverStatus;
  if (driverStatus === 'WAITLISTED') {
    return { state: "waitlisted", message: "" };
  }
  if (driverStatus === 'ON_HOLD') {
    // Parked without rejection (driver oversupply / region not launched
    // yet). Show a calm hold screen — NOT the waitlist screen (their
    // application was received and is deliberately paused) and NOT a
    // redirect loop (previously ON_HOLD fell through every status check
    // and bounced between onboarding and sign-in).
    return { state: "on_hold", message: "" };
  }
  if (driverStatus === 'INVITED') {
    return { state: "invited", message: "" };
  }
  if (driverStatus === 'PENDING_APPROVAL' || driverStatus === 'PENDING') {
    return { state: "pending_approval", message: "" };
  }
  if (driverStatus === 'SUSPENDED') {
    return {
      state: "needs_signin",
      message:
        "Your driver account has been suspended. Please contact support for assistance.",
    };
  }
  if (driverStatus === 'REJECTED') {
    return { state: "rejected", message: "" };
  }

  // Step 4: Check onboarding using stored login data (no API call)
  if (!user.onboardingCompleted) {
    return { state: "needs_onboarding", message: "" };
  }

  // All checks passed
  return { state: "authenticated", message: "" };
}

/**
 * DriverRouteGuard wraps protected driver pages.
 * It enforces:
 *   1. Authenticated → otherwise redirect to /driver-signin
 *   2. Driver role → otherwise redirect to /
 *   3. APPROVED status → otherwise show "pending" screen
 *   4. Onboarding completed → otherwise redirect to /driver-onboarding-complete?token=...
 *
 * Uses login response data (stored in localStorage) — no extra API calls.
 */
export function DriverRouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  // Resolved synchronously in the useState initializer — same cadence as
  // the old useEffect check (once per guard mount = once per navigation),
  // just during the first render so no spinner frame ever paints between
  // pages. No setter is needed: the state is final for this mount.
  const [guard] = useState<ReturnType<typeof computeDriverGuardAccess>>(
    computeDriverGuardAccess
  );
  const guardState = guard.state;
  const statusMessage = guard.message;

  // Redirect states
  useEffect(() => {
    if (guardState === "needs_signin") {
      navigate({ to: "/driver-signin" });
    } else if (guardState === "needs_onboarding") {
      const user = getUser();
      if (user?.onboardingToken) {
        navigate({
          to: "/driver-onboarding-complete",
          search: { token: user.onboardingToken },
        });
      } else {
        navigate({ to: "/driver-signin" });
      }
    }
  }, [guardState, navigate]);

  // Pending approval screen
  if (guardState === "pending_approval") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
            Application Pending Approval
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Your application is under review. We'll notify you by email
            once an administrator approves your application.
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Waitlisted screen
  if (guardState === "waitlisted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-slate-500 dark:text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
            You're on the Waitlist
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Your account has been created and is on the waitlist. An administrator
            will review your profile and invite you to complete your application
            when a spot opens up.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // On Hold screen — held without rejection; the application stays in the
  // system and the admin team will revisit it when the region opens up.
  if (guardState === "on_hold") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
            <PauseCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
            Application On Hold
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Your application has been received and is complete — we've simply
            paused new activations in your area for now. Our team will reach
            out when we're ready to move forward; no action is needed from
            you in the meantime.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Invited screen
  if (guardState === "invited") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-sky-600 dark:text-sky-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
            You've Been Invited!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Congratulations! An administrator has invited you to complete your
            driver application. You will be redirected to continue the process.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Rejected screen
  if (guardState === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
            Application Not Approved
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Your driver application was not approved. Please contact support for
            more information.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Error / non-driver
  if (statusMessage && (guardState === "needs_signin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center">
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

  // Redirecting states — show nothing (useEffect handles redirect)
  if (guardState === "needs_signin" || guardState === "needs_onboarding") {
    return null;
  }

  // Authenticated and onboarding completed — render children
  return <>{children}</>;
}
