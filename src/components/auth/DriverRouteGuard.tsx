"use client";
import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  isAuthenticated,
  getUser,
} from "@/lib/tanstack/dataQuery";
import { Loader2, Clock, AlertTriangle, CheckCircle } from "lucide-react";

type GuardState =
  | "loading"
  | "authenticated"
  | "needs_signin"
  | "needs_onboarding"
  | "pending_approval"
  | "waitlisted"
  | "invited"
  | "rejected";

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
  const [guardState, setGuardState] = useState<GuardState>("loading");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function checkAccess() {
    // Step 1: Check authentication
    if (!isAuthenticated()) {
      setGuardState("needs_signin");
      return;
    }

    const user = getUser();

    // Step 2: Check driver role
    if (!user?.roles?.includes("DRIVER")) {
      setStatusMessage("You don't have driver access.");
      setGuardState("needs_signin");
      return;
    }

    // Step 3: Check driver status
    const driverStatus = user.driverStatus;
    if (driverStatus === 'WAITLISTED') {
      setGuardState("waitlisted");
      return;
    }
    if (driverStatus === 'INVITED') {
      setGuardState("invited");
      return;
    }
    if (driverStatus === 'PENDING_APPROVAL' || driverStatus === 'PENDING') {
      setGuardState("pending_approval");
      return;
    }
    if (driverStatus === 'SUSPENDED') {
      setStatusMessage("Your driver account has been suspended. Please contact support for assistance.");
      setGuardState("needs_signin");
      return;
    }
    if (driverStatus === 'REJECTED') {
      setGuardState("rejected");
      return;
    }

    // Step 4: Check onboarding using stored login data (no API call)
    if (!user.onboardingCompleted) {
      setGuardState("needs_onboarding");
      return;
    }

    // All checks passed
    setGuardState("authenticated");
  }

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

  // Loading spinner
  if (guardState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-slate-500 font-medium">Checking access...</p>
        </div>
      </div>
    );
  }

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
            onClick={() => navigate({ to: "/driver-signin" })}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Back to Sign In
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
            onClick={() => navigate({ to: "/driver-signin" })}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Back to Sign In
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
            driver application. Please sign in to continue.
          </p>
          <button
            onClick={() => navigate({ to: "/driver-signin" })}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-sky-500 hover:bg-sky-600 text-white transition"
          >
            Sign In to Continue
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
            onClick={() => navigate({ to: "/" })}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Go Home
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
