import React, { useState, useEffect, useCallback } from "react";
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
  Info,
  CheckCircle,
  Check,
  Loader2,
  Lock,
  AlertCircle,
  FileCheck,
  Clock,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LivePhotoCapture } from "@/components/shared/LivePhotoCapture";
import { MobileOnlySignupCard } from "../shared/MobileOnlySignupCard";
import { deviceTouchHint, shouldShowMobileOnlySignup } from "@/lib/device";
import { authFetchRaw, isAuthenticated } from "@/lib/tanstack/dataQuery";
// Reused verbatim from the onboarding-complete page so both forms read as
// one flow: identical site shell and the same (CA-enabled) state list.
import { US_STATES, Header, Footer } from "./driverOnboardingComplete";

// ==================== CONSTANTS ====================

const API_URL = import.meta.env.VITE_API_URL;

// ==================== VALIDATION SCHEMA ====================

// Deliberately narrow (owner decision): while an application is PENDING
// APPROVAL the driver may correct ONLY their driver's license — number,
// issuing state, and the front/back photos. Identity data that must not
// drift mid-review (SSN, date of birth), the residential address, and the
// verification selfie are locked; anything else goes through support. The
// server enforces the exact same field set and the PENDING_APPROVAL gate.
const licenseUpdateSchema = z.object({
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
});

type LicenseUpdateFormData = z.infer<typeof licenseUpdateSchema>;

// ==================== TYPES ====================

interface OnboardingDataResponse {
  driverStatus: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  editable: boolean;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseFrontUrl: string | null;
  licenseBackUrl: string | null;
}

// Friendly one-liners for the not-editable card, keyed by the real status.
// PENDING_APPROVAL is the ONLY editable status — everything else lands on
// this card if the page is opened directly.
const STATUS_LOCKED_COPY: Record<string, string> = {
  WAITLISTED:
    "You haven't been invited to complete your application yet — there is nothing on file to update.",
  INVITED:
    "Your application form is still waiting to be completed. Use the onboarding link to submit it first.",
  APPROVED:
    "You're approved — your license details are locked in. Contact support if something needs to be corrected.",
  SUSPENDED:
    "Your account is suspended, so license details can't be edited right now. Please contact support.",
};

// ==================== COMPONENT ====================

