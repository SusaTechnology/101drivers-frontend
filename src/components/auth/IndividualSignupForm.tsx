//@ts-nocheck
/**
 * IndividualSignupForm — signup form for personal (private) customers.
 *
 * Mirrors the "Account & Contact Information" section of DealerSignupForm
 * (same layout, same field styling, same terms checkbox with policy links).
 * The only difference: no business fields, no Google Places autocomplete.
 *
 * OTP flow (separate page — same pattern as driver signup):
 *   1. User fills form → clicks "Send Verification Code"
 *   2. This form sends the OTP via the backend, saves the pending payload
 *      to sessionStorage, and navigates to /auth/individual-verify-email
 *   3. The verify page shows the OTP entry UI (InputOTP component)
 *   4. User enters the 6-digit code (or clicks the email link which
 *      auto-fills it via ?otp=XXXX URL param)
 *   5. On verify, the backend creates User+Customer, issues tokens,
 *      redirects to /dealer-dashboard
 *
 * Reuses: Button, Input, Card, Label, PolicySheet, toast, useDataMutation
 * — same UI primitives as DealerSignupForm for visual consistency.
 */
import React, { useState } from "react";
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
  KeyRound,
  UserCircle,
  Loader2,
  Info,
  Check,
  MapPin,
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
import { useDataMutation } from "@/lib/tanstack/dataQuery";
import PolicySheet from "@/components/shared/PolicySheet";
import PendingRegistrationDialog from "@/components/auth/PendingRegistrationDialog";
import { ReferralCodeInput } from "@/components/shared/ReferralCodeInput";

// sessionStorage key for the pending signup payload (so the verify page
// can read it and complete the registration).
const INDIVIDUAL_PENDING_PAYLOAD_KEY = "individualPendingPayload";

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
    state: z.string().min(1, "State is required"),
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

// ── Payload type (sent to backend, stored in sessionStorage for verify page) ─
interface IndividualSignupPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // US state (2-letter code). Private customers in California are
  // auto-approved at signup — see backend SignupStateUtil.
  state?: string;
  referralCode?: string;
}

// All US states + DC — used for the signup State dropdown.
const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

