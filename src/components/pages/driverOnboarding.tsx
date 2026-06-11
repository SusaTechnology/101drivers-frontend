// @ts-nocheck
import React, { useCallback, useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Handshake, AlertTriangle, ArrowRight } from "lucide-react";
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Home,
  Phone,
  Mail,
  Lock,
  Camera,
  MapPin,
  Filter,
  Bell,
  User,
  Shield,
  Clock,
  LogIn,
  Info,
  UserCheck,
  Users,
  Database,
  AlertCircle,
  Menu,
  X,
  Eye,
  EyeOff,
  Check,
  CheckCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataMutation, useDataQuery } from "@/lib/tanstack/dataQuery";

// Form validation schema (unchanged)
const onboardingSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    dateOfBirth: z
      .string()
      .min(1, "Date of birth is required")
      .regex(
        /^\d{2}\/\d{2}\/\d{4}$/,
        "Date must be in MM/DD/YYYY format"
      ),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(10, "Phone number is required and it must be 10 digits"),
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
    homeArea: z.string().regex(/^\d{5}$/, "Enter a valid 5-digit ZIP code"),
    radius: z.string().optional(),
    districts: z.array(z.string()).optional(),
    alerts: z.boolean().optional(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and privacy policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => {
    // Validate age >= 25
    const dobStr = data.dateOfBirth;
    if (!dobStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) return false;
    const [m, d, y] = dobStr.split('/').map(Number);
    const dob = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const mDiff = today.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 25;
  }, {
    message: "You must be at least 25 years old to apply",
    path: ["dateOfBirth"],
  });

type OnboardingFormData = z.infer<typeof onboardingSchema>;

// localStorage key for persisting signup draft
const DRIVER_SIGNUP_DRAFT_KEY = "driverSignupDraft";

interface DriverSignupPayload {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  homeArea?: string;
  preferredRadius?: string;
  districts?: string[];
  emailAlerts?: boolean;
  agreementAcceptedAt?: string;
}

// Format phone number to US format: (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const truncated = digits.slice(0, 10);
  
  // Format based on length
  if (truncated.length === 0) return '';
  if (truncated.length <= 3) return truncated;
  if (truncated.length <= 6) return `(${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
  return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6)}`;
};

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

