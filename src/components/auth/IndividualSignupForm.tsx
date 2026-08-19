//@ts-nocheck
/**
 * IndividualSignupForm — signup form for personal (private) customers.
 *
 * This is a slimmed-down version of DealerSignupForm that collects only
 * the fields a personal customer needs:
 *   • Full name
 *   • Email (login)
 *   • Phone
 *   • Password + confirm
 *   • Terms acceptance
 *   • OTP email verification (same two-step pattern as dealer signup)
 *
 * No business fields (businessName, businessPlaceId, etc.).
 *
 * On success, the backend issues tokens (auto-login) and the user is
 * redirected to /individual-dashboard.
 *
 * Reuses: Button, Input, Card, Label, PolicySheet, toast, useDataMutation
 * — same UI primitives as DealerSignupForm for visual consistency.
 */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User as Person,
  Phone,
  Mail,
  Lock,
  CheckCircle,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  ArrowRight,
  LogIn as LoginIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDataMutation, setUser } from "@/lib/tanstack/dataQuery";
import PolicySheet from "@/components/shared/PolicySheet";

// ── Form schema ─────────────────────────────────────────────────────────
const individualSignupSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    password: z
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
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type IndividualSignupFormData = z.infer<typeof individualSignupSchema>;

// ── Payload types ───────────────────────────────────────────────────────
interface IndividualSignupPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface IndividualSignupPayloadWithOtp extends IndividualSignupPayload {
  verificationToken: string;
}

