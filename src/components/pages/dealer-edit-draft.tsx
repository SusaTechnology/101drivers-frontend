// Edit Draft Delivery Page
// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Flag,
  Car,
  FileText,
  Save,
  Loader2,
  ChevronRight,
  CheckCircle,
  Info,
  AlertCircle,
} from "lucide-react";
import LocationAutocomplete from "@/components/map/LocationAutocomplete";
import RouteMap from "@/components/map/RouteMap";
import { getUser, getAccessToken } from "@/lib/tanstack/dataQuery";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Form validation schema (relaxed for drafts)
const draftSchema = z.object({
  serviceType: z.enum([
    "HOME_DELIVERY",
    "BETWEEN_LOCATIONS",
    "SERVICE_PICKUP_RETURN",
  ]),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  dropoffAddress: z.string().min(1, "Drop-off address is required"),
  pickupDate: z.string().optional(),
  pickupWindow: z.string().optional(),
  dropoffDate: z.string().optional(),
  dropoffWindow: z.string().optional(),
  afterHours: z.boolean().optional(),
  licensePlate: z.string().optional(),
  vinVerification: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  enableRecipient: z.boolean().optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientPhone: z.string().optional(),
});

type DraftFormData = z.infer<typeof draftSchema>;

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

// Format ISO to date string
function isoToDateString(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toISOString().split('T')[0];
}

