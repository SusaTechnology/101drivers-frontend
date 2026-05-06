"use client";
import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  isAuthenticated,
  getUser,
} from "@/lib/tanstack/dataQuery";
import { Loader2, ShieldCheck, Clock, AlertTriangle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

interface OnboardingStatus {
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  driverStatus: string;
}

type GuardState =
  | "loading"
  | "authenticated"
  | "needs_signin"
  | "needs_onboarding"
  | "pending_approval";

/**
 * DriverRouteGuard wraps protected driver pages.
 * It enforces:
 *   1. Authenticated → otherwise redirect to /driver-signin
 *   2. Driver role → otherwise redirect to /
 *   3. APPROVED status → otherwise show "pending" screen
 *   4. Onboarding completed → otherwise redirect to /driver-onboarding-complete
 */
export function DriverRouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [guardState, setGuardState] = useState<GuardState>("loading");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAccess() {
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
    if (driverStatus === "PENDING") {
      setGuardState("pending_approval");
      return;
    }
    if (driverStatus === "SUSPENDED") {
      setStatusMessage("Your driver account has been suspended. Please contact support for assistance.");
      setGuardState("needs_signin");
      return;
    }

    // Step 4: For APPROVED drivers, check onboarding status
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_URL}/api/drivers/onboarding-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setGuardState("needs_signin");
        } else {
          // On other errors (404, 500, etc.), allow through — don't block on transient failures
          setGuardState("authenticated");
        }
        return;
      }

      const status: OnboardingStatus = await res.json();

      if (status.onboardingCompleted) {
        setGuardState("authenticated");
      } else {
        setGuardState("needs_onboarding");
      }
    } catch {
      // On network error, allow through — don't block on transient failures
      setGuardState("authenticated");
    }
  }

  // Redirect states
  useEffect(() => {
    if (guardState === "needs_signin") {
      navigate({ to: "/driver-signin" });
    } else if (guardState === "needs_onboarding") {
      navigate({ to: "/driver-onboarding-complete" });
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
            Your driver account is still under review. We'll notify you by email
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
