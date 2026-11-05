import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ArrowRight,
  User,
  Shield,
  LogIn,
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
  Camera,
  FileCheck,
  Clock,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LivePhotoCapture } from "@/components/shared/LivePhotoCapture";
import { MobileOnlySignupCard } from "../shared/MobileOnlySignupCard";
import { deviceTouchHint, shouldShowMobileOnlySignup } from "@/lib/device";
import { authFetchRaw, isAuthenticated, getUser } from "@/lib/tanstack/dataQuery";
// Reused verbatim from the onboarding-complete page so both forms read as
// one flow: identical site shell and the same (CA-enabled) state list.
import { US_STATES, Header, Footer } from "./driverOnboardingComplete";

// ==================== CONSTANTS ====================

const API_URL = import.meta.env.VITE_API_URL;

// ==================== VALIDATION SCHEMA ====================

// Same rules as the onboarding-complete form, with three differences:
//   • ssn is optional — an empty value keeps the SSN already on file
//     (shown masked); a non-empty value must be 9 digits.
//   • residentialZip IS collected here, prefilled from the stored value
//     (the completion form never asks — at signup it was authoritative).
//   • dateOfBirth is optional, MM/DD/YYYY, validated as a real date.
const onboardingEditSchema = z.object({
  ssn: z
    .string()
    .regex(/^(\d{9})?$/, "SSN must be exactly 9 digits"),
  licenseNumber: z
    .string()
    .min(1, "License number is required")
    .max(15, "License number is too long")
    .regex(/^[A-Za-z]?\d{1,14}$/, "Enter a valid license number (e.g. D1234567)"),
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
    .regex(/^(\d{5}(-\d{4})?)?$/, "ZIP code must be 5 digits"),
  selfiePhotoUrl: z.string().min(1, "Selfie photo is required"),
  dateOfBirth: z
    .string()
    .regex(/^(\d{2}\/\d{2}\/\d{4})?$/, "Use MM/DD/YYYY"),
});

type OnboardingEditFormData = z.infer<typeof onboardingEditSchema>;

// ==================== HELPER FUNCTIONS ====================

/** Format DOB input as user types (auto-add slashes) */
const formatDOB = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

/** Reject impossible calendar dates (02/31/1990) before the server does. */
const isRealDate = (dobStr: string): boolean => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) return false;
  const [m, d, y] = dobStr.split("/").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  );
};

// ==================== TYPES ====================

interface OnboardingDataResponse {
  driverStatus: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  editable: boolean;
  dateOfBirth: string | null;
  dateOfBirthDisplay: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseFrontUrl: string | null;
  licenseBackUrl: string | null;
  selfiePhotoUrl: string | null;
  residentialAddressLine1: string | null;
  residentialAddressLine2: string | null;
  residentialCity: string | null;
  residentialState: string | null;
  residentialZip: string | null;
  ssnLastFour: string | null;
  agreementAcceptedAt: string | null;
}

// Friendly one-liners for the not-editable card, keyed by the real status.
const STATUS_LOCKED_COPY: Record<string, string> = {
  WAITLISTED:
    "You haven't been invited to complete your application yet — there is nothing to edit yet.",
  INVITED:
    "Your application form is still waiting to be completed. Use the onboarding link to submit it first.",
  APPROVED:
    "You're approved — your application details are locked in. Contact support if something needs to be corrected.",
  SUSPENDED:
    "Your account is suspended, so application details can't be edited right now. Please contact support.",
};

// ==================== COMPONENT ====================

