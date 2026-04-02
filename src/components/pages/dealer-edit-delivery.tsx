// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from "@/lib/google-maps-config";
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
  Save,
  Loader2,
  Calendar,
  X,
  Menu,
} from "lucide-react";
import LocationAutocomplete from "@/components/map/LocationAutocomplete";
import RouteMap from "@/components/map/RouteMap";
import { getUser, useDataQuery, usePatch, useCreate } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";

// Form validation schema - similar to create but some fields may be optional for edit
const editDeliverySchema = z.object({
  serviceType: z.enum([
    "HOME_DELIVERY",
    "BETWEEN_LOCATIONS",
    "SERVICE_PICKUP_RETURN",
  ]).optional(),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  dropoffAddress: z.string().min(1, "Drop-off address is required"),
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
  color: z.string().min(1, "Color is required"),
  colorOther: z.string().optional(),
  instructions: z.string().optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientPhone: z.string().optional(),
  enableRecipient: z.boolean().optional(),
});

type EditDeliveryFormData = z.infer<typeof editDeliverySchema>;

// Vehicle dropdown options
const vehicleMakes = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler",
  "Dodge", "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar",
  "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz",
  "MINI", "Mitsubishi", "Nissan", "Porsche", "RAM", "Subaru", "Tesla",
  "Toyota", "Volkswagen", "Volvo", "Other"
];

const vehicleColors = [
  "Black", "White", "Silver", "Gray", "Blue", "Red", "Brown", "Green",
  "Beige", "Orange", "Gold", "Yellow", "Purple", "Other"
];

const transmissionTypes = [
  "Automatic", "Manual", "CVT", "Other"
];

// Time windows
const timeWindows = [
  "9:00 AM – 11:00 AM",
  "11:00 AM – 1:00 PM",
  "1:00 PM – 3:00 PM",
  "3:00 PM – 5:00 PM",
  "5:00 PM – 7:00 PM",
];

// Helper to parse time window
function parseWindowTimes(windowStr: string): { start: string; end: string } {
  const parts = windowStr.split(" – ");
  return { start: parts[0], end: parts[1] };
}

// Combine date and time into ISO string
function combineDateAndTimeToISO(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeMatch) throw new Error(`Invalid time format: ${timeStr}`);
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const ampm = timeMatch[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const date = new Date(year, month - 1, day, hours, minutes, 0);
  return date.toISOString();
}

// Extract date from ISO string
function extractDateFromISO(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().split('T')[0];
}

// Extract time window from ISO strings
function extractTimeWindowFromISO(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export default function DealerEditDelivery() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const deliveryId = state?.id;
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showRecipientFields, setShowRecipientFields] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [pickupPlaceId, setPickupPlaceId] = useState<string | null>(null);
  const [dropoffPlaceId, setDropoffPlaceId] = useState<string | null>(null);
  const [pickupState, setPickupState] = useState<string | null>(null);
  const [dropoffState, setDropoffState] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const customer = getUser();

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Fetch existing delivery data
  const {
    data: deliveryData,
    isLoading,
    isError,
    error,
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}`,
    noFilter: true,
    enabled: !!deliveryId,
  });

  // Update mutation
  const updateDelivery = usePatch(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}`, {
    onSuccess: () => {
      toast.success("Delivery updated successfully", {
        description: "Your changes have been saved.",
      });
      navigate({ to: "/dealer-delivery-details", search: { id: deliveryId } });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to update delivery";
      toast.error("Failed to update delivery", {
        description: errorMessage,
      });
      console.error("Delivery update failed:", error);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditDeliveryFormData>({
    resolver: zodResolver(editDeliverySchema),
    defaultValues: {
      serviceType: "HOME_DELIVERY",
      afterHours: false,
      enableRecipient: false,
      pickupWindow: "9:00 AM – 11:00 AM",
      dropoffWindow: "3:00 PM – 5:00 PM",
    },
  });

  // Populate form when delivery data loads
  useEffect(() => {
    if (deliveryData && isLoaded) {
      // Set coordinates from API data
      if (deliveryData.pickupLat && deliveryData.pickupLng) {
        setPickupCoords({ lat: deliveryData.pickupLat, lng: deliveryData.pickupLng });
      }
      if (deliveryData.dropoffLat && deliveryData.dropoffLng) {
        setDropoffCoords({ lat: deliveryData.dropoffLat, lng: deliveryData.dropoffLng });
      }

      // Extract dates and windows
      let pickupDate = '';
      let pickupWindow = '9:00 AM – 11:00 AM';
      let dropoffDate = '';
      let dropoffWindow = '3:00 PM – 5:00 PM';

      if (deliveryData.pickupWindowStart && deliveryData.pickupWindowEnd) {
        pickupDate = extractDateFromISO(deliveryData.pickupWindowStart);
        pickupWindow = extractTimeWindowFromISO(deliveryData.pickupWindowStart, deliveryData.pickupWindowEnd);
      }
      if (deliveryData.dropoffWindowStart && deliveryData.dropoffWindowEnd) {
        dropoffDate = extractDateFromISO(deliveryData.dropoffWindowStart);
        dropoffWindow = extractTimeWindowFromISO(deliveryData.dropoffWindowStart, deliveryData.dropoffWindowEnd);
      }

      // Reset form with delivery data
      reset({
        serviceType: deliveryData.serviceType || "HOME_DELIVERY",
        pickupAddress: deliveryData.pickupAddress || "",
        dropoffAddress: deliveryData.dropoffAddress || "",
        pickupDate,
        pickupWindow,
        dropoffDate,
        dropoffWindow,
        afterHours: deliveryData.afterHours || false,
        licensePlate: deliveryData.licensePlate || "",
        vinVerification: deliveryData.vinVerificationCode || "",
        transmission: deliveryData.vehicleTransmission || "Automatic",
        make: deliveryData.vehicleMake || "",
        model: deliveryData.vehicleModel || "",
        color: deliveryData.vehicleColor || "",
        instructions: deliveryData.specialInstructions || "",
        recipientName: deliveryData.recipientName || "",
        recipientEmail: deliveryData.recipientEmail || "",
        recipientPhone: deliveryData.recipientPhone || "",
        enableRecipient: !!deliveryData.recipientName,
      });

      setShowRecipientFields(!!deliveryData.recipientName);
      setIsLoadingData(false);
    }
  }, [deliveryData, isLoaded, reset]);

  // Watch form values
  const serviceType = watch("serviceType");
  const pickupAddress = watch("pickupAddress");
  const dropoffAddress = watch("dropoffAddress");
  const enableRecipient = watch("enableRecipient");
  const transmission = watch("transmission");
  const make = watch("make");
  const model = watch("model");
  const color = watch("color");

  useEffect(() => {
    setShowRecipientFields(!!enableRecipient);
  }, [enableRecipient]);

  // Geocoder helper
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

  // Handle place selection
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
  }, [setValue]);

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
  }, [setValue]);

  // Build payload for update
  const buildPayload = (data: EditDeliveryFormData) => {
    const finalMake = data.make === "Other" ? data.makeOther : data.make;
    const finalModel = data.model === "Other" ? data.modelOther : data.model;
    const finalColor = data.color === "Other" ? data.colorOther : data.color;

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
      pickupAddress: data.pickupAddress,
      pickupLat: pickupCoords?.lat,
      pickupLng: pickupCoords?.lng,
      pickupPlaceId: pickupPlaceId,
      pickupState: pickupState,
      dropoffAddress: data.dropoffAddress,
      dropoffLat: dropoffCoords?.lat,
      dropoffLng: dropoffCoords?.lng,
      dropoffPlaceId: dropoffPlaceId,
      dropoffState: dropoffState,
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
      vehicleTransmission: data.transmission === "Other" ? data.transmissionOther : data.transmission,
      specialInstructions: data.instructions,
      recipientName: data.enableRecipient ? data.recipientName : null,
      recipientEmail: data.enableRecipient ? data.recipientEmail : null,
      recipientPhone: data.enableRecipient ? data.recipientPhone : null,
    };
  };

  const onSubmit = (data: EditDeliveryFormData) => {
    if (!pickupCoords || !dropoffCoords) {
      toast.error("Missing location data", {
        description: "Please select valid pickup and drop-off addresses.",
      });
      return;
    }

    const payload = buildPayload(data);
    updateDelivery.mutate(payload);
  };

  // Determine if editing is allowed based on status
  const canEdit = deliveryData?.status === 'LISTED' || deliveryData?.status === 'DRAFT';
  const canEditSchedule = deliveryData?.status === 'LISTED' || deliveryData?.status === 'DRAFT' || deliveryData?.status === 'BOOKED';

  // Header component
  const Header = () => (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/dealer-dashboard" className="flex items-center" aria-label="101 Drivers">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-create-delivery"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Create Delivery
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/dealer-delivery-details", search: { id: deliveryId } })}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Details
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-create-delivery"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Create Delivery
            </Link>
          </div>
        </div>
      )}
    </header>
  );

  // Footer component
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
              Dealer portal • California-only operations • Email-first notifications
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            © {new Date().getFullYear()} 101 Drivers Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );

  // Loading state
  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading delivery data...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (isError || !deliveryData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load delivery</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
            <Button onClick={() => navigate({ to: "/dealer-dashboard" })} className="mt-6 bg-lime-500 text-slate-950">
              Back to Dashboard
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Not editable state
  if (!canEdit && !canEditSchedule) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Cannot edit this delivery</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              This delivery is {deliveryData.status?.toLowerCase()} and cannot be edited.
            </p>
            <Button onClick={() => navigate({ to: "/dealer-delivery-details", search: { id: deliveryId } })} className="mt-6 bg-lime-500 text-slate-950">
              Back to Details
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Title section */}
        <section className="flex flex-col gap-6 mb-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center">
                <Settings className="h-6 w-6 text-lime-600 dark:text-lime-400" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  Edit Delivery #{deliveryId?.slice(-6).toUpperCase()}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                  {canEdit 
                    ? "Update delivery details. Changes will be saved immediately."
                    : "Update schedule for this delivery. Other fields are locked after booking."}
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
                Status: {deliveryData.status}
              </Badge>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN - Form */}
            <div className="xl:col-span-7 space-y-8">
              {/* Schedule Section - Always editable for LISTED/DRAFT/BOOKED */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                        Schedule
                      </CardDescription>
                      <CardTitle className="text-2xl font-black mt-2">
                        Pickup & Drop-off Windows
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Update the schedule windows for this delivery.
                      </p>
                    </div>
                    <Calendar className="h-5 w-5 text-lime-500" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Pickup Window */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Pickup Date</Label>
                      <Input
                        type="date"
                        {...register("pickupDate")}
                        className="h-12 rounded-2xl"
                      />
                      {errors.pickupDate && (
                        <p className="text-xs text-red-500">{errors.pickupDate.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Pickup Window</Label>
                      <Select
                        value={watch("pickupWindow")}
                        onValueChange={(value) => setValue("pickupWindow", value)}
                      >
                        <SelectTrigger className="h-12 rounded-2xl">
                          <SelectValue placeholder="Select window" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeWindows.map((window) => (
                            <SelectItem key={window} value={window}>
                              {window}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Dropoff Window */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Drop-off Date (optional)</Label>
                      <Input
                        type="date"
                        {...register("dropoffDate")}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Drop-off Window</Label>
                      <Select
                        value={watch("dropoffWindow")}
                        onValueChange={(value) => setValue("dropoffWindow", value)}
                      >
                        <SelectTrigger className="h-12 rounded-2xl">
                          <SelectValue placeholder="Select window" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeWindows.map((window) => (
                            <SelectItem key={window} value={window}>
                              {window}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* After Hours */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="afterHours"
                      {...register("afterHours")}
                    />
                    <Label htmlFor="afterHours" className="text-xs font-bold cursor-pointer">
                      After hours delivery (may incur additional fees)
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Addresses Section - Only editable for LISTED/DRAFT */}
              {canEdit && (
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                          Locations
                        </CardDescription>
                        <CardTitle className="text-2xl font-black mt-2">
                          Pickup & Drop-off Addresses
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          CA-only addresses with autocomplete/search.
                        </p>
                      </div>
                      <Route className="h-5 w-5 text-lime-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Pickup Address */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Pickup address</Label>
                        <LocationAutocomplete
                          key="pickup"
                          value={pickupAddress || ""}
                          onChange={(val) => setValue("pickupAddress", val)}
                          onPlaceSelect={handlePickupSelect}
                          isLoaded={isLoaded}
                          placeholder="Search pickup location"
                          icon={<MapPin className="h-5 w-5 text-slate-400" />}
                        />
                        {errors.pickupAddress && (
                          <p className="text-xs text-red-500">{errors.pickupAddress.message}</p>
                        )}
                      </div>

                      {/* Drop-off Address */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Drop-off address</Label>
                        <LocationAutocomplete
                          key="dropoff"
                          value={dropoffAddress || ""}
                          onChange={(val) => setValue("dropoffAddress", val)}
                          onPlaceSelect={handleDropoffSelect}
                          isLoaded={isLoaded}
                          placeholder="Search drop-off location"
                          icon={<Flag className="h-5 w-5 text-slate-400" />}
                        />
                        {errors.dropoffAddress && (
                          <p className="text-xs text-red-500">{errors.dropoffAddress.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Map Preview */}
                    <div className="relative min-h-[240px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800">
                      <RouteMap
                        pickup={pickupCoords}
                        dropoff={dropoffCoords}
                        isLoaded={isLoaded}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Vehicle Section - Only editable for LISTED/DRAFT */}
              {canEdit && (
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                          Vehicle
                        </CardDescription>
                        <CardTitle className="text-2xl font-black mt-2">
                          Vehicle Information
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          Vehicle details for verification at pickup.
                        </p>
                      </div>
                      <Car className="h-5 w-5 text-lime-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* License Plate & VIN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">License Plate</Label>
                        <Input
                          {...register("licensePlate")}
                          placeholder="ABC1234"
                          className="h-12 rounded-2xl uppercase"
                        />
                        {errors.licensePlate && (
                          <p className="text-xs text-red-500">{errors.licensePlate.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">VIN Last 4 Digits</Label>
                        <Input
                          {...register("vinVerification")}
                          placeholder="1234"
                          maxLength={4}
                          className="h-12 rounded-2xl"
                        />
                        {errors.vinVerification && (
                          <p className="text-xs text-red-500">{errors.vinVerification.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Make, Model, Color */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Make</Label>
                        <Select
                          value={make}
                          onValueChange={(value) => setValue("make", value)}
                        >
                          <SelectTrigger className="h-12 rounded-2xl">
                            <SelectValue placeholder="Select make" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicleMakes.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {make === "Other" && (
                          <Input
                            {...register("makeOther")}
                            placeholder="Enter make"
                            className="h-10 rounded-xl mt-2"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Model</Label>
                        <Input
                          {...register("model")}
                          placeholder="Camry"
                          className="h-12 rounded-2xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Color</Label>
                        <Select
                          value={color}
                          onValueChange={(value) => setValue("color", value)}
                        >
                          <SelectTrigger className="h-12 rounded-2xl">
                            <SelectValue placeholder="Select color" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicleColors.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {color === "Other" && (
                          <Input
                            {...register("colorOther")}
                            placeholder="Enter color"
                            className="h-10 rounded-xl mt-2"
                          />
                        )}
                      </div>
                    </div>

                    {/* Transmission */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Transmission</Label>
                      <Select
                        value={transmission}
                        onValueChange={(value) => setValue("transmission", value)}
                      >
                        <SelectTrigger className="h-12 rounded-2xl">
                          <SelectValue placeholder="Select transmission" />
                        </SelectTrigger>
                        <SelectContent>
                          {transmissionTypes.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {transmission === "Other" && (
                        <Input
                          {...register("transmissionOther")}
                          placeholder="Enter transmission type"
                          className="h-10 rounded-xl mt-2"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recipient Section - Only editable for LISTED/DRAFT */}
              {canEdit && (
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-2xl font-black">Recipient (Optional)</CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          Add recipient details for delivery notifications.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enableRecipient"
                          {...register("enableRecipient")}
                        />
                        <Label htmlFor="enableRecipient" className="text-xs font-bold cursor-pointer">
                          Enable recipient
                        </Label>
                      </div>
                    </div>
                  </CardHeader>
                  {showRecipientFields && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Name</Label>
                          <Input
                            {...register("recipientName")}
                            placeholder="John Doe"
                            className="h-12 rounded-2xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Email</Label>
                          <Input
                            type="email"
                            {...register("recipientEmail")}
                            placeholder="john@example.com"
                            className="h-12 rounded-2xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Phone</Label>
                          <Input
                            {...register("recipientPhone")}
                            placeholder="+1-555-123-4567"
                            className="h-12 rounded-2xl"
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Special Instructions */}
              {canEdit && (
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl font-black">Special Instructions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      {...register("instructions")}
                      placeholder="Any special instructions for the driver..."
                      className="rounded-2xl min-h-[100px]"
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT COLUMN - Summary */}
            <div className="xl:col-span-5 space-y-6">
              {/* Summary Card */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg sticky top-28">
                <CardHeader>
                  <CardTitle className="text-xl font-black">Summary</CardTitle>
                  <CardDescription>
                    Review your changes before saving.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Current Status</div>
                    <div className="font-extrabold text-slate-900 dark:text-white mt-1">
                      {deliveryData.status}
                    </div>
                  </div>

                  {/* Editable Fields Summary */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Pickup Date</span>
                      <span className="font-bold">{watch("pickupDate") || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Pickup Window</span>
                      <span className="font-bold">{watch("pickupWindow") || "—"}</span>
                    </div>
                    {canEdit && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Vehicle</span>
                          <span className="font-bold">{watch("make")} {watch("model")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">License Plate</span>
                          <span className="font-bold">{watch("licensePlate")}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      disabled={updateDelivery.isPending || !isDirty}
                      className="w-full bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold gap-2"
                    >
                      {updateDelivery.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate({ to: "/dealer-delivery-details", search: { id: deliveryId } })}
                      className="w-full font-extrabold"
                    >
                      Cancel
                    </Button>
                  </div>

                  {!isDirty && (
                    <p className="text-xs text-slate-500 text-center">
                      No changes detected yet
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Info Card */}
              <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      Editing restrictions
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                      {canEdit 
                        ? "You can edit all fields while status is LISTED or DRAFT."
                        : "Only schedule can be modified after booking. Other fields are locked."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
