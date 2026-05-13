import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
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
  Calendar as CalendarIcon,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  FileCheck,
  Clock,
  Camera,
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
  ssn: z
    .string()
    .min(1, "Social Security Number is required")
    .regex(/^\d{9}$/, "SSN must be exactly 9 digits"),
  licenseNumber: z.string().min(1, "License number is required"),
  licenseState: z
    .string()
    .min(1, "License state is required")
    .regex(/^[A-Z]{2}$/, "State must be a valid 2-letter code"),
  licenseFrontUrl: z.string().min(1, "License front photo is required"),
  licenseBackUrl: z.string().min(1, "License back photo is required"),
  residentialAddressLine1: z.string().min(1, "Street address is required"),
  residentialAddressLine2: z.string().optional(),
  residentialCity: z.string().min(1, "City is required"),
  residentialState: z
    .string()
    .min(1, "State is required")
    .regex(/^[A-Z]{2}$/, "State must be a valid 2-letter code"),
  residentialZip: z
    .string()
    .min(1, "ZIP code is required")
    .regex(/^\d{5}$/, "ZIP code must be exactly 5 digits"),
  selfiePhotoUrl: z.string().min(1, "Selfie photo is required"),
});

type OnboardingCompleteFormData = z.infer<typeof onboardingCompleteSchema>;

// ==================== HELPER FUNCTIONS ====================

/** Format DOB input as user types (auto-add slashes) */
const formatDOB = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

/** Parse MM/DD/YYYY string to a Date object (for calendar) */
const parseDOBtoDate = (dobStr: string): Date | undefined => {
  if (!dobStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) return undefined;
  const [m, d, y] = dobStr.split("/").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
  return date;
};

/** Format Date object to MM/DD/YYYY */
const formatDateToStr = (date: Date): string => {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
};

// ==================== TYPES ====================

interface OnboardingStatusResponse {
  onboardingCompleted: boolean;
  driverStatus?: string;
}

interface OnboardingCompletePayload {
  ssn: string;
  licenseNumber: string;
  licenseState: string;
  licenseFrontUrl: string;
  licenseBackUrl: string;
  residentialAddressLine1: string;
  residentialAddressLine2?: string;
  residentialCity: string;
  residentialState: string;
  residentialZip: string;
  selfiePhotoUrl: string;
}

// ==================== COMPONENT ====================

interface DriverOnboardingCompleteProps {
  token?: string;
}

