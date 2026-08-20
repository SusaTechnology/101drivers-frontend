//@ts-nocheck
/**
 * IndividualSignupForm — signup form for personal (private) customers.
 *
 * Mirrors the "Account & Contact Information" section of DealerSignupForm
 * (same layout, same field styling, same terms checkbox with policy links).
 * The only difference: no business fields, no Google Places autocomplete.
 *
 * OTP flow:
 *   1. User fills form → clicks "Send Verification Code"
 *   2. Backend sends OTP email with link to /auth/individual-signup?otp=XXXX
 *   3. User enters OTP inline (auto-verified on 6th digit) OR clicks the
 *      email link which auto-fills the OTP and restores the form draft
 *   4. User clicks "Create Account" → backend creates User+Customer,
 *      issues tokens (auto-login), redirects to /dealer-dashboard
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
  UserCircle,
  Loader2,
  Info,
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

// localStorage key for saving the individual signup draft (so the OTP
// email link can restore the form state).
const INDIVIDUAL_SIGNUP_DRAFT_KEY = "individualSignupDraft";

// ── Form schema (same fields as dealer's Account & Contact Information) ─
const individualSignupSchema = z
  .object({
    contactName: z.string().min(1, "Name is required"),
    contactEmail: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    contactPhone: z
      .string()
      .min(1, "Mobile number is required")
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
  const [openPolicySheet, setOpenPolicySheet] = useState<
    "customer-agreement" | "customer-terms" | "customer-privacy" | null
  >(null);
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
    reset,
    formState: { errors },
  } = useForm<IndividualSignupFormData>({
    resolver: zodResolver(individualSignupSchema),
    defaultValues: {
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const watchContactName = watch("contactName");
  const watchContactEmail = watch("contactEmail");
  const watchContactPhone = watch("contactPhone");
  const watchPassword = watch("password");
  const watchConfirmPassword = watch("confirmPassword");
  const acceptTerms = watch("acceptTerms");

  // Phone display formatter — (XXX) XXX-XXXX
  const [contactPhoneDisplay, setContactPhoneDisplay] = useState("");
  const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 0) {
      formatted = `(${digits}`;
    }
    setContactPhoneDisplay(formatted);
    // Store raw digits in the form
    (e.target as HTMLInputElement).value = digits;
    // Trigger react-hook-form onChange
    register("contactPhone").onChange(e);
  };

  // ── Check for OTP in URL and restore draft from localStorage ────────
  // Same pattern as DealerSignupForm: when the user clicks the email link,
  // the OTP is in the URL (?otp=XXXX) and the form draft is in localStorage.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOtp = urlParams.get("otp");

    if (urlOtp) {
      const draftStr = localStorage.getItem(INDIVIDUAL_SIGNUP_DRAFT_KEY);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.formData) {
            // Restore form data
            reset(draft.formData, { keepDefaultValues: false });
            if (draft.formData.contactPhone) {
              const digits = draft.formData.contactPhone;
              let formatted = digits;
              if (digits.length > 6) {
                formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
              } else if (digits.length > 3) {
                formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
              } else if (digits.length > 0) {
                formatted = `(${digits}`;
              }
              setContactPhoneDisplay(formatted);
            }
            // Set OTP and show verification step
            setOtpValue(urlOtp);
            setOtpSent(true);
            setPendingSignupData(draft.payload);
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      } else {
        toast.error("Session expired", {
          description: "Please start a new registration.",
        });
      }
    }
  }, [reset]);

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

      // Save draft to localStorage so the OTP email link can restore it.
      const formValues = watch();
      localStorage.setItem(
        INDIVIDUAL_SIGNUP_DRAFT_KEY,
        JSON.stringify({ formData: formValues, payload: variables }),
      );
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
    any,
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
      localStorage.removeItem(INDIVIDUAL_SIGNUP_DRAFT_KEY);

      // The backend issues tokens on success (auto-login).
      // Store user data and redirect to the dashboard.
      if (data && typeof data === "object" && "id" in data) {
        setUser({
          id: data.id,
          username: data.username,
          email: data.email,
          roles: data.roles || ["PRIVATE_CUSTOMER"],
          fullName: data.fullName || variables.fullName,
          profileId: data.profileId,
        });
        setTimeout(() => {
          navigate({ to: "/dealer-dashboard" });
        }, 1500);
      } else {
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
      email: data.contactEmail.trim().toLowerCase(),
      password: data.password,
      fullName: data.contactName.trim(),
      phone: data.contactPhone,
      contactName: data.contactName.trim(),
      contactEmail: data.contactEmail.trim().toLowerCase(),
      contactPhone: data.contactPhone,
    };

    if (!otpSent) {
      sendOtpMutation.mutate(payload);
    } else if (otpVerified) {
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

  // Password validation checks (same as dealer form)
  const passwordChecks = {
    hasLength: (watchPassword || "").length >= 8,
    hasUpper: /[A-Z]/.test(watchPassword || ""),
    hasLower: /[a-z]/.test(watchPassword || ""),
    hasNumber: /[0-9]/.test(watchPassword || ""),
    hasSpecial: /[^A-Za-z0-9]/.test(watchPassword || ""),
    hasMatch:
      !!watchConfirmPassword && watchPassword === watchConfirmPassword,
  };
  passwordChecks.allValid =
    passwordChecks.hasLength &&
    passwordChecks.hasUpper &&
    passwordChecks.hasLower &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecial;

  // ── Success screen ───────────────────────────────────────────────────
  if (registrationComplete) {
    return (
      <Card className="max-w-2xl mx-auto border-slate-200 dark:border-slate-800 shadow-lg rounded-3xl">
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
    <Card className="max-w-2xl mx-auto border-slate-200 dark:border-slate-800 shadow-lg rounded-3xl overflow-hidden">
      {/* Header — matches dealer form's "Account & Contact Information" */}
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1">
              Step 2
            </p>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              Account & Contact Information
            </CardTitle>
            <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Create your personal account to request deliveries.
            </CardDescription>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
            <UserCircle className="w-3 h-3 text-primary" />
            Required
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-8 space-y-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* ── Your Contact Details ─────────────────────────────────────── */}
          <div className={cn(
            "space-y-4 p-4 rounded-2xl border transition-all duration-300",
            errors.contactName || errors.contactEmail || errors.contactPhone
              ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
              : "border-transparent"
          )}>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Your Contact Details
            </h4>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="contactName" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Name{!watchContactName?.trim() && <span className="text-red-500">*</span>}
              </Label>
              <div className="relative">
                <Person className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="contactName"
                  {...register("contactName")}
                  className={cn(
                    "w-full h-14 pl-12 pr-4 rounded-2xl border dark:bg-slate-800/40 input-focus-ring text-sm transition-colors",
                    errors.contactName
                      ? "border-red-400 dark:border-red-500"
                      : watchContactName?.trim()
                        ? "border-green-300 dark:border-green-700"
                        : "border-slate-200 dark:border-slate-700"
                  )}
                  placeholder="John Doe"
                  disabled={isPending}
                />
                {watchContactName?.trim() && !errors.contactName && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>
              {errors.contactName && (
                <p className="text-sm text-red-500 font-medium">{errors.contactName.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Email{!watchContactEmail?.trim() && <span className="text-red-500">*</span>}
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="contactEmail"
                  type="email"
                  autoComplete="off"
                  {...register("contactEmail")}
                  className={cn(
                    "w-full h-14 pl-12 pr-4 rounded-2xl border dark:bg-slate-800/40 input-focus-ring text-sm transition-colors",
                    errors.contactEmail
                      ? "border-red-400 dark:border-red-500"
                      : watchContactEmail?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchContactEmail)
                        ? "border-green-300 dark:border-green-700"
                        : "border-slate-200 dark:border-slate-700"
                  )}
                  placeholder="your@email.com"
                  disabled={isPending}
                />
                {watchContactEmail?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchContactEmail) && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>
              {errors.contactEmail && (
                <p className="text-sm text-red-500 font-medium">{errors.contactEmail.message}</p>
              )}
            </div>

            {/* Mobile */}
            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mobile{!watchContactPhone?.trim() && <span className="text-red-500">*</span>}
              </Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  value={contactPhoneDisplay}
                  onChange={handleContactPhoneChange}
                  type="tel"
                  autoComplete="off"
                  inputMode="tel"
                  maxLength={14}
                  className={cn(
                    "w-full h-14 pl-12 pr-4 rounded-2xl border dark:bg-slate-800/40 input-focus-ring text-sm transition-colors",
                    errors.contactPhone
                      ? "border-red-400 dark:border-red-500"
                      : (watchContactPhone?.replace(/\D/g, '').length || 0) >= 10
                        ? "border-green-300 dark:border-green-700"
                        : "border-slate-200 dark:border-slate-700"
                  )}
                  placeholder="(555) 123-4567"
                  disabled={isPending}
                />
                {(watchContactPhone?.replace(/\D/g, '').length || 0) >= 10 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>
              {errors.contactPhone && (
                <p className="text-sm text-red-500 font-medium">{errors.contactPhone.message}</p>
              )}
            </div>
          </div>

          {/* ── Account Password ────────────────────────────────────────── */}
          <div className={cn(
            "space-y-4 p-4 rounded-2xl border transition-all duration-300",
            (errors.password || errors.confirmPassword ||
             (watchPassword && watchConfirmPassword && watchPassword !== watchConfirmPassword))
              ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
              : "border-transparent"
          )}>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Account Password
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Password{!passwordChecks.allValid && <span className="text-red-500">*</span>}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="off"
                    className="w-full h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                    placeholder="Create password"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirm Password{!passwordChecks.hasMatch && <span className="text-red-500">*</span>}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    {...register("confirmPassword")}
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="off"
                    className="w-full h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                    placeholder="Repeat password"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── OTP Section — shown after "Send Verification Code" ──────── */}
          {otpSent && (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
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

          {/* ── Terms and Conditions — matches dealer form exactly ─────── */}
          <div
            className={cn(
              "space-y-2 p-4 rounded-2xl border transition-all duration-300",
              errors.acceptTerms
                ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                : acceptTerms
                ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30"
            )}
          >
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="acceptTerms"
                {...register("acceptTerms")}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-primary focus:ring-offset-0"
                disabled={isPending}
              />
              <Label
                htmlFor="acceptTerms"
                className={cn(
                  "text-xs leading-relaxed cursor-pointer flex-1 flex-wrap",
                  errors.acceptTerms
                    ? "text-red-700 dark:text-red-300 font-bold"
                    : acceptTerms
                    ? "text-green-700 dark:text-green-300 font-medium"
                    : "text-slate-600 dark:text-slate-400"
                )}
              >
                I agree to receive email notifications and accept the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenPolicySheet("customer-agreement");
                  }}
                  className="font-extrabold hover:text-primary underline inline"
                >
                  Customer Agreement
                </button>
                ,{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenPolicySheet("customer-terms");
                  }}
                  className="font-extrabold hover:text-primary underline inline"
                >
                  Terms of Service
                </button>
                , and{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenPolicySheet("customer-privacy");
                  }}
                  className="font-extrabold hover:text-primary underline inline"
                >
                  Privacy Policy
                </button>
                .
              </Label>
            </div>
            {errors.acceptTerms && (
              <p className="text-sm text-red-500 font-medium">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          {/* ── Info banner ─────────────────────────────────────────────── */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
            <Info className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
              You'll receive a 6-digit verification code by email. Enter it
              above to complete your signup. The code expires in 15 minutes.
            </p>
          </div>

          {/* ── Submit button ───────────────────────────────────────────── */}
          <Button
            type="submit"
            disabled={isPending || !acceptTerms || (otpSent && !otpVerified)}
            className="w-full h-14 rounded-2xl font-extrabold text-sm bg-primary hover:bg-primary/90 text-slate-950"
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

          {/* ── Sign in link ────────────────────────────────────────────── */}
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

      {/* Policy Sheet — same component as dealer form */}
      <PolicySheet
        open={!!openPolicySheet}
        onOpenChange={(open) => {
          if (!open) setOpenPolicySheet(null);
        }}
        type={openPolicySheet ?? "customer-agreement"}
      />
    </Card>
  );
}