// Format ISO to time window string
function isoToTimeWindow(startIso: string | undefined, endIso: string | undefined): string {
  if (!startIso || !endIso) return "";
  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export default function EditDraftPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const draftId = state?.id || '';
  const queryClient = useQueryClient();
  const customer = getUser();

  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [pickupPlaceId, setPickupPlaceId] = useState<string | null>(null);
  const [dropoffPlaceId, setDropoffPlaceId] = useState<string | null>(null);
  const [pickupState, setPickupState] = useState<string | null>(null);
  const [dropoffState, setDropoffState] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState({ miles: 0, total: 0 });
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [showRecipientFields, setShowRecipientFields] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DraftFormData>({
    resolver: zodResolver(draftSchema),
    defaultValues: {
      serviceType: "HOME_DELIVERY",
      afterHours: false,
      enableRecipient: false,
    },
  });

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places'],
  });

  // Fetch draft data when component mounts
  useEffect(() => {
    const fetchDraft = async () => {
      if (!draftId) {
        setIsLoadingDraft(false);
        return;
      }

      try {
        const token = getAccessToken();
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            credentials: 'include',
          }
        );

        if (!response.ok) throw new Error('Failed to fetch draft');
        const draft = await response.json();

        // Populate form
        setValue('serviceType', draft.serviceType);
        setValue('pickupAddress', draft.pickupAddress);
        setValue('dropoffAddress', draft.dropoffAddress);
        setPickupCoords({ lat: draft.pickupLat, lng: draft.pickupLng });
        setDropoffCoords({ lat: draft.dropoffLat, lng: draft.dropoffLng });
        setPickupPlaceId(draft.pickupPlaceId || null);
        setDropoffPlaceId(draft.dropoffPlaceId || null);
        setPickupState(draft.pickupState || null);
        setDropoffState(draft.dropoffState || null);

        if (draft.pickupWindowStart && draft.pickupWindowEnd) {
          setValue('pickupDate', isoToDateString(draft.pickupWindowStart));
          setValue('pickupWindow', isoToTimeWindow(draft.pickupWindowStart, draft.pickupWindowEnd));
        }
        if (draft.dropoffWindowStart && draft.dropoffWindowEnd) {
          setValue('dropoffDate', isoToDateString(draft.dropoffWindowStart));
          setValue('dropoffWindow', isoToTimeWindow(draft.dropoffWindowStart, draft.dropoffWindowEnd));
        }

        if (draft.licensePlate) setValue('licensePlate', draft.licensePlate);
        if (draft.vinVerificationCode) setValue('vinVerification', draft.vinVerificationCode);
        if (draft.vehicleMake) setValue('make', draft.vehicleMake);
        if (draft.vehicleModel) setValue('model', draft.vehicleModel);
        if (draft.vehicleColor) setValue('color', draft.vehicleColor);

        if (draft.recipientName || draft.recipientEmail || draft.recipientPhone) {
          setValue('enableRecipient', true);
          setShowRecipientFields(true);
          if (draft.recipientName) setValue('recipientName', draft.recipientName);
          if (draft.recipientEmail) setValue('recipientEmail', draft.recipientEmail);
          if (draft.recipientPhone) setValue('recipientPhone', draft.recipientPhone);
        }

        if (draft.quote) {
          setQuoteData({
            miles: draft.quote.distanceMiles || 0,
            total: draft.quote.estimatedAmount || 0,
          });
        }

        // Store quoteId for submission
        if (draft.quoteId || draft.quote?.id) {
          setQuoteId(draft.quoteId || draft.quote?.id);
        }

        setIsLoadingDraft(false);
      } catch (error) {
        console.error('Failed to fetch draft:', error);
        toast.error("Failed to load draft");
        navigate({ to: "/dealer-drafts" });
      }
    };

    if (draftId) fetchDraft();
  }, [draftId]);

  const serviceType = watch("serviceType");
  const pickupAddress = watch("pickupAddress");
  const dropoffAddress = watch("dropoffAddress");
  const enableRecipient = watch("enableRecipient");

  useEffect(() => {
    setShowRecipientFields(!!enableRecipient);
  }, [enableRecipient]);

  // Mutations
  const updateDraftMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error('Failed to update draft');
      return response.json();
    },
    onSuccess: () => {
      toast.success("Draft updated successfully");
      queryClient.invalidateQueries({ queryKey: ['draftDeliveries'] });
    },
    onError: (error: any) => {
      toast.error("Failed to update draft", { description: error?.message });
    },
  });

  const submitForQuoteMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests/create-from-quote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error('Failed to submit for quote');
      return response.json();
    },
    onSuccess: () => {
      toast.success("Delivery submitted successfully!");
      // Optionally delete the draft after successful submission
      if (draftId) {
        fetch(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`, {
          method: 'DELETE',
          headers: {
            ...(getAccessToken() ? { 'Authorization': `Bearer ${getAccessToken()}` } : {}),
          },
          credentials: 'include',
        }).catch(() => {}); // Ignore delete errors
      }
      queryClient.invalidateQueries({ queryKey: ['draftDeliveries'] });
      navigate({ to: "/dealer-dashboard" });
    },
    onError: (error: any) => {
      toast.error("Failed to submit for quote", { description: error?.message });
    },
  });

  // Handlers
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
        if (stateComp) setPickupState(stateComp.short_name);
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
        if (stateComp) setDropoffState(stateComp.short_name);
      }
    }
  }, [setValue]);

  const handleUpdateDraft = () => {
    const data = watch();
    const payload = {
      serviceType: data.serviceType,
      pickupAddress: data.pickupAddress,
      pickupLat: pickupCoords?.lat,
      pickupLng: pickupCoords?.lng,
      dropoffAddress: data.dropoffAddress,
      dropoffLat: dropoffCoords?.lat,
      dropoffLng: dropoffCoords?.lng,
      pickupWindowStart: data.pickupDate && data.pickupWindow
        ? combineDateAndTimeToISO(data.pickupDate, parseWindowTimes(data.pickupWindow).start)
        : undefined,
      pickupWindowEnd: data.pickupDate && data.pickupWindow
        ? combineDateAndTimeToISO(data.pickupDate, parseWindowTimes(data.pickupWindow).end)
        : undefined,
      licensePlate: data.licensePlate || undefined,
      vinVerificationCode: data.vinVerification || undefined,
      vehicleMake: data.make,
      vehicleModel: data.model,
      vehicleColor: data.color,
      recipientName: data.enableRecipient ? data.recipientName : undefined,
      recipientEmail: data.enableRecipient ? data.recipientEmail : undefined,
      recipientPhone: data.enableRecipient ? data.recipientPhone : undefined,
    };
    updateDraftMutation.mutate(payload);
  };

  const handleSubmitForQuote = () => {
    const data = watch();

    if (!quoteId) {
      toast.error("Quote required", { description: "This draft does not have a valid quote. Please create a new delivery." });
      return;
    }
    if (!pickupCoords || !dropoffCoords) {
      toast.error("Location required", { description: "Please select valid addresses." });
      return;
    }
    if (!data.pickupDate || !data.pickupWindow) {
      toast.error("Schedule required", { description: "Please set a pickup window." });
      return;
    }
    if (!data.licensePlate || !data.make || !data.model || !data.color) {
      toast.error("Vehicle info required", { description: "Please complete vehicle details." });
      return;
    }

    const payload = {
      customerId: customer?.profileId,
      quoteId,
      serviceType: data.serviceType,
      customerChose: "PICKUP_WINDOW" as const,
      pickupWindowStart: combineDateAndTimeToISO(data.pickupDate, parseWindowTimes(data.pickupWindow!).start),
      pickupWindowEnd: combineDateAndTimeToISO(data.pickupDate, parseWindowTimes(data.pickupWindow!).end),
      dropoffWindowStart: data.dropoffDate && data.dropoffWindow
        ? combineDateAndTimeToISO(data.dropoffDate, parseWindowTimes(data.dropoffWindow).start)
        : undefined,
      dropoffWindowEnd: data.dropoffDate && data.dropoffWindow
        ? combineDateAndTimeToISO(data.dropoffDate, parseWindowTimes(data.dropoffWindow).end)
        : undefined,
      licensePlate: data.licensePlate,
      vinVerificationCode: data.vinVerification || undefined,
      vehicleMake: data.make,
      vehicleModel: data.model,
      vehicleColor: data.color,
      recipientName: data.enableRecipient ? data.recipientName : undefined,
      recipientEmail: data.enableRecipient ? data.recipientEmail : undefined,
      recipientPhone: data.enableRecipient ? data.recipientPhone : undefined,
      afterHours: data.afterHours || false,
      isUrgent: false,
    };
    submitForQuoteMutation.mutate(payload);
  };

  // Loading state
  if (isLoadingDraft) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-lime-500 mx-auto" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading draft...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate({ to: "/dealer-drafts" })}
              className="h-10 w-10 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Edit Draft</h1>
              <p className="text-sm text-slate-500">Update and submit when ready</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-2">
            <FileText className="h-3 w-3" />
            Draft Mode
          </Badge>
        </div>
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* LEFT COLUMN */}
          <div className="xl:col-span-7 space-y-8">
            {/* Service Type */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">Car Transfer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Book 101 Drivers to move your car in Southern California.
                </p>
              </CardContent>
            </Card>

            {/* Addresses */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">Addresses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Pickup Address</Label>
                  <LocationAutocomplete
                    key="pickup"
                    value={pickupAddress || ""}
                    onChange={(val) => setValue("pickupAddress", val)}
                    onPlaceSelect={handlePickupSelect}
                    isLoaded={isLoaded}
                    placeholder="Search pickup location"
                    icon={<MapPin className="h-5 w-5 text-slate-400" />}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Drop-off Address</Label>
                  <LocationAutocomplete
                    key="dropoff"
                    value={dropoffAddress || ""}
                    onChange={(val) => setValue("dropoffAddress", val)}
                    onPlaceSelect={handleDropoffSelect}
                    isLoaded={isLoaded}
                    placeholder="Search drop-off location"
                    icon={<Flag className="h-5 w-5 text-slate-400" />}
                  />
                </div>
                {pickupCoords && dropoffCoords && (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-64">
                    <RouteMap pickup={pickupCoords} dropoff={dropoffCoords} isLoaded={isLoaded} />
                  </div>
                )}
                {quoteData.total > 0 && (
                  <div className="p-4 rounded-2xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-lime-700 dark:text-lime-300">Estimated Quote</div>
                        <div className="text-2xl font-black text-lime-600">${quoteData.total.toFixed(2)}</div>
                      </div>
                      <div className="text-sm text-lime-600 dark:text-lime-400">{quoteData.miles.toFixed(1)} miles</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Pickup Date</Label>
                    <Input type="date" {...register("pickupDate")} className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Pickup Window</Label>
                    <Select value={watch("pickupWindow")} onValueChange={(value) => setValue("pickupWindow", value)}>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Select window" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7:00 AM – 9:00 AM">7:00 AM – 9:00 AM</SelectItem>
                        <SelectItem value="9:00 AM – 11:00 AM">9:00 AM – 11:00 AM</SelectItem>
                        <SelectItem value="11:00 AM – 1:00 PM">11:00 AM – 1:00 PM</SelectItem>
                        <SelectItem value="1:00 PM – 3:00 PM">1:00 PM – 3:00 PM</SelectItem>
                        <SelectItem value="3:00 PM – 5:00 PM">3:00 PM – 5:00 PM</SelectItem>
                        <SelectItem value="5:00 PM – 7:00 PM">5:00 PM – 7:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="afterHours" checked={watch('afterHours')} onCheckedChange={(checked) => setValue('afterHours', !!checked)} />
                  <Label htmlFor="afterHours" className="text-xs font-bold cursor-pointer">After-hours delivery</Label>
                </div>
              </CardContent>
            </Card>

            {/* Vehicle */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">Vehicle Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">License Plate</Label>
                    <Input {...register("licensePlate")} className="h-12 rounded-xl" placeholder="7ABC123" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">VIN Code (4 digits)</Label>
                    <Input {...register("vinVerification")} className="h-12 rounded-xl" placeholder="1234" maxLength={4} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Make</Label>
                    <Input {...register("make")} className="h-12 rounded-xl" placeholder="Toyota" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Model</Label>
                    <Input {...register("model")} className="h-12 rounded-xl" placeholder="Camry" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Color</Label>
                    <Input {...register("color")} className="h-12 rounded-xl" placeholder="White" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recipient */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black">Recipient (Optional)</CardTitle>
                    <CardDescription>Add a recipient to receive tracking updates</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="enableRecipient" checked={enableRecipient} onCheckedChange={(checked) => setValue("enableRecipient", !!checked)} />
                    <Label htmlFor="enableRecipient" className="text-xs font-bold cursor-pointer">Enable</Label>
                  </div>
                </div>
              </CardHeader>
              {showRecipientFields && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Name</Label>
                      <Input {...register("recipientName")} className="h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Email</Label>
                      <Input {...register("recipientEmail")} type="email" className="h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Phone</Label>
                      <Input {...register("recipientPhone")} type="tel" className="h-12 rounded-xl" />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Actions */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardContent className="p-6 space-y-4">
                <Button
                  className="w-full py-6 rounded-2xl bg-lime-500 hover:bg-lime-600 text-slate-950 font-extrabold text-lg"
                  onClick={handleSubmitForQuote}
                  disabled={submitForQuoteMutation.isPending}
                >
                  {submitForQuoteMutation.isPending ? "Submitting..." : "Submit for Quote"}
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full py-4 rounded-2xl font-extrabold"
                  onClick={handleUpdateDraft}
                  disabled={updateDraftMutation.isPending}
                >
                  {updateDraftMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Update Draft
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-slate-500 text-center">
                  "Update Draft" saves your changes. "Submit for Quote" finalizes the delivery request.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="xl:col-span-5">
            <div className="sticky top-28 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Draft Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Service Type</span>
                    <span className="font-bold">Car Transfer</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Status</span>
                    <Badge variant="secondary">DRAFT</Badge>
                  </div>
                  {quoteData.total > 0 && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Estimated Price</span>
                        <span className="text-xl font-black text-lime-600">${quoteData.total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-lime-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-lime-700 dark:text-lime-300">
                      <p className="font-bold">Draft Mode</p>
                      <p className="text-xs mt-1">This delivery is saved as a draft. Complete the required fields and submit for a quote when ready.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
