// @ts-nocheck
import React, { useCallback, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useJsApiLoader } from "@react-google-maps/api";
import LocationAutocomplete from "@/components/map/LocationAutocomplete"; // adjust path as needed
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataMutation, useDataQuery } from "@/lib/tanstack/dataQuery";

// Form validation schema (unchanged)
const onboardingSchema = z
  .object({
    // username: z
    //   .string()
    //   .min(3, "Username must be at least 3 characters")
    //   .max(20, "Username must be less than 20 characters")
    //   .regex(
    //     /^[a-zA-Z0-9_]+$/,
    //     "Username can only contain letters, numbers, and underscores",
    //   ),
    fullName: z.string().min(2, "Full name is required"),
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
    homeArea: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().min(1, "Home area is required").optional(),
    ),
    radius: z.string().min(1, "Preferred radius is required").optional(),
    jobMiles: z
      .string()
      .min(1, "Job distance preference is required")
      .optional(),
    districts: z.array(z.string()).optional(),
    alerts: z.boolean().optional(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and privacy policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type OnboardingFormData = z.infer<typeof onboardingSchema>;

interface DriverSignupPayload {
  // username: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  homeArea?: string;
  preferredRadius?: string;
  preferredJobDistance?: string;
  districts?: string[];
  emailAlerts?: boolean;
}

interface DriverSignupPayloadWithOtp extends DriverSignupPayload {
  verificationToken: string;
}

export default function DriverOnboardingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [pendingSignupData, setPendingSignupData] = useState<DriverSignupPayload | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const navigate = useNavigate();

  // Load Google Maps API for autocomplete
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry','places'],
  });

  // Mutation for sending OTP (first step)
  const sendOtpMutation = useDataMutation<
    { message: string },
    DriverSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/driver/`, // Adjust endpoint as needed
    onSuccess: (data, variables) => {
      toast.success("OTP sent to your email", {
        description: `${data.message}`,
      });
      setOtpSent(true);
      setPendingSignupData(variables); // Store data for second step
    },
    onError: (error) => {
      toast.error("Failed to send OTP", {
        description: error.message || "Please try again later.",
      });
    },
    successMessage: "OTP sent successfully",
    errorMessage: "Failed to send OTP",
    fetchWithoutRefresh: true,
  });

  // Mutation for verifying OTP and final registration (second step)
  const verifyOtpMutation = useDataMutation<
    { message: string },
    DriverSignupPayloadWithOtp
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/driver`, // Adjust endpoint as needed
    onSuccess: (data, variables) => {
      toast.success("Application submitted successfully!", {
        description: "Your driver account is pending admin approval.",
      });
      // Store driver info in localStorage (excluding password for security, but you can store as needed)
      const { password, ...safeData } = variables;
      localStorage.setItem("driverSignupData", JSON.stringify(safeData));
      setRegistrationComplete(true);
    },
    onError: (error) => {
      toast.error("Verification failed", {
        description: error.message || "Invalid OTP or server error.",
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
      alerts: false,
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
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/serviceDistricts`, // or your deliveries endpoint
    noFilter: true,
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
      // username: data.username,
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      phone: data.phone,
      homeArea: data.homeArea,
      preferredRadius: data.radius,
      preferredJobDistance: data.jobMiles,
      districts: data.districts,
      emailAlerts: data.alerts,
      status: "PENDING"
    };

    if (!otpSent) {
      // Step 1: Send OTP
      sendOtpMutation.mutate(basePayload);
    } else {
      // Step 2: Verify OTP and complete registration
      if (!otpValue.trim()) {
        toast.error("Please enter the OTP");
        return;
      }
      const payloadWithOtp: DriverSignupPayloadWithOtp = {
        ...basePayload,
        verificationToken: otpValue,
      };
      verifyOtpMutation.mutate(payloadWithOtp);
    }
  };

  // Watch acceptTerms for validation feedback
  const acceptTerms = watch("acceptTerms");
  const homeAreaValue = watch("homeArea");

  // Determine if any mutation is pending
  const isPending = sendOtpMutation.isPending || verifyOtpMutation.isPending;

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
            to="/auth/dealer-signin"
            search={{ userType: "driver" }}
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
              Driver onboarding • Pending approval • Email-first
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
                Pending approval after signup
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
                Drivers can complete signup, but your account remains
                <span className="font-extrabold text-lime-600 dark:text-lime-400">
                  {" "}
                  Pending Approval{" "}
                </span>
                until Admin approves it. Only
                <span className="font-extrabold text-lime-600 dark:text-lime-400">
                  {" "}
                  approved drivers{" "}
                </span>
                can book jobs.
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
              to="/auth/dealer-signin?userType=driver"
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

                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-xs font-bold">
                        Full name
                      </Label>
                      <Input
                        id="fullName"
                        {...register("fullName")}
                        className="h-14 rounded-2xl"
                        placeholder="Jane Driver"
                        disabled={isPending}
                      />
                      {errors.fullName && (
                        <p className="text-xs text-red-500">
                          {errors.fullName.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold">
                          Email
                        </Label>
                        <Input
                          id="email"
                          {...register("email")}
                          className="h-14 rounded-2xl"
                          placeholder="jane@example.com"
                          type="email"
                          disabled={isPending}
                        />
                        {errors.email && (
                          <p className="text-xs text-red-500">
                            {errors.email.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-bold">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          {...register("phone")}
                          className="h-14 rounded-2xl"
                          placeholder="+1 (___) ___-____"
                          type="tel"
                          disabled={isPending}
                        />
                        {errors.phone && (
                          <p className="text-xs text-red-500">
                            {errors.phone.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-xs font-bold">
                          Password
                        </Label>
                        <Input
                          id="password"
                          {...register("password")}
                          className="h-14 rounded-2xl"
                          placeholder="Create password"
                          type="password"
                          disabled={isPending}
                        />
                        {errors.password && (
                          <p className="text-xs text-red-500">
                            {errors.password.message}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500">
                          Must be at least 8 characters with uppercase,
                          lowercase, number, and special character
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="confirmPassword"
                          className="text-xs font-bold"
                        >
                          Confirm Password
                        </Label>
                        <Input
                          id="confirmPassword"
                          {...register("confirmPassword")}
                          className="h-14 rounded-2xl"
                          placeholder="Repeat password"
                          type="password"
                          disabled={isPending}
                        />
                        {errors.confirmPassword && (
                          <p className="text-xs text-red-500">
                            {errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Terms and Conditions (unchanged) */}
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="acceptTerms"
                          {...register("acceptTerms")}
                          disabled={isPending}
                        />
                        <Label
                          htmlFor="acceptTerms"
                          className={cn(
                            "text-xs text-slate-600 dark:text-slate-400 cursor-pointer",
                            !acceptTerms &&
                              "text-amber-600 dark:text-amber-400",
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
                        Step 2
                      </CardDescription>
                      <CardTitle className="text-2xl font-black mt-2">
                        Service area preferences
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        These preferences filter your job feed and can power job
                        alerts.
                      </p>
                    </div>
                    <Badge variant="outline" className="hidden sm:flex">
                      <Filter className="h-3 w-3 mr-1" />
                      Preferences
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Home Area with Google Places Autocomplete (unchanged) */}
                  <div className="space-y-2">
                    <Label htmlFor="homeArea" className="text-xs font-bold">
                      Home city / ZIP (anchor)
                    </Label>
                    <LocationAutocomplete
                      value={homeAreaValue || ""}
                      onChange={(val) => setValue("homeArea", val)}
                      onPlaceSelect={handleHomeAreaSelect}
                      isLoaded={isLoaded}
                      placeholder="Los Angeles, CA or 90012"
                      icon={<MapPin className="h-4 w-4 text-slate-400" />}
                      className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                      disabled={isPending}
                    />
                    {errors?.homeArea && (
                      <p className="text-xs text-red-500">
                        {errors.homeArea.message}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Powered by Google Places – start typing to search.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="radius" className="text-xs font-bold">
                        Preferred radius (miles)
                      </Label>
                      <Select
                        onValueChange={(value) => setValue("radius", value)}
                        defaultValue=""
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-14 rounded-2xl">
                          <SelectValue placeholder="Select radius" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 miles</SelectItem>
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

                    <div className="space-y-2">
                      <Label htmlFor="jobMiles" className="text-xs font-bold">
                        Preferred job distance
                      </Label>
                      <Select
                        onValueChange={(value) => setValue("jobMiles", value)}
                        defaultValue=""
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-14 rounded-2xl">
                          <SelectValue placeholder="Select preference" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">
                            Mostly short (0–25 mi)
                          </SelectItem>
                          <SelectItem value="medium">
                            Mixed (25–50 mi)
                          </SelectItem>
                          <SelectItem value="long">Longer (50+ mi)</SelectItem>
                          <SelectItem value="any">Any distance</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.jobMiles && (
                        <p className="text-xs text-red-500">
                          {errors.jobMiles.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold">
                      District preferences (MVP)
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Select districts to tune your feed and alerts. (Prototype
                      list — admin can define districts.)
                    </p>

{/* District preferences */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold">
                      District preferences (MVP)
                    </Label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Select districts to tune your feed and alerts. (Prototype
                      list — admin can define districts.)
                    </p>

                    {isLoading || isFetching ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 animate-pulse"
                          >
                            <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : isError ? (
                      <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <AlertTitle className="text-red-900 dark:text-red-200 text-sm">
                          Failed to load districts
                        </AlertTitle>
                        <AlertDescription className="text-red-900/80 dark:text-red-200/80 text-xs">
                          {error?.message || "Please try again later."}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2">
                        {districtList?.map((district: any) => (
                          <div
                            key={district.id}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 cursor-pointer transition-colors",
                              !isPending && "hover:border-lime-500",
                            )}
                            onClick={() => {
                              if (!isPending) {
                                handleDistrictChange(
                                  district.id,
                                  !selectedDistricts.includes(district.id),
                                );
                              }
                            }}
                          >
                            <Checkbox
                              id={district.id}
                              checked={selectedDistricts.includes(district.id)}
                              onCheckedChange={(checked) => {
                                if (!isPending) {
                                  handleDistrictChange(
                                    district.id,
                                    checked as boolean,
                                  );
                                }
                              }}
                              disabled={isPending}
                            />
                            <div className="flex-1">
                              <div className="font-black text-slate-900 dark:text-white text-sm">
                                {district.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {district.geoJson?.label || district.code || "No description"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold">
                      Job alerts (optional)
                    </Label>
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="alerts"
                          {...register("alerts")}
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

                  {/* OTP Input Field - appears only after OTP sent */}
                  {otpSent && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label htmlFor="otp" className="text-xs font-bold">
                        Enter OTP
                      </Label>
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
                    disabled={isPending || !acceptTerms || (otpSent && !otpValue.trim())}
                    className={cn(
                      "w-full py-6 rounded-2xl transition flex items-center justify-center gap-2 text-lg font-extrabold",
                      !acceptTerms
                        ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        : "bg-lime-500 hover:bg-lime-600 text-slate-950 hover:shadow-xl hover:shadow-lime-500/20",
                    )}
                  >
                    {isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-950"></div>
                        {sendOtpMutation.isPending ? "Sending OTP..." : "Verifying..."}
                      </>
                    ) : !acceptTerms ? (
                      "Accept Terms & Conditions"
                    ) : otpSent ? (
                      <>
                        Verify OTP & Submit
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    ) : (
                      <>
                        Send OTP to Email
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    {otpSent
                      ? "After verification, your application will be submitted for admin approval."
                      : "After submission, you'll receive an OTP via email to verify your identity."}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : (
          /* Pending Approval Panel (unchanged) */
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="pt-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-16 h-16 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-8 w-8 text-lime-600 dark:text-lime-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    Submitted — Pending Approval
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-2">
                    Thanks! Your driver registration is pending Admin approval.
                    We'll email you when you're approved to book jobs.
                  </p>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/driver/signin"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition"
                    >
                      Go to Sign In
                      <LogIn className="h-4 w-4" />
                    </Link>

                    <Link
                      to="/"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-extrabold border border-slate-200 dark:border-slate-800 hover:bg-lime-500/5 transition"
                    >
                      Back to Home
                      <Home className="h-4 w-4" />
                    </Link>
                  </div>

                  <p className="mt-6 text-[11px] text-slate-500 dark:text-slate-400">
                    Note: Admin will review your application and approve it
                    within 1-2 business days.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}