export function DriverOnboardingEdit() {
  // Same PHONE/TABLET-ONLY rule as onboarding-complete (owner rule): the
  // license photos are re-captured through the live camera, so a
  // desktop/laptop never sees the form. The server enforces the same gate
  // on the PATCH endpoint.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The server's device gate rejected the request even though the client
  // gate passed (DevTools emulation can fool the client checks, never the
  // server's) — show the same phone/tablet card the gate would.
  const [serverBlocked, setServerBlocked] = useState(false);
  const [data, setData] = useState<OnboardingDataResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseFrontPreview, setLicenseFrontPreview] = useState<string | null>(null);
  const [licenseBackPreview, setLicenseBackPreview] = useState<string | null>(null);
  const [licenseFrontUploading, setLicenseFrontUploading] = useState(false);
  const [licenseBackUploading, setLicenseBackUploading] = useState(false);
  const navigate = useNavigate();

  // ==================== LOAD PREFILL DATA ====================
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = "/driver-signin";
      return;
    }
    // The touch hint lets the server's mobile-only gate classify the
    // device exactly like the PATCH/save call does — the GET is gated too.
    authFetchRaw(`${API_URL}/api/drivers/onboarding-data`, {
      headers: { "x-device-touch": deviceTouchHint() },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          // Server device gate (403 + storeUrl): the client gate passed but
          // the server disagrees — render the phone/tablet card.
          if (res.status === 403 && errData?.storeUrl) {
            setServerBlocked(true);
            return null;
          }
          throw new Error(
            errData?.message || "Could not load your license information"
          );
        }
        return res.json();
      })
      .then((payload: OnboardingDataResponse | null) => {
        if (payload) setData(payload);
      })
      .catch((err) => {
        setLoadError(err.message || "Could not load your license information");
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
  } = useForm<LicenseUpdateFormData>({
    resolver: zodResolver(licenseUpdateSchema),
    defaultValues: {
      licenseNumber: "",
      licenseState: "CA",
      licenseFrontUrl: "",
      licenseBackUrl: "",
    },
  });

  // Prefill once the payload arrives: the license fields with their stored
  // values, and the stored photo URLs straight into the previews — the
  // driver sees exactly what they submitted, and tapping a photo retakes
  // it through the same live-camera path as the original submission.
  useEffect(() => {
    if (!data) return;
    reset({
      licenseNumber: data.licenseNumber ?? "",
      licenseState: data.licenseState ?? "CA",
      licenseFrontUrl: data.licenseFrontUrl ?? "",
      licenseBackUrl: data.licenseBackUrl ?? "",
    });
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

  const handleLicenseStateChange = useCallback(
    (value: string) => {
      setValue("licenseState", value, { shouldValidate: true });
    },
    [setValue]
  );

  const submitEdit = async (formData: LicenseUpdateFormData) => {
    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        licenseNumber: formData.licenseNumber,
        licenseState: formData.licenseState,
        licenseFrontUrl: formData.licenseFrontUrl,
        licenseBackUrl: formData.licenseBackUrl,
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

        // Server device gate (403 + storeUrl): show the phone/tablet card
        // instead of a toast — same surface as the client gate.
        if (res.status === 403 && errData?.storeUrl) {
          setServerBlocked(true);
          return;
        }

        // License reuse (one driver account per license): the server
        // answers a NEUTRAL 409 — surface it ON the field, scroll the
        // driver there, skip the generic error toast.
        if (code === "LICENSE_ALREADY_REGISTERED") {
          setError("licenseNumber", { type: "manual", message });
          requestAnimationFrame(() => {
            const el = document.getElementById("licenseNumber");
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            (el as HTMLElement | null)?.focus?.({ preventScroll: true });
          });
          return;
        }

        throw new Error(message);
      }

      toast.success("Changes saved!", {
        description: "Your license information has been updated.",
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

  const onSubmit = (formData: LicenseUpdateFormData) => {
    submitEdit(formData);
  };

  // ==================== DEVICE GATE ====================
  // Runs FIRST, before every other branch — same as onboarding-complete.
  if (shouldShowMobileOnlySignup()) {
    return <MobileOnlySignupCard />;
  }

  // Server device gate overruled the client checks (spoofed/emulated
  // device) — same card, no form flash.
  if (serverBlocked) {
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
                  Your license information has been updated. Your status
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
              Loading your license information...
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
  // Only PENDING_APPROVAL drivers reach the form — every other status gets
  // this card (the board hides the button for them too; this is the
  // direct-URL safety net matching the server's gate).
  if (!data.editable) {
    const lockedCopy =
      STATUS_LOCKED_COPY[data.driverStatus] ??
      "License updates are only available while your application is pending approval. Please contact support if something needs to be corrected.";
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
              License Update
            </Badge>
            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800/50">
              <FileCheck className="h-3 w-3 mr-1" />
              Review &amp; Update
            </Badge>
          </div>

          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Update your driver&apos;s license
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mt-4">
              These are the license details and photos you submitted — shown
              exactly as they are on file. Correct the number, switch the
              issuing state, or tap a photo to retake it. All fields marked
              with <span className="text-red-500">*</span> are required.
            </p>
          </div>

          <Alert className="max-w-2xl bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-900/30">
            <Info className="h-4 w-4 text-sky-500" />
            <AlertTitle className="text-sky-900 dark:text-sky-200">
              Only your license can be updated here
            </AlertTitle>
            <AlertDescription className="text-sky-900/80 dark:text-sky-200/80 text-xs">
              While your application is pending approval, this page is limited
              to your license number, issuing state, and photos — everything
              else (address, SSN, date of birth, selfie) stays locked. Saving
              won&apos;t change your status; our team reviews the updated
              version.
            </AlertDescription>
          </Alert>
        </section>

        {/* Form Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* ---- Driver's License Information ---- */}
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                On File
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
                    : watch("licenseNumber")?.trim()
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
                        if (watch("licenseNumber")?.trim()) trigger("licenseNumber");
                      },
                    })}
                    className={cn(
                      "h-14 rounded-2xl pr-10 transition-colors",
                      errors.licenseNumber
                        ? "border-red-400 dark:border-red-500"
                        : watch("licenseNumber")?.trim()
                          ? "border-green-300 dark:border-green-700"
                          : ""
                    )}
                    placeholder="e.g. D1234567"
                    autoComplete="off"
                  />
                  {watch("licenseNumber")?.trim() && !errors.licenseNumber && (
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
