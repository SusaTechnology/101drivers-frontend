// @ts-nocheck
import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  Key,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Menu,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDataMutation } from "@/lib/tanstack/dataQuery";

// Custom Card component (same as in DealerSignIn)
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

// Validation schema
const resetPasswordSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    verificationToken: z
      .string()
      .min(6, "OTP must be 6 digits")
      .max(6, "OTP must be 6 digits")
      .regex(/^\d+$/, "OTP must contain only numbers"),
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

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordPayload {
  email: string;
  verificationToken: string;
  newPassword: string;
}

export function ResetPassword() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
      verificationToken: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useDataMutation<
    { message: string },
    ResetPasswordPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/reset-password`,
    method: "POST",
    fetchWithoutRefresh: true,
    onSuccess: (data) => {
      toast.success("Password reset successfully", {
        description: data.message || "You can now sign in with your new password.",
      });
      reset();
      // Redirect to sign-in page after 1.5 seconds
      setTimeout(() => {
        navigate({ to: "/auth/dealer-signin" }); // or driver? but we'll go to generic signin? Actually we might want to preserve userType? For now generic.
      }, 1500);
    },
    onError: (error) => {
      toast.error("Failed to reset password", {
        description: error.message || "Please check your details and try again.",
      });
    },
  });

  const onSubmit = (data: ResetPasswordFormData) => {
    const payload: ResetPasswordPayload = {
      email: data.email,
      verificationToken: data.verificationToken,
      newPassword: data.newPassword,
    };
    resetPasswordMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header (similar to DealerSignIn) */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200 dark:border-slate-800">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Link
                to="/landing"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Landing
              </Link>
              <Link
                to="/about"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                About
              </Link>
              <Link
                to="/privacy"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Terms
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              asChild
            >
              <Link to="/auth/dealer-signin">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top">
            <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
              <Link
                to="/landing"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Landing
              </Link>
              <Link
                to="/about"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/privacy"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Terms
              </Link>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <Button
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-primary text-primary-foreground hover:opacity-95 transition"
                  asChild
                >
                  <Link
                    to="/auth/dealer-signin"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Back to Sign In
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-[600px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <CustomCard className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 sm:p-10 hover-lift">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                RESET PASSWORD
              </p>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                Create a new password
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Enter your email, the OTP you received, and your new password.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <Key className="text-primary w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                Secure
              </span>
            </div>
          </div>

          {/* Error/Success could be displayed here if needed */}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-black uppercase tracking-widest text-slate-500"
              >
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                  disabled={resetPasswordMutation.isPending}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* OTP */}
            <div className="space-y-2">
              <Label
                htmlFor="verificationToken"
                className="text-xs font-black uppercase tracking-widest text-slate-500"
              >
                OTP Code
              </Label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="verificationToken"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  className="h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm font-mono tracking-widest"
                  disabled={resetPasswordMutation.isPending}
                  {...register("verificationToken")}
                />
              </div>
              {errors.verificationToken && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.verificationToken.message}
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                Enter the 6-digit code sent to your email.
              </p>
            </div>

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
                  placeholder="••••••••"
                  className="h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                  disabled={resetPasswordMutation.isPending}
                  {...register("newPassword")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={resetPasswordMutation.isPending}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.newPassword.message}
                </p>
              )}
              <p className="text-[10px] text-slate-500">
                Must be at least 8 characters with uppercase, lowercase, number, and special character.
              </p>
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
                  placeholder="••••••••"
                  className="h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                  disabled={resetPasswordMutation.isPending}
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={resetPasswordMutation.isPending}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Info note */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
              <Info className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                After resetting your password, you'll be redirected to sign in with your new credentials.
              </p>
            </div>

            <Button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="w-full py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2 h-14 text-base"
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Resetting...
                </>
              ) : (
                <>
                  Reset Password
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                Remember your password?{" "}
                <Button
                  variant="link"
                  className="font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                  asChild
                  type="button"
                >
                  <Link to="/auth/dealer-signin">Sign in</Link>
                </Button>
              </p>
            </div>
          </form>
        </CustomCard>

        {/* Back to home link */}
        <div className="mt-6 flex justify-center">
          <Button
            variant="link"
            className="text-sm font-extrabold text-primary hover:opacity-90 transition"
            asChild
          >
  
          </Button>
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                California-only operations • Email-first notifications
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}