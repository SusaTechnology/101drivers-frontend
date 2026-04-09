import React, { useState } from "react";
import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  MailCheck,
  Lock,
  Info,
  Menu,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setAccessToken, setUser, startSessionKeepAlive, useDataMutation } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";

export const Route = createFileRoute("/driver-signin/")({
  component: RouteComponent,
});

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

const signInSchema = z.object({
  username: z.string(),
  password: z.string().min(1, { message: "Password is required" }),
});

type SignInFormData = z.infer<typeof signInSchema>;

interface LoginResponse {
  accessToken: string;
  id: string;
  profileId: string;
  username: string;
  roles: string[];
  refreshToken?: string;
  email?: string;
  name?: string;
  customerApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  driverStatus?: "PENDING" | "APPROVED" | "SUSPENDED";
  isActive?: boolean;
}

interface ForgotPasswordPayload {
  email: string;
}

function RouteComponent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const usernameValue = watch("username");

  const loginMutation = useDataMutation<LoginResponse, SignInFormData>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/login`,
    method: "POST",
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data) => {
      const userRoles = data.roles || [];

      // Check role — only DRIVER allowed on this page
      const hasValidRole = userRoles.includes("DRIVER");
      if (!hasValidRole) {
        const roleNames = userRoles.join(", ") || "unknown";
        setLoginError(
          `You are trying to sign in as a driver, but your account is registered as ${roleNames}. Please use the correct sign-in page for your role.`
        );
        toast.error("Role mismatch. Please use the correct login page.");
        return;
      }

      // Check account active status
      if (data.isActive === false) {
        setLoginError(
          "Your account has been disabled. Please contact support for assistance."
        );
        toast.error("Account disabled. Please contact support.");
        return;
      }

      // Check driver approval status
      if (data.driverStatus) {
        const status = data.driverStatus;
        if (status === "PENDING") {
          setLoginError(
            "Your driver account is pending approval. We'll notify you by email once an administrator approves your application."
          );
          toast.error("Account pending approval.");
          return;
        }
        if (status === "SUSPENDED") {
          setLoginError(
            "Your driver account has been suspended. Please contact support for assistance."
          );
          toast.error("Account suspended.");
          return;
        }
      }

      // All checks passed
      setAccessToken(data.accessToken);
      setUser({
        id: data.id,
        username: data.username,
        profileId: data.profileId,
        roles: data.roles,
        customerApprovalStatus: data.customerApprovalStatus,
        driverStatus: data.driverStatus,
        isActive: data.isActive,
      });
      startSessionKeepAlive();
      toast.success("Login successful! Redirecting...");
      setLoginError(null);
      reset();

      setTimeout(() => {
        navigate({ to: "/driver-dashboard" });
      }, 1000);
    },
    onError: (error) => {
      setLoginError(
        //@ts-ignore
        error?.message || "Login failed. Please check your credentials."
      );
      toast.error("Login failed. Please check your credentials.");
    },
  });

  // Forgot password mutation
  const forgotPasswordMutation = useDataMutation<{ message: string }, ForgotPasswordPayload>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/forgot-password`,
    method: "POST",
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data) => {
      toast.success("Password reset email sent", {
        description: data.message || "Please check your inbox for instructions.",
      });
      //@ts-ignore
      navigate({ to: "/auth/reset-password", search: { email: usernameValue } });
    },
    onError: (error) => {
      toast.error("Failed to send reset email", {
        //@ts-ignore
        description: error.message || "Please try again later.",
      });
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setLoginError(null);
    loginMutation.mutate(data);
  };

  const handleForgotPassword = () => {
    if (!usernameValue) {
      toast.error("Please enter your email address");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(usernameValue)) {
      toast.error("Please enter a valid email address");
      return;
    }
    forgotPasswordMutation.mutate({ email: usernameValue });
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
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
              <Link to="/landing">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
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

        {/* Mobile Menu */}
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
                    to="/landing"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Back to Home
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Intro Section */}
          <div className="lg:col-span-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Car className="text-primary w-6 h-6 font-bold" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white">
                  Driver Login
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg leading-relaxed max-w-xl">
                  Log in to accept California delivery jobs and see your earnings.
                </p>
                {/* Plain text quick notes (no pills/badges) */}
                <div className="mt-6 space-y-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    California-only
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Email-first notifications
                  </p>
                </div>
              </div>
            </div>

            <CustomCard className="mt-10 bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                What you get:
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                  Be your own boss
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                  Plan your routes &amp; schedule
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                  Pick jobs, build your income
                </li>
              </ul>
            </CustomCard>
          </div>

          {/* Right: Login Form Card */}
          <div className="lg:col-span-6">
            <CustomCard className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 sm:p-10 hover-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    DRV
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    Welcome back
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Sign in to access your driver portal.
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <Lock className="text-primary w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                    Secure
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {loginError && (
                <div className="mt-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-medium">
                      {loginError}
                    </p>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-8 space-y-5"
              >
                {/* Email Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Email
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="driver@email.com"
                    className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                    disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
                    {...register("username")}
                  />
                  {errors.username && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm pr-12"
                      disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rememberMe"
                      defaultChecked
                      className="rounded border-slate-300 text-primary focus:ring-primary/20"
                      disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
                      {...register("rememberMe" as any)}
                    />
                    <Label
                      htmlFor="rememberMe"
                      className="text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Remember me
                    </Label>
                  </div>

                  <Button
                    variant="link"
                    className="text-sm font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
                  >
                    {forgotPasswordMutation.isPending ? "Sending..." : "Forgot password?"}
                  </Button>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
                  className="w-full py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2 h-14 text-base"
                >
                  {loginMutation.isPending ? (
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
                      Signing in...
                    </>
                  ) : (
                    <>
                      Log In
                      <ArrowRight className="w-5 h-5 font-bold" />
                    </>
                  )}
                </Button>

                {/* Bottom Link */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Don't have an account?{" "}
                    <Button
                      variant="link"
                      className="font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                      asChild
                      type="button"
                    >
                      <Link to="/driver-onboarding">Become a driver</Link>
                    </Button>
                  </p>

                  <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Notifications are{" "}
                    <span className="font-bold">email-first</span>. SMS is
                    optional and depends on Admin policy.
                  </p>
                </div>
              </form>
            </CustomCard>

            {/* Bottom Navigation Buttons */}
            <div className="mt-3 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold border-slate-200 dark:border-slate-800 h-12"
                asChild
                disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
              >
                <Link to="/">
                  <ArrowLeft className="w-5 h-5 text-primary" />
                  Back to Index
                </Link>
              </Button>
              <Button
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition h-12"
                asChild
                disabled={loginMutation.isPending || forgotPasswordMutation.isPending}
              >
                <Link to="/landing">
                  Go to Landing
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
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
