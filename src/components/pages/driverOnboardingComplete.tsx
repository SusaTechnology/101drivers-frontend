import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ArrowRight,
  User,
  Shield,
  LogIn,
  Home,
  Info,
  Menu,
  X,
  CheckCircle,
  Check,
  Loader2,
  MapPin,
  Calendar,
  Lock,
  AlertCircle,
  FileCheck,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDataQuery,
  useDataMutation,
  isAuthenticated,
  getUser,
} from "@/lib/tanstack/dataQuery";

// ==================== CONSTANTS ====================

const API_URL = import.meta.env.VITE_API_URL;

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
] as const;

// ==================== VALIDATION SCHEMA ====================

const onboardingCompleteSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full legal name is required (at least 2 characters)"),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .regex(
      /^\d{2}\/\d{2}\/\d{4}$/,
      "Date must be in MM/DD/YYYY format"
    ),
  ssn: z
    .string()
    .min(1, "Social Security Number is required")
    .regex(/^\d{9}$/, "SSN must be exactly 9 digits"),
  addressLine1: z.string().min(1, "Street address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z
    .string()
    .min(1, "State is required")
    .regex(/^[A-Z]{2}$/, "State must be a valid 2-letter code"),
  zipCode: z
    .string()
    .min(1, "ZIP code is required")
    .regex(/^\d{5}$/, "ZIP code must be exactly 5 digits"),
});

type OnboardingCompleteFormData = z.infer<typeof onboardingCompleteSchema>;

// ==================== HELPER FUNCTIONS ====================

/** Format raw SSN digits into ***-**-XXXX masked display */
const maskSSN = (digits: string): string => {
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `***-**-${digits.slice(4)}`;
  return `***-**-${digits.slice(5)}`;
};

/** Format DOB input as user types (auto-add slashes) */
const formatDOB = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

// ==================== TYPES ====================

interface OnboardingStatusResponse {
  onboardingCompleted: boolean;
  driverStatus?: string;
}

interface OnboardingCompletePayload {
  fullName: string;
  dateOfBirth: string;
  ssn: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
}

// ==================== COMPONENT ====================

