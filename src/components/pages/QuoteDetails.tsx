import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Menu,
  X,
  ReceiptText,
  MapPin,
  Flag,
  Route as RouteIcon,
  Ruler,
  Edit,
  Map,
  Car,
  Calendar,
  Clock,
  Phone,
  Mail,
  User,
  MessageSquare,
  ShieldCheck,
  Check,
  Info,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useJsApiLoader } from '@react-google-maps/api';
import RouteMap from '@/components/map/RouteMap';
import { useCreate } from "@/lib/tanstack/dataQuery";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

// Define libraries outside component to prevent unnecessary reloads
const GOOGLE_MAPS_LIBRARIES: ['geometry', 'places'] = ['geometry', 'places'];

// Helper functions (unchanged)
function parseWindowTimes(windowStr: string): { start: string; end: string } {
  const match = windowStr.match(/\((\d+[ap]m)[–-](\d+[ap]m)\)/i);
  if (match) {
    return { start: match[1], end: match[2] };
  }
  return { start: "8am", end: "12pm" };
}

function parseTimeToHoursMinutes(timeStr: string): { hours: number; minutes: number } {
  const lower = timeStr.toLowerCase();
  const isPM = lower.includes('pm');
  const isAM = lower.includes('am');
  const numeric = parseInt(lower.replace(/[^0-9]/g, ''));
  let hours = numeric;
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return { hours, minutes: 0 };
}

function combineDateAndTimeToISO(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const { hours, minutes } = parseTimeToHoursMinutes(timeStr);
  const date = new Date(year, month - 1, day, hours, minutes, 0);
  return date.toISOString();
}

const serviceTypeMap = {
  home: "HOME_DELIVERY",
  dealer: "BETWEEN_LOCATIONS",
  service: "SERVICE_PICKUP_RETURN",
};

function NumberIcon({ number, className }: { number: number; className?: string }) {
  return (
    <div className={`w-4 h-4 flex items-center justify-center ${className}`}>
      <span className="text-xs font-bold">{number}</span>
    </div>
  );
}

const DRAFT_KEY = "quoteDraft";

