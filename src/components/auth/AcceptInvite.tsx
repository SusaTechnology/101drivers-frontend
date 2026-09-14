// components/auth/AcceptInvite.tsx
// Admin invite acceptance page — opens from the single-use setup link
// emailed to newly invited administrators (no password is ever shared
// by chat; the invitee sets their own password here).
import React, { useState, useRef } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Lock,
  Shield,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDataQuery, useDataMutation } from "@/lib/tanstack/dataQuery";
import { cn } from "@/lib/utils";

// Custom Card component (same as in DealerSignIn / ResetPassword)
function CustomCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border bg-card p-6 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Same password policy as the reset-password form
const acceptInviteSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

interface AcceptInvitePayload {
  token: string;
  password: string;
}

export function AcceptInvite() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auth/accept-invite' });
  const token = search?.token || "";

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Chrome autofill doesn't always trigger React events — read DOM directly
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // ==================== TOKEN VALIDATION (page load) ====================

  const {
    data: inviteInfo,
    isLoading: validating,
    isError: tokenInvalid,
    error: tokenError,
  } = useDataQuery<{ email: string; fullName: string | null }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/accept-invite?token=${encodeURIComponent(token)}`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    staleTime: 0,
    enabled: !!token,
    queryKey: ['accept-invite-validate', token],
  });

  // ==================== ACCEPT (set password) ====================

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const watchNewPassword = watch("newPassword");
  const watchConfirmPassword = watch("confirmPassword");

  // Live strength checks (same as reset-password page)
  const passwordChecks = {
    minLength: (watchNewPassword?.length || 0) >= 8,
    hasUppercase: /[A-Z]/.test(watchNewPassword || ''),
    hasLowercase: /[a-z]/.test(watchNewPassword || ''),
    hasNumber: /[0-9]/.test(watchNewPassword || ''),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(watchNewPassword || ''),
    hasMatch: watchNewPassword && watchConfirmPassword && watchNewPassword === watchConfirmPassword,
  };

  const acceptInviteMutation = useDataMutation<
    { success: boolean; email: string },
    AcceptInvitePayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/accept-invite`,
    method: "POST",
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: () => {
      setAccepted(true);
      reset();
      toast.success("Password set successfully", {
        description: "Your admin account is ready. Redirecting to sign in...",
      });
      setTimeout(() => {
        navigate({ to: "/auth/admin-signin" });
      }, 2500);
    },
    onError: (error) => {
      toast.error("Failed to set password", {
        description: error.message || "The invite link may have expired. Ask an administrator to resend it.",
      });
    },
  });

  const onSubmit = (data: AcceptInviteFormData) => {
    // If Chrome autofilled but React didn't capture it, read from DOM directly
    const pwDomValue = newPasswordRef.current?.value;

    acceptInviteMutation.mutate({
      token,
      password: pwDomValue || data.newPassword,
    });
  };

  // Chrome autofill can fill these inputs WITHOUT firing React change
  // events, so react-hook-form's copy can stay stale (often empty) even
  // though the fields visibly hold a full password. Validation used to run
  // against that stale copy — a perfectly good autofilled password was
  // rejected with the false "Password must be at least 8 characters" error
  // and the form could never be submitted. The DOM value is always what
  // the user sees, so sync it into the form BEFORE the policy check runs.
  const syncDomAndSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setValue("newPassword", newPasswordRef.current?.value ?? "", {
      shouldDirty: true,
    });
    setValue("confirmPassword", confirmPasswordRef.current?.value ?? "", {
      shouldDirty: true,
    });
    handleSubmit(onSubmit)(e);
  };

  // ==================== RENDER ====================

  const invalidMessage =
    (tokenError as any)?.message ||
    "This invite link is not valid. It may have expired, already been used, or been replaced by a newer one.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="font-black text-slate-950 text-sm">101</span>
            </div>
            <span className="font-black text-lg text-slate-900 dark:text-white">
              101 Drivers
            </span>
          </Link>
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Shield className="text-primary w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
              Secure Setup
            </span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[600px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <CustomCard className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 sm:p-10 hover-lift">
          {/* ==================== SUCCESS ==================== */}
          {accepted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-5">
                You're all set!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Your admin password has been saved. Redirecting you to the
                sign-in page in a moment...
              </p>
              <Button
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-primary text-primary-foreground hover:opacity-95 transition"
                asChild
              >
                <a href="/auth/admin-signin">
                  Go to Sign In
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </a>
              </Button>
            </div>
          ) : validating ? (
            /* ==================== VALIDATING ==================== */
            <div className="text-center py-10">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
                Validating your invitation...
              </p>
            </div>
          ) : !token || tokenInvalid ? (
            /* ==================== INVALID LINK ==================== */
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-5">
                Invitation link issue
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 max-w-sm mx-auto">
                {invalidMessage}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
                Ask an existing administrator to resend the invite from
                Admin &gt; Users, then open the newest email.
              </p>
            </div>
          ) : (
            /* ==================== FORM ==================== */
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    ADMIN INVITE
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    Set up your admin account
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Welcome{inviteInfo?.fullName ? `, ${inviteInfo.fullName}` : ""}!
                    Choose a password for{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {inviteInfo?.email}
                    </span>
                    .
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <Mail className="text-primary w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                    Invited
                  </span>
                </div>
              </div>

              <form onSubmit={syncDomAndSubmit} className="mt-8 space-y-5">
                {/* New Password */}
                <div className="space-y-2">
                  <Label
                    htmlFor="newPassword"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                      disabled={acceptInviteMutation.isPending}
                      ref={(e) => {
                        newPasswordRef.current = e;
                        register("newPassword").ref(e);
                      }}
                      onChange={(e) => {
                        register("newPassword").onChange(e);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                      disabled={acceptInviteMutation.isPending}
                      ref={(e) => {
                        confirmPasswordRef.current = e;
                        register("confirmPassword").ref(e);
                      }}
                      onChange={(e) => {
                        register("confirmPassword").onChange(e);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* Password requirements checklist */}
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { ok: passwordChecks.minLength, label: "8+ characters" },
                    { ok: passwordChecks.hasUppercase, label: "Uppercase letter" },
                    { ok: passwordChecks.hasLowercase, label: "Lowercase letter" },
                    { ok: passwordChecks.hasNumber, label: "Number" },
                    { ok: passwordChecks.hasSpecial, label: "Special character" },
                    { ok: passwordChecks.hasMatch, label: "Passwords match" },
                  ].map((check) => (
                    <div
                      key={check.label}
                      className={cn(
                        "flex items-center gap-1.5",
                        check.ok ? "text-emerald-600" : "text-slate-400"
                      )}
                    >
                      <CheckCircle2
                        className={cn(
                          "w-3.5 h-3.5",
                          check.ok ? "opacity-100" : "opacity-40"
                        )}
                      />
                      {check.label}
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={acceptInviteMutation.isPending}
                  className="w-full h-14 rounded-2xl text-sm font-black bg-primary text-primary-foreground hover:opacity-95 transition"
                >
                  {acceptInviteMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Set Password & Activate Account"
                  )}
                </Button>

                <p className="text-[11px] text-slate-500 text-center">
                  This link is single-use and expires 48 hours after it was sent.
                </p>
              </form>
            </>
          )}
        </CustomCard>
      </main>
    </div>
  );
}