// ── Component ───────────────────────────────────────────────────────────
export function IndividualSignupForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openPolicySheet, setOpenPolicySheet] = useState<
    "customer-agreement" | "customer-terms" | "customer-privacy" | null
  >(null);

  // Referral code (validated by ReferralCodeInput via /api/referrals/public/resolve/:code).
  // Null when empty/invalid/paused. Non-null only when the resolve endpoint returns
  // found=true + programActive=true. Conditionally spread into the submit payload.
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Pending verification dialog — shown when the user tries to sign up
  // with an email that has a pending (unverified) registration.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingCreatedAt, setPendingCreatedAt] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IndividualSignupFormData>({
    resolver: zodResolver(individualSignupSchema),
    defaultValues: {
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      state: "",
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
    // Update the react-hook-form field with the raw digits
    setValue("contactPhone", digits, { shouldValidate: true });
  };

  // ── Mutation: send OTP (step 1) ──────────────────────────────────────
  // On success: save the pending payload to sessionStorage and navigate
  // to the separate verify-email page. The verify page reads the payload,
  // shows the OTP entry UI, and calls step 2 to create the account.
  const sendOtpMutation = useDataMutation<
    any,
    IndividualSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private/`,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data, variables) => {
      // Check if the backend says there's a pending (unverified) registration
      if (data.action === "PENDING_VERIFICATION") {
        setPendingEmail(data.email);
        setPendingCreatedAt(data.createdAt ?? null);
        return;
      }

      // Normal flow — OTP sent successfully
      toast.success("Code sent to your email", {
        description: data.message || "Please check your inbox.",
      });
      // Store ONLY the email + state + optional referralCode in sessionStorage
      // (NOT the password or contact info — the backend has the User row
      // with the hashed password). The verify page sends {email, otp, state?,
      // referralCode?} — state is needed in step 2 because the California
      // auto-approval happens when the Customer row is created (step 2).
      sessionStorage.setItem(
        INDIVIDUAL_PENDING_PAYLOAD_KEY,
        JSON.stringify({
          email: variables.email,
          ...(variables.state ? { state: variables.state } : {}),
          ...(variables.referralCode ? { referralCode: variables.referralCode } : {}),
        }),
      );
      // Navigate to the separate OTP entry page.
      navigate({ to: "/individual-verify-email" });
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

  // ── Mutation: resend OTP for a pending signup ───────────────────────
  // Called when the user chooses "Verify the old signup" in the dialog.
  const resendOtpMutation = useDataMutation<
    { message: string; email: string },
    { email: string }
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private/resend-otp`,
    method: 'POST',
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data) => {
      toast.success("Code sent to your email", {
        description: data.message || "Please check your inbox.",
      });
      // Store just the email (not the payload — the backend already has it)
      sessionStorage.setItem(
        INDIVIDUAL_PENDING_PAYLOAD_KEY,
        JSON.stringify({ email: data.email }),
      );
      setPendingEmail(null);
      navigate({ to: "/individual-verify-email" });
    },
    onError: (error) => {
      toast.error("Failed to resend code", {
        description: error.message || "Please try again later.",
      });
    },
  });

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
      state: data.state,
      ...(referralCode ? { referralCode } : {}),
    };
    sendOtpMutation.mutate(payload);
  };

  const isPending = sendOtpMutation.isPending || resendOtpMutation.isPending;

  // Password validation checks (same as dealer form)
  const passwordChecks = {
    minLength: (watchPassword?.length || 0) >= 8,
    hasUppercase: /[A-Z]/.test(watchPassword || ""),
    hasLowercase: /[a-z]/.test(watchPassword || ""),
    hasNumber: /[0-9]/.test(watchPassword || ""),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(watchPassword || ""),
    hasMatch: !!watchConfirmPassword && watchPassword === watchConfirmPassword,
    allValid: false,
  };
  passwordChecks.allValid =
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasLowercase &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecial &&
    passwordChecks.hasMatch;

  // ── Main form ────────────────────────────────────────────────────────
  return (
    <Card className="max-w-2xl mx-auto border-slate-200 dark:border-slate-800 shadow-lg rounded-3xl overflow-hidden">
      {/* Header — matches dealer form's "Account & Contact Information" */}
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1">
              Step 2
            </p> */}
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

          {/* State — full width. Used for the California auto-approval rule:
              private customers in CA skip admin approval entirely. */}
          <div className="space-y-2">
            <Label htmlFor="state" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              State<span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                id="state"
                {...register("state")}
                disabled={isPending}
                className={cn(
                  "w-full h-14 pl-12 pr-4 rounded-2xl border bg-white dark:bg-slate-800/40 input-focus-ring text-sm transition-colors appearance-none",
                  errors.state
                    ? "border-red-400 dark:border-red-500"
                    : watch("state")
                      ? "border-green-300 dark:border-green-700"
                      : "border-slate-200 dark:border-slate-700"
                )}
              >
                <option value="">Select your state</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {errors.state && (
              <p className="text-sm text-red-500 font-medium">{errors.state.message}</p>
            )}
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

            {/* Password — single column */}
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

            {/* Confirm Password — single column */}
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

            {/* Password Requirements — same checklist as dealer form */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 space-y-2">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Password Requirements
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-2">
                  {passwordChecks.minLength ? (
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${passwordChecks.minLength ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                    8+ characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordChecks.hasUppercase ? (
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${passwordChecks.hasUppercase ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                    1 uppercase
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordChecks.hasLowercase ? (
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${passwordChecks.hasLowercase ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                    1 lowercase
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordChecks.hasNumber ? (
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${passwordChecks.hasNumber ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                    1 number
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordChecks.hasSpecial ? (
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${passwordChecks.hasSpecial ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                    1 special char
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordChecks.hasMatch ? (
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${passwordChecks.hasMatch ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                    Passwords match
                  </span>
                </div>
              </div>
            </div>
          </div>

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
              on the next page to complete your signup. The code expires in 15 minutes.
            </p>
          </div>

          {/* Referral Code (optional) — auto-fills from ?ref= URL param,
              validates against /api/referrals/public/resolve/:code */}
          <ReferralCodeInput
            onChange={setReferralCode}
            disabled={isPending}
            allowedReferrerTypes={["DRIVER", "BUSINESS", "PERSONAL"]}
          />

          {/* ── Submit button ───────────────────────────────────────────── */}
          <Button
            type="submit"
            disabled={isPending || !acceptTerms}
            className="w-full h-14 rounded-2xl font-extrabold text-sm bg-primary hover:bg-primary/90 text-slate-950"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending Code...
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 mr-2" />
                Send Verification Code
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

      {/* Pending Registration Dialog — shown when the user tries to sign up
          with an email that has a pending (unverified) registration.
          Extracted into its own component for reusability. */}
      <PendingRegistrationDialog
        email={pendingEmail}
        createdAt={pendingCreatedAt}
        isResending={resendOtpMutation.isPending}
        onVerify={(email) => {
          resendOtpMutation.mutate({ email });
        }}
        onUseAnother={() => {
          setPendingEmail(null);
          setPendingCreatedAt(null);
          // Focus the email field so the user can enter a new one
          const emailInput = document.getElementById("contactEmail") as HTMLInputElement;
          if (emailInput) emailInput.focus();
        }}
      />
    </Card>
  );
}