export function QuoteDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    quote?: any;
    pickupCoords?: google.maps.LatLngLiteral;
    dropoffCoords?: google.maps.LatLngLiteral;
    pickupAddress?: string;
    dropoffAddress?: string;
    distance?: number;
  };

  // Check if user arrived with fresh quote data (new quote flow)
  const hasFreshQuoteData = state?.quote || state?.pickupCoords;

  const urlParams = new URLSearchParams(window.location.search);
  const urlOtp = urlParams.get('otp');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loadedQuote, setLoadedQuote] = useState<any>(null);
  const [verificationEmail, setVerificationEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>(urlOtp || "");
  const [otpSent, setOtpSent] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);

  // Clear stale draft when user starts a new quote (arrives with fresh data from landing page)
  useEffect(() => {
    if (hasFreshQuoteData && !urlOtp) {
      // User is starting a new quote - clear any old draft
      localStorage.removeItem(DRAFT_KEY);
      console.log("Cleared stale draft - starting fresh quote");
    }
  }, [hasFreshQuoteData, urlOtp]);

  // Schema for form validation - OTP handled separately
  const quoteDetailsSchema = z.object({
    serviceType: z.enum(["home", "dealer", "service"]),
    preferredDate: z.string().min(1, "Date is required"),
    timeWindow: z.string().min(1, "Time window is required"),
    vehicleColor: z.string().min(1, "Color is required"), // Required
    carMake: z.string().optional(), // Optional
    carModel: z.string().min(1, "Model is required"), // Required
    transmission: z.string().optional(), // Optional - defaults to Automatic
    vinLast4: z.string().length(4, "VIN last 4 must be exactly 4 characters"), // Required
    plate: z.string().min(1, "License plate is required"), // Now required
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    instructions: z.string().optional(),
    afterHours: z.boolean().optional().default(false),
    isUrgent: z.boolean().optional().default(false),
    recipientName: z.string().optional(),
    recipientEmail: z.string().email().optional().or(z.literal("")),
    recipientPhone: z.string().optional(),
    // Password fields for account creation (shown when OTP verification is needed)
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
  }).refine((data) => {
    // Validate password match if password is provided
    if (data.password && data.confirmPassword) {
      return data.password === data.confirmPassword;
    }
    return true;
  }, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  type QuoteDetailsFormData = z.infer<typeof quoteDetailsSchema>;


  // Use either state quote or loadedQuote from draft
  const quote = loadedQuote || state?.quote;
  const pickupCoords = quote?.pickupLat && quote?.pickupLng
    ? { lat: quote.pickupLat, lng: quote.pickupLng }
    : state?.pickupCoords;
  const dropoffCoords = quote?.dropoffLat && quote?.dropoffLng
    ? { lat: quote.dropoffLat, lng: quote.dropoffLng }
    : state?.dropoffCoords;
  const pickupAddress = quote?.pickupAddress || state?.pickupAddress || 'Pickup';
  const dropoffAddress = quote?.dropoffAddress || state?.dropoffAddress || 'Drop-off';
  const distance = quote?.distanceMiles || state?.distance || 0;
  const estimatedPrice = quote?.estimatedPrice || 0;
  const feesBreakdown = quote?.feesBreakdown;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    reset,
  } = useForm<QuoteDetailsFormData>({
    resolver: zodResolver(quoteDetailsSchema),
    defaultValues: {
      serviceType: "service",
      preferredDate: "",
      timeWindow: "Morning (8am–12pm)",
      vehicleColor: "",
      carMake: "",
      carModel: "",
      transmission: "Automatic",
      vinLast4: "",
      plate: "",
      fullName: "",
      email: "",
      phone: "",
      instructions: "",
      afterHours: false,
      isUrgent: false,
      recipientName: "",
      recipientEmail: "",
      recipientPhone: "",
      password: "",
      confirmPassword: "",
    },
  });
  // Load draft from localStorage if OTP present in URL (new tab scenario)
  useEffect(() => {
    if (urlOtp) {
      const draftStr = localStorage.getItem(DRAFT_KEY);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.formData) {
            // Log the draft data for debugging
            console.log("Loading draft:", draft.formData);
            console.log("Vehicle color from draft:", draft.formData.vehicleColor);
            
            // Use reset with keepDefaultValues: false to ensure all values are replaced
            reset(draft.formData, { keepDefaultValues: false });
            setLoadedQuote(draft.quoteData || null);
            setDraftLoaded(true);
            setVerificationEmail(draft.formData.email || "");
            setOtp(urlOtp);
            setVerificationRequired(true); // Show OTP section since we have OTP in URL
            console.log("Draft loaded from localStorage for OTP verification");
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      } else {
        // No draft found - user might have cleared storage or link expired
        toast.error("Session expired", {
          description: "Please start a new quote request.",
        });
      }
    }
  }, [urlOtp, reset]);

  const watchTimeWindow = watch("timeWindow");
  const watchVehicleColor = watch("vehicleColor");
  const watchCarMake = watch("carMake");
  const watchCarModel = watch("carModel");
  const watchTransmission = watch("transmission");
  const watchPassword = watch("password");
  const watchConfirmPassword = watch("confirmPassword");

  // Password validation checks
  const passwordChecks = {
    minLength: (watchPassword?.length || 0) >= 8,
    hasUppercase: /[A-Z]/.test(watchPassword || ''),
    hasLowercase: /[a-z]/.test(watchPassword || ''),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(watchPassword || ''),
    hasMatch: watchPassword && watchConfirmPassword && watchPassword === watchConfirmPassword,
    allValid: false, // Will be calculated below
  };
  passwordChecks.allValid = passwordChecks.minLength && passwordChecks.hasUppercase && passwordChecks.hasLowercase && passwordChecks.hasSpecial && passwordChecks.hasMatch;

  // Common car makes
  const carMakes = [
    "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler",
    "Dodge", "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar",
    "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz",
    "Nissan", "Porsche", "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo", "Other"
  ];

  // Common models by make (simplified)
  const carModelsByMake: Record<string, string[]> = {
    "Toyota": ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "Prius", "4Runner", "Sequoia", "Sienna", "Other"],
    "Honda": ["Accord", "Civic", "CR-V", "Pilot", "Odyssey", "Ridgeline", "HR-V", "Passport", "Fit", "Other"],
    "Ford": ["F-150", "Escape", "Explorer", "Mustang", "Edge", "Ranger", "Bronco", "Expedition", "Maverick", "Other"],
    "Chevrolet": ["Silverado", "Equinox", "Malibu", "Tahoe", "Traverse", "Camaro", "Colorado", "Suburban", "Blazer", "Other"],
    "Nissan": ["Altima", "Sentra", "Rogue", "Pathfinder", "Frontier", "Maxima", "Kicks", "Murano", "Titan", "Other"],
    "Hyundai": ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Venue", "Ioniq", "Other"],
    "Kia": ["Forte", "Optima", "Sportage", "Sorento", "Telluride", "Soul", "Seltos", "Carnival", "K5", "Other"],
    "Tesla": ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck", "Other"],
    "BMW": ["3 Series", "5 Series", "X3", "X5", "X7", "4 Series", "X1", "X4", "Other"],
    "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE", "S-Class", "A-Class", "GLA", "GLB", "Other"],
    "Audi": ["A4", "A6", "Q3", "Q5", "Q7", "Q8", "A5", "e-tron", "Other"],
    "Lexus": ["ES", "RX", "NX", "GX", "LX", "IS", "UX", "RX", "Other"],
    "Volkswagen": ["Jetta", "Passat", "Tiguan", "Atlas", "Golf", "ID.4", "Taos", "Other"],
    "Subaru": ["Outback", "Forester", "Crosstrek", "Impreza", "Ascent", "Legacy", "WRX", "Other"],
    "Mazda": ["Mazda3", "Mazda6", "CX-5", "CX-9", "CX-30", "MX-5 Miata", "CX-50", "Other"],
    "Jeep": ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Renegade", "Gladiator", "Wagoneer", "Other"],
    "Dodge": ["Charger", "Challenger", "Durango", "Hornet", "Other"],
    "GMC": ["Sierra", "Terrain", "Yukon", "Acadia", "Canyon", "Hummer EV", "Other"],
    "Cadillac": ["Escalade", "CT5", "XT5", "XT6", "CT4", "Lyriq", "Other"],
    "Buick": ["Enclave", "Encore", "Envision", "Other"],
    "Chrysler": ["300", "Pacifica", "Voyager", "Other"],
    "Lincoln": ["Navigator", "Aviator", "Nautilus", "Corsair", "Other"],
    "Acura": ["MDX", "RDX", "TLX", "Integra", "Other"],
    "Infiniti": ["Q50", "QX60", "QX80", "QX55", "Other"],
    "Jaguar": ["F-PACE", "XE", "XF", "E-PACE", "I-PACE", "Other"],
    "Land Rover": ["Range Rover", "Discovery", "Defender", "Range Rover Sport", "Evoque", "Other"],
    "Porsche": ["Cayenne", "Macan", "911", "Taycan", "Panamera", "Other"],
    "Volvo": ["XC60", "XC90", "S60", "XC40", "C40", "Other"],
    "Other": ["Other"],
  };

  // Transmission types
  const transmissionTypes = ["Automatic", "Manual", "Other"];

  const createDelivery = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/individual/create-from-quote`, {
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data) => {
      setIsSubmitting(false);
      const action = data.action;
      if (action === "CREATED") {
        // Save delivery data for confirmation page before clearing draft
        const deliveryInfo = {
          deliveryId: data.deliveryId,
          formData: watch(),
          quoteData: quote,
        };
        // Clear draft after successful creation
        localStorage.removeItem(DRAFT_KEY);
        // Navigate with delivery data
        navigate({ 
          to: "/quote-confirmation",
          state: { delivery: deliveryInfo }
        });
      } else if (action === "VERIFICATION_REQUIRED") {
        setVerificationRequired(true);
        setVerificationEmail(data.email || watch('email'));
        setOtpSent(true);
        toast.success("OTP sent to your email", {
          description: `We've sent a 6-digit code to ${data.email}. Enter it below to verify.`,
          duration: 5000,
        });
        // Save draft to localStorage for resuming
        const formData = watch();
        const draft = { formData, quoteData: quote };
        console.log("Saving draft to localStorage:", draft);
        console.log("Vehicle color being saved:", formData.vehicleColor);
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } else if (action === "LOGIN_REQUIRED") {
        navigate({ to: `/auth/dealer-signin` });
      }
    },
    onError: (error) => {
      setIsSubmitting(false);
      console.error("Submission failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Submission failed. Please check your details and try again.";
      
      // Check if error is related to email already existing
      const isEmailExistsError = errorMessage.toLowerCase().includes("email") && 
        (errorMessage.toLowerCase().includes("already") || 
         errorMessage.toLowerCase().includes("exists") ||
         errorMessage.toLowerCase().includes("registered"));
      
      if (isEmailExistsError) {
        toast.error("Email already registered", {
          description: "This email is already associated with an account. Please sign in to continue.",
          action: {
            label: "Sign In",
            onClick: () => navigate({ to: "/auth/dealer-signin" }),
          },
          duration: 8000,
        });
      } else {
        toast.error("Failed to create delivery request", {
          description: errorMessage,
        });
      }
    },
  });

  // Resend OTP mutation
  const resendOtp = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/individual/resend-otp`, {
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data) => {
      setResendingOtp(false);
      toast.success("OTP resent", {
        description: `A new code has been sent to ${verificationEmail}`,
      });
    },
    onError: (error) => {
      setResendingOtp(false);
      const errorMessage = error instanceof Error ? error.message : "Failed to resend OTP";
      toast.error("Failed to resend OTP", {
        description: errorMessage,
      });
    },
  });

  // Handle resend OTP
  const handleResendOtp = () => {
    setResendingOtp(true);
    resendOtp.mutate({ email: verificationEmail });
  };

  const onSubmit: SubmitHandler<QuoteDetailsFormData> = async (data) => {
    console.log("✅ onSubmit called with data:", data);
    setIsSubmitting(true);

    const pickupTimes = parseWindowTimes(data.timeWindow);
    const pickupStart = combineDateAndTimeToISO(data.preferredDate, pickupTimes.start);
    const pickupEnd = combineDateAndTimeToISO(data.preferredDate, pickupTimes.end);

    const serviceTypeEnum = serviceTypeMap[data.serviceType];

    const payload: any = {
      customerEmail: data.email,
      customerName: data.fullName,
      customerPhone: data.phone || undefined,
      quoteId: quote?.id,
      serviceType: serviceTypeEnum,
      pickupWindowStart: pickupStart,
      pickupWindowEnd: pickupEnd,
      licensePlate: data.plate || "",
      vehicleColor: data.vehicleColor || undefined,
      vehicleMake: data.carMake || undefined,
      vehicleModel: data.carModel || undefined,
      transmission: data.transmission || "Automatic",
      vinVerificationCode: data.vinLast4,
      recipientName: data.recipientName || undefined,
      recipientEmail: data.recipientEmail || undefined,
      recipientPhone: data.recipientPhone || undefined,
      afterHours: data.afterHours || false,
      pickupAddress: pickupAddress,
      dropoffAddress: dropoffAddress,
      isUrgent: data.isUrgent || false,
      instructions: data.instructions || undefined,
      requiresOpsConfirmation: data.afterHours || false,
      sameDayEligible: false,
      status: "QUOTED", // Initial status - customer must review and release to market
    };

    // Include OTP if verification is required and OTP is provided
    if (verificationRequired && otp) {
      payload.otp = otp;
      payload.password = data.password;
    }

    createDelivery.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header (unchanged) */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/landing" className="flex items-center" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <a href="/landing#how" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">How it works</a>
              <a href="/landing#standard" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">Compliance</a>
              <a href="/landing#dealers" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">Dealers</a>
              <a href="/landing#drivers" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">Drivers</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/landing#estimate" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Estimate</span>
              <span className="sm:hidden">Back</span>
            </Link>
            <Button variant="outline" size="icon" className="md:hidden w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top">
            <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
              <a className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2" href="/landing#how" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <a className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2" href="/landing#standard" onClick={() => setMobileMenuOpen(false)}>Compliance</a>
              <a className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2" href="/landing#dealers" onClick={() => setMobileMenuOpen(false)}>Dealers</a>
              <a className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2" href="/landing#drivers" onClick={() => setMobileMenuOpen(false)}>Drivers</a>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <Link to="/landing#estimate" className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors py-1" onClick={() => setMobileMenuOpen(false)}>
                  Back to Estimate
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Top summary */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                <ReceiptText className="w-6 h-6 text-primary font-bold" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  Quote details (after estimate)
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Estimate first, then service type, scheduling,
                  vehicle info, and contact details.
                </p>
              </div>
            </div>

            {/* Route + Estimate preview */}
            <Card className="mt-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden hover-lift">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-7 relative min-h-[280px] sm:min-h-[340px] bg-slate-50 dark:bg-slate-950 overflow-hidden">
                  <RouteMap pickup={pickupCoords} dropoff={dropoffCoords} isLoaded={isLoaded} />

                  <div className="absolute top-5 left-5 right-5 flex flex-col sm:flex-row gap-2 z-10">
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-lime-500" />
                      Pickup: {pickupAddress}
                    </div>
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Flag className="w-4 h-4 text-lime-500" />
                      Drop-off: {dropoffAddress}
                    </div>
                  </div>

                  <div className="absolute bottom-5 left-5 flex flex-wrap gap-2 z-10">
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <RouteIcon className="w-4 h-4 text-lime-500" />
                      Route Preview
                    </div>
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-lime-500" />
                      Distance: {Math.round(distance)} mi
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 sm:p-8 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Estimate Summary
                      </p>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                        ${estimatedPrice.toFixed(2)}
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-2">
                          (estimated)
                        </span>
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Estimate shown first. Details collected on this page.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold hover:opacity-90 transition border border-slate-200 dark:border-slate-700" asChild>
                      <Link to="/landing#estimate">
                        <Edit className="w-4 h-4 text-primary" />
                        Edit route
                      </Link>
                    </Button>
                  </div>

                  {feesBreakdown && (
                    <div className="mt-6 space-y-3">
                      {feesBreakdown.baseFare !== undefined && (
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-semibold">
                          <span>Base Transportation</span>
                          <span className="text-slate-900 dark:text-white font-black">
                            ${feesBreakdown.baseFare.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {feesBreakdown.distanceCharge > 0 && (
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-semibold">
                          <span>Distance-based charge</span>
                          <span className="text-slate-900 dark:text-white font-black">
                            ${feesBreakdown.distanceCharge.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {feesBreakdown.insuranceFee !== undefined && (
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-semibold">
                          <span>Insurance Fee</span>
                          <span className="text-slate-900 dark:text-white font-black">
                            ${feesBreakdown.insuranceFee.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {feesBreakdown.transactionFee !== undefined && (
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 font-semibold">
                          <span>Transaction Fee</span>
                          <span className="text-slate-900 dark:text-white font-black">
                            ${feesBreakdown.transactionFee.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                    <Info className="w-5 h-5 text-amber-500" />
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                      Real quote from backend. Details collected below.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-slate-800 dark:text-slate-200 text-xs font-extrabold">
                <NumberIcon number={1} className="text-primary" />
                Estimate first ✅
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold">
                <NumberIcon number={2} className="text-primary" />
                Details now ✅
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold">
                <NumberIcon number={3} className="text-primary" />
                Submit request
              </div>
            </div>


          </div>

          {/* Right: Details form */}
          <div className="lg:col-span-5">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 hover-lift">
              <CardHeader className="p-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Step 2
                    </p>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                      Delivery details
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Scheduling + vehicle + contact details (after estimate).
                    </CardDescription>
                  </div>
                  <div className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3 h-3 text-primary" />
                    CA Only
                  </div>
                </div>
                {/* Validity indicator */}
                {/* <div className="flex justify-end mt-2">
                  <span className={`text-xs font-bold ${isValid ? 'text-green-500' : 'text-red-500'}`}>
                    Form {isValid ? '✅ valid' : '❌ invalid'}
                  </span>
                </div> */}
              </CardHeader>

              <CardContent className="p-0 mt-8 space-y-7">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
                  {/* Schedule */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Preferred Date
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="date"
                          className="h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          {...register("preferredDate")}
                        />
                      </div>
                      {errors.preferredDate && <p className="text-xs text-red-500">{errors.preferredDate.message}</p>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Time Window
                      </Label>
                      <Select
                        key={`timewindow-${draftLoaded}`}
                        value={watchTimeWindow || ""}
                        onValueChange={(value) => setValue("timeWindow", value)}
                      >
                        <SelectTrigger className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm">
                          <SelectValue placeholder="Select time window" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Morning (8am–12pm)">Morning (8am–12pm)</SelectItem>
                          <SelectItem value="Afternoon (12pm–4pm)">Afternoon (12pm–4pm)</SelectItem>
                          <SelectItem value="Evening (4pm–8pm)">Evening (4pm–8pm)</SelectItem>
                          <SelectItem value="Flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.timeWindow && <p className="text-xs text-red-500">{errors.timeWindow.message}</p>}
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Vehicle Information
                      </Label>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Model, Color, VIN & Plate are required
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Make - OPTIONAL */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Make <span className="text-slate-400">(optional)</span>
                        </Label>
                        <Select
                          key={`carmake-${draftLoaded}`}
                          value={watchCarMake || ""}
                          onValueChange={(value) => {
                            setValue("carMake", value);
                            setValue("carModel", ""); // Reset model when make changes
                          }}
                        >
                          <SelectTrigger className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm">
                            <SelectValue placeholder="Select make" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {carMakes.map((make) => (
                              <SelectItem key={make} value={make}>{make}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Model - REQUIRED (depends on make) */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Model <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          key={`carmodel-${draftLoaded}`}
                          value={watchCarModel || ""}
                          onValueChange={(value) => setValue("carModel", value)}
                          disabled={!watchCarMake}
                        >
                          <SelectTrigger className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm">
                            <SelectValue placeholder={watchCarMake ? "Select model" : "Select make first"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {(carModelsByMake[watchCarMake || "Other"] || ["Other"]).map((model) => (
                              <SelectItem key={model} value={model}>{model}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.carModel && <p className="text-xs text-red-500">{errors.carModel.message}</p>}
                      </div>

                      {/* VIN last-4 - REQUIRED */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          VIN Last-4 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="e.g. 1234"
                          maxLength={4}
                          inputMode="numeric"
                          {...register("vinLast4")}
                        />
                        {errors.vinLast4 && <p className="text-xs text-red-500">{errors.vinLast4.message}</p>}
                      </div>

                      {/* Plate - REQUIRED */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          License Plate <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm uppercase"
                          placeholder="e.g. 7ABC123"
                          {...register("plate")}
                        />
                        {errors.plate && <p className="text-xs text-red-500">{errors.plate.message}</p>}
                      </div>

                      {/* Color - REQUIRED */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Vehicle Color <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          key={`vehiclecolor-${draftLoaded}`}
                          value={watchVehicleColor || ""}
                          onValueChange={(value) => setValue("vehicleColor", value)}
                        >
                          <SelectTrigger className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm">
                            <SelectValue placeholder="Select color" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="White">White</SelectItem>
                            <SelectItem value="Black">Black</SelectItem>
                            <SelectItem value="Gray">Gray</SelectItem>
                            <SelectItem value="Silver">Silver</SelectItem>
                            <SelectItem value="Blue">Blue</SelectItem>
                            <SelectItem value="Red">Red</SelectItem>
                            <SelectItem value="Green">Green</SelectItem>
                            <SelectItem value="Brown">Brown</SelectItem>
                            <SelectItem value="Beige">Beige</SelectItem>
                            <SelectItem value="Gold">Gold</SelectItem>
                            <SelectItem value="Orange">Orange</SelectItem>
                            <SelectItem value="Yellow">Yellow</SelectItem>
                            <SelectItem value="Purple">Purple</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.vehicleColor && <p className="text-xs text-red-500">{errors.vehicleColor.message}</p>}
                      </div>

                      {/* Transmission - OPTIONAL */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Transmission <span className="text-slate-400">(optional)</span>
                        </Label>
                        <Select
                          key={`transmission-${draftLoaded}`}
                          value={watchTransmission || "Automatic"}
                          onValueChange={(value) => setValue("transmission", value)}
                        >
                          <SelectTrigger className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm">
                            <SelectValue placeholder="Select transmission" />
                          </SelectTrigger>
                          <SelectContent>
                            {transmissionTypes.map((trans) => (
                              <SelectItem key={trans} value={trans}>{trans}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Contact Details
                      </Label>
                      <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        <Mail className="w-3 h-3 text-primary" />
                        Email-first
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Full Name
                        </Label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            className="h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="Your name"
                            {...register("fullName")}
                          />
                        </div>
                        {errors.fullName && <p className="text-xs text-red-500">{errors.fullName.message}</p>}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Email
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            type="email"
                            className="h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="you@example.com"
                            {...register("email")}
                          />
                        </div>
                        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Phone Number
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="tel"
                          className="h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="Required for delivery updates"
                          {...register("phone")}
                        />
                      </div>
                      {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                    </div>
                  </div>

                  {/* Recipient (optional) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Checkbox id="hasRecipient" onCheckedChange={(checked) => {
                        if (!checked) {
                          setValue("recipientName", "");
                          setValue("recipientEmail", "");
                          setValue("recipientPhone", "");
                        }
                      }} />
                      <Label htmlFor="hasRecipient" className="text-xs font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                        Add recipient (optional)
                      </Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Recipient Name
                        </Label>
                        <Input
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="Recipient name"
                          {...register("recipientName")}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Recipient Email
                        </Label>
                        <Input
                          type="email"
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="recipient@example.com"
                          {...register("recipientEmail")}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Recipient Phone
                      </Label>
                      <Input
                        type="tel"
                        className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                        placeholder="Optional"
                        {...register("recipientPhone")}
                      />
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Special Instructions
                    </Label>
                    <div className="relative">
                      <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                      <Textarea
                        className="min-h-[110px] pl-12 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                        placeholder="Gate code, parking details, key handoff notes, etc."
                        {...register("instructions")}
                      />
                    </div>
                  </div>

                  {/* OTP Verification Section - shown when verification is required */}
                  {verificationRequired && (
                    <div className="space-y-4 p-5 rounded-2xl bg-lime-50 dark:bg-lime-900/10 border border-lime-200 dark:border-lime-900/30">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-lime-600 dark:text-lime-400" />
                        <Label className="text-xs font-black uppercase tracking-widest text-lime-700 dark:text-lime-300">
                          Email Verification Required
                        </Label>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        We've sent a 6-digit code to <span className="font-bold">{verificationEmail}</span>. Enter it below to verify your email.
                      </p>
                      
                      {/* OTP Input */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Enter 6-digit OTP
                        </Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm text-center text-2xl tracking-[0.5em] font-bold"
                          placeholder="000000"
                        />
                        {otp.length === 6 && (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            OTP entered
                          </p>
                        )}
                      </div>

                      {/* Password fields for account creation */}
                      {otp.length === 6 && (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              Create a password for your account
                            </p>
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
                                {passwordChecks.hasSpecial ? (
                                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                                )}
                                <span className={`text-xs ${passwordChecks.hasSpecial ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                  1 special char
                                </span>
                              </div>
                              <div className="flex items-center gap-2 col-span-2">
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

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Password <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                  type="password"
                                  className="h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                                  placeholder="Create password"
                                  {...register("password")}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Confirm Password <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                  type="password"
                                  className="h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                                  placeholder="Confirm password"
                                  {...register("confirmPassword")}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Error messages */}
                          {(errors.password || errors.confirmPassword) && (
                            <div className="flex flex-col gap-1">
                              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                              {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Resend OTP */}
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Didn't receive the code?
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleResendOtp}
                          disabled={resendingOtp}
                          className="text-xs font-bold text-lime-600 dark:text-lime-400 hover:text-lime-700"
                        >
                          {resendingOtp ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-lime-600 mr-2"></div>
                              Sending...
                            </>
                          ) : (
                            "Resend OTP"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Error summary */}
                  {Object.keys(errors).length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-4 mb-4">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">Please fix the following:</p>
                      <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-1">
                        {Object.entries(errors).map(([key, value]) => (
                          <li key={key}>
                            <span className="font-medium">{key}:</span> {value.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="pt-2 space-y-3">
                    <Button
                      type="submit"
                      disabled={isSubmitting || (verificationRequired && otp.length !== 6)}
                      className="w-full py-4 rounded-2xl bg-primary text-primary-foreground hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                          Submitting...
                        </>
                      ) : verificationRequired ? (
                        otp.length === 6 ? (
                          <>
                            Verify & Create Account
                            <Check className="w-4 h-4 font-bold" />
                          </>
                        ) : (
                          "Enter OTP to Continue"
                        )
                      ) : (
                        <>
                          Review & Submit Request
                          <ArrowLeft className="w-4 h-4 font-bold rotate-180" />
                        </>
                      )}
                    </Button>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                      After submitting, we'll send updates by{" "}
                      <span className="font-bold">email</span> (SMS optional if enabled).
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Compliance strip (unchanged) */}
        <section className="mt-10">
          <Card className="bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  The 101 Standard (proof at pickup & drop-off)
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  VIN last-4 verification, required photos, odometer start/end,
                  and post-trip report.
                </p>
              </div>
              <Button className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition" asChild>
                <a href="/landing#standard">
                  View Compliance
                  <ShieldCheck className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers logo" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                California-only operations • Email-first notifications
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}