export function DriverOnboardingEdit() {
  // Same PHONE/TABLET-ONLY rule as onboarding-complete (owner rule): the
  // edit form re-captures license and selfie photos through the live
  // camera, so a desktop/laptop never sees the form. The server enforces
  // the same gate on the PATCH endpoint.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ssnDisplay, setSsnDisplay] = useState("");
  const [ssnVisible, setSsnVisible] = useState(false);
  const [ssnEditEnabled, setSsnEditEnabled] = useState(false);
  const ssnInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingDataResponse | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseFrontPreview, setLicenseFrontPreview] = useState<string | null>(null);
  const [licenseBackPreview, setLicenseBackPreview] = useState<string | null>(null);
  const [licenseFrontUploading, setLicenseFrontUploading] = useState(false);
  const [licenseBackUploading, setLicenseBackUploading] = useState(false);
  const [dobDisplay, setDobDisplay] = useState("");
  const navigate = useNavigate();

  // ==================== LOAD PREFILL DATA ====================
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = "/driver-signin";
      return;
    }
    authFetchRaw(`${API_URL}/api/drivers/onboarding-data`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load your application information");
        return res.json();
      })
      .then((payload: OnboardingDataResponse) => {
        setData(payload);
        if (payload.dateOfBirthDisplay) {
          setDobDisplay(payload.dateOfBirthDisplay);
        }
      })
      .catch((err) => {
        setLoadError(err.message || "Could not load your application information");
      })
      .finally(() => setLoadingData(false));
  }, []);

  // Form setup (defaults filled from the loaded data below via reset)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<OnboardingEditFormData>({
    resolver: zodResolver(onboardingEditSchema),
    defaultValues: {
      ssn: "",
      licenseNumber: "",
      licenseState: "CA",
      licenseFrontUrl: "",
      licenseBackUrl: "",
      residentialAddressLine1: "",
      residentialAddressLine2: "",
      residentialCity: "",
      residentialState: "CA",
      residentialZip: "",
      selfiePhotoUrl: "",
      dateOfBirth: "",
    },
  });

  // Prefill once the payload arrives: every text field with its stored
  // value, and the stored photo URLs straight into the previews — the
  // driver sees exactly what they submitted, and tapping a photo retakes
  // it through the same live-camera path as the original submission.
  useEffect(() => {
    if (!data) return;
    reset({
      ssn: "",
      licenseNumber: data.licenseNumber ?? "",
      licenseState: data.licenseState ?? "CA",
      licenseFrontUrl: data.licenseFrontUrl ?? "",
      licenseBackUrl: data.licenseBackUrl ?? "",
      residentialAddressLine1: data.residentialAddressLine1 ?? "",
      residentialAddressLine2: data.residentialAddressLine2 ?? "",
      residentialCity: data.residentialCity ?? "",
      residentialState: data.residentialState ?? "CA",
      residentialZip: data.residentialZip ?? "",
      selfiePhotoUrl: data.selfiePhotoUrl ?? "",
      dateOfBirth: data.dateOfBirthDisplay ?? "",
    });
    setSelfiePreview(data.selfiePhotoUrl ?? null);
    setLicenseFrontPreview(data.licenseFrontUrl ?? null);
    setLicenseBackPreview(data.licenseBackUrl ?? null);
  }, [data, reset]);

  // Photo upload — the file ALWAYS arrives from the live camera
  // (LivePhotoCapture); same public upload endpoint the onboarding-complete
  // form uses, so no new upload route is introduced.
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/public/uploads/driver-selfie`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const dataJson = await res.json();
      if (!dataJson.ok || !dataJson.url) throw new Error("Upload failed");
      return dataJson.url as string;
    },
    []
  );

  const handleSelfieCapture = useCallback(
    async (file: File, previewDataUrl: string) => {
      setSelfiePreview(previewDataUrl);
      setSelfieUploading(true);
      try {
        const url = await uploadFile(file);
        setValue("selfiePhotoUrl", url, { shouldValidate: true });
        toast.success("Selfie updated!");
      } catch {
        toast.error("Upload failed", {
          description: "Could not upload selfie. Please try again.",
        });
        setSelfiePreview(null);
        setValue("selfiePhotoUrl", "");
      } finally {
        setSelfieUploading(false);
      }
    },
    [setValue, uploadFile]
  );

  const handleLicenseFrontCapture = useCallback(
    async (file: File, previewDataUrl: string) => {
      setLicenseFrontPreview(previewDataUrl);
      setLicenseFrontUploading(true);
      try {
        const url = await uploadFile(file);
        setValue("licenseFrontUrl", url, { shouldValidate: true });
        toast.success("License front updated!");
      } catch {
        toast.error("Upload failed", {
          description: "Could not upload license front. Please try again.",
        });
        setLicenseFrontPreview(null);
        setValue("licenseFrontUrl", "");
      } finally {
        setLicenseFrontUploading(false);
      }
    },
    [setValue, uploadFile]
  );

  const handleLicenseBackCapture = useCallback(
    async (file: File, previewDataUrl: string) => {
      setLicenseBackPreview(previewDataUrl);
      setLicenseBackUploading(true);
      try {
        const url = await uploadFile(file);
        setValue("licenseBackUrl", url, { shouldValidate: true });
        toast.success("License back updated!");
      } catch {
        toast.error("Upload failed", {
          description: "Could not upload license back. Please try again.",
        });
        setLicenseBackPreview(null);
        setValue("licenseBackUrl", "");
      } finally {
        setLicenseBackUploading(false);
      }
    },
    [setValue, uploadFile]
  );

  // Bring an errored field into view after the state update renders it.
  const focusField = (id: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null)?.focus?.({ preventScroll: true });
    });
  };

  // Watch fields for validation feedback
  const watchSsn = watch("ssn");
  const watchLicenseNumber = watch("licenseNumber");
  const watchAddressLine1 = watch("residentialAddressLine1");
  const watchCity = watch("residentialCity");
  const watchState = watch("residentialState");
  const watchZip = watch("residentialZip");
  const watchDob = watch("dateOfBirth");

  const ssnIsValid = watchSsn?.trim() && /^\d{9}$/.test(watchSsn);
  const dobTouched = !!watchDob && watchDob !== (data?.dateOfBirthDisplay ?? "");

  const handleSSNChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawDigits = e.target.value.replace(/\D/g, "").slice(0, 9);
      // A fresh edit dismisses a server "already registered" error — the
      // driver is correcting the value, the red state should follow.
      clearErrors("ssn");
      setSsnDisplay(rawDigits);
      setValue("ssn", rawDigits, { shouldValidate: true });
    },
    [setValue, clearErrors]
  );

  const handleStateChange = useCallback(
    (value: string) => {
      setValue("residentialState", value, { shouldValidate: true });
    },
    [setValue]
  );

  const handleLicenseStateChange = useCallback(
    (value: string) => {
      setValue("licenseState", value, { shouldValidate: true });
    },
    [setValue]
  );

  const handleDobChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDOB(e.target.value);
      setDobDisplay(formatted);
      setValue("dateOfBirth", formatted, { shouldValidate: true });
    },
    [setValue]
  );

  const submitEdit = async (formData: OnboardingEditFormData) => {
    // Client-side real-date check for a changed DOB (the server re-checks).
    if (dobTouched && !isRealDate(formData.dateOfBirth)) {
      setError("dateOfBirth", {
        type: "manual",
        message: "Enter a real date in MM/DD/YYYY format",
      });
      focusField("dateOfBirth");
      return;
    }
    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        licenseNumber: formData.licenseNumber,
        licenseState: formData.licenseState,
        licenseFrontUrl: formData.licenseFrontUrl,
        licenseBackUrl: formData.licenseBackUrl,
        residentialAddressLine1: formData.residentialAddressLine1,
        residentialAddressLine2: formData.residentialAddressLine2 || undefined,
        residentialCity: formData.residentialCity,
        residentialState: formData.residentialState,
        selfiePhotoUrl: formData.selfiePhotoUrl,
        // Optional fields are sent only when the driver actually entered
        // something — an omitted SSN keeps the one already on file, and an
        // omitted ZIP keeps the stored one (the completion-form contract).
        ...(ssnEditEnabled && formData.ssn ? { ssn: formData.ssn } : {}),
        ...(formData.residentialZip
          ? { residentialZip: formData.residentialZip }
          : {}),
        ...(dobTouched && formData.dateOfBirth
          ? { dateOfBirth: formData.dateOfBirth }
          : {}),
      };

      // The touch hint lets the server's mobile-only gate classify the
      // device exactly like the onboarding-complete call does.
      const res = await authFetchRaw(`${API_URL}/api/drivers/onboarding-data`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-device-touch": deviceTouchHint(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData: any = await res.json().catch(() => ({}));
        const code: string | undefined = errData?.code;
        const message: string =
          errData?.message || `Request failed (${res.status})`;

        // Identity reuse (one driver account per SSN / per license): the
        // server answers a NEUTRAL 409 — surface it ON the field, scroll
        // the driver there, skip the generic error toast.
        if (code === "SSN_ALREADY_REGISTERED") {
          setSsnEditEnabled(true);
          setError("ssn", { type: "manual", message });
          focusField("ssn");
          return;
        }
        if (code === "LICENSE_ALREADY_REGISTERED") {
          setError("licenseNumber", { type: "manual", message });
          focusField("licenseNumber");
          return;
        }

        throw new Error(message);
      }

      toast.success("Changes saved!", {
        description: "Your application information has been updated.",
      });
      setSaved(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error("Failed to save changes", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = (formData: OnboardingEditFormData) => {
    submitEdit(formData);
  };

  // ==================== DEVICE GATE ====================
  // Runs FIRST, before every other branch — same as onboarding-complete.
  if (shouldShowMobileOnlySignup()) {
    return <MobileOnlySignupCard />;
  }

  // ==================== SAVED SCREEN ====================
  if (saved) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <main className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-lg w-full border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-10 text-center space-y-6">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/20 animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CheckCircle className="w-14 h-14 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Changes Saved!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Your application information has been updated. Your status
                  hasn&apos;t changed — our team reviews the latest version on
                  file.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/driver-application-submitted" })}
                  className="w-full inline-flex items-center justify-center h-12 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
                >
                  Back to Application Status
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
                <Link to="/home">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-2xl font-bold"
                  >
                    Done
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

  // ==================== LOADING ====================
  if (loadingData) {
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
              Loading your application information...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ==================== LOAD ERROR ====================
  if (loadError || !data) {
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
                Something went wrong
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {loadError || "Please sign in again and try back later."}
              </p>
              <Link to="/driver-application-submitted">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  Back to Application Status
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // ==================== NOT EDITABLE ====================
  if (!data.editable) {
    const lockedCopy =
      STATUS_LOCKED_COPY[data.driverStatus] ??
      "Your application information can't be edited for your current status. Please contact support if something needs to be corrected.";
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <main className="flex-1 flex items-center justify-center px-6">
          <Card className="max-w-md w-full border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                <Lock className="w-8 h-8 text-slate-500 dark:text-slate-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Editing not available
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {lockedCopy}
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {data.driverStatus.replace(/_/g, " ")}
                </span>
              </div>
              <Link to="/driver-application-submitted">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  Back to Application Status
                </Button>
              </Link>
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
              <Pencil className="h-3 w-3 mr-1" />
              Edit Application
            </Badge>
            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800/50">
              <FileCheck className="h-3 w-3 mr-1" />
              Review &amp; Update
            </Badge>
          </div>

          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Edit your application
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mt-4">
              Everything you submitted is right here — review it, correct it,
              and save. Photos are prefilled too; tap one to retake it. All
              fields marked with <span className="text-red-500">*</span> are
              required.
            </p>
          </div>

          <Alert className="max-w-2xl bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-900/30">
            <Info className="h-4 w-4 text-sky-500" />
            <AlertTitle className="text-sky-900 dark:text-sky-200">
              Saving won&apos;t change your status
            </AlertTitle>
            <AlertDescription className="text-sky-900/80 dark:text-sky-200/80 text-xs">
              Updates only refresh the information our team reviews — your
              application status stays exactly as it is.
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
                Date of birth and SSN as you originally submitted them.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 pb-6">
              {/* DOB */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.dateOfBirth
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : dobTouched && watchDob
                      ? "border-green-300 dark:border-green-700"
                      : "border-transparent"
                )}
              >
                <Label htmlFor="dateOfBirth" className="text-xs font-bold">
                  Date of Birth
                  <span className="text-slate-400 dark:text-slate-500 ml-1 font-normal text-[10px]">
                    (leave unchanged to keep what&apos;s on file)
                  </span>
                </Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="dateOfBirth"
                    type="text"
                    value={dobDisplay}
                    onChange={handleDobChange}
                    className={cn(
                      "h-14 pl-12 rounded-2xl font-mono transition-colors",
                      errors.dateOfBirth
                        ? "border-red-400 dark:border-red-500"
                        : dobTouched && watchDob
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="MM/DD/YYYY"
                    autoComplete="bday"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </div>
                {errors.dateOfBirth ? (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.dateOfBirth.message}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Currently on file: {data.dateOfBirthDisplay ?? "—"}
                  </p>
                )}
              </div>

              {/* SSN — masked "on file" until the driver chooses to change it */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.ssn
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : "border-transparent"
                )}
              >
                <Label className="text-xs font-bold">
                  Social Security Number
                </Label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Used for background check purposes only — kept private and
                  encrypted.
                </p>
                {!ssnEditEnabled ? (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span className="font-mono tracking-widest text-sm text-slate-700 dark:text-slate-300">
                        ••• - {data.ssnLastFour ?? "••••"}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-[10px]"
                      >
                        on file
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl font-bold"
                      onClick={() => {
                        setSsnEditEnabled(true);
                        setSsnDisplay("");
                        setValue("ssn", "");
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Update
                    </Button>
                  </div>
                ) : (
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
                      placeholder="Enter 9 digits to replace"
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
                )}
                {errors.ssn && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.ssn.message}
                  </p>
                )}
                {!ssnEditEnabled && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Leave it as is — your SSN is only replaced if you tap
                    Update and enter a new one.
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
                Your license details and photos as submitted. Tap a photo to
                retake it if the quality was poor or your license changed.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 pb-6">
              {/* License Number */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.licenseNumber
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : watchLicenseNumber?.trim()
                      ? "border-green-300 dark:border-green-700"
                      : "border-transparent"
                )}
              >
                <Label htmlFor="licenseNumber" className="text-xs font-bold">
                  License Number
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="licenseNumber"
                    {...register("licenseNumber", {
                      maxLength: 15,
                      onChange: () => {
                        // Any edit dismisses a server "already registered" error.
                        clearErrors("licenseNumber");
                        if (watchLicenseNumber?.trim()) trigger("licenseNumber");
                      },
                    })}
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
                  <p className="text-xs text-red-500 font-medium">
                    {errors.licenseNumber.message}
                  </p>
                )}
              </div>

              {/* License State */}
              <div
                className={cn(
                  "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                  errors.licenseState
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                    : "border-transparent"
                )}
              >
                <Label className="text-xs font-bold">
                  Issuing State<span className="text-red-500 ml-1">*</span>
                </Label>
                <Select
                  value={watch("licenseState") || undefined}
                  onValueChange={handleLicenseStateChange}
                >
                  <SelectTrigger
                    className={cn(
                      "h-14 rounded-2xl transition-colors",
                      errors.licenseState
                        ? "border-red-400 dark:border-red-500"
                        : watch("licenseState")
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                  >
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  {/* Popper anchoring — same dropdown glitch fix as the
                      completion form's state selects. */}
                  <SelectContent
                    position="popper"
                    className="max-h-64 overflow-y-auto z-50"
                    sideOffset={4}
                  >
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value} — {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.licenseState && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.licenseState.message}
                  </p>
                )}
              </div>

              {/* License Photos — prefilled with the stored uploads */}
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
                    License Front Photo<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    The photo currently on file is shown.
                  </p>
                  {licenseFrontPreview ? (
                    <>
                      <img
                        src={licenseFrontPreview}
                        alt="License front on file"
                        className="w-full h-32 object-cover rounded-xl border-2 border-green-400 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLicenseFrontPreview(null)}
                      />
                      {licenseFrontUploading && (
                        <p className="text-[10px] text-sky-500 mt-1">Uploading...</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">
                        Tap the photo to retake
                      </p>
                    </>
                  ) : (
                    <LivePhotoCapture
                      kind="license-front"
                      facing="environment"
                      hint="Fit the FRONT of your license inside the frame"
                      uploading={licenseFrontUploading}
                      disabled={isSubmitting}
                      onCapture={handleLicenseFrontCapture}
                    />
                  )}
                  {errors.licenseFrontUrl && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.licenseFrontUrl.message}
                    </p>
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
                    License Back Photo<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    The photo currently on file is shown.
                  </p>
                  {licenseBackPreview ? (
                    <>
                      <img
                        src={licenseBackPreview}
                        alt="License back on file"
                        className="w-full h-32 object-cover rounded-xl border-2 border-green-400 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setLicenseBackPreview(null)}
                      />
                      {licenseBackUploading && (
                        <p className="text-[10px] text-sky-500 mt-1">Uploading...</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">
                        Tap the photo to retake
                      </p>
                    </>
                  ) : (
                    <LivePhotoCapture
                      kind="license-back"
                      facing="environment"
                      hint="Fit the BACK of your license inside the frame"
                      uploading={licenseBackUploading}
                      disabled={isSubmitting}
                      onCapture={handleLicenseBackCapture}
                    />
                  )}
                  {errors.licenseBackUrl && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.licenseBackUrl.message}
                    </p>
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
                documents. Moving? Update it here so your service area stays
                correct.
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
                <Label htmlFor="addressLine1" className="text-xs font-bold">
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
                    State<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={watchState || undefined}
                    onValueChange={handleStateChange}
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
                    <SelectContent
                      position="popper"
                      className="max-h-64 overflow-y-auto z-50"
                      sideOffset={4}
                    >
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

                {/* ZIP — prefilled from the signup value; optional so an
                    untouched field never overwrites what's stored. */}
                <div
                  className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.residentialZip
                      ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                      : "border-transparent"
                  )}
                >
                  <Label htmlFor="zip" className="text-xs font-bold">
                    ZIP Code
                    <span className="text-slate-400 dark:text-slate-500 ml-1 font-normal text-[10px]">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="zip"
                    {...register("residentialZip")}
                    className={cn(
                      "h-14 rounded-2xl font-mono transition-colors",
                      errors.residentialZip
                        ? "border-red-400 dark:border-red-500"
                        : watchZip
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="90001"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={10}
                  />
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
                The selfie on file is shown — tap it to retake a clearer one.
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
                  Selfie Photo<span className="text-red-500 ml-1">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  <LivePhotoCapture
                    kind="selfie"
                    facing="user"
                    hint="Center your face in the frame"
                    variant="square"
                    previewUrl={selfiePreview}
                    uploading={selfieUploading}
                    disabled={isSubmitting}
                    onCapture={handleSelfieCapture}
                    onRetake={() => setSelfiePreview(null)}
                  />
                  <div className="flex-1">
                    <LivePhotoCapture
                      kind="selfie"
                      facing="user"
                      hint="Center your face in the frame"
                      variant="button"
                      buttonLabel={
                        selfieUploading
                          ? "Uploading..."
                          : selfiePreview
                            ? "Retake Selfie"
                            : "Take Selfie"
                      }
                      disabled={isSubmitting || selfieUploading}
                      onCapture={handleSelfieCapture}
                    />
                    {selfiePreview && (
                      <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-medium">
                        Photo on file
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
                    Saving changes...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 mt-3">
                By saving, you confirm that the updated information is accurate
                and truthful.
              </p>
            </div>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
