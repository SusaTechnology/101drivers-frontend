// app/pages/dealer/create-delivery.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Flag,
  Car,
  Clock,
  Mail,
  Phone,
  User,
  CreditCard,
  Receipt,
  Settings,
  Info,
  AlertCircle,
  ChevronRight,
  Home,
  Shuffle as SwapHorizontal,
  Wrench,
  Route,
  CheckCircle,
} from "lucide-react";
import LocationAutocomplete from "@/components/map/LocationAutocomplete";
import RouteMap from "@/components/map/RouteMap";
import { getUser, useCreate } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";

// Form validation schema
const deliverySchema = z.object({
  serviceType: z.enum([
    "HOME_DELIVERY",
    "BETWEEN_LOCATIONS",
    "SERVICE_PICKUP_RETURN",
  ]),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  dropoffAddress: z.string().min(1, "Drop-off address is required"),
  rememberPickup: z.boolean().optional(),
  pickupDate: z.string().min(1, "Pickup date is required"),
  pickupWindow: z.string().min(1, "Pickup window is required"),
  dropoffDate: z.string().optional(),
  dropoffWindow: z.string().optional(),
  afterHours: z.boolean().optional(),
  licensePlate: z.string().min(1, "License plate is required"),
  vinVerification: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits"),
  transmission: z.string().min(1, "Transmission is required"),
  transmissionOther: z.string().optional(),
  make: z.string().min(1, "Make is required"),
  makeOther: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  modelOther: z.string().optional(),
  trim: z.string().optional(),
  trimOther: z.string().optional(),
  color: z.string().min(1, "Color is required"),
  colorOther: z.string().optional(),
  instructions: z.string().optional(),
  contactName: z.string().min(1, "Contact name is required").optional(),
  contactEmail: z.string().email("Valid email is required").optional(),
  contactPhone: z.string().min(1, "Phone is required").optional(),
  enableRecipient: z.boolean().optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientPhone: z.string().optional(),
  paymentType: z.enum(["PREPAID", "POSTPAID"]).optional(),
  dealerAuthorized: z.boolean().optional(),
  status: z.enum( ["DRAFT", "QUOTED", "LISTED", "BOOKED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]),
  // customer: z.string()
  // isUrgent:
});

type DeliveryFormData = z.infer<typeof deliverySchema>;
interface QuotePreviewResponse {
  id: string;
  distanceMiles: number;
  estimatedPrice: number;
  feesBreakdown: {
    baseFare: number;
    distanceCharge: number;
    insuranceFee: number;
    transactionFee: number;
  };
}

interface SchedulePreviewRequest {
  quoteId: string;
  serviceType: string;
  customerChose?: "PICKUP_WINDOW" | "DROPOFF_WINDOW";
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  dropoffWindowStart?: string;
  dropoffWindowEnd?: string;
}

interface SchedulePreviewResponse {
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  dropoffWindowStart?: string;
  dropoffWindowEnd?: string;
  etaMinutes: number;
  bufferMinutes: number;
  sameDayEligible: boolean;
  requiresOpsConfirmation: boolean;
  afterHours: boolean;
  feasible: boolean;
  message: string | null;
}

// Helper to parse time window like "9:00 AM – 11:00 AM"
function parseWindowTimes(windowStr: string): { start: string; end: string } {
  const parts = windowStr.split(" – ");
  return { start: parts[0], end: parts[1] };
}
const formatTimeRange = (startIso?: string, endIso?: string) => {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};
// Combine date (YYYY-MM-DD) and time (e.g., "9:00 AM") into ISO string with local offset
function combineDateAndTimeToISO(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Parse time like "9:00 AM"
  const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeMatch) throw new Error(`Invalid time format: ${timeStr}`);
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const ampm = timeMatch[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  // Create date in local time zone (browser's zone)
  const date = new Date(year, month - 1, day, hours, minutes, 0);
  // Return ISO string including offset
  return date.toISOString(); // This will be in UTC, but backend expects UTC? We'll send UTC.
  // Alternatively, we can construct with offset: but simpler to send UTC and let backend interpret as UTC.
  // The backend likely stores DateTime in UTC. So sending UTC ISO string is fine.
}

export default function CreateDeliveryPage() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showRecipientFields, setShowRecipientFields] = useState(false);
  const [isDealerAuthorized, setIsDealerAuthorized] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [pickupPlaceId, setPickupPlaceId] = useState<string | null>(null);
  const [dropoffPlaceId, setDropoffPlaceId] = useState<string | null>(null);
  const [pickupState, setPickupState] = useState<string | null>(null);
  const [dropoffState, setDropoffState] = useState<string | null>(null);
  const [schedulePreviewData, setSchedulePreviewData] = useState<SchedulePreviewResponse | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState({
    miles: 0,
    total: 0,
    base: 0,
    distance: 0,
    insurance: 0,
    transaction: 0,
  });
  const customer = getUser();
  
  // Mutation for creating delivery
  const createDelivery = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/create-from-quote`, {
    onSuccess: () => {
      // Navigate to confirmation or dashboard
      toast.success("Delivery request created successfully 🚚");
      navigate({ to: "/dealer-dashboard" }); // adjust as needed
    },
    onError: (error) => {
      // You could show a toast here
      toast.error(
        error?.message || "Failed to create delivery request"
      );
      console.error("Failed to create delivery:", error);
    },
    successMessage: "Delivery request created successfully",
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DeliveryFormData>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      serviceType: "HOME_DELIVERY",
      paymentType: "PREPAID",
      rememberPickup: false,
      afterHours: false,
      enableRecipient: false,
      dealerAuthorized: false,
      pickupWindow: "9:00 AM – 11:00 AM",
      dropoffWindow: "3:00 PM – 5:00 PM",
      status: "DRAFT",
    },
  });

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places'],
  });

  // Watch form values for dynamic behavior
  const serviceType = watch("serviceType");
  const pickupAddress = watch("pickupAddress");
  const dropoffAddress = watch("dropoffAddress");
  const enableRecipient = watch("enableRecipient");
  const dealerAuthorized = watch("dealerAuthorized");
  const transmission = watch("transmission");
  const make = watch("make");
  const model = watch("model");
  const trim = watch("trim");
  const color = watch("color");
  const pickupDate = watch("pickupDate");
  const pickupWindow = watch("pickupWindow");
  const dropoffDate = watch("dropoffDate");
  const dropoffWindow = watch("dropoffWindow");
  // Update recipient fields visibility
  useEffect(() => {
    setShowRecipientFields(!!enableRecipient);
  }, [enableRecipient]);

  // Update dealer authorized state
  useEffect(() => {
    setIsDealerAuthorized(!!dealerAuthorized);
  }, [dealerAuthorized]);

  
  const getQuotePreview = useCreate<QuotePreviewResponse, { pickupAddress: string; dropoffAddress: string; serviceType: string }>(
  `${import.meta.env.VITE_API_URL}/api/deliveryRequests/quote-preview`,
  {
    onSuccess: (data) => {
      setQuoteData({
        miles: data.distanceMiles || 0,
        total: data.estimatedPrice || 0,
        base: data.feesBreakdown?.baseFare || 0,
        distance: data.feesBreakdown?.distanceCharge || 0,
        insurance: data.feesBreakdown?.insuranceFee || 0,
        transaction: data.feesBreakdown?.transactionFee || 0,
      });
      setQuoteId(data.id);
      setHasCalculated(true);
    },
    onError: (error) => {
      toast.error(
        error?.message || "Failed to create delivery request"
      );
      console.error('Failed to fetch quote:', error);
      // Optionally reset to zeros or keep previous
    },
    successMessage: undefined, // No toast for this
  }
);
  const getSchedulePreview = useCreate<SchedulePreviewResponse, SchedulePreviewRequest>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/schedule-preview`,
    {
      onSuccess: (data) => {
        setSchedulePreviewData(data);
        
      },
      onError: (error) => {
        toast.error(
        error?.message || "Failed to create delivery request"
      );
        console.error('Schedule preview failed:', error);
      },
      successMessage: undefined,
    }
  );

