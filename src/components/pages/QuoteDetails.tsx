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
  };

  const urlParams = new URLSearchParams(window.location.search);
  const emailToken = urlParams.get('token');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<"home" | "dealer" | "service">("home");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loadedQuote, setLoadedQuote] = useState<any>(null);
  const [verificationEmail, setVerificationEmail] = useState<string>("");

  // Dynamically create schema based on emailToken presence
  const quoteDetailsSchema = z.object({
    serviceType: z.enum(["home", "dealer", "service"]),
    preferredDate: z.string().min(1, "Date is required"),
    timeWindow: z.string().min(1, "Time window is required"),
    vehicleColor: z.string().min(1, "Vehicle color is required"),
    carMake: z.string().min(1, "Make is required"),
    carModel: z.string().min(1, "Model is required"),
    vinLast4: z.string().length(4, "VIN last 4 must be 4 characters"),
    plate: z.string().optional(),
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    instructions: z.string().optional(),
    afterHours: z.boolean().optional().default(false),
    isUrgent: z.boolean().optional().default(false),
    saveVehicleForFuture: z.boolean().optional().default(false),
    recipientName: z.string().optional(),
    recipientEmail: z.string().email().optional().or(z.literal("")),
    recipientPhone: z.string().optional(),
    // Conditionally require password and confirmPassword
    password: emailToken
      ? z.string().min(8, "Password must be at least 8 characters")
      : z.string().optional(),
    confirmPassword: emailToken
      ? z.string().min(8, "Confirm password must be at least 8 characters")
      : z.string().optional(),
  }).refine((data) => {
    // Only validate password match if both fields exist (i.e., token present)
    if (emailToken && (data.password || data.confirmPassword)) {
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
      serviceType: "home",
      preferredDate: "",
      timeWindow: "Morning (8am–12pm)",
      vehicleColor: "",
      carMake: "",
      carModel: "",
      vinLast4: "",
      plate: "",
      fullName: "",
      email: "",
      phone: "",
      instructions: "",
      afterHours: false,
      isUrgent: false,
      saveVehicleForFuture: false,
      recipientName: "",
      recipientEmail: "",
      recipientPhone: "",
      password: "",
      confirmPassword: "",
    },
  });
  // Load draft from localStorage if token present
  useEffect(() => {
    if (emailToken) {
      const draftStr = localStorage.getItem(DRAFT_KEY);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.formData) {
            reset(draft.formData);
            setSelectedService(draft.formData.serviceType || "home");
                      if (draft.formData.timeWindow) {
            setValue("timeWindow", draft.formData.timeWindow);
          }
          if (draft.formData.vehicleColor) {
            setValue("vehicleColor", draft.formData.vehicleColor);
          }
            setLoadedQuote(draft.quoteData || null);
            setDraftLoaded(true);
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, [emailToken, setValue]);

  const watchTimeWindow = watch("timeWindow");
  const watchVehicleColor = watch("vehicleColor");

  const createDelivery = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/individual/create-from-quote`, {
    onSuccess: (data) => {
      setIsSubmitting(false);
      const action = data.action;
      if (action === "CREATED") {
        localStorage.removeItem(DRAFT_KEY);
        navigate({ to: "/delivery-success", params: { id: data.deliveryId } });
      } else if (action === "VERIFICATION_REQUIRED") {
          setVerificationRequired(true);
          setVerificationEmail(data.email || watch('email'));
            toast.success("Verification email sent", {
            description: `We've sent a verification link to ${data.email}. Please check your inbox.`,
            duration: 5000, // 5 seconds
          });
          const formData = watch();
          const draft = { formData, quoteData: quote };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } else if (action === "LOGIN_REQUIRED") {
        navigate({
          to: `/auth/dealer-signin`,
          search: { redirect: `${import.meta.env.VITE_API_URL}/quote-details`, draftQuoteId: quote?.id },
        });
      }
    },
    onError: (error) => {
      setIsSubmitting(false);
      console.error("Submission failed:", error);
    },
  });

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
      vehicleColor: data.vehicleColor,
      vehicleMake: data.carMake,
      vehicleModel: data.carModel,
      vinVerificationCode: data.vinLast4,
      recipientName: data.recipientName || undefined,
      recipientEmail: data.recipientEmail || undefined,
      recipientPhone: data.recipientPhone || undefined,
      afterHours: data.afterHours || false,
      pickupAddress: pickupAddress,
      dropoffAddress: dropoffAddress,
      isUrgent: data.isUrgent || false,
      saveVehicleForFuture: data.saveVehicleForFuture || false,
      instructions: data.instructions || undefined,
      requiresOpsConfirmation: data.afterHours || false,
      sameDayEligible: false,
      status: "DRAFT",
    };

    if (emailToken) {
      payload.emailVerificationToken = emailToken;
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
            <Link to="/landing#estimate" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <ArrowLeft className="w-4 h-4" />
              Back to Estimate
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
                  PRD flow: estimate first → then service type, scheduling,
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
                        Estimate shown first. Details collected on this page (PRD).
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
                      Service type + scheduling + vehicle + contact details (after estimate).
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
                  {/* Service type */}
                  <div>
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Service Type
                    </Label>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-2xl">
                      {[
                        { id: "home", label: "Home" },
                        { id: "dealer", label: "Dealer (B2B)" },
                        { id: "service", label: "Service Pickup" },
                      ].map((service) => (
                        <Button
                          key={service.id}
                          type="button"
                          variant={selectedService === service.id ? "default" : "ghost"}
                          className={`pill h-auto py-3 text-[11px] font-black uppercase tracking-widest rounded-xl ${
                            selectedService === service.id
                              ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/60"
                          }`}
                          onClick={() => {
                            setSelectedService(service.id as any);
                            setValue("serviceType", service.id as any);
                          }}
                        >
                          {service.label}
                        </Button>
                      ))}
                    </div>
                  </div>

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
                        value={watchTimeWindow}
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Color */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Vehicle Color
                        </Label>
                        <div className="relative">
                          <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Select
                            value={watchVehicleColor}
                            onValueChange={(value) => setValue("vehicleColor", value)}
                          >
                            <SelectTrigger className="h-14 pl-12 pr-10 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm">
                              <SelectValue placeholder="Select color" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="White">White</SelectItem>
                              <SelectItem value="Black">Black</SelectItem>
                              <SelectItem value="Gray">Gray</SelectItem>
                              <SelectItem value="Silver">Silver</SelectItem>
                              <SelectItem value="Blue">Blue</SelectItem>
                              <SelectItem value="Red">Red</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {errors.vehicleColor && <p className="text-xs text-red-500">{errors.vehicleColor.message}</p>}
                      </div>

                      {/* Make */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Make
                        </Label>
                        <Input
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="e.g. Toyota"
                          {...register("carMake")}
                        />
                        {errors.carMake && <p className="text-xs text-red-500">{errors.carMake.message}</p>}
                      </div>

                      {/* Model */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Model
                        </Label>
                        <Input
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="e.g. Camry"
                          {...register("carModel")}
                        />
                        {errors.carModel && <p className="text-xs text-red-500">{errors.carModel.message}</p>}
                      </div>

                      {/* VIN last-4 */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          VIN last-4 (required)
                        </Label>
                        <Input
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="1234"
                          maxLength={4}
                          inputMode="numeric"
                          {...register("vinLast4")}
                        />
                        {errors.vinLast4 && <p className="text-xs text-red-500">{errors.vinLast4.message}</p>}
                      </div>

                      {/* Plate */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Plate (optional)
                        </Label>
                        <Input
                          className="h-14 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="7ABC123"
                          {...register("plate")}
                        />
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
                        Phone (optional)
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="tel"
                          className="h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="Optional — used only if SMS is enabled"
                          {...register("phone")}
                        />
                      </div>
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

                  {/* After Hours, Urgent, Save Vehicle */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="afterHours" {...register("afterHours")} />
                      <Label htmlFor="afterHours" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        After hours (may require Ops confirmation)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="isUrgent" {...register("isUrgent")} />
                      <Label htmlFor="isUrgent" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Urgent (priority handling)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="saveVehicleForFuture" {...register("saveVehicleForFuture")} />
                      <Label htmlFor="saveVehicleForFuture" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Save vehicle for future requests
                      </Label>
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

                  {/* Password fields - shown only when email token present */}
                  {emailToken && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Password
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
                          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Confirm Password
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
                          {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Set a password to create your account and complete the request.
                      </p>
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
                      disabled={isSubmitting || (verificationRequired && !emailToken)}
                      className="w-full py-4 rounded-2xl bg-primary text-primary-foreground hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                          Submitting...
                        </>
                      ) : verificationRequired && !emailToken ? (
                        "Verification Sent"
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