// ── Component ───────────────────────────────────────────────────────────
export function IndividualSignupForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPolicySheet, setShowPolicySheet] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpFocused, setOtpFocused] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpAttempted, setOtpAttempted] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [pendingSignupData, setPendingSignupData] =
    useState<IndividualSignupPayload | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<IndividualSignupFormData>({
    resolver: zodResolver(individualSignupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const acceptTerms = watch("acceptTerms");

  // ── Mutations ────────────────────────────────────────────────────────
  // Step 1: send OTP (trailing slash = step 1 endpoint)
  const sendOtpMutation = useDataMutation<
    { message: string },
    IndividualSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private/`,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data, variables) => {
      toast.success("Code sent to your email", {
        description: data.message || "Please check your inbox.",
      });
      setOtpSent(true);
      setPendingSignupData(variables);
      setOtpVerified(false);
      setOtpAttempted(false);
      setOtpValue("");
    },
    onError: (error) => {
      const errorMessage = error.message || "Please try again later.";
      if (errorMessage.toLowerCase().includes("already")) {
        toast.error("Email already registered", {
          description:
            "This email is already associated with an account. Please sign in instead.",
          action: {
            label: "Log In",
            onClick: () => {
              window.location.href = "/auth/dealer-signin";
            },
          },
          duration: 8000,
        });
      } else {
        toast.error("Failed to send code", {
          description: errorMessage,
        });
      }
    },
    successMessage: "Code sent successfully",
    errorMessage: "Failed to send code",
  });

  // Step 2: verify OTP + create account (no trailing slash = step 2)
  const verifyOtpMutation = useDataMutation<
    { message: string },
    IndividualSignupPayloadWithOtp
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private`,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data, variables) => {
      toast.success("Account created successfully!", {
        description: "Welcome to 101 Drivers!",
      });
      setRegistrationComplete(true);

      // The backend issues tokens on success (auto-login).
      // Store user data and redirect to the individual dashboard.
      // The response includes the same UserInfo shape as login.
      if (data && typeof data === "object" && "id" in data) {
        const userInfo = data as any;
        setUser({
          id: userInfo.id,
          username: userInfo.username,
          email: userInfo.email,
          roles: userInfo.roles || ["PRIVATE_CUSTOMER"],
          fullName: userInfo.fullName || variables.fullName,
          profileId: userInfo.profileId,
        });
        // Redirect after a short delay so the toast is visible
        setTimeout(() => {
          navigate({ to: "/individual-dashboard" });
        }, 1500);
      } else {
        // If no auto-login data, redirect to sign-in
        setTimeout(() => {
          navigate({ to: "/auth/dealer-signin" });
        }, 2000);
      }
    },
    onError: (error) => {
      const errorMessage = error.message || "Invalid code or server error.";
      if (errorMessage.toLowerCase().includes("already")) {
        toast.error("Email already registered", {
          description:
            "This email is already associated with an account. Please sign in instead.",
          action: {
            label: "Log In",
            onClick: () => {
              window.location.href = "/auth/dealer-signin";
            },
          },
          duration: 8000,
        });
      } else {
        toast.error("Verification failed", {
          description: errorMessage,
        });
      }
    },
    successMessage: "Account created successfully",
    errorMessage: "Failed to create account",
  });

  // Resend OTP (same endpoint as step 1)
  const resendCodeMutation = useDataMutation<
    { message: string },
    IndividualSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private/`,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data) => {
      toast.success("Code resent", {
        description: data.message || "Please check your inbox.",
      });
      setOtpValue("");
      setOtpVerified(false);
      setOtpAttempted(false);
    },
    onError: (error) => {
      toast.error("Failed to resend code", {
        description: error.message || "Please try again later.",
      });
    },
    successMessage: "Code resent successfully",
    errorMessage: "Failed to resend code",
  });

  // Live OTP check (does NOT consume the token — just validates format)
  const verifyOtpCheckMutation = useDataMutation<
    { verified: boolean },
    { email: string; verificationToken: string }
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/verify-otp`,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccessInvalidate: false,
    onSuccess: (data, variables) => {
      if (variables.verificationToken === otpValueRef.current) {
        setOtpVerified(data.verified);
        setOtpAttempted(true);
      }
    },
    onError: () => {
      setOtpVerified(false);
      setOtpAttempted(true);
    },
  });

  // Ref to track the latest otpValue inside mutation callbacks
  const otpValueRef = useRef(otpValue);
  useEffect(() => {
    otpValueRef.current = otpValue;
  }, [otpValue]);

  // Auto-verify when the user types 6 digits
  useEffect(() => {
    if (!otpSent) return;
    if (otpValue.length === 6) {
      if (!verifyOtpCheckMutation.isPending) {
        verifyOtpCheckMutation.mutate({
          email: pendingSignupData?.email ?? "",
          verificationToken: otpValue,
        });
      }
    } else {
      if (otpVerified || otpAttempted) {
        setOtpVerified(false);
        setOtpAttempted(false);
      }
    }
  }, [otpValue, otpSent]);

  // ── Submit handler ───────────────────────────────────────────────────
  const onSubmit = (data: IndividualSignupFormData) => {
    const payload: IndividualSignupPayload = {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      fullName: data.fullName.trim(),
      phone: data.phone,
      contactName: data.fullName.trim(),
      contactEmail: data.email.trim().toLowerCase(),
      contactPhone: data.phone,
    };

    if (!otpSent) {
      // Step 1: send OTP
      sendOtpMutation.mutate(payload);
    } else if (otpVerified) {
      // Step 2: verify OTP + create account
      const payloadWithOtp: IndividualSignupPayloadWithOtp = {
        ...payload,
        verificationToken: otpValue,
      };
      verifyOtpMutation.mutate(payloadWithOtp);
    }
  };

  const isPending =
    sendOtpMutation.isPending ||
    verifyOtpMutation.isPending ||
    resendCodeMutation.isPending;

  // ── Phone formatter ──────────────────────────────────────────────────
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    return digits;
  };

  // ── Success screen ───────────────────────────────────────────────────
  if (registrationComplete) {
    return (
      <Card className="max-w-md mx-auto border-slate-200 dark:border-slate-800 shadow-lg rounded-3xl">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Welcome to 101 Drivers!
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your personal account has been created successfully. Redirecting
            you to your dashboard…
          </p>
          <div className="mt-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────
  return (
    <Card className="max-w-md mx-auto border-slate-200 dark:border-slate-800 shadow-lg rounded-3xl">
      <CardHeader className="space-y-1 p-6">
        <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
          Create your personal account
        </CardTitle>
        <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
          Sign up as an individual to request deliveries. No business
          information required.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Full Name
            </Label>
            <div className="relative">
              <Person className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="fullName"
                placeholder="John Doe"
                {...register("fullName")}
                className={cn(
                  "pl-10 rounded-xl h-11",
                  errors.fullName && "border-red-500",
                )}
              />
            </div>
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                className={cn(
                  "pl-10 rounded-xl h-11",
                  errors.email && "border-red-500",
                )}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Mobile Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="1234567890"
                {...register("phone")}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  e.target.value = formatted;
                }}
                className={cn(
                  "pl-10 rounded-xl h-11",
                  errors.phone && "border-red-500",
                )}
              />
            </div>
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("password")}
                className={cn(
                  "pl-10 pr-10 rounded-xl h-11",
                  errors.password && "border-red-500",
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("confirmPassword")}
                className={cn(
                  "pl-10 pr-10 rounded-xl h-11",
                  errors.confirmPassword && "border-red-500",
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* OTP Section — shown after the first submit */}
          {otpSent && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Enter the 6-digit code sent to your email
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingSignupData) {
                      resendCodeMutation.mutate(pendingSignupData);
                    }
                  }}
                  disabled={resendCodeMutation.isPending}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  {resendCodeMutation.isPending ? "Resending…" : "Resend code"}
                </button>
              </div>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpValue}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpValue(digits);
                }}
                onFocus={() => setOtpFocused(true)}
                onBlur={() => setOtpFocused(false)}
                className={cn(
                  "text-center text-2xl font-black tracking-[0.5em] rounded-xl h-14",
                  otpVerified
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10"
                    : otpAttempted && otpValue.length === 6
                      ? "border-red-500 bg-red-50 dark:bg-red-900/10"
                      : otpFocused && !otpValue.trim()
                        ? "border-primary"
                        : "",
                )}
              />
              {verifyOtpCheckMutation.isPending && otpValue.length === 6 && !otpVerified && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking code…
                </p>
              )}
              {otpVerified && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Code verified!
                </p>
              )}
              {otpAttempted && otpValue.length === 6 && !otpVerified && !verifyOtpCheckMutation.isPending && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Invalid code. Please try again.
                </p>
              )}
            </div>
          )}

          {/* Terms */}
          <div className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("acceptTerms")}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowPolicySheet(true)}
                  className="text-primary hover:underline font-semibold"
                >
                  Terms and Privacy Policy
                </button>
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="text-xs text-red-500">{errors.acceptTerms.message}</p>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isPending || !acceptTerms || (otpSent && !otpVerified)}
            className="w-full h-12 rounded-xl font-extrabold text-sm bg-primary hover:bg-primary/90 text-slate-950"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {sendOtpMutation.isPending || resendCodeMutation.isPending
                  ? "Sending Code..."
                  : "Creating Account..."}
              </>
            ) : !otpSent ? (
              <>
                <KeyRound className="w-4 h-4 mr-2" />
                Send Verification Code
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {otpVerified ? "Create Account" : "Enter Valid Code"}
              </>
            )}
          </Button>

          {/* Sign in link */}
          <div className="text-center pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                to="/auth/dealer-signin"
                className="text-primary hover:underline font-semibold"
              >
                Sign in
              </Link>
            </span>
          </div>
        </form>
      </CardContent>

      {/* Policy Sheet */}
      <PolicySheet open={showPolicySheet} onOpenChange={setShowPolicySheet} />
    </Card>
  );
}