const handleQuotePreview = () => {
      if (pickupAddress && dropoffAddress && serviceType) {
      getQuotePreview.mutate({ pickupAddress, dropoffAddress, serviceType });
    }
  }

  // Geocoder helper for the "Same as business info" button
  const geocodeAddress = (address: string, setter: (coords: google.maps.LatLngLiteral) => void) => {
    if (!isLoaded) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results && results[0].geometry.location) {
        const location = results[0].geometry.location;
        setter({ lat: location.lat(), lng: location.lng() });
      }
    });
  };

  // Handle place selection from autocomplete
  const handlePickupSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setPickupCoords({ lat, lng });
      setPickupPlaceId(place.place_id || null);
      setValue("pickupAddress", place.formatted_address || "");
    

        if (place.address_components) {
      const stateComp = place.address_components.find(comp =>
        comp.types.includes('administrative_area_level_1')
      );
      if (stateComp) {
        setPickupState(stateComp.short_name || stateComp.long_name);
      }
    }
  }
  }, []);

  const handleDropoffSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setDropoffCoords({ lat, lng });
      setDropoffPlaceId(place.place_id || null);
      setValue("dropoffAddress", place.formatted_address || "");

          if (place.address_components) {
      const stateComp = place.address_components.find(comp =>
        comp.types.includes('administrative_area_level_1')
      );
      if (stateComp) {
        setDropoffState(stateComp.short_name || stateComp.long_name);
      }
    }
  
    }
  }, []);

  // Handle "Same as business info" button
  const handleSameAsBusiness = () => {
    const address = "101 Drivers Dealer Lot, Los Angeles, CA";
    setValue("pickupAddress", address);
    geocodeAddress(address, setPickupCoords);
  };

  // Transform form data to API payload
  const buildPayload = (data: DeliveryFormData) => {
    // Resolve "Other" fields
    const finalMake = data.make === "Other" ? data.makeOther : data.make;
    const finalModel = data.model === "Other" ? data.modelOther : data.model;
    const finalColor = data.color === "Other" ? data.colorOther : data.color;

    // Parse windows
    const pickupTimes = parseWindowTimes(data.pickupWindow);
    const pickupStart = combineDateAndTimeToISO(data.pickupDate, pickupTimes.start);
    const pickupEnd = combineDateAndTimeToISO(data.pickupDate, pickupTimes.end);

    let dropoffStart: string | undefined;
    let dropoffEnd: string | undefined;
    if (data.dropoffDate && data.dropoffWindow) {
      const dropoffTimes = parseWindowTimes(data.dropoffWindow);
      dropoffStart = combineDateAndTimeToISO(data.dropoffDate, dropoffTimes.start);
      dropoffEnd = combineDateAndTimeToISO(data.dropoffDate, dropoffTimes.end);
    }

    return {
      quoteId: quoteId,
      serviceType: data.serviceType,
      pickupAddress: data.pickupAddress,
      pickupLat: pickupCoords?.lat,
      pickupLng: pickupCoords?.lng,
      pickupPlaceId: pickupPlaceId,
      dropoffAddress: data.dropoffAddress,
      dropoffLat: dropoffCoords?.lat,
      dropoffLng: dropoffCoords?.lng,
      dropoffPlaceId: dropoffPlaceId,
      pickupWindowStart: pickupStart,
      pickupWindowEnd: pickupEnd,
      dropoffWindowStart: dropoffStart,
      dropoffWindowEnd: dropoffEnd,
      afterHours: data.afterHours || false,
      licensePlate: data.licensePlate,
      vinVerificationCode: data.vinVerification,
      vehicleMake: finalMake,
      vehicleModel: finalModel,
      vehicleColor: finalColor,
      // specialInstructions: data.instructions,
      recipientName: data.enableRecipient ? data.recipientName : undefined,
      recipientEmail: data.enableRecipient ? data.recipientEmail : undefined,
      recipientPhone: data.enableRecipient ? data.recipientPhone : undefined,
      // paymentType: data.paymentType,
      // customerContact: {
      //   name: data.contactName,
      //   email: data.contactEmail,
      //   phone: data.contactPhone,
      // },
        isUrgent: false,
  requiresOpsConfirmation: data.afterHours || false,
  sameDayEligible: false,
  status: "DRAFT",
  customerId: customer.profileId

    };
  };

  const onSubmit = async (data: DeliveryFormData) => {
    // console.log("customer____",customer.profileId)
    // Basic validation: if postpaid is selected but dealer not authorized, block
    if (data.paymentType === "POSTPAID" && !isDealerAuthorized) {
      alert("You are not authorized for postpaid payment.");
      return;
    }

    const payload = buildPayload(data);
    createDelivery.mutate(payload);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Header component (unchanged) ...
  const Header = () => (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <a
            href="/dealer-dashboard"
            className="flex items-center"
            aria-label="101 Drivers"
          >
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="/dealer-dashboard"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/dealer-create-delivery"
              className="text-sm font-semibold text-lime-500 hover:text-lime-600 transition-colors"
            >
              Create Delivery
            </a>
            <a
              // href="/dealer/notifications"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Notifications
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/dealer-dashboard" })}
            className="hidden sm:inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <span
                className={`block h-0.5 w-6 bg-current transition-transform ${isMobileMenuOpen ? "rotate-45 translate-y-1" : ""}`}
              />
              <span
                className={`block h-0.5 w-6 bg-current transition-opacity mt-1 ${isMobileMenuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block h-0.5 w-6 bg-current transition-transform mt-1 ${isMobileMenuOpen ? "-rotate-45 -translate-y-1" : ""}`}
              />
            </div>
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <a
              href="/dealer-dashboard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/dealer-create-delivery"
              className="text-sm font-semibold text-lime-500 hover:text-lime-600 transition-colors"
            >
              Create Delivery
            </a>
            <a
              // href="/dealer/notifications"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Notifications
            </a>
          </div>
        </div>
      )}
    </header>
  );

  // Footer component (unchanged) ...
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
              Dealer portal • California-only operations • Email-first
              notifications
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

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Title section (unchanged) */}
        <section className="flex flex-col gap-6 mb-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center">
                <Route className="h-6 w-6 text-lime-600 dark:text-lime-400" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  Create delivery request
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                  Dealer flow: enter CA-only addresses → view map/miles/quote →
                  set schedule → vehicle dropdowns → optional recipient tracking
                  → payment (prepaid or postpaid if authorized).
                </p>
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-end gap-2">
              <Badge
                variant="secondary"
                className="bg-lime-100 dark:bg-lime-900/20 text-lime-800 dark:text-lime-200 border-lime-200"
              >
                <MapPin className="h-3 w-3 mr-1" />
                CA-only validation
              </Badge>
              <Badge
                variant="outline"
                className="bg-slate-100 dark:bg-slate-800/50"
              >
                <Mail className="h-3 w-3 mr-1" />
                Email-first (SMS optional)
              </Badge>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN - Form */}
          <div className="xl:col-span-7 space-y-8">
            {/* Step 1: Service Type (unchanged) */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Step 1
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Service type
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Choose the service type (used for guidance + stored on the
                      request).
                    </p>
                  </div>
                  {/* <Badge variant="outline" className="hidden sm:flex">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    PRD-aligned
                  </Badge> */}
                </div>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  defaultValue="HOME_DELIVERY"
                  className="grid grid-cols-1 md:grid-cols-3 gap-3"
                  onValueChange={(value) =>
                    setValue("serviceType", value as any)
                  }
                >
                  {[
                    {
                      value: "HOME_DELIVERY",
                      icon: Home,
                      title: "Home Delivery",
                      description: "Dealer ↔ customer delivery.",
                    },
                    {
                      value: "BETWEEN_LOCATIONS",
                      icon: SwapHorizontal,
                      title: "Between Locations",
                      description: "Any A → B relocation.",
                    },
                    {
                      value: "SERVICE_PICKUP_RETURN",
                      icon: Wrench,
                      title: "Service Pick-up & Return",
                      description: "To service center and back.",
                    },
                  ].map((item) => (
                    <Label
                      key={item.value}
                      htmlFor={item.value}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-5 hover:border-lime-500 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                          <div className="w-11 h-11 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center">
                            <item.icon className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                          </div>
                          <RadioGroupItem value={item.value} id={item.value} />
                        </div>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {item.description}
                        </div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Step 2: Addresses & Quote */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Step 2
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Pickup & drop-off
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      CA-only addresses with autocomplete/search. Quote updates
                      when route changes.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden sm:flex">
                    <Route className="h-3 w-3 mr-1" />
                    Route + miles + price
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Pickup Address - replaced with LocationAutocomplete */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="pickupAddress"
                      className="text-xs font-bold"
                    >
                      Pickup address
                    </Label>
                    <LocationAutocomplete
                      key="pickup"
                      value={pickupAddress || ""}
                      onChange={(val) => setValue("pickupAddress", val)}
                      onPlaceSelect={handlePickupSelect}
                      isLoaded={isLoaded}
                      placeholder="Search pickup location (California only)"
                      icon={<MapPin className="h-5 w-5 text-slate-400" />}
                    />
                    {errors.pickupAddress && (
                      <p className="text-xs text-red-500">
                        {errors.pickupAddress.message}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="rememberPickup"
                          {...register("rememberPickup")}
                        />
                        <Label
                          htmlFor="rememberPickup"
                          className="text-xs font-bold cursor-pointer"
                        >
                          Remember pickup for next time
                        </Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-auto p-0"
                        onClick={handleSameAsBusiness}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Same as business info
                      </Button>
                    </div>
                  </div>

                  {/* Drop-off Address - replaced with LocationAutocomplete */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="dropoffAddress"
                      className="text-xs font-bold"
                    >
                      Drop-off address
                    </Label>
                    <LocationAutocomplete
                      key="dropoff"
                      value={dropoffAddress || ""}
                      onChange={(val) => setValue("dropoffAddress", val)}
                      onPlaceSelect={handleDropoffSelect}
                      isLoaded={isLoaded}
                      placeholder="Search drop-off location (California only)"
                      icon={<Flag className="h-5 w-5 text-slate-400" />}
                    />
                    {errors.dropoffAddress && (
                      <p className="text-xs text-red-500">
                        {errors.dropoffAddress.message}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Any out-of-CA address will be rejected in the real app
                      (server validation).
                    </p>
                  </div>
                </div>

                {/* Map Preview & Quote */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Map Preview - replaced with RouteMap */}
                  <div className="lg:col-span-7 relative min-h-[240px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <RouteMap
                      pickup={pickupCoords}
                      dropoff={dropoffCoords}
                      isLoaded={isLoaded}
                    />
                    {/* Overlay badges */}
                    <div className="absolute bottom-5 left-5 flex flex-wrap gap-2 z-10">
                      <Badge className="bg-white/95 dark:bg-slate-900/90 backdrop-blur shadow-lg">
                        <MapPin className="h-3 w-3 mr-1" />
                        Route map
                      </Badge>
                      <Badge className="bg-white/95 dark:bg-slate-900/90 backdrop-blur shadow-lg">
                        <Route className="h-3 w-3 mr-1" />
                        Distance: {quoteData.miles || "—"} mi
                      </Badge>
                    </div>
                  </div>

                  {/* Quote Breakdown */}
                  <Card className="lg:col-span-5">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                            Quote
                          </CardDescription>
                          <CardTitle className="text-2xl font-black mt-2">
                            {formatCurrency(quoteData.total) || "$—"}
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-2">
                              (estimated)
                            </span>
                          </CardTitle>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                            Itemized breakdown updates if addresses or service
                            type change.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleQuotePreview}
                          disabled={!pickupAddress || !dropoffAddress || !serviceType || getQuotePreview.isPending}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          {getQuotePreview.isPending
                            ? "Loading..."
                            : hasCalculated
                            ? "Recalculate"
                            : "Calculate"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {hasCalculated ? <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">
                            Base fare
                          </span>
                          <span className="text-slate-900 dark:text-white font-black">
                            {formatCurrency(quoteData.base)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">
                            Distance charge
                          </span>
                          <span className="text-slate-900 dark:text-white font-black">
                            {formatCurrency(quoteData.distance)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">
                            Insurance fee
                          </span>
                          <span className="text-slate-900 dark:text-white font-black">
                            {formatCurrency(quoteData.insurance)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">
                            Transaction fee
                          </span>
                          <span className="text-slate-900 dark:text-white font-black">
                            {formatCurrency(quoteData.transaction)}
                          </span>
                        </div>
                      </div>: <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
                            Click "Calculate" to get a real‑time quote based on the addresses and service type.
                          </p>}


                      <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex gap-3">
                        <Info className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
                          Real‑time quote from backend – updates automatically
                          when addresses or service type change.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Scheduling */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Step 3
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Schedule window
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Select pickup/drop-off windows. System suggests feasible
                      times based on ETA + buffer.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden sm:flex">
                    <Clock className="h-3 w-3 mr-1" />
                    US time format
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pickup Ready Window */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest">
                        Pickup ready window
                      </Label>
                      <span className="text-[11px] font-extrabold text-slate-500">
                        Suggested default: 9–11 AM
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="pickupDate"
                          className="text-xs font-bold"
                        >
                          Pickup date
                        </Label>
                        <Input
                          id="pickupDate"
                          type="date"
                          {...register("pickupDate")}
                          className="h-14 rounded-2xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="pickupWindow"
                          className="text-xs font-bold"
                        >
                          Window
                        </Label>
                        <Select
                          {...register("pickupWindow")}
                          onValueChange={(value) =>
                            setValue("pickupWindow", value)
                          }
                        >
                          <SelectTrigger className="h-14 rounded-2xl">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7:00 AM – 9:00 AM">
                              7:00 AM – 9:00 AM
                            </SelectItem>
                            <SelectItem value="9:00 AM – 11:00 AM">
                              9:00 AM – 11:00 AM
                            </SelectItem>
                            <SelectItem value="11:00 AM – 1:00 PM">
                              11:00 AM – 1:00 PM
                            </SelectItem>
                            <SelectItem value="1:00 PM – 3:00 PM">
                              1:00 PM – 3:00 PM
                            </SelectItem>
                            <SelectItem value="3:00 PM – 5:00 PM">
                              3:00 PM – 5:00 PM
                            </SelectItem>
                            <SelectItem value="5:00 PM – 7:00 PM">
                              5:00 PM – 7:00 PM
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                                            {/* Display results */}
                        {schedulePreviewData && (
                         <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-4">
              {/* Header with icon and button */}
          

             {/* Results area */}
                    {schedulePreviewData && (
                      <div className="mt-2 space-y-3">
                        {/* Status badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={schedulePreviewData.feasible ? "default" : "destructive"} className="px-2 py-0.5 text-[10px]">
                            {schedulePreviewData.feasible ? "✓ Feasible" : "✗ Not Feasible"}
                          </Badge>
                          {schedulePreviewData.sameDayEligible && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px]">
                              Same‑day eligible
                            </Badge>
                          )}
                          {(schedulePreviewData.requiresOpsConfirmation || schedulePreviewData.afterHours) && (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800 text-[10px]">
                              Ops confirmation required
                            </Badge>
                          )}
                        </div>

                        {/* Key details grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          {/* Pickup window */}
                          <span className="text-slate-500">Pickup window</span>
                          <span className="font-medium">
                            {formatTimeRange(schedulePreviewData.pickupWindowStart, schedulePreviewData.pickupWindowEnd) || '—'}
                          </span>

                          {/* Dropoff window */}
                          <span className="text-slate-500">Drop‑off window</span>
                          <span className="font-medium">
                            {formatTimeRange(schedulePreviewData.dropoffWindowStart, schedulePreviewData.dropoffWindowEnd) || '—'}
                          </span>

                          {/* ETA */}
                          <span className="text-slate-500">ETA</span>
                          <span className="font-medium">{formatDuration(schedulePreviewData.etaMinutes)}</span>

                          {/* Buffer */}
                          <span className="text-slate-500">Buffer</span>
                          <span className="font-medium">{schedulePreviewData.bufferMinutes} min</span>
                        </div>

                        {/* Optional message */}
                        {schedulePreviewData.message && (
                          <p className="text-[11px] text-slate-600 italic">{schedulePreviewData.message}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                 )}
                  </div>

                  {/* Drop-off Window */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest">
                        Desired drop-off window
                      </Label>
                      <span className="text-[11px] font-extrabold text-slate-500">
                        System suggests pickup
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="dropoffDate"
                          className="text-xs font-bold"
                        >
                          Drop-off date
                        </Label>
                        <Input
                          id="dropoffDate"
                          type="date"
                          {...register("dropoffDate")}
                          className="h-14 rounded-2xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="dropoffWindow"
                          className="text-xs font-bold"
                        >
                          Window
                        </Label>
                        <Select
                          {...register("dropoffWindow")}
                          onValueChange={(value) =>
                            setValue("dropoffWindow", value)
                          }
                        >
                          <SelectTrigger className="h-14 rounded-2xl">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7:00 AM – 9:00 AM">
                              7:00 AM – 9:00 AM
                            </SelectItem>
                            <SelectItem value="9:00 AM – 11:00 AM">
                              9:00 AM – 11:00 AM
                            </SelectItem>
                            <SelectItem value="11:00 AM – 1:00 PM">
                              11:00 AM – 1:00 PM
                            </SelectItem>
                            <SelectItem value="1:00 PM – 3:00 PM">
                              1:00 PM – 3:00 PM
                            </SelectItem>
                            <SelectItem value="3:00 PM – 5:00 PM">
                              3:00 PM – 5:00 PM
                            </SelectItem>
                            <SelectItem value="5:00 PM – 7:00 PM">
                              5:00 PM – 7:00 PM
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox id="afterHours" {...register("afterHours")} />
                      <Label
                        htmlFor="afterHours"
                        className="text-xs font-bold cursor-pointer"
                      >
                        Other / After-hours (routes to Ops for confirmation)
                      </Label>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Settings className="h-5 w-5 text-lime-500 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-extrabold">Schedule Feasibility</div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                Check if your selected windows are feasible based on ETA and buffer.
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!quoteId) return;

                              // Convert selected windows to ISO strings if they exist
                              let pickupStart, pickupEnd, dropoffStart, dropoffEnd;
                              if (pickupDate && pickupWindow) {
                                const pickupTimes = parseWindowTimes(pickupWindow);
                                pickupStart = combineDateAndTimeToISO(pickupDate, pickupTimes.start);
                                pickupEnd = combineDateAndTimeToISO(pickupDate, pickupTimes.end);
                              }
                              if (dropoffDate && dropoffWindow) {
                                const dropoffTimes = parseWindowTimes(dropoffWindow);
                                dropoffStart = combineDateAndTimeToISO(dropoffDate, dropoffTimes.start);
                                dropoffEnd = combineDateAndTimeToISO(dropoffDate, dropoffTimes.end);
                              }

                              getSchedulePreview.mutate({
                                quoteId,
                                serviceType,
                                pickupWindowStart: pickupStart,
                                pickupWindowEnd: pickupEnd,
                                dropoffWindowStart: dropoffStart,
                                dropoffWindowEnd: dropoffEnd,
                              });
                            }}
                            disabled={!quoteId || getSchedulePreview.isPending}
                          >
                            {getSchedulePreview.isPending ? "Checking..." : "Check Feasibility"}
                          </Button>
                        </div>


                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 4: Vehicle Details */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Step 4
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Vehicle details
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Make/model/trim/color from dropdowns; "Other" unlocks
                      free-text. VIN verification required.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden sm:flex">
                    <Car className="h-3 w-3 mr-1" />
                    Dropdown-driven
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Vehicle Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licensePlate" className="text-xs font-bold">
                      License Plate
                    </Label>
                    <Input
                      id="licensePlate"
                      {...register("licensePlate")}
                      className="h-14 rounded-2xl"
                      placeholder="7ABC123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="vinVerification"
                      className="text-xs font-bold"
                    >
                      VIN verification code{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="vinVerification"
                      {...register("vinVerification")}
                      className="h-14 rounded-2xl"
                      placeholder="4 digits"
                      maxLength={4}
                    />
                    {errors.vinVerification && (
                      <p className="text-xs text-red-500">
                        {errors.vinVerification.message}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Must be exactly 4 numeric digits (no letters).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transmission" className="text-xs font-bold">
                      Transmission
                    </Label>
                    <Select
                      {...register("transmission")}
                      onValueChange={(value) => setValue("transmission", value)}
                    >
                      <SelectTrigger className="h-14 rounded-2xl">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Automatic">Automatic</SelectItem>
                        <SelectItem value="Manual">Manual</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {transmission === "Other" && (
                      <Input
                        {...register("transmissionOther")}
                        className="h-14 rounded-2xl mt-2"
                        placeholder="Enter transmission"
                      />
                    )}
                  </div>
                </div>

                {/* Make & Model */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="make" className="text-xs font-bold">
                      Make
                    </Label>
                    <Select
                      {...register("make")}
                      onValueChange={(value) => setValue("make", value)}
                    >
                      <SelectTrigger className="h-14 rounded-2xl">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Toyota">Toyota</SelectItem>
                        <SelectItem value="Honda">Honda</SelectItem>
                        <SelectItem value="Ford">Ford</SelectItem>
                        <SelectItem value="Chevrolet">Chevrolet</SelectItem>
                        <SelectItem value="Tesla">Tesla</SelectItem>
                        <SelectItem value="BMW">BMW</SelectItem>
                        <SelectItem value="Mercedes-Benz">
                          Mercedes-Benz
                        </SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {make === "Other" && (
                      <Input
                        {...register("makeOther")}
                        className="h-14 rounded-2xl mt-2"
                        placeholder="Enter make"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model" className="text-xs font-bold">
                      Model
                    </Label>
                    <Select
                      {...register("model")}
                      onValueChange={(value) => setValue("model", value)}
                    >
                      <SelectTrigger className="h-14 rounded-2xl">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Camry">Camry</SelectItem>
                        <SelectItem value="Corolla">Corolla</SelectItem>
                        <SelectItem value="RAV4">RAV4</SelectItem>
                        <SelectItem value="Civic">Civic</SelectItem>
                        <SelectItem value="Accord">Accord</SelectItem>
                        <SelectItem value="Model 3">Model 3</SelectItem>
                        <SelectItem value="Model Y">Model Y</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {model === "Other" && (
                      <Input
                        {...register("modelOther")}
                        className="h-14 rounded-2xl mt-2"
                        placeholder="Enter model"
                      />
                    )}
                  </div>
                </div>

                {/* Trim & Color */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trim" className="text-xs font-bold">
                      Trim (if available)
                    </Label>
                    <Select
                      {...register("trim")}
                      onValueChange={(value) => setValue("trim", value)}
                    >
                      <SelectTrigger className="h-14 rounded-2xl">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Base">Base</SelectItem>
                        <SelectItem value="Sport">Sport</SelectItem>
                        <SelectItem value="Limited">Limited</SelectItem>
                        <SelectItem value="Touring">Touring</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {trim === "Other" && (
                      <Input
                        {...register("trimOther")}
                        className="h-14 rounded-2xl mt-2"
                        placeholder="Enter trim"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="color" className="text-xs font-bold">
                      Color
                    </Label>
                    <Select
                      {...register("color")}
                      onValueChange={(value) => setValue("color", value)}
                    >
                      <SelectTrigger className="h-14 rounded-2xl">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Black">Black</SelectItem>
                        <SelectItem value="White">White</SelectItem>
                        <SelectItem value="Silver">Silver</SelectItem>
                        <SelectItem value="Gray">Gray</SelectItem>
                        <SelectItem value="Blue">Blue</SelectItem>
                        <SelectItem value="Red">Red</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {color === "Other" && (
                      <Input
                        {...register("colorOther")}
                        className="h-14 rounded-2xl mt-2"
                        placeholder="Enter color"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 5: Instructions */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                    Step 5
                  </CardDescription>
                  <CardTitle className="text-2xl font-black mt-2">
                    Instructions
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Gate codes, key handoff notes, dealership contact at pickup,
                    etc.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label
                    htmlFor="instructions"
                    className="text-xs font-black uppercase tracking-widest"
                  >
                    Special instructions
                  </Label>
                  <Textarea
                    id="instructions"
                    {...register("instructions")}
                    className="min-h-[130px] rounded-2xl"
                    placeholder="Gate code, parking instructions, key location, point-of-contact notes..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - Contact, Recipient, Payment (unchanged) */}
          <div className="xl:col-span-5 space-y-8">
            {/* Contact */}
            {/* <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Contact
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Dealer contact
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Email-first notifications. Phone for operational calls;
                      SMS optional if enabled.
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden sm:flex">
                    <Mail className="h-3 w-3 mr-1" />
                    Email-first
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto py-3"
                  onClick={() => {
                    setValue("contactName", "Dealer Contact");
                    setValue("contactEmail", "dealer@company.com");
                    setValue("contactPhone", "(310) 555-0123");
                  }}
                >
                  <User className="h-4 w-4 mr-2" />
                  Same as saved business contact (prototype)
                </Button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName" className="text-xs font-bold">
                      Full name
                    </Label>
                    <Input
                      id="contactName"
                      {...register("contactName")}
                      className="h-14 rounded-2xl"
                      placeholder="Contact person"
                    />
                    {errors.contactName && (
                      <p className="text-xs text-red-500">
                        {errors.contactName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail" className="text-xs font-bold">
                      Email
                    </Label>
                    <Input
                      id="contactEmail"
                      {...register("contactEmail")}
                      className="h-14 rounded-2xl"
                      placeholder="dealer@company.com"
                      type="email"
                    />
                    {errors.contactEmail && (
                      <p className="text-xs text-red-500">
                        {errors.contactEmail.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone" className="text-xs font-bold">
                    Phone
                  </Label>
                  <Input
                    id="contactPhone"
                    {...register("contactPhone")}
                    className="h-14 rounded-2xl"
                    placeholder="(###) ###-####"
                    type="tel"
                  />
                  {errors.contactPhone && (
                    <p className="text-xs text-red-500">
                      {errors.contactPhone.message}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    SMS optional and depends on Admin policy; email is default.
                  </p>
                </div>
              </CardContent>
            </Card> */}

            {/* Recipient Tracking */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                    Optional
                  </CardDescription>
                  <CardTitle className="text-2xl font-black mt-2">
                    Recipient tracking
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    If provided, recipient gets secure tracking link and
                    notifications (email by default).
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableRecipient"
                    {...register("enableRecipient")}
                    checked={showRecipientFields}
                    onCheckedChange={(checked) => {
                      setShowRecipientFields(!!checked);
                      setValue("enableRecipient", !!checked);
                    }}
                  />
                  <Label
                    htmlFor="enableRecipient"
                    className="text-xs font-bold cursor-pointer"
                  >
                    Add recipient contact
                  </Label>
                </div>

                {showRecipientFields && (
                  <div className="mt-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="recipientName"
                          className="text-xs font-bold"
                        >
                          Recipient name
                        </Label>
                        <Input
                          id="recipientName"
                          {...register("recipientName")}
                          className="h-14 rounded-2xl"
                          placeholder="Buyer / receiver"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="recipientEmail"
                          className="text-xs font-bold"
                        >
                          Recipient email
                        </Label>
                        <Input
                          id="recipientEmail"
                          {...register("recipientEmail")}
                          className="h-14 rounded-2xl"
                          placeholder="recipient@example.com"
                          type="email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="recipientPhone"
                        className="text-xs font-bold"
                      >
                        Recipient phone (optional)
                      </Label>
                      <Input
                        id="recipientPhone"
                        {...register("recipientPhone")}
                        className="h-14 rounded-2xl"
                        placeholder="Optional (SMS if enabled)"
                        type="tel"
                      />
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Tracking links are access-controlled and should expire
                      after completion.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                    Payment
                  </CardDescription>
                  <CardTitle className="text-2xl font-black mt-2">
                    Payment option
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Dealers can choose prepaid or postpaid{" "}
                    <span className="font-bold">only if authorized</span>.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  defaultValue="PREPAID"
                  className="space-y-3"
                  onValueChange={(value) =>
                    setValue("paymentType", value as any)
                  }
                >
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-lime-500" />
                      <div>
                        <div className="font-extrabold">Prepaid</div>
                        <div className="text-[11px] text-slate-500">
                          Authorize now (capture rules per policy).
                        </div>
                      </div>
                    </div>
                    <RadioGroupItem value="PREPAID" id="PREPAID" />
                  </div>

                  <div
                    className={`flex items-center justify-between p-4 rounded-2xl border ${
                      isDealerAuthorized
                        ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className="h-5 w-5 text-lime-500" />
                      <div>
                        <div className="font-extrabold">Postpaid (credit)</div>
                        <div className="text-[11px] text-slate-500">
                          Visible only for Admin-authorized dealers.
                        </div>
                      </div>
                    </div>
                    <RadioGroupItem
                      value="POSTPAID"
                      id="POSTPAID"
                      disabled={!isDealerAuthorized}
                    />
                  </div>
                </RadioGroup>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <Settings className="h-5 w-5 text-lime-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-extrabold">
                        Authorization flag (prototype)
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Toggle to simulate dealer being authorized for postpaid.
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dealerAuthorized"
                        {...register("dealerAuthorized")}
                        checked={isDealerAuthorized}
                        onCheckedChange={(checked) => {
                          setIsDealerAuthorized(!!checked);
                          setValue("dealerAuthorized", !!checked);
                        }}
                      />
                      <Label
                        htmlFor="dealerAuthorized"
                        className="text-xs font-bold cursor-pointer"
                      >
                        Authorized
                      </Label>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  {isDealerAuthorized
                    ? "Authorized: postpaid is selectable."
                    : "Not authorized: postpaid should be hidden and rejected by API."}
                </p>
              </CardContent>
            </Card>

            {/* Submit */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                    Submit
                  </CardDescription>
                  <CardTitle className="text-2xl font-black mt-2">
                    Review & create
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Creates a listed delivery request. We'll email confirmation
                    (SMS optional if enabled).
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  type="submit"
                  className="w-full py-6 rounded-2xl bg-lime-500 hover:bg-lime-600 text-slate-950 font-extrabold text-lg"
                  onClick={handleSubmit(onSubmit)}
                  disabled={createDelivery.isPending}
                >
                  {createDelivery.isPending ? "Creating..." : "Create Delivery Request"}
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>

                {Object.keys(errors).length > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-extrabold text-red-900 dark:text-red-200">
                          Fix the following:
                        </div>
                        <ul className="mt-2 text-[11px] text-red-900 dark:text-red-200 list-disc pl-5 space-y-1">
                          {Object.entries(errors).map(([key, error]) => (
                            <li key={key}>
                              {error?.message || `Error in ${key}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 mt-4 text-center">
                  Compliance evidence (VIN verification, photos, odometer,
                  Start/Stop tracking) is captured by driver during delivery.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}