export function DriverOnboardingComplete({ token }: DriverOnboardingCompleteProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ssnDisplay, setSsnDisplay] = useState("");
  const [ssnVisible, setSsnVisible] = useState(false);
  const ssnInputRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseFrontPreview, setLicenseFrontPreview] = useState<string | null>(null);
  const [licenseBackPreview, setLicenseBackPreview] = useState<string | null>(null);
  const [licenseFrontUploading, setLicenseFrontUploading] = useState(false);
  const [licenseBackUploading, setLicenseBackUploading] = useState(false);
  const licenseFrontInputRef = useRef<HTMLInputElement>(null);
  const licenseBackInputRef = useRef<HTMLInputElement>(null);
  // Determine if we're using token-based (from email) or auth-based (from login) flow
  const usingToken = !!token;

  // Fetch onboarding status on mount
  useEffect(() => {
    if (usingToken) {
      // Token-based: call public endpoint (no auth needed)
      fetch(`${API_URL}/api/public/drivers/onboarding-status?token=${encodeURIComponent(token)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Invalid or expired link");
          return res.json();
        })
        .then((data) => {
          setTokenValid(true);
          setAlreadyCompleted(data.onboardingCompleted === true);
          setDriverName(data.driverName || null);
        })
        .catch((err) => {
          setTokenValid(false);
          setStatusError(err.message || "Invalid or expired link");
        })
        .finally(() => setLoadingStatus(false));
    } else {
      // Auth-based: use stored login data (no API call needed)
      const user = getUser();
      if (user?.onboardingCompleted) {
        setAlreadyCompleted(true);
      }
      setLoadingStatus(false);
    }
  }, [token, usingToken]);

  // Selfie photo upload handler
  const handleSelfieChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type", { description: "Only JPEG, PNG, and WebP images are allowed." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Please select an image under 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setSelfiePreview(reader.result as string);
    reader.readAsDataURL(file);

    setSelfieUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/public/uploads/driver-selfie`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.ok && data.url) {
        setValue("selfiePhotoUrl", data.url, { shouldValidate: true });
        toast.success("Selfie uploaded!");
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      toast.error("Upload failed", { description: "Could not upload selfie. Please try again." });
      setSelfiePreview(null);
      setValue("selfiePhotoUrl", "");
    } finally {
      setSelfieUploading(false);
    }
  }, [setValue]);

  // Submit mutation
  const submitOnboarding = async (data: OnboardingCompleteFormData) => {
    try {
      setIsSubmitting(true);
      let res: Response;
      if (usingToken) {
        // Token-based: call public endpoint (no auth needed)
        res = await fetch(`${API_URL}/api/public/drivers/onboarding-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, token }),
        });
      } else {
        // Auth-based: use useDataMutation style
        res = await fetch(`${API_URL}/api/drivers/onboarding-complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Request failed (${res.status})`);
      }

      toast.success("Onboarding information submitted successfully!", {
        description: "We'll review your information shortly.",
      });
      setSubmitted(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error("Failed to submit onboarding information", {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
      ssn: "",
      licenseNumber: "",
      licenseState: "",
      licenseFrontUrl: "",
      licenseBackUrl: "",
      residentialAddressLine1: "",
      residentialAddressLine2: "",
      residentialCity: "",
      residentialState: "",
      residentialZip: "",
      selfiePhotoUrl: "",
    },
  });

  // Watch fields for validation feedback
  const watchSsn = watch("ssn");
  const watchLicenseNumber = watch("licenseNumber");
  const watchLicenseState = watch("licenseState");
  const watchAddressLine1 = watch("residentialAddressLine1");
  const watchCity = watch("residentialCity");
  const watchState = watch("residentialState");
  const watchZipCode = watch("residentialZip");

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

  // State change handler
  const handleStateChange = useCallback(
    (value: string) => {
      setValue("residentialState", value, { shouldValidate: true });
    },
    [setValue]
  );

  // License state change handler
  const handleLicenseStateChange = useCallback(
    (value: string) => {
      setValue("licenseState", value, { shouldValidate: true });
    },
    [setValue]
  );

  // License front photo upload handler
  const handleLicenseFrontChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type", { description: "Only JPEG, PNG, and WebP images are allowed." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Please select an image under 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLicenseFrontPreview(reader.result as string);
    reader.readAsDataURL(file);

    setLicenseFrontUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/public/uploads/driver-selfie`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.ok && data.url) {
        setValue("licenseFrontUrl", data.url, { shouldValidate: true });
        toast.success("License front uploaded!");
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      toast.error("Upload failed", { description: "Could not upload license front. Please try again." });
      setLicenseFrontPreview(null);
      setValue("licenseFrontUrl", "");
    } finally {
      setLicenseFrontUploading(false);
    }
  }, [setValue]);

  // License back photo upload handler
  const handleLicenseBackChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type", { description: "Only JPEG, PNG, and WebP images are allowed." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Please select an image under 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLicenseBackPreview(reader.result as string);
    reader.readAsDataURL(file);

    setLicenseBackUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/public/uploads/driver-selfie`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (data.ok && data.url) {
        setValue("licenseBackUrl", data.url, { shouldValidate: true });
        toast.success("License back uploaded!");
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      toast.error("Upload failed", { description: "Could not upload license back. Please try again." });
      setLicenseBackPreview(null);
      setValue("licenseBackUrl", "");
    } finally {
      setLicenseBackUploading(false);
    }
  }, [setValue]);

  const onSubmit = (data: OnboardingCompleteFormData) => {
    submitOnboarding(data);
  };

  // ==================== AUTH / TOKEN GUARD RENDERING ====================

  // Token-based flow: invalid token
  if (usingToken && !loadingStatus && tokenValid === false) {
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
                Invalid or Expired Link
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {statusError || "This onboarding link is no longer valid. Please contact support if you need a new link."}
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

  // No-token flow: this page requires a token — redirect to sign-in
  if (!usingToken) {
    const user = isAuthenticated() ? getUser() : null;

    // Authenticated APPROVED driver with no onboarding token — redirect to dashboard
    if (user?.roles?.includes("DRIVER") && user?.driverStatus === 'APPROVED') {
      if (user?.onboardingCompleted) {
        window.location.href = "/driver-dashboard";
        return null;
      }
    }

    // Everyone else (no token, no auth, or pending) — redirect to sign-in
    window.location.href = "/driver-signin";
    return null;
  }

  // Loading onboarding status
  if (loadingStatus) {
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
                <Link
                  to="/driver-signin"
                  className="flex-1 inline-flex items-center justify-center h-12 rounded-2xl font-bold bg-lime-500 hover:bg-lime-600 text-black transition-colors no-underline"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Go to Sign In
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
                SSN is used for background check purposes only. License info must match your actual license.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 pb-6">
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
                  Used for background check purposes only.
                </p>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    ref={ssnInputRef}
                    id="ssn"
                    type={ssnVisible ? "text" : "password"}
                    value={ssnDisplay}
                    onChange={handleSSNChange}
                    className={cn(
                      "h-14 pl-12 pr-10 rounded-2xl tracking-widest font-mono transition-colors",
                      errors.ssn
                        ? "border-red-400 dark:border-red-500"
                        : ssnIsValid
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="Enter 9 digits"
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={9}
                  />
                  <button
                    type="button"
                    onClick={() => setSsnVisible(!ssnVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    tabIndex={-1}
                  >
                    {ssnVisible ? (
                      <EyeOff className="w-5 h-5 text-slate-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </div>
                {errors.ssn && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.ssn.message}
                  </p>
                )}
              </div>
            </CardContent>

            {/* ---- Driver's License Information ---- */}
            <CardHeader className="border-b border-t border-slate-100 dark:border-slate-800">
              <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                Section 2
              </CardDescription>
              <CardTitle className="text-xl font-black mt-1 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-lime-500" />
                Driver&apos;s License Information
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Provide your valid driver&apos;s license details and upload photos of both sides.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 pb-6">
              {/* License Number */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.licenseNumber
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : watchLicenseNumber?.trim() ? "border-green-300 dark:border-green-700" : "border-transparent"
                )}
              >
                <Label htmlFor="licenseNumber" className="text-xs font-bold">
                  License Number{!watchLicenseNumber?.trim() && <span className="text-red-500">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="licenseNumber"
                    {...register("licenseNumber")}
                    className={cn(
                      "h-14 rounded-2xl pr-10 transition-colors",
                      errors.licenseNumber
                        ? "border-red-400 dark:border-red-500"
                        : watchLicenseNumber?.trim()
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="e.g. D1234567"
                    autoComplete="off"
                  />
                  {watchLicenseNumber?.trim() && !errors.licenseNumber && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.licenseNumber && (
                  <p className="text-xs text-red-500 font-medium">{errors.licenseNumber.message}</p>
                )}
              </div>

              {/* License State */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.licenseState
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : watchLicenseState ? "border-green-300 dark:border-green-700" : "border-transparent"
                )}
              >
                <Label className="text-xs font-bold">
                  Issuing State{!watchLicenseState && <span className="text-red-500">*</span>}
                </Label>
                <Select
                  value={watchLicenseState}
                  onValueChange={handleLicenseStateChange}
                >
                  <SelectTrigger
                    className={cn(
                      "h-14 rounded-2xl transition-colors",
                      errors.licenseState
                        ? "border-red-400 dark:border-red-500"
                        : watchLicenseState
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
                {errors.licenseState && (
                  <p className="text-xs text-red-500 font-medium">{errors.licenseState.message}</p>
                )}
              </div>

              {/* License Photos - Front and Back */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* License Front */}
                <div
                  className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.licenseFrontUrl
                      ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                      : "border-transparent"
                  )}
                >
                  <Label className="text-xs font-bold">
                    License Front Photo {!errors.licenseFrontUrl && <span className="text-red-500">*</span>}
                  </Label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Upload a clear photo of the front of your license
                  </p>
                  <input
                    ref={licenseFrontInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLicenseFrontChange}
                    className="hidden"
                  />
                  {licenseFrontPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={licenseFrontPreview} alt="License front" className="w-full h-32 object-cover" />
                      {licenseFrontUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => licenseFrontInputRef.current?.click()}
                      className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 hover:border-lime-500 dark:hover:border-lime-500 transition-colors"
                    >
                      <Camera className="w-6 h-6 text-slate-400" />
                      <span className="text-xs text-slate-500">{licenseFrontUploading ? "Uploading..." : "Click to upload"}</span>
                    </button>
                  )}
                  {errors.licenseFrontUrl && (
                    <p className="text-xs text-red-500 font-medium">{errors.licenseFrontUrl.message}</p>
                  )}
                </div>

                {/* License Back */}
                <div
                  className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.licenseBackUrl
                      ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                      : "border-transparent"
                  )}
                >
                  <Label className="text-xs font-bold">
                    License Back Photo {!errors.licenseBackUrl && <span className="text-red-500">*</span>}
                  </Label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Upload a clear photo of the back of your license
                  </p>
                  <input
                    ref={licenseBackInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLicenseBackChange}
                    className="hidden"
                  />
                  {licenseBackPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={licenseBackPreview} alt="License back" className="w-full h-32 object-cover" />
                      {licenseBackUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => licenseBackInputRef.current?.click()}
                      className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 hover:border-lime-500 dark:hover:border-lime-500 transition-colors"
                    >
                      <Camera className="w-6 h-6 text-slate-400" />
                      <span className="text-xs text-slate-500">{licenseBackUploading ? "Uploading..." : "Click to upload"}</span>
                    </button>
                  )}
                  {errors.licenseBackUrl && (
                    <p className="text-xs text-red-500 font-medium">{errors.licenseBackUrl.message}</p>
                  )}
                </div>
              </div>
            </CardContent>

            {/* ---- Residential Address ---- */}
            <CardHeader className="border-b border-t border-slate-100 dark:border-slate-800">
              <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                Section 3
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
                  errors.residentialAddressLine1
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
                    {...register("residentialAddressLine1")}
                    className={cn(
                      "h-14 pl-12 pr-10 rounded-2xl transition-colors",
                      errors.residentialAddressLine1
                        ? "border-red-400 dark:border-red-500"
                        : watchAddressLine1?.trim()
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="123 Main Street"
                    autoComplete="address-line1"
                    disabled={false}
                  />
                  {watchAddressLine1?.trim() && !errors.residentialAddressLine1 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.residentialAddressLine1 && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.residentialAddressLine1.message}
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
                  {...register("residentialAddressLine2")}
                  className="h-14 rounded-2xl"
                  placeholder="Apt 4B"
                  autoComplete="address-line2"
                  disabled={false}
                />
              </div>

              {/* City */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.residentialCity
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
                    {...register("residentialCity")}
                    className={cn(
                      "h-14 rounded-2xl pr-10 transition-colors",
                      errors.residentialCity
                        ? "border-red-400 dark:border-red-500"
                        : watchCity?.trim()
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="Los Angeles"
                    autoComplete="address-level2"
                    disabled={false}
                  />
                  {watchCity?.trim() && !errors.residentialCity && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                {errors.residentialCity && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.residentialCity.message}
                  </p>
                )}
              </div>

              {/* State + ZIP Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* State */}
                <div
                  className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.residentialState
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
                    disabled={false}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-14 rounded-2xl transition-colors",
                        errors.residentialState
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
                  {watchState && !errors.residentialState && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        {US_STATES.find((s) => s.value === watchState)?.label}
                      </span>
                    </div>
                  )}
                  {errors.residentialState && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.residentialState.message}
                    </p>
                  )}
                </div>

                {/* ZIP Code */}
                <div
                  className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.residentialZip
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
                      {...register("residentialZip")}
                      className={cn(
                        "h-14 rounded-2xl pr-10 transition-colors",
                        errors.residentialZip
                          ? "border-red-400 dark:border-red-500"
                          : zipIsValid
                            ? "border-green-300 dark:border-green-700"
                            : ""
                      )}
                      placeholder="90001"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      maxLength={5}
                      disabled={false}
                    />
                    {zipIsValid && !errors.residentialZip && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                  </div>
                  {errors.residentialZip && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.residentialZip.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>

            {/* ---- Selfie Photo ---- */}
            <CardHeader className="border-b border-t border-slate-100 dark:border-slate-800">
              <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                Section 4
              </CardDescription>
              <CardTitle className="text-xl font-black mt-1 flex items-center gap-2">
                <Camera className="w-5 h-5 text-lime-500" />
                Verification Photo
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Take a clear selfie so we can verify your identity.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 pb-6">
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.selfiePhotoUrl
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : selfiePreview
                      ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30"
                )}
              >
                <Label className="text-xs font-bold">
                  Selfie Photo
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Take a clear selfie so the admin can verify your identity before approval.
                </p>
                <div className="flex items-center gap-4">
                  <input
                    ref={selfieInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    onChange={handleSelfieChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => selfieInputRef.current?.click()}
                    disabled={isSubmitting || selfieUploading}
                    className={cn(
                      "w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all",
                      "hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/10",
                      errors.selfiePhotoUrl
                        ? "border-red-400 text-red-400"
                        : selfiePreview
                          ? "border-green-400 text-green-500"
                          : "border-slate-300 dark:border-slate-600 text-slate-400"
                    )}
                  >
                    {selfieUploading ? (
                      <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
                    ) : selfiePreview ? (
                      <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <Camera className="w-8 h-8" />
                    )}
                  </button>
                  <div className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => selfieInputRef.current?.click()}
                      disabled={isSubmitting || selfieUploading}
                      className="w-full h-10 rounded-xl"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {selfieUploading ? "Uploading..." : selfiePreview ? "Change Photo" : "Take / Upload Selfie"}
                    </Button>
                    {selfiePreview && (
                      <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-medium">
                        Photo uploaded successfully
                      </p>
                    )}
                  </div>
                </div>
                {errors.selfiePhotoUrl && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.selfiePhotoUrl.message}
                  </p>
                )}
              </div>
            </CardContent>

            {/* ---- Submit ---- */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 rounded-2xl font-black text-base bg-lime-500 hover:bg-lime-600 text-black shadow-lg shadow-lime-500/20 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
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
