import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Store,
  MapPin,
  MailCheck,
  Lock,
  Info,
  Menu,
  X,
  AlertCircle,
  Car,
  EyeOff,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setAccessToken, setUser, startSessionKeepAlive } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";
import { useDataMutation } from "@/lib/tanstack/dataQuery";

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
  // Approval status for customers and drivers
  customerApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  driverStatus?: 'PENDING' | 'APPROVED' | 'SUSPENDED';
  // User active status
  isActive?: boolean;
}

// Forgot password payload
interface ForgotPasswordPayload {
  email: string;
}

export function DealerSignIn({
  userType = "dealer",
}: {
  userType?: "dealer" | "driver" | "admin";
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const isDealer = userType === "dealer";
  const isDriver = userType === "driver";
  const isAdmin = userType === "admin";

  // For dealers, we accept both BUSINESS_CUSTOMER and PRIVATE_CUSTOMER roles
  // Private customers (individuals) use the same signin page when coming from quote-details
  const expectedRoleMap: Record<string, string | string[]> = {
    dealer: ["BUSINESS_CUSTOMER", "PRIVATE_CUSTOMER"],
    driver: "DRIVER",
    admin: "ADMIN",
  };
  const expectedRole = expectedRoleMap[userType];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const usernameValue = watch("username"); // Get current username input

  const loginMutation = useDataMutation<LoginResponse, SignInFormData>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/login`,
    method: "POST",
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data) => {
      const userRoles = data.roles || [];
      
      // Check 1: Role mismatch
      // For dealers, check if user has either BUSINESS_CUSTOMER or PRIVATE_CUSTOMER role
      const allowedRoles = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
      const hasValidRole = userRoles.some((role: string) => allowedRoles.includes(role));
      
      if (!hasValidRole) {
        const roleNames = userRoles.join(', ') || 'unknown';
        setLoginError(
          `You are trying to sign in as ${userType}, but your account is registered as ${roleNames}. Please use the correct sign‑in page for your role.`
        );
        toast.error("Role mismatch. Please check your credentials or use the correct login page.");
        return;
      }
      
      // Determine the actual customer type for conditional logic
      const isBusinessCustomer = userRoles.includes('BUSINESS_CUSTOMER');
      const isPrivateCustomer = userRoles.includes('PRIVATE_CUSTOMER');

      // Check 2: User account active status (if provided by backend)
      if (data.isActive === false) {
        setLoginError(
          "Your account has been disabled. Please contact support for assistance."
        );
        toast.error("Account disabled. Please contact support.");
        return;
      }

      // Check 3: Approval status for BUSINESS_CUSTOMER only (not PRIVATE_CUSTOMER)
      // Individual/Private customers don't need approval
      if (isDealer && isBusinessCustomer && data.customerApprovalStatus) {
        const status = data.customerApprovalStatus;
        if (status === 'PENDING') {
          setLoginError(
            "Your dealer account is pending approval. We'll notify you by email once an administrator reviews your application."
          );
          toast.error("Account pending approval.");
          return;
        }
        if (status === 'REJECTED') {
          setLoginError(
            "Your dealer account application was not approved. Please contact support for more information."
          );
          toast.error("Account not approved.");
          return;
        }
        if (status === 'SUSPENDED') {
          setLoginError(
            "Your dealer account has been suspended. Please contact support for assistance."
          );
          toast.error("Account suspended.");
          return;
        }
      }

      // Check 4: Approval status for drivers
      if (isDriver && data.driverStatus) {
        const status = data.driverStatus;
        if (status === 'PENDING') {
          setLoginError(
            "Your driver account is pending approval. We'll notify you by email once an administrator approves your application."
          );
          toast.error("Account pending approval.");
          return;
        }
        if (status === 'SUSPENDED') {
          setLoginError(
            "Your driver account has been suspended. Please contact support for assistance."
          );
          toast.error("Account suspended.");
          return;
        }
      }

      // All checks passed - proceed with login
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
      // Start session keep-alive for persistent login
      startSessionKeepAlive();
      toast.success("Login successful! Redirecting...");
      setLoginError(null);
      reset();

      setTimeout(() => {
        // Both BUSINESS_CUSTOMER and PRIVATE_CUSTOMER go to dealer-dashboard
        // (the dashboard adapts based on customer type)
        if (userType === "dealer") {
          navigate({ to: "/dealer-dashboard" });
        } else if (userType === "driver") {
          navigate({ to: "/driver-dashboard" });
        } else {
          navigate({ to: "/admin-dashboard" });
        }
      }, 1000);
    },
    onError: (error) => {
      setLoginError(
        //@ts-ignore
        error?.message || "Login failed. Please check your credentials.",
      );
      toast.error("Login failed. Please check your credentials.");
    },
  });

  // Forgot password mutation
  const forgotPasswordMutation = useDataMutation<{ message: string }, ForgotPasswordPayload>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/forgot-password`,
    method: "POST",
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data) => {
      toast.success("Password reset email sent", {
        description: data.message || "Please check your inbox for instructions.",
      });
      navigate({ to: "/auth/reset-password" });
    },
    onError: (error) => {
      toast.error("Failed to send reset email", {
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
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(usernameValue)) {
      toast.error("Please enter a valid email address");
      return;
    }
    forgotPasswordMutation.mutate({ email: usernameValue });
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header (unchanged) */}
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

        {/* Mobile Menu (unchanged) */}
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
          {/* Left: Intro Section (unchanged) */}
          <div className="lg:col-span-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                {isAdmin ? (
                  <Lock className="text-primary w-6 h-6 font-bold" />
                ) : isDealer ? (
                  <Store className="text-primary w-6 h-6 font-bold" />
                ) : (
                  <Car className="text-primary w-6 h-6 font-bold" />
                )}
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white">
                  {isAdmin ? "Admin Sign In" : isDealer ? "Customer Sign In" : "Driver Sign In"}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg leading-relaxed max-w-xl">
                  {isAdmin ? (
                    "Manage platform users, monitor operations, and configure system settings."
                  ) : isDealer ? (
                    "Manage deliveries, track status, and review compliance proofs."
                  ) : (
                    "Accept delivery jobs, upload proofs, and track earnings."
                  )}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-slate-800 dark:text-slate-200 text-xs font-extrabold">
                    <MapPin className="text-primary w-4 h-4" />
                    California-only operations
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold">
                    <MailCheck className="text-primary w-4 h-4" />
                    Email-first notifications
                  </div>
                </div>
              </div>
            </div>

            <CustomCard className="mt-10 bg-white/70 dark:bg-slate-900/40 border border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                What you can do as {isAdmin ? "an Admin" : isDealer ? "a Customer" : "a Driver"}
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                {isAdmin ? (
                  <>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Manage all user accounts (dealers, drivers) and their permissions
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Monitor platform-wide operations and delivery analytics
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Configure system settings, notification preferences, and compliance rules
                    </li>
                  </>
                ) : isDealer ? (
                  <>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Create delivery requests for customers or inventory moves
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Track status updates and receive email notifications (SMS optional if enabled)
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Review VIN last-4 verification, photos, odometer start/end, and trip report proofs
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Accept delivery jobs based on availability and location
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Upload VIN verification, photos, and odometer readings
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                      Track earnings and delivery history with detailed trip reports
                    </li>
                  </>
                )}
              </ul>
            </CustomCard>
          </div>

          {/* Right: Sign-in Form */}
          <div className="lg:col-span-6">
            <CustomCard className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 sm:p-10 hover-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    {isAdmin ? "ADMIN" : isDealer ? "CUST" : "DRV"}
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    {isAdmin ? "Welcome back, Admin" : isDealer ? "Welcome back" : "Welcome back, Driver"}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {isAdmin ? (
                      "Sign in to access the admin dashboard."
                    ) : isDealer ? (
                      "Sign in to access your dashboard."
                    ) : (
                      "Sign in to access your driver portal."
                    )}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <Lock className="text-primary w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                    Secure
                  </span>
                </div>
              </div>

              {/* Error Display (unchanged) */}
              {loginError && (
                <div className="mt-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-medium ">
                      {loginError}
                    </p>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-8 space-y-5"
              >
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    {/* {isAdmin ? "Email or Username" : isDealer ? "Business Name" : "Email or Username"} */}
                    Email
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder={
                      isAdmin ? "admin@101drivers.com" : isDealer ? "dealer@business.com" : "driver@email.com"
                    }
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

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rememberMe"
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

                  {/* Forgot password button - now sends request */}
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
                      Sign In {isAdmin ? "as Admin" : isDealer ? "" : "as Driver"}
                      <ArrowRight className="w-5 h-5 font-bold" />
                    </>
                  )}
                </Button>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {!isAdmin && "Don't have an account? "}
                    {isAdmin ? (
                      <span className="text-xs text-slate-500">Admin accounts are created by system administrators.</span>
                    ) : isDealer ? (
                      <Button
                        variant="link"
                        className="font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                        asChild
                        type="button"
                      >
                        <Link to="/auth/dealer-signup">
                          Create dealer account
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="link"
                        className="font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                        asChild
                        type="button"
                      >
                        <Link to="/driver-onboarding">Become a driver</Link>
                      </Button>
                    )}
                  </p>

                  <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Notifications are{" "}
                    <span className="font-bold">email-first</span>. SMS is
                    optional and depends on Admin policy.
                  </p>
                </div>
              </form>
            </CustomCard>

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