"use client";
import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { isAuthenticated, getUser } from "@/lib/tanstack/dataQuery";
import { Loader2, ShieldAlert } from "lucide-react";

type AdminGuardState = "checking" | "authorized" | "needs_signin" | "forbidden";

/**
 * AdminRouteGuard wraps protected admin pages.
 * It enforces:
 *   1. Authenticated → otherwise redirect to /auth/admin-signin
 *   2. ADMIN role → otherwise redirect the user to their OWN home
 *      (driver dashboard, dealer dashboard, or landing) — never leaves
 *      them on a dead end.
 *
 * The backend remains the real authorization authority (API calls carry
 * role guards); this guard only stops the UI from rendering admin pages
 * for non-admin accounts. Uses login response data stored in
 * localStorage — no extra API calls, no loading flash beyond the check.
 *
 * Mirrors DriverRouteGuard's house pattern (component guard, no router
 * beforeLoad), so admin pages behave exactly like driver pages today.
 */
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [guardState, setGuardState] = useState<AdminGuardState>("checking");

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

    // Step 2: Check ADMIN role — authentication alone is NOT enough.
    const user = getUser();
    if (!user?.roles?.includes("ADMIN")) {
      setGuardState("forbidden");
      return;
    }

    setGuardState("authorized");
  }

  // Redirect states
  useEffect(() => {
    if (guardState === "needs_signin") {
      navigate({ to: "/auth/admin-signin" });
    } else if (guardState === "forbidden") {
      // Send the user to the dashboard that matches THEIR role — the same
      // homes the sign-in flow uses (DealerSignIn post-login navigation),
      // so a driver or customer who mistypes an admin URL just lands
      // where they belong.
      const roles = getUser()?.roles ?? [];
      if (roles.includes("DRIVER")) {
        navigate({ to: "/driver/dashboard" });
      } else if (
        roles.includes("BUSINESS_CUSTOMER") ||
        roles.includes("PRIVATE_CUSTOMER")
      ) {
        navigate({ to: "/dealer-dashboard" });
      } else {
        navigate({ to: "/" });
      }
    }
  }, [guardState, navigate]);

  // Unauthorized: spinner while redirecting (matches DriverRouteGuard UX)
  if (guardState !== "authorized") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
        {guardState === "forbidden" ? (
          <>
            <ShieldAlert className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You don't have admin access. Taking you back…
            </p>
          </>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        )}
      </div>
    );
  }

  // Authorized admin — render the page unchanged
  return <>{children}</>;
}