export function DriverOnboardingComplete() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ssnDisplay, setSsnDisplay] = useState("");
  const [dobDisplay, setDobDisplay] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Auth & user checks
  const authenticated = isAuthenticated();
  const user = getUser();
  const isDriver = user?.roles?.includes("DRIVER");
  const driverStatus = user?.driverStatus;

  // Fetch onboarding status on mount
  const {
    data: onboardingStatus,
    isLoading: statusLoading,
  } = useDataQuery<OnboardingStatusResponse>({
    apiEndPoint: `${API_URL}/api/drivers/onboarding-status`,
    noFilter: true,
    fetchWithoutRefresh: true,
    enabled: authenticated && isDriver && driverStatus === "APPROVED",
  });

  const alreadyCompleted = onboardingStatus?.onboardingCompleted === true;

  // Submit mutation
  const submitMutation = useDataMutation<
    { message: string },
    OnboardingCompletePayload
  >({
    apiEndPoint: `${API_URL}/api/drivers/onboarding-complete`,
    onSuccess: () => {
      toast.success("Onboarding information submitted successfully!", {
        description: "We'll review your information shortly.",
      });
      setSubmitted(true);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error("Failed to submit onboarding information", {
        description: message,
      });
    },
    fetchWithoutRefresh: true,
  });

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingCompleteFormData>({
    resolver: zodResolver(onboardingCompleteSchema),
    defaultValues: {
      fullName: "",
      dateOfBirth: "",
      ssn: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  // Watch fields for validation feedback
  const watchFullName = watch("fullName");
  const watchDob = watch("dateOfBirth");
  const watchSsn = watch("ssn");
  const watchAddressLine1 = watch("addressLine1");
  const watchCity = watch("city");
  const watchState = watch("state");
  const watchZipCode = watch("zipCode");

  const dobIsValid =
    watchDob?.trim() && /^\d{2}\/\d{2}\/\d{4}$/.test(watchDob);
  const ssnIsValid = watchSsn?.trim() && /^\d{9}$/.test(watchSsn);
  const zipIsValid =
    watchZipCode?.trim() && /^\d{5}$/.test(watchZipCode);

  // SSN change handler
  const handleSSNChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawDigits = e.target.value.replace(/\D/g, "").slice(0, 9);
      setSsnDisplay(rawDigits);
      setValue("ssn", rawDigits, { shouldValidate: true });
    },
    [setValue]
  );

  // DOB change handler
  const handleDOBChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDOB(e.target.value);
      setDobDisplay(formatted);
      setValue("dateOfBirth", formatted, { shouldValidate: true });
    },
    [setValue]
  );

  // State change handler
  const handleStateChange = useCallback(
    (value: string) => {
      setValue("state", value, { shouldValidate: true });
    },
    [setValue]
  );

  const onSubmit = (data: OnboardingCompleteFormData) => {
    submitMutation.mutate(data);
  };

  // ==================== AUTH GUARD RENDERING ====================

  // Not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <main className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-md w-full border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <LogIn className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Please Sign In
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You need to be signed in to complete your driver onboarding.
              </p>
              <Link to="/driver-signin">
                <Button className="w-full h-12 rounded-2xl font-bold bg-lime-500 hover:bg-lime-600 text-black">
                  <LogIn className="w-4 h-4 mr-2" />
                  Driver Sign In
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Not a driver
  if (!isDriver) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <main className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-md w-full border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Access Denied
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This page is only available for drivers. Your current account
                does not have the driver role.
              </p>
              <Link to="/">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  Go to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Driver account pending
  if (driverStatus === "PENDING") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-2xl mx-auto pt-10">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg">
            {/* Success Header */}
            <div className="relative bg-gradient-to-br from-lime-500/20 via-lime-500/10 to-transparent py-12 px-6 sm:px-10">
              <div className="relative flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime-400 to-lime-500 flex items-center justify-center shadow-lg shadow-lime-500/30">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute -inset-2 rounded-full border-2 border-lime-400/30 animate-pulse" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  Application Submitted!
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 mt-3 max-w-md">
                  Your driver account application has been received and is pending admin approval.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    Pending Approval
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 sm:p-10">
              <div className="mb-8">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-lime-500" />
                  What Happens Next?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400">1</span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Admin Review</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Our team will verify your information within 1-2 business days.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                      <span className="text-lg font-black text-purple-600 dark:text-purple-400">2</span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Email Confirmation</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You'll receive an email once your account is approved.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mb-3">
                      <span className="text-lg font-black text-lime-600 dark:text-lime-400">3</span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Complete Onboarding</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Once approved, you'll provide additional details to get started.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/driver-signin"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold hover:opacity-90 transition shadow-lg"
                >
                  <LogIn className="w-5 h-5" />
                  Go to Sign In
                </Link>
                <Link
                  to="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <Home className="w-5 h-5" />
                  Back to Home
                </Link>
              </div>
              <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Questions? Contact support at{" "}
                <a href="mailto:support@101drivers.com" className="font-bold text-lime-500 hover:underline">
                  support@101drivers.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading onboarding status
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-lime-500 animate-spin mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Checking your onboarding status...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Already completed
  if (alreadyCompleted || submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <main className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-lg w-full border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-10 text-center space-y-6">
              {/* Animated green checkmark */}
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/20 animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CheckCircle className="w-14 h-14 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Onboarding Complete!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Thank you for providing your information. We&apos;ll run your
                  background check and DMV review. We&apos;ll get back to you
                  soon.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link to="/driver-dashboard" className="flex-1">
                  <Button className="w-full h-12 rounded-2xl font-bold bg-lime-500 hover:bg-lime-600 text-black">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Go to Driver Dashboard
                  </Button>
                </Link>
                <Link to="/" className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-2xl font-bold"
                  >
                    Back to Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // ==================== MAIN FORM ====================

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <main className="w-full max-w-[700px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Title Section */}
        <section className="mb-10 space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-lime-100 dark:bg-lime-900/20 text-lime-800 dark:text-lime-200 border-lime-200">
              <User className="h-3 w-3 mr-1" />
              Driver Onboarding
            </Badge>
            <Badge
              variant="outline"
              className="bg-slate-100 dark:bg-slate-800/50"
            >
              <FileCheck className="h-3 w-3 mr-1" />
              Final Step
            </Badge>
          </div>

          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Complete your onboarding
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mt-4">
              Please provide your personal information to finalize your driver
              onboarding. All fields marked with{" "}
              <span className="text-red-500">*</span> are required.
            </p>
          </div>

          <Alert className="max-w-2xl bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200">
              Your information is secure
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs">
              All personal data is encrypted and transmitted securely. Your SSN
              is used solely for background check purposes and stored in
              compliance with applicable regulations.
            </AlertDescription>
          </Alert>
        </section>

        {/* Form Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* ---- Personal Information ---- */}
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                Section 1
              </CardDescription>
              <CardTitle className="text-xl font-black mt-1 flex items-center gap-2">
                <User className="w-5 h-5 text-lime-500" />
                Personal Information
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Information must match your government-issued ID exactly.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 pb-6">
              {/* Full Legal Name */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.fullName
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : "border-transparent"
                )}
              >
                <Label htmlFor="fullName" className="text-xs font-bold">
                  Full legal name (as on driver&apos;s license)
                  {!watchFullName?.trim() && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                  This must match your driver&apos;s license exactly.
                </p>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="fullName"
                    {...register("fullName")}
                    className={cn(
                      "h-14 pl-12 pr-10 rounded-2xl transition-colors",
                      errors.fullName
                        ? "border-red-400 dark:border-red-500"
                        : watchFullName?.trim() && watchFullName.trim().length >= 2
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="John A. Smith"
                    autoComplete="name"
                    disabled={submitMutation.isPending}
                  />
                  {watchFullName?.trim() &&
                    watchFullName.trim().length >= 2 &&
                    !errors.fullName && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                </div>
                {errors.fullName && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Date of Birth */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.dateOfBirth
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : "border-transparent"
                )}
              >
                <Label htmlFor="dateOfBirth" className="text-xs font-bold">
                  Date of birth
                  {!watchDob?.trim() && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="dateOfBirth"
                    value={dobDisplay}
                    onChange={handleDOBChange}
                    className={cn(
                      "h-14 pl-12 pr-10 rounded-2xl transition-colors",
                      errors.dateOfBirth
                        ? "border-red-400 dark:border-red-500"
                        : dobIsValid
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="MM/DD/YYYY"
                    autoComplete="bday"
                    inputMode="numeric"
                    maxLength={10}
                    disabled={submitMutation.isPending}
                  />
                  {dobIsValid && !errors.dateOfBirth && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Format: MM/DD/YYYY
                </p>
                {errors.dateOfBirth && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.dateOfBirth.message}
                  </p>
                )}
              </div>

              {/* SSN */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.ssn
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : "border-transparent"
                )}
              >
                <Label htmlFor="ssn" className="text-xs font-bold">
                  Social Security Number
                  {!watchSsn?.trim() && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                  Used for background check purposes only. Displayed as masked.
                </p>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="ssn"
                    value={ssnDisplay.length > 0 ? maskSSN(ssnDisplay) : ""}
                    onChange={handleSSNChange}
                    className={cn(
                      "h-14 pl-12 pr-10 rounded-2xl tracking-widest font-mono transition-colors",
                      errors.ssn
                        ? "border-red-400 dark:border-red-500"
                        : ssnIsValid
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="***-**-XXXX"
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={11}
                    disabled={submitMutation.isPending}
                  />
                  {ssnIsValid && !errors.ssn && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.ssn && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.ssn.message}
                  </p>
                )}
              </div>
            </CardContent>

            {/* ---- Residential Address ---- */}
            <CardHeader className="border-b border-t border-slate-100 dark:border-slate-800">
              <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                Section 2
              </CardDescription>
              <CardTitle className="text-xl font-black mt-1 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-lime-500" />
                Residential Address
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your current residential address as it appears on official
                documents.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 pb-8">
              {/* Address Line 1 */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.addressLine1
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : "border-transparent"
                )}
              >
                <Label
                  htmlFor="addressLine1"
                  className="text-xs font-bold"
                >
                  Street address
                  {!watchAddressLine1?.trim() && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="addressLine1"
                    {...register("addressLine1")}
                    className={cn(
                      "h-14 pl-12 pr-10 rounded-2xl transition-colors",
                      errors.addressLine1
                        ? "border-red-400 dark:border-red-500"
                        : watchAddressLine1?.trim()
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="123 Main Street"
                    autoComplete="address-line1"
                    disabled={submitMutation.isPending}
                  />
                  {watchAddressLine1?.trim() && !errors.addressLine1 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.addressLine1 && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.addressLine1.message}
                  </p>
                )}
              </div>

              {/* Address Line 2 */}
              <div className="space-y-2 p-4 rounded-2xl">
                <Label
                  htmlFor="addressLine2"
                  className="text-xs font-bold text-slate-600 dark:text-slate-400"
                >
                  Apartment, suite, unit, etc.
                  <span className="text-slate-400 dark:text-slate-500 ml-1 font-normal text-[10px]">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="addressLine2"
                  {...register("addressLine2")}
                  className="h-14 rounded-2xl"
                  placeholder="Apt 4B"
                  autoComplete="address-line2"
                  disabled={submitMutation.isPending}
                />
              </div>

              {/* City */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.city
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : "border-transparent"
                )}
              >
                <Label htmlFor="city" className="text-xs font-bold">
                  City
                  {!watchCity?.trim() && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="city"
                    {...register("city")}
                    className={cn(
                      "h-14 rounded-2xl pr-10 transition-colors",
                      errors.city
                        ? "border-red-400 dark:border-red-500"
                        : watchCity?.trim()
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="Los Angeles"
                    autoComplete="address-level2"
                    disabled={submitMutation.isPending}
                  />
                  {watchCity?.trim() && !errors.city && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.city && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.city.message}
                  </p>
                )}
              </div>

              {/* State + ZIP Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* State */}
                <div
                  className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.state
                      ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                      : "border-transparent"
                  )}
                >
                  <Label className="text-xs font-bold">
                    State
                    {!watchState?.trim() && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                  <Select
                    value={watchState}
                    onValueChange={handleStateChange}
                    disabled={submitMutation.isPending}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-14 rounded-2xl transition-colors",
                        errors.state
                          ? "border-red-400 dark:border-red-500"
                          : watchState
                            ? "border-green-300 dark:border-green-700"
                            : ""
                      )}
                    >
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {US_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.value} — {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {watchState && !errors.state && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        {US_STATES.find((s) => s.value === watchState)?.label}
                      </span>
                    </div>
                  )}
                  {errors.state && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.state.message}
                    </p>
                  )}
                </div>

                {/* ZIP Code */}
                <div
                  className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.zipCode
                      ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                      : "border-transparent"
                  )}
                >
                  <Label htmlFor="zipCode" className="text-xs font-bold">
                    ZIP code
                    {!watchZipCode?.trim() && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="zipCode"
                      {...register("zipCode")}
                      className={cn(
                        "h-14 rounded-2xl pr-10 transition-colors",
                        errors.zipCode
                          ? "border-red-400 dark:border-red-500"
                          : zipIsValid
                            ? "border-green-300 dark:border-green-700"
                            : ""
                      )}
                      placeholder="90001"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      maxLength={5}
                      disabled={submitMutation.isPending}
                    />
                    {zipIsValid && !errors.zipCode && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                  </div>
                  {errors.zipCode && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.zipCode.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>

            {/* ---- Submit ---- */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-6">
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full h-14 rounded-2xl font-black text-base bg-lime-500 hover:bg-lime-600 text-black shadow-lg shadow-lime-500/20 disabled:opacity-60"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Onboarding Information
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 mt-3">
                By submitting, you confirm that all information provided is
                accurate and truthful.
              </p>
            </div>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
}

// ==================== HEADER SUB-COMPONENT ====================

function Header({
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center" aria-label="101 Drivers">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="/#how"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              How it works
            </a>
            <a
              href="/#standard"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Compliance
            </a>
            <Link
              to="/about"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              About
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/driver-signin"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <LogIn className="h-4 w-4" />
            Driver Sign In
          </Link>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <a
              href="/#how"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              How it works
            </a>
            <a
              href="/#standard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Compliance
            </a>
            <Link
              to="/about"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              About
            </Link>
            <Separator className="my-2" />
            <Link
              to="/driver-signin"
              className="text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Driver Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ==================== FOOTER SUB-COMPONENT ====================

function Footer() {
  return (
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
              Driver onboarding • Complete your profile
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} 101 Drivers Inc. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