export default function DriverOnboardingPage() {
  const DRIVER_PENDING_PAYLOAD_KEY = 'driverPendingPayload';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [dobDisplay, setDobDisplay] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openSheet, setOpenSheet] = useState<'agreement' | 'terms' | 'privacy' | null>(null);

  const navigate = useNavigate();

  // Redirect to the application submitted page after registration.
  useEffect(() => {
    if (registrationComplete) {
      navigate({ to: '/driver-application-submitted' })
    }
  }, [registrationComplete, navigate])

  // Handle phone input with formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneDisplay(formatted);
    // Store only digits for form submission
    const digits = formatted.replace(/\D/g, '');
    setValue("phone", digits);

    if (digits.length === 10) {
    clearErrors("phone");
  }
  };

  // Mutation for sending OTP (first step)
  const sendOtpMutation = useDataMutation<
    { message: string },
    DriverSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/driver/`, // Adjust endpoint as needed
    onSuccess: (data, variables) => {
      toast.success("Code sent to your email", {
        description: `${data.message}`,
      });
      // Store payload for the verify page
      sessionStorage.setItem(DRIVER_PENDING_PAYLOAD_KEY, JSON.stringify(variables));
      // Navigate to the dedicated OTP verification page
      navigate({ to: '/driver-verify-email' });
    },
    onError: (error) => {
      const errorMessage = error.message || "Please try again later.";
      
      // Check if error is related to email already existing
      const isEmailExistsError = errorMessage.toLowerCase().includes("email") && 
        (errorMessage.toLowerCase().includes("already") || 
         errorMessage.toLowerCase().includes("exists") ||
         errorMessage.toLowerCase().includes("registered"));
      
      if (isEmailExistsError) {
        toast.error("Email already registered", {
          description: "This email is already associated with an account. Please sign in instead.",
          action: {
            label: "Sign In",
            onClick: () => navigate({ to: "/driver-signin" }),
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
    fetchWithoutRefresh: true,
  });



  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    clearErrors,
    formState: { errors },
    reset,
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      homeArea: '',
      radius: '',
      alerts: true,
      acceptTerms: false,
      districts: [],
    },
  });
  
    const {
    data: districtList,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/public/serviceDistricts`,
    noFilter: true,
    fetchWithoutRefresh: true,
  })
  console.log("districtList", districtList);

  const districts = [
    {
      id: "LA-West",
      label: "LA — West",
      description: "Santa Monica, Venice, Westwood",
    },
    {
      id: "LA-Central",
      label: "LA — Central",
      description: "Downtown, Hollywood, Koreatown",
    },
    {
      id: "OC",
      label: "Orange County",
      description: "Irvine, Anaheim, Santa Ana",
    },
    {
      id: "BayArea",
      label: "Bay Area",
      description: "San Francisco, Oakland, San Jose",
    },
  ];

  const handleDistrictChange = (districtId: string, checked: boolean) => {
    if (checked) {
      const updated = [...selectedDistricts, districtId];
      setSelectedDistricts(updated);
      setValue("districts", updated);
    } else {
      const updated = selectedDistricts.filter((id) => id !== districtId);
      setSelectedDistricts(updated);
      setValue("districts", updated);
    }
  };

  // Check for OTP in URL (email link resume) and redirect to verify page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOtp = urlParams.get('otp');
    
    if (urlOtp) {
      const draftStr = localStorage.getItem(DRIVER_SIGNUP_DRAFT_KEY);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.formData) {
            // Reconstruct the payload from draft form data
            const payload: DriverSignupPayload = {
              email: draft.formData.email,
              password: draft.formData.password,
              fullName: draft.formData.fullName,
              dateOfBirth: draft.formData.dateOfBirth,
              phone: draft.formData.phone,
              homeArea: draft.formData.homeArea,
              preferredRadius: draft.formData.radius,
              districts: draft.formData.districts,
              emailAlerts: draft.formData.alerts,
              agreementAcceptedAt: new Date().toISOString(),
            };
            // Store payload and redirect to verify page (with OTP in URL)
            sessionStorage.setItem(DRIVER_PENDING_PAYLOAD_KEY, JSON.stringify(payload));
            navigate({ to: '/driver-verify-email', search: { otp: urlOtp } });
          }
        } catch (e) {
          console.error('Failed to parse draft', e);
          toast.error('Session expired', {
            description: 'Please start a new registration.',
          });
        }
      } else {
        toast.error('Session expired', {
          description: 'Please start a new registration.',
        });
      }
    }
  }, [navigate, reset]);

  const onSubmit = async (data: OnboardingFormData) => {
    if (!data.acceptTerms) {
      toast.error("Please accept the terms and conditions");
      return;
    }

    // Prepare base payload
    const basePayload: DriverSignupPayload = {
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      phone: data.phone,
      homeArea: data.homeArea,
      preferredRadius: data.radius,
      districts: data.districts,
      emailAlerts: data.alerts,
      agreementAcceptedAt: new Date().toISOString(),
    };

    // Save draft to localStorage so user can resume via email link
    const draft = {
      formData: data,
    };
    localStorage.setItem(DRIVER_SIGNUP_DRAFT_KEY, JSON.stringify(draft));

    // Send OTP
    sendOtpMutation.mutate(basePayload);
  };

  // Watch all form fields for validation feedback
  const acceptTerms = watch("acceptTerms");
  const homeAreaValue = watch("homeArea");
  const watchPassword = watch("password");
  const watchConfirmPassword = watch("confirmPassword");
  const watchRadius = watch("radius");
  const watchFullName = watch("fullName");
  const watchDateOfBirth = watch("dateOfBirth");
  const watchEmail = watch("email");
  const watchPhone = watch("phone");

  // Age gate: compute actual age from DOB
  const computedAge = useMemo(() => {
    const dobStr = watchDateOfBirth;
    if (!dobStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) return null;
    const [m, d, y] = dobStr.split('/').map(Number);
    const dob = new Date(y, m - 1, d);
    if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const mDiff = today.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }, [watchDateOfBirth]);

  const isAgeVerified = computedAge !== null && computedAge >= 25;
  const isUnder25 = computedAge !== null && computedAge < 25;

  // Password validation checks
  const passwordChecks = {
    minLength: (watchPassword?.length || 0) >= 8,
    hasUppercase: /[A-Z]/.test(watchPassword || ''),
    hasLowercase: /[a-z]/.test(watchPassword || ''),
    hasNumber: /[0-9]/.test(watchPassword || ''),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(watchPassword || ''),
    hasMatch: watchPassword && watchConfirmPassword && watchPassword === watchConfirmPassword,
    allValid: false, // Will be calculated below
  };
  passwordChecks.allValid = passwordChecks.minLength && passwordChecks.hasUppercase && passwordChecks.hasLowercase && passwordChecks.hasNumber && passwordChecks.hasSpecial && passwordChecks.hasMatch;

  // Check if all required fields are filled (radius is optional)
  const allRequiredFieldsFilled = (
    (watchFullName?.trim().length || 0) >= 2 &&
    watchEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchEmail) &&
    passwordChecks.allValid &&
    (watchPhone?.replace(/\D/g, '').length || 0) >= 10 &&
    /^\d{5}$/.test(homeAreaValue?.trim() || '')  
  );

  // Form is ready to submit only when all fields are filled AND terms accepted
  const isFormReady = allRequiredFieldsFilled && acceptTerms;

  // Determine if any mutation is pending
  const isPending = sendOtpMutation.isPending;

  // Header component (unchanged)
  const Header = () => (
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
              to="/driver/signin"
              className="text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Driver Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );

  // Footer component (unchanged)
  const Footer = () => (
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
              Driver onboarding • Waitlist after signup • Email-first
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            © 2024 101 Drivers Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="w-full max-w-[1100px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Title Section (unchanged) */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div className="space-y-6">
            {/* <div className="flex flex-wrap gap-2">
              <Badge className="bg-lime-100 dark:bg-lime-900/20 text-lime-800 dark:text-lime-200 border-lime-200">
                <User className="h-3 w-3 mr-1" />
                Driver Onboarding
              </Badge>
              <Badge
                variant="outline"
                className="bg-slate-100 dark:bg-slate-800/50"
              >
                <Shield className="h-3 w-3 mr-1" />
                Waitlist after signup
              </Badge>
              <Badge
                variant="outline"
                className="bg-slate-100 dark:bg-slate-800/50"
              >
                <Phone className="h-3 w-3 mr-1" />
                Mobile-first (PWA-ready)
              </Badge>
            </div> */}

            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                Join the 101 Drivers Waitlist
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mt-4">
                You can complete signup and join the
                <span className="font-extrabold text-lime-600 dark:text-lime-400">
                  {" "}
                  Waitlist{" "}
                </span>
                . Once an admin invites you, you'll complete your full application. Only
                <span className="font-extrabold text-lime-600 dark:text-lime-400">
                  {" "}
                  approved drivers{" "}
                </span>
                can book jobs. You must be at least 25 years old.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              to="/driver-signin"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <LogIn className="h-4 w-4" />
              Already have an account?
            </Link>
          </div>
        </section>

        {!registrationComplete ? (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Account Basics (unchanged) */}
            <div className="lg:col-span-7">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                        Step 1
                      </CardDescription>
                      <CardTitle className="text-2xl font-black mt-2">
                        Sign up for the waitlist
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="hidden sm:flex">
                      <Lock className="h-3 w-3 mr-1" />
                      Secure
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* <div className="space-y-2">
                      <Label htmlFor="username" className="text-xs font-bold">
                        Username
                      </Label>
                      <Input
                        id="username"
                        {...register("username")}
                        className="h-14 rounded-2xl"
                        placeholder="driver123"
                        disabled={isPending}
                      />
                      {errors.username && (
                        <p className="text-xs text-red-500">
                          {errors.username.message}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        Choose a unique username (3-20 characters, letters,
                        numbers, underscores only)
                      </p>
                    </div> */}

                    {/* Date of Birth */}
                    <div className={cn(
                      "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                      isUnder25 || errors.dateOfBirth
                        ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                        : "border-transparent"
                    )}>
                      <Label className="text-xs font-bold">
                        Date of birth{!watchDateOfBirth?.trim() && <span className="text-red-500">*</span>}
                      </Label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                        You must be at least 25 years old to join the waitlist.
                      </p>
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "h-14 w-full pl-12 pr-10 rounded-2xl border border-input bg-background text-left text-sm transition-colors flex items-center",
                              "hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500",
                              isUnder25
                                ? "border-red-400 dark:border-red-500"
                                : errors.dateOfBirth
                                  ? "border-red-400 dark:border-red-500"
                                  : watchDateOfBirth?.trim() && /^\d{2}\/\d{2}\/\d{4}$/.test(watchDateOfBirth)
                                    ? "border-green-300 dark:border-green-700"
                                    : ""
                            )}
                            disabled={isPending}
                          >
                            <CalendarIcon className="w-4 h-4 text-slate-400 mr-2 ml-8" />
                            <span className={cn("flex-1 text-base", !dobDisplay && "text-slate-400")}>
                              {dobDisplay || "Select your date of birth"}
                            </span>
                            {watchDateOfBirth?.trim() && /^\d{2}\/\d{2}\/\d{4}$/.test(watchDateOfBirth) && !errors.dateOfBirth && !isUnder25 && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarPicker
                            mode="single"
                            selected={parseDOBtoDate(dobDisplay)}
                            onSelect={(date: Date | undefined) => {
                              if (date) {
                                const formatted = formatDateToStr(date);
                                setDobDisplay(formatted);
                                setValue("dateOfBirth", formatted, { shouldValidate: true });
                                setCalendarOpen(false);
                              }
                            }}
                            disabled={(date: Date) => {
                              const today = new Date();
                              const minDate = new Date(today);
                              minDate.setFullYear(minDate.getFullYear() - 25);
                              // Disable dates after today, before 1920, or that would make driver under 25
                              return date > today || date < new Date("1920-01-01") || date > minDate;
                            }}
                            defaultMonth={parseDOBtoDate(dobDisplay) || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 25); return d; })()}
                            captionLayout="dropdown"
                            fromYear={1920}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                      {isUnder25 ? (
                        <div className="flex items-start gap-2 mt-1">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                            You are <span className="font-black">{computedAge} years old</span>. You must be at least <span className="font-black">25 years old</span> to join the waitlist. Please enter a correct date of birth.
                          </p>
                        </div>
                      ) : errors.dateOfBirth ? (
                        <p className="text-xs text-red-500 font-medium">
                          {errors.dateOfBirth.message}
                        </p>
                      ) : null}
                    </div>

                    {/* Age Gate Banner */}
                    {isUnder25 ? (
                      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 space-y-2">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-red-900 dark:text-red-200">
                              Sorry, you do not meet the age requirement
                            </p>
                            <p className="text-xs text-red-800/80 dark:text-red-300/80 mt-1">
                              You are {computedAge} years old. You must be at least 25 years old to join the waitlist. If you entered the wrong date, please correct it above.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : !isAgeVerified ? (
                      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 space-y-2">
                        <div className="flex items-start gap-3">
                          <Shield className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                              Age Requirement — 25 or Older
                            </p>
                            <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1">
                              You must be at least 25 years old to join the waitlist. Enter your date of birth above to unlock the rest of the form.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <p className="text-xs font-bold text-green-800 dark:text-green-200">
                            Age verified! You may continue with your application.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Full Name */}
                    <div className={cn(
                      "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                      errors.fullName
                        ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                        : "border-transparent"
                    )}>
                      <Label htmlFor="fullName" className="text-xs font-bold">
                        Full legal name (exactly as it appears on your driver's license){!watchFullName?.trim() && <span className="text-red-500">*</span>}
                      </Label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                        This must match your driver's license exactly.
                      </p>
                      <div className="relative">
                        <Input
                          id="fullName"
                          {...register("fullName")}
                          className={cn(
                            "h-14 rounded-2xl pr-10 transition-colors",
                            errors.fullName
                              ? "border-red-400 dark:border-red-500"
                              : watchFullName?.trim()
                                ? "border-green-300 dark:border-green-700"
                                : ""
                          )}
                          placeholder="Full legal name as on driver's license"
                          autoComplete="name"
                          disabled={isPending || !isAgeVerified}
                        />
                        {watchFullName?.trim() && !errors.fullName && (
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

                    {/* Email */}
                    <div className={cn(
                      "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                      errors.email
                        ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                        : "border-transparent"
                    )}>
                      <Label htmlFor="email" className="text-xs font-bold">
                        Email{!watchEmail?.trim() && <span className="text-red-500">*</span>}
                      </Label>
                      <div className="relative">
                        <Input
                          id="email"
                          {...register("email")}
                          className={cn(
                            "h-14 rounded-2xl pr-10 transition-colors",
                            errors.email
                              ? "border-red-400 dark:border-red-500"
                              : watchEmail?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchEmail)
                                ? "border-green-300 dark:border-green-700"
                                : ""
                          )}
                          placeholder="jane@example.com"
                          type="email"
                          autoComplete="email"
                          disabled={isPending || !isAgeVerified}
                        />
                        {watchEmail?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchEmail) && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                        )}
                      </div>
                      {errors.email && (
                        <p className="text-xs text-red-500 font-medium">
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-xs font-bold">
                          Password{!passwordChecks.allValid && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="password"
                            {...register("password")}
                            className="h-14 pl-12 pr-12 rounded-2xl"
                            placeholder="Create password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="off"
                            disabled={isPending || !isAgeVerified}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                          >
                            {showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        {errors.password && (
                          <p className="text-xs text-red-500">
                            {errors.password.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="confirmPassword"
                          className="text-xs font-bold"
                        >
                          Confirm Password{!passwordChecks.hasMatch && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="confirmPassword"
                            {...register("confirmPassword")}
                            className="h-14 pl-12 pr-12 rounded-2xl"
                            placeholder="Repeat password"
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="off"
                            disabled={isPending || !isAgeVerified}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        {errors.confirmPassword && (
                          <p className="text-xs text-red-500">
                            {errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Password Requirements - Always visible */}
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

                    {/* Phone */}
                    <div className={cn(
                      "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                      errors.phone
                        ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                        : "border-transparent"
                    )}>
                      <Label htmlFor="phone" className="text-xs font-bold">
                        Phone{(watchPhone?.replace(/\D/g, '').length || 0) < 10 && <span className="text-red-500">*</span>}
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="phone"
                          name="phone"
                          value={phoneDisplay}
                          onChange={handlePhoneChange}
                          onBlur={() => trigger("phone")}
                          className={cn(
                            "h-14 pl-12 rounded-2xl transition-colors",
                            errors.phone
                              ? "border-red-400 dark:border-red-500"
                              : (watchPhone?.replace(/\D/g, '').length || 0) >= 10
                                ? "border-green-300 dark:border-green-700"
                                : ""
                          )}
                          placeholder="(555) 123-4567"
                          type="tel"
                          autoComplete="tel-national"
                          inputMode="tel"
                          maxLength={14}
                          disabled={isPending || !isAgeVerified}
                        />
                        <input type="hidden" {...register("phone")} />
                        {(watchPhone?.replace(/\D/g, '').length || 0) >= 10 && !errors.phone && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                        )}
                      </div>
                      {errors.phone && (
                        <p className="text-xs text-red-500 font-medium">
                          {errors.phone.message}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        US phone number format. Used for operational contact.
                      </p>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Camera + Location Note (unchanged) */}
              {/* <Card className="mt-6 border-slate-200 dark:border-slate-800">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center flex-shrink-0">
                      <Camera className="h-6 w-6 text-lime-600 dark:text-lime-400" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">
                        Camera + location required during jobs
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Jobs require compliance evidence (photos, odometer) and
                        Start/Stop tracking. You'll be prompted on mobile when
                        needed.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card> */}
            </div>

            {/* Right: Service Area Preferences */}
            <div className={cn("lg:col-span-5 transition-opacity duration-300", !isAgeVerified && "opacity-40 pointer-events-none")}>
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                        Step 2 
                      </CardDescription>
                      <CardTitle className="text-2xl font-black mt-2">
                        Service area preferences
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        These optional preferences help filter your job feed and power job alerts.
                        You can set these later in your profile settings.
                      </p>
                    </div>
                    {/* <Badge variant="outline" className="hidden sm:flex">
                      <Filter className="h-3 w-3 mr-1" />
                      Optional
                    </Badge> */}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Home ZIP Code */}
                  <div className={cn(
                    "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                    errors.homeArea
                      ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                      : "border-transparent"
                  )}>
                    <Label htmlFor="homeArea" className="text-xs font-bold">
                      Home ZIP Code {!homeAreaValue?.trim() && <span className="text-red-500"> *</span>}
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="homeArea"
                        {...register("homeArea")}
                        className={cn(
                          "h-14 pl-12 rounded-2xl transition-colors",
                          errors.homeArea
                            ? "border-red-400 dark:border-red-500"
                            : homeAreaValue?.trim()
                              ? "border-green-300 dark:border-green-700"
                              : ""
                        )}
                        placeholder="90012"
                        disabled={isPending || !isAgeVerified}
                      />
                      {homeAreaValue?.trim() && !errors.homeArea && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                      )}
                    </div>
                    {errors.homeArea && (
                      <p className="text-xs text-red-500 font-medium">
                        {errors.homeArea.message}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enter your 5-digit California ZIP code. We only operate in California.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="radius" className="text-xs font-bold">
                      Preferred radius <span className="text-slate-400 font-normal">(optional)</span>
                    </Label>
                    <Select
                      key={`radius-${draftLoaded}`}
                      value={watchRadius || ""}
                      onValueChange={(value) => setValue("radius", value)}
                      disabled={isPending || !isAgeVerified}
                    >
                      <SelectTrigger className="h-14 rounded-2xl">
                        <SelectValue placeholder="Select radius" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="25">25 miles</SelectItem>
                        <SelectItem value="50">50 miles</SelectItem>
                        <SelectItem value="75">75 miles</SelectItem>
                        <SelectItem value="100">100 miles</SelectItem>

                      </SelectContent>
                    </Select>
                    {errors.radius && (
                      <p className="text-xs text-red-500">
                        {errors.radius.message}
                      </p>
                    )}
                  </div>

                  {/* <div className="space-y-3">
                    <Label className="text-xs font-bold">
                      Job alerts (optional)
                    </Label>
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="alerts"
                          checked={watch("alerts")}
                          onCheckedChange={(checked) => setValue("alerts", checked as boolean)}
                          disabled={isPending || !isAgeVerified}
                        />
                        <div>
                          <Label
                            htmlFor="alerts"
                            className="font-black text-slate-900 dark:text-white text-sm cursor-pointer"
                          >
                            Enable email alerts for new matching jobs
                          </Label>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Email-first notifications. SMS may be enabled later
                            by admin policy.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div> */}


                </CardContent>
              </Card>

              {/* Agreements & Submit Section — below Step 2, separate section */}
              <div className="mt-6 space-y-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                {/* Box 1: Important Policy Information */}
                <Alert className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 shadow-md rounded-2xl">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm">
                    Important Policy Information
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs">
                    Drivers cannot cancel or reassign jobs in the app. Only book
                    a job if you can complete it. For rare emergencies that arise
                    after booking, contact customer support.
                  </AlertDescription>
                </Alert>

                {/* Box 2: Agreement Checkbox */}
                <div className="space-y-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shadow-md">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="acceptTerms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setValue("acceptTerms", checked as boolean)}
                      className="mt-0.5 w-5 h-5 rounded accent-lime-500"
                    />
                    <Label
                      htmlFor="acceptTerms"
                      className={cn(
                        "text-sm cursor-pointer leading-relaxed flex items-center flex-wrap gap-y-1",
                        acceptTerms
                          ? "text-green-700 dark:text-green-300 font-medium"
                          : "text-slate-700 dark:text-slate-300"
                      )}
                    >
                      By checking this box, I acknowledge that I have read, understood, and agree to be bound by the{" "}
                      <button
                        type="button"
                        className="font-extrabold hover:text-lime-500 underline"
                        onClick={() => setOpenSheet('agreement')}
                      >
                        Independent Driver Agreement
                      </button>
                      , the{" "}
                      <button
                        type="button"
                        className="font-extrabold hover:text-lime-500 underline"
                        onClick={() => setOpenSheet('terms')}
                      >
                        Terms of Service
                      </button>
                      , and the{" "}
                      <button
                        type="button"
                        className="font-extrabold hover:text-lime-500 underline"
                        onClick={() => setOpenSheet('privacy')}
                      >
                        Privacy Policy
                      </button>
                      .
                    </Label>
                  </div>
                </div>

                {/* Box 3: Submit Button */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shadow-md">
                  <Button
                    type="submit"
                    onClick={handleSubmit(onSubmit)}
                    disabled={isPending || !isAgeVerified || !isFormReady}
                    className={cn(
                      "w-full py-6 rounded-2xl transition flex items-center justify-center gap-2 text-lg font-extrabold",
                      (!isAgeVerified || !isFormReady)
                        ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        : "bg-lime-500 hover:bg-lime-600 text-slate-950 hover:shadow-xl hover:shadow-lime-500/20",
                    )}
                  >
                    {isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-950"></div>
                        Continue...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-3">
                    After clicking Continue, you'll receive a verification code via email.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* Success/Pending Approval Panel - Polished */
          <section className="mt-10">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
              {/* Success Header with gradient */}
              <div className="relative bg-gradient-to-br from-lime-500/20 via-lime-500/10 to-transparent py-12 px-6 sm:px-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(163,230,53,0.1),transparent_50%)]" />
                <div className="relative flex flex-col items-center text-center">
                  {/* Animated Checkmark */}
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
                  
                  {/* Status Badge */}
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      Pending Approval
                    </span>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 sm:p-10">
                {/* What's Next Section */}
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
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">Start Driving</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Access your driver dashboard and start booking jobs!</p>
                    </div>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="mb-8 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-lime-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">While You Wait</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        You can bookmark the sign-in page. Once approved, you'll use your email and password to access your driver dashboard.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
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

                {/* Help Text */}
                <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Questions? Contact support at{" "}
                  <a href="mailto:support@101drivers.com" className="font-bold text-lime-500 hover:underline">
                    support@101drivers.com
                  </a>
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <Footer />

      {/* In-app sheet for agreement / terms / privacy — no navigation, one tap to go back */}
      <Sheet open={!!openSheet} onOpenChange={(open) => !open && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pt-8 px-6">
            <SheetTitle className="text-2xl font-black text-slate-900 dark:text-white">
              {openSheet === 'agreement' && 'Independent Driver Agreement'}
              {openSheet === 'terms' && 'Terms of Service'}
              {openSheet === 'privacy' && 'Privacy Policy'}
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">
              {openSheet === 'agreement' && 'Effective: April 1, 2026'}
              {openSheet === 'terms' && 'Effective date: March 2024'}
              {openSheet === 'privacy' && 'Last updated: March 2024'}
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 pb-10 space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {openSheet === 'agreement' && (
              <>
                <p>This Independent Driver Agreement ("Agreement") is entered into by and between the driver ("Driver") and 101 Drivers, Inc. ("Company"). By checking the agreement box during signup, the Driver acknowledges and agrees to the following terms and conditions.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">1. Independent Contractor Status</h3></div>
                <p>The Driver acknowledges and agrees that they are an independent contractor and not an employee of the Company. The Driver shall be solely responsible for determining the manner and means by which services are performed. The Company does not control the Driver's work schedule, methods, or procedures, except as may be reasonably necessary to ensure the quality of services provided. Nothing in this Agreement shall be construed to create an employment relationship, partnership, joint venture, or agency relationship between the Driver and the Company.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Handshake className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">2. Services</h3></div>
                <p>The Driver agrees to perform vehicle delivery services as requested through the Company's platform. The Driver shall use their own vehicle, equipment, and tools to perform the services. The Driver represents that they possess a valid driver's license, appropriate insurance coverage, and any other licenses or permits required by law to perform the services.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Handshake className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">3. Compensation</h3></div>
                <p>The Driver shall be compensated for completed delivery services as outlined on the Company's platform. Compensation rates may be adjusted by the Company from time to time with reasonable notice. The Driver acknowledges that they are responsible for all taxes, including self-employment taxes, related to the compensation received under this Agreement.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">4. Insurance and Liability</h3></div>
                <p>The Driver shall maintain, at their own expense, appropriate automobile liability insurance that meets or exceeds the minimum requirements of the state(s) in which they operate. The Driver agrees to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from the Driver's negligent acts or omissions in the performance of services under this Agreement.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">5. Background Check</h3></div>
                <p>The Driver consents to a background check and driving record review as a condition of providing services through the Company's platform. The Company reserves the right to suspend or terminate this Agreement if the results of such checks do not meet the Company's standards.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">6. Confidentiality</h3></div>
                <p>The Driver agrees to maintain the confidentiality of any proprietary or sensitive information received from the Company or its customers, including but not limited to customer contact information, delivery addresses, and business practices. This obligation survives the termination of this Agreement.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">7. Termination</h3></div>
                <p>Either party may terminate this Agreement at any time, with or without cause, by providing written notice to the other party. Upon termination, the Driver shall return any Company property and cease representing themselves as affiliated with the Company.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">8. Governing Law</h3></div>
                <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the courts located in the State of Georgia.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">9. Entire Agreement</h3></div>
                <p>This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Info className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">10. Acknowledgment</h3></div>
                <p>BY CHECKING THE AGREEMENT BOX DURING DRIVER SIGNUP, THE DRIVER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. THE DRIVER FURTHER ACKNOWLEDGES THAT THEY HAVE HAD THE OPPORTUNITY TO REVIEW THIS AGREEMENT AND TO ASK QUESTIONS ABOUT ITS PROVISIONS.</p>

                <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p className="text-[11px] leading-normal font-medium">This Agreement contains provisions that dictate how claims between you and 101 Drivers can be brought. By agreeing during signup, you acknowledge that you understand and accept all of the terms outlined in this Agreement.</p>
                </div>
              </>
            )}

            {openSheet === 'terms' && (
              <>
                <p>These Terms will govern your use of the 101 Drivers platform, including quote requests, delivery coordination, and compliance evidence handling. The terms are aligned with applicable laws for California operations.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Key Concepts</h3></div>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Quote-first flow: you can view an estimate before providing additional details.</li>
                  <li>Compliance evidence: deliveries may require photos, odometer readings, and VIN last-4 verification.</li>
                  <li>Notifications: email-first updates (SMS optional if enabled by Admin policy).</li>
                  <li>Platform rules: cancellation, rescheduling, and dispute handling will follow published policies.</li>
                </ul>

                <div className="flex items-center gap-2 mt-6 mb-2"><UserCheck className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Accounts & Eligibility</h3></div>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Dealers/individual customers may create delivery requests after authentication (when enabled).</li>
                  <li>Drivers may require onboarding and approval before booking jobs.</li>
                  <li>Admin oversight may be required for certain operations and compliance.</li>
                </ul>

                <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 flex gap-3">
                  <Info className="h-5 w-5 shrink-0" />
                  <p className="text-[11px] leading-normal font-medium">This page contains general information. For specific legal questions, please consult with legal counsel.</p>
                </div>
              </>
            )}

            {openSheet === 'privacy' && (
              <>
                <p>101 Drivers Privacy Policy outlines how we collect, use, and share your personal information as a user of the 101 Drivers Platform. Our goal is to simplify your life by providing a reliable vehicle delivery platform, and to do so, we need to collect some of your personal information.</p>
                <p>This policy applies to all users of the 101 Drivers Platform, including Customers and Drivers (including Driver applicants), and all 101 Drivers services.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Database className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">The Information We Collect</h3></div>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Device Information:</strong> Hardware model, operating system, unique device identifiers, and mobile network information.</li>
                  <li><strong>Log Information:</strong> Browser type, access times, pages viewed, IP address, and referring page.</li>
                  <li><strong>Location Information:</strong> GPS signal or information about nearby Wi-Fi access points and cell towers.</li>
                </ul>

                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-5 mb-2">Location, Usage, and Device Data</h4>
                <p>For Customers, we collect your device's precise location from the time you request a vehicle delivery until it ends. For Drivers, we collect your device's precise location when you use the app. We also collect delivery information like date, time, destination, distance, route, and payment.</p>

                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-5 mb-2">Communications Data</h4>
                <p>We facilitate phone calls and text messages between Customers and Drivers without sharing either party's actual phone number. However, we collect information about these communications, including phone numbers, date/time, and contents of SMS and chat messages.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><Clock className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">How We Use Your Information</h3></div>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Provide an intuitive, useful, efficient experience on our platform</li>
                  <li>Verify your identity, maintain your account, settings, and preferences</li>
                  <li>Connect you to your vehicle deliveries and provide various offerings</li>
                  <li>Calculate prices and process payments</li>
                  <li>Allow Customers and Drivers to connect and share their location</li>
                  <li>Communicate with you about your use of the platform</li>
                  <li>Maintain the security and safety of the platform and its users</li>
                  <li>Authenticate users, investigate and resolve incidents, prevent fraud</li>
                  <li>Provide customer support and improve the platform through research</li>
                </ul>

                <div className="flex items-center gap-2 mt-6 mb-2"><Users className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">How We Share Your Information</h3></div>
                <p>We do not sell your personal information to third parties for money, and we do not act as a data broker.</p>
                <ul className="list-disc pl-5 space-y-2 mt-2">
                  <li>The Customer's vehicle pickup and destination location, name, and vehicle info</li>
                  <li>The Driver's name and profile photo</li>
                  <li>We do not share actual phone numbers or contact information</li>
                </ul>

                <div className="flex items-center gap-2 mt-6 mb-2"><Lock className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Data Retention and Security</h3></div>
                <p>We retain your information for as long as necessary to provide you and our other users the 101 Drivers Platform. We take reasonable measures to protect your personal information, but we cannot guarantee security against unauthorized intrusions.</p>

                <div className="flex items-center gap-2 mt-6 mb-2"><UserCheck className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Your Rights and Choices</h3></div>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Unsubscribe from commercial/promotional emails by clicking unsubscribe</li>
                  <li>Opt out of promotional text messages and push notifications through device settings</li>
                  <li>Review and edit account information through your account settings</li>
                  <li>Prevent location sharing through your device's system settings</li>
                  <li>Modify cookie settings on your browser</li>
                  <li>Delete your 101 Drivers account by contacting us</li>
                </ul>

                <div className="flex items-center gap-2 mt-6 mb-2"><Mail className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Contact Us</h3></div>
                <p>For any questions or concerns about your privacy, contact us at:</p>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 mt-2">
                  <a href="mailto:driver@101drivers.com" className="text-lime-500 font-bold hover:underline">driver@101drivers.com</a>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setOpenSheet(null)}
              className="mt-6 w-full h-12 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold transition-colors"
            >
              Go Back to Sign Up
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}