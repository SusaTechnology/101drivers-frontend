// @ts-nocheck
import React, { useCallback, useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config';
import LocationAutocomplete from "@/components/map/LocationAutocomplete"; // adjust path as needed
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
    phone: z.string().min(10, "Phone number is required"),
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
    homeArea: z.string().optional(),
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
}

interface DriverSignupPayloadWithOtp extends DriverSignupPayload {
  verificationToken: string;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [pendingSignupData, setPendingSignupData] = useState<DriverSignupPayload | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [dobDisplay, setDobDisplay] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  
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
  };

  // Load Google Maps API for autocomplete
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

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
      setOtpSent(true);
      setPendingSignupData(variables); // Store data for second step
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

  // Mutation for resending code
  const resendCodeMutation = useDataMutation<
    { message: string },
    DriverSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/driver/`, // Same endpoint as send
    onSuccess: (data) => {
      toast.success("Code resent successfully", {
        description: "Check your email for the new verification code.",
      });
    },
    onError: (error) => {
      toast.error("Failed to resend code", {
        description: error.message || "Please try again later.",
      });
    },
    successMessage: "Code resent successfully",
    errorMessage: "Failed to resend code",
    fetchWithoutRefresh: true,
  });

  // Mutation for verifying OTP and final registration (second step)
  const verifyOtpMutation = useDataMutation<
    { message: string },
    DriverSignupPayloadWithOtp
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/driver`, // Adjust endpoint as needed
    onSuccess: (data, variables) => {
      toast.success("Registration successful!", {
        description: "You've been added to the waitlist. We'll notify you when you're invited to complete your application.",
      });
      // Clear draft from localStorage
      localStorage.removeItem(DRIVER_SIGNUP_DRAFT_KEY);
      // Store driver info in localStorage (excluding password for security, but you can store as needed)
      const { password, ...safeData } = variables;
      localStorage.setItem("driverSignupData", JSON.stringify(safeData));
      setRegistrationComplete(true);
    },
    onError: (error) => {
      toast.error("Verification failed", {
        description: error.message || "Invalid code or server error.",
      });
    },
    successMessage: "Driver signup submitted successfully",
    errorMessage: "Failed to submit driver signup",
    fetchWithoutRefresh: true,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      alerts: true,
      acceptTerms: true,
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

  // Check for OTP in URL and restore draft from localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOtp = urlParams.get('otp');
    
    if (urlOtp) {
      const draftStr = localStorage.getItem(DRIVER_SIGNUP_DRAFT_KEY);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.formData) {
            // Restore form data
            reset(draft.formData, { keepDefaultValues: false });
            // Restore selected districts
            if (draft.formData.districts) {
              setSelectedDistricts(draft.formData.districts);
            }
            // Set OTP and show verification step
            setOtpValue(urlOtp);
            setOtpSent(true);
            setDraftLoaded(true);
            console.log("Draft restored from localStorage for OTP verification");
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      } else {
        // No draft found - user might have cleared storage or link expired
        toast.error("Session expired", {
          description: "Please start a new registration.",
        });
      }
    }
  }, [reset]);

  // Handler for when a place is selected from autocomplete
  const handleHomeAreaSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.formatted_address) {
      setValue("homeArea", place.formatted_address);
    }
  }, []);

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
    };

    if (!otpSent) {
      // Step 1: Send OTP
      // Save draft to localStorage so user can resume via email link
      const draft = {
        formData: data,
      };
      localStorage.setItem(DRIVER_SIGNUP_DRAFT_KEY, JSON.stringify(draft));
      sendOtpMutation.mutate(basePayload);
    } else {
      // Step 2: Verify OTP and complete registration
      if (!otpValue.trim()) {
        toast.error("Please enter the verification code");
        return;
      }
      const payloadWithOtp: DriverSignupPayloadWithOtp = {
        ...basePayload,
        verificationToken: otpValue,
      };
      verifyOtpMutation.mutate(payloadWithOtp);
    }
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

  // Check if all required fields are filled (homeArea and radius are optional)
  const allRequiredFieldsFilled = (
    (watchFullName?.trim().length || 0) >= 2 &&
    watchEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchEmail) &&
    passwordChecks.allValid &&
    (watchPhone?.replace(/\D/g, '').length || 0) >= 10
  );

  // Form is ready to submit only when all fields are filled AND terms accepted
  const isFormReady = allRequiredFieldsFilled && acceptTerms;

  // Determine if any mutation is pending
  const isPending = sendOtpMutation.isPending || verifyOtpMutation.isPending || resendCodeMutation.isPending;

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
            <div className="flex flex-wrap gap-2">
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
            </div>

            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                Become a certified 101 Driver
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mt-4">
                Drivers can complete signup and join the
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

            <Alert className="max-w-2xl bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
              <Info className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-900 dark:text-amber-200">
                Important Information
              </AlertTitle>
              <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs">
                Email verification is required before accessing protected
                features (email-first). Phone is collected for operational
                contact; phone verification may be optional per policy.
              </AlertDescription>
            </Alert>
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
                        Create your driver account
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Use email + password. Email verification is required.
                        Phone is collected for operational calls/notifications.
                      </p>
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
                          disabled={isPending}
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

                    {/* Date of Birth */}
                    <div className={cn(
                      "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                      errors.dateOfBirth
                        ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                        : "border-transparent"
                    )}>
                      <Label className="text-xs font-bold">
                        Date of birth{!watchDateOfBirth?.trim() && <span className="text-red-500">*</span>}
                      </Label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                        You must be at least 25 years old to apply as a driver.
                      </p>
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "h-14 w-full pl-12 pr-10 rounded-2xl border border-input bg-background text-left text-sm transition-colors flex items-center",
                              "hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500",
                              errors.dateOfBirth
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
                            {watchDateOfBirth?.trim() && /^\d{2}\/\d{2}\/\d{4}$/.test(watchDateOfBirth) && !errors.dateOfBirth && (
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
                            disabled={(date: Date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            defaultMonth={parseDOBtoDate(dobDisplay) || undefined}
                            captionLayout="dropdown"
                            fromYear={1920}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                      {errors.dateOfBirth && (
                        <p className="text-xs text-red-500 font-medium">
                          {errors.dateOfBirth.message}
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
                          disabled={isPending}
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
                            disabled={isPending}
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
                            disabled={isPending}
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
                          disabled={isPending}
                        />
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

                    {/* Terms and Conditions */}
                    <div 
                      className={cn(
                        "space-y-2 p-4 rounded-2xl border transition-all duration-300",
                        allRequiredFieldsFilled && !acceptTerms
                          ? "border-red-400 dark:border-red-600 bg-red-100 dark:bg-red-900/30 shadow-lg shadow-red-200 dark:shadow-red-900/30 animate-pulse"
                          : acceptTerms
                          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30"
                      )}
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="acceptTerms"
                          checked={acceptTerms}
                          onCheckedChange={(checked) => setValue("acceptTerms", checked as boolean)}
                          disabled={isPending}
                          className={cn(
                            allRequiredFieldsFilled && !acceptTerms && "data-[state=unchecked]:border-red-500 data-[state=unchecked]:bg-red-100"
                          )}
                        />
                        <Label
                          htmlFor="acceptTerms"
                          className={cn(
                            "text-sm cursor-pointer leading-relaxed",
                            allRequiredFieldsFilled && !acceptTerms
                              ? "text-red-700 dark:text-red-300 font-bold"
                              : acceptTerms
                              ? "text-green-700 dark:text-green-300 font-medium"
                              : "text-slate-600 dark:text-slate-400"
                          )}
                        >
                          By continuing, you agree to our{" "}
                          <Link
                            to="/terms"
                            className="font-extrabold hover:text-lime-500 underline"
                            target="_blank"
                          >
                            Terms
                          </Link>{" "}
                          and{" "}
                          <Link
                            to="/privacy"
                            className="font-extrabold hover:text-lime-500 underline"
                            target="_blank"
                          >
                            Privacy Policy
                          </Link>
                          .
                        </Label>
                      </div>
                      {errors.acceptTerms && (
                        <p className="text-xs text-red-500">
                          {errors.acceptTerms.message}
                        </p>
                      )}
                      {allRequiredFieldsFilled && !acceptTerms && (
                        <p className="text-sm text-red-600 dark:text-red-400 font-bold flex items-center gap-2 bg-red-200 dark:bg-red-800/50 p-2 rounded-lg">
                          <AlertCircle className="h-4 w-4" />
                          Please check the box above to accept terms and continue
                        </p>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Camera + Location Note (unchanged) */}
              <Card className="mt-6 border-slate-200 dark:border-slate-800">
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
              </Card>
            </div>

            {/* Right: Service Area Preferences */}
            <div className="lg:col-span-5">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                        Step 2 <span className="text-slate-400 font-normal">(Optional)</span>
                      </CardDescription>
                      <CardTitle className="text-2xl font-black mt-2">
                        Service area preferences
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        These optional preferences help filter your job feed and power job alerts.
                        You can set these later in your profile settings.
                      </p>
                    </div>
                    <Badge variant="outline" className="hidden sm:flex">
                      <Filter className="h-3 w-3 mr-1" />
                      Optional
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Home Area with Google Places Autocomplete (unchanged) */}
                  <div className="space-y-2">
                    <Label htmlFor="homeArea" className="text-xs font-bold">
                      Home city or ZIP code <span className="text-slate-400 font-normal">(optional)</span>
                    </Label>
                    <LocationAutocomplete
                      value={homeAreaValue || ""}
                      onChange={(val) => setValue("homeArea", val)}
                      onPlaceSelect={handleHomeAreaSelect}
                      isLoaded={isLoaded}
                      placeholder="Los Angeles, CA or 90012"
                      icon={<MapPin className="h-4 w-4 text-slate-400" />}
                      types={['geocode']} // Allow cities, ZIP codes, and addresses
                    />
                    {errors?.homeArea && (
                      <p className="text-xs text-red-500">
                        {errors.homeArea.message}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enter your California city or ZIP code. We only operate in California.
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
                      disabled={isPending}
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

                  <div className="space-y-3">
                    <Label className="text-xs font-bold">
                      Job alerts (optional)
                    </Label>
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="alerts"
                          checked={watch("alerts")}
                          onCheckedChange={(checked) => setValue("alerts", checked as boolean)}
                          disabled={isPending}
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
                  </div>

                  {/* Code Input Field - appears only after code sent */}
                  {otpSent && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="otp" className="text-xs font-bold">
                          Enter Verification Code
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (pendingSignupData) {
                              resendCodeMutation.mutate(pendingSignupData);
                            }
                          }}
                          disabled={resendCodeMutation.isPending}
                          className="text-xs h-8 px-3 text-lime-600 hover:text-lime-700 dark:text-lime-400 dark:hover:text-lime-300 font-semibold"
                        >
                          {resendCodeMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-lime-600 mr-2"></div>
                              Sending...
                            </>
                          ) : (
                            "Resend Code"
                          )}
                        </Button>
                      </div>
                      <Input
                        id="otp"
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value)}
                        className="h-14 rounded-2xl text-center text-lg tracking-widest font-mono"
                        placeholder="123456"
                        maxLength={6}
                        disabled={isPending}
                      />
                      <p className="text-[11px] text-slate-500">
                        Enter the 6-digit code sent to your email.
                      </p>
                    </div>
                  )}

                  <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm">
                      Important Policy Information
                    </AlertTitle>
                    <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs">
                      Drivers cannot cancel/reassign jobs in-app. Operations
                      handles reassignment. You can report issues and request
                      schedule changes after booking.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    onClick={handleSubmit(onSubmit)}
                    disabled={isPending || !isFormReady || (otpSent && !otpValue.trim())}
                    className={cn(
                      "w-full py-6 rounded-2xl transition flex items-center justify-center gap-2 text-lg font-extrabold",
                      !isFormReady
                        ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        : "bg-lime-500 hover:bg-lime-600 text-slate-950 hover:shadow-xl hover:shadow-lime-500/20",
                    )}
                  >
                    {isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-950"></div>
                        {sendOtpMutation.isPending || resendCodeMutation.isPending ? "Sending Code..." : "Verifying..."}
                      </>
                    ) : !allRequiredFieldsFilled ? (
                      "Complete All Required Fields"
                    ) : !acceptTerms ? (
                      "Accept Terms & Conditions"
                    ) : otpSent ? (
                      <>
                        Verify & Submit
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    ) : (
                      <>
                        Send Code to Email
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    {otpSent
                      ? "After verification, your application will be submitted for admin approval."
                      : "After submission, you'll receive a verification code via email."}
                  </p>
                </CardContent>
              </Card>
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
    </div>
  );
}