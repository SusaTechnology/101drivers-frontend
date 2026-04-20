// app/pages/dealer/edit-delivery.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { Separator } from "@/components/ui/separator";
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
  FileText,
  HelpCircle,
  RefreshCw,
  X,
  Menu,
  CalendarIcon,
} from "lucide-react";
import LocationAutocomplete from "@/components/map/LocationAutocomplete";
import RouteMap from "@/components/map/RouteMap";
import { getAllMakes, getModelsForMake } from "@/data/vehicleDatabase";
import { usePickupZones } from "@/hooks/usePickupZones";
import { getUser, useDataQuery, usePatch, useCreate, authFetch } from "@/lib/tanstack/dataQuery";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Form validation schema - same as create page
const deliverySchema = z.object({
  serviceType: z.enum([
    "HOME_DELIVERY",
    "BETWEEN_LOCATIONS",
    "SERVICE_PICKUP_RETURN",
  ]),
  pickupAddress: z.string().min(1, "From location is required"),
  dropoffAddress: z.string().min(1, "To location is required"),
  rememberPickup: z.boolean().optional(),
  // Schedule fields - populated from backend schedule-preview
  pickupWindowStart: z.string().optional(),
  pickupWindowEnd: z.string().optional(),
  dropoffWindowStart: z.string().optional(),
  dropoffWindowEnd: z.string().optional(),
  licensePlate: z.string().min(1, "License plate is required"),
  vinVerification: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits"),
  transmission: z.string().optional(),
  transmissionOther: z.string().optional(),
  make: z.string().min(1, "Make is required"),
  makeOther: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  modelOther: z.string().optional(),
  color: z.string().min(1, "Color is required"),
  colorOther: z.string().optional(),
  instructions: z.string().optional(),
  contactName: z.string().min(1, "Contact name is required").optional(),
  contactEmail: z.string().email("Valid email is required").optional(),
  contactPhone: z.string().min(1, "Phone is required").optional(),
  enableRecipient: z.boolean().optional(),
  recipientName: z.string().min(1, "Recipient name is required").optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientPhone: z.string().min(10, "Valid phone number is required").optional(),
  paymentType: z.enum(["PREPAID", "POSTPAID"]).optional(),
  dealerAuthorized: z.boolean().optional(),
  status: z.enum(["DRAFT", "QUOTED", "LISTED", "BOOKED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]),
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
  customerType?: 'PRIVATE' | 'BUSINESS';
  customerId?: string;
  customerChose?: "PICKUP_WINDOW" | "DROPOFF_WINDOW";
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  dropoffWindowStart?: string;
  dropoffWindowEnd?: string;
  preferredDate?: string;
}

interface SlotItem {
  label: string;
  start: string;
  end: string;
}

interface SchedulePreviewResponse {
  feasible: boolean;
  message: string | null;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  dropoffWindowStart?: string;
  dropoffWindowEnd?: string;
  etaMinutes: number;
  bufferMinutes: number;
  sameDayEligible: boolean;
  requiresOpsConfirmation: boolean;
  afterHours: boolean;
  policy?: {
    id: string;
    serviceType: string;
    customerType: string;
    defaultMode: string;
    sameDayCutoffTime: string;
    maxSameDayMiles: number;
    bufferMinutes: number;
    afterHoursEnabled: boolean;
    requiresOpsConfirmation: boolean;
  };
  sameDay?: {
    eligible: boolean;
    status: string;
    reasons: string[];
    warnings: string[];
  };
  matchedSlots?: {
    pickup: SlotItem | null;
    dropoff: SlotItem | null;
  };
  suggestedSlots?: {
    pickup: SlotItem[];
    dropoff: SlotItem[];
  };
}

// Types for saved data
interface SavedAddress {
  id: string;
  address: string;
  city: string;
  country: string;
  label?: string;
  lat: number;
  lng: number;
  placeId?: string;
  postalCode?: string;
  state?: string;
  isDefault?: boolean;
}

interface SavedVehicle {
  id: string;
  color: string;
  licensePlate: string;
  make: string;
  model: string;
}

// Customer data interface for fetching postpaid status
interface CustomerData {
  id: string;
  businessName: string | null;
  postpaidEnabled: boolean;
  approvalStatus: string;
  customerType: 'PRIVATE' | 'BUSINESS';
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

// Helper functions for data conversion
function isoToDateString(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toISOString().split('T')[0];
}

function isoToTimeWindow(startIso: string | undefined, endIso: string | undefined): string {
  if (!startIso || !endIso) return "";
  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// Format phone number to US format: (XXX) XXX-XXXX
function formatUSPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return '';
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

export default function EditDeliveryPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const deliveryId = state?.id;
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDealerAuthorized, setIsDealerAuthorized] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [pickupPlaceId, setPickupPlaceId] = useState<string | null>(null);
  const [dropoffPlaceId, setDropoffPlaceId] = useState<string | null>(null);
  const [pickupState, setPickupState] = useState<string | null>(null);
  const [pickupCity, setPickupCity] = useState<string | null>(null);
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
  
  // Schedule section - one-side-at-a-time flow
  const [customerChose, setCustomerChose] = useState<"PICKUP_WINDOW" | "DROPOFF_WINDOW" | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [suggestedSlots, setSuggestedSlots] = useState<{ pickup: SlotItem[]; dropoff: SlotItem[] }>({ pickup: [], dropoff: [] });
  const [validatedWindows, setValidatedWindows] = useState<{
    pickupWindowStart?: string;
    pickupWindowEnd?: string;
    dropoffWindowStart?: string;
    dropoffWindowEnd?: string;
  } | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<SavedAddress | null>(null);
  const [pickupSaved, setPickupSaved] = useState(false);
  const [pendingSavedAddressId, setPendingSavedAddressId] = useState<string | null>(null);

  // Saved vehicles state
  const [useSavedVehicle, setUseSavedVehicle] = useState(false);
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [selectedSavedVehicle, setSelectedSavedVehicle] = useState<SavedVehicle | null>(null);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [pendingSavedVehicleId, setPendingSavedVehicleId] = useState<string | null>(null);

  // Ref to prevent quote reset during data loading
  const isDataLoadingRef = useRef(false);
  // Ref to track previous coordinates for detecting actual changes
  const prevPickupCoordsRef = useRef<google.maps.LatLngLiteral | null>(null);
  const prevDropoffCoordsRef = useRef<google.maps.LatLngLiteral | null>(null);

  const customer = getUser();

  const { zones: pickupZones } = usePickupZones();

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

  // Fetch customer data to check postpaidEnabled status
  const customerDataQuery = useDataQuery<CustomerData>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${customer?.profileId}`,
    enabled: !!customer?.profileId,
    staleTime: 5 * 60 * 1000,
    queryKey: ['customerData', customer?.profileId],
    noFilter: true,
  });

  // Derived postpaid enabled status from backend
  const isPrivateCustomer = customerDataQuery.data?.customerType === 'PRIVATE';
  const isBusinessCustomer = customerDataQuery.data?.customerType === 'BUSINESS';
  const postpaidEnabled = isBusinessCustomer && (customerDataQuery.data?.postpaidEnabled ?? false);

  // Fetch saved addresses
  const savedAddressesQuery = useQuery<SavedAddress[]>({
    queryKey: ['savedAddresses', customer?.profileId],
    queryFn: async () => {
      return authFetch(
        `${import.meta.env.VITE_API_URL}/api/savedAddresses?where[customer][id]=${customer?.profileId}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    },
    enabled: !!customer?.profileId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch saved vehicles
  const savedVehiclesQuery = useQuery<SavedVehicle[]>({
    queryKey: ['savedVehicles', customer?.profileId],
    queryFn: async () => {
      return authFetch(
        `${import.meta.env.VITE_API_URL}/api/savedVehicles?where[customer][id]=${customer?.profileId}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    },
    enabled: !!customer?.profileId,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation for saving pickup address
  const saveAddressMutation = useCreate(`${import.meta.env.VITE_API_URL}/api/savedAddresses`, {
    onSuccess: () => {
      toast.success("Location saved");
      savedAddressesQuery.refetch();
      setPickupSaved(true);
    },
    onError: (error: any) => {
      toast.error("Failed to save address", { description: error?.message });
    },
    successMessage: undefined,
  });

  // Mutation for saving vehicle
  const saveVehicleMutation = useCreate(`${import.meta.env.VITE_API_URL}/api/savedVehicles`, {
    onSuccess: () => {
      toast.success("Vehicle saved for future use");
      savedVehiclesQuery.refetch();
    },
    onError: (error: any) => {
      toast.error("Failed to save vehicle", { description: error?.message });
    },
    successMessage: undefined,
  });

  // Determine if editing is allowed based on status
  const canEdit = deliveryData?.status === 'LISTED' || deliveryData?.status === 'DRAFT' || deliveryData?.status === 'QUOTED' || deliveryData?.status === 'EXPIRED';
  const canEditSchedule = deliveryData?.status === 'LISTED' || deliveryData?.status === 'DRAFT' || deliveryData?.status === 'QUOTED' || deliveryData?.status === 'BOOKED' || deliveryData?.status === 'EXPIRED';
  const isExpired = deliveryData?.status === 'EXPIRED';

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

  // Save as Draft mutation
  const saveAsDraft = usePatch(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}`, {
    onSuccess: () => {
      toast.success("Saved as draft", {
        description: "Delivery moved to Drafts. You can continue editing or delete it from there.",
      });
      navigate({ to: "/dealer-delivery-details", search: { id: deliveryId } });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to save as draft";
      toast.error("Failed to save as draft", {
        description: errorMessage,
      });
      console.error("Save as draft failed:", error);
    },
  });

  const handleSaveAsDraft = () => {
    if (!pickupCoords || !dropoffCoords) {
      toast.error("Missing addresses", {
        description: "Please enter pickup and drop-off addresses before saving.",
      });
      return;
    }
    const payload = {
      ...buildPayload(getValues()),
      status: "DRAFT",
    };
    saveAsDraft.mutate(payload);
  };

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
      transmission: "Automatic",
      rememberPickup: false,
      enableRecipient: true,
      dealerAuthorized: false,
      status: "DRAFT",
    },
  });

  // Populate form when delivery data loads
  useEffect(() => {
    if (deliveryData && isLoaded && !isLoadingData) {
      return;
    }
    
    if (deliveryData && isLoaded && isLoadingData) {
      isDataLoadingRef.current = true;
      
      // Set coordinates and initialize refs to prevent false change detection
      if (deliveryData.pickupLat && deliveryData.pickupLng) {
        const coords = { lat: deliveryData.pickupLat, lng: deliveryData.pickupLng };
        setPickupCoords(coords);
        prevPickupCoordsRef.current = coords;
      }
      if (deliveryData.dropoffLat && deliveryData.dropoffLng) {
        const coords = { lat: deliveryData.dropoffLat, lng: deliveryData.dropoffLng };
        setDropoffCoords(coords);
        prevDropoffCoordsRef.current = coords;
      }
      
      setPickupPlaceId(deliveryData.pickupPlaceId || null);
      setDropoffPlaceId(deliveryData.dropoffPlaceId || null);
      setPickupState(deliveryData.pickupState || null);
      setDropoffState(deliveryData.dropoffState || null);

      // Populate form with delivery data
      setValue('serviceType', deliveryData.serviceType || 'HOME_DELIVERY');
      setValue('pickupAddress', deliveryData.pickupAddress || '');
      setValue('dropoffAddress', deliveryData.dropoffAddress || '');

      // Schedule - populate validatedWindows
      if (deliveryData.pickupWindowStart && deliveryData.pickupWindowEnd && deliveryData.dropoffWindowStart && deliveryData.dropoffWindowEnd) {
        setValidatedWindows({
          pickupWindowStart: deliveryData.pickupWindowStart,
          pickupWindowEnd: deliveryData.pickupWindowEnd,
          dropoffWindowStart: deliveryData.dropoffWindowStart,
          dropoffWindowEnd: deliveryData.dropoffWindowEnd,
        });
        setCustomerChose("PICKUP_WINDOW");
        setSelectedSlot({
          label: isoToTimeWindow(deliveryData.pickupWindowStart, deliveryData.pickupWindowEnd),
          start: deliveryData.pickupWindowStart,
          end: deliveryData.pickupWindowEnd,
        });
        setSchedulePreviewData({
          feasible: true,
          message: null,
          pickupWindowStart: deliveryData.pickupWindowStart,
          pickupWindowEnd: deliveryData.pickupWindowEnd,
          dropoffWindowStart: deliveryData.dropoffWindowStart,
          dropoffWindowEnd: deliveryData.dropoffWindowEnd,
          etaMinutes: deliveryData.etaMinutes || 60,
          bufferMinutes: deliveryData.bufferMinutes || 15,
          sameDayEligible: deliveryData.sameDayEligible || false,
          requiresOpsConfirmation: deliveryData.requiresOpsConfirmation || false,
          afterHours: deliveryData.afterHours || false,
        });
      }

      // Vehicle info
      if (deliveryData.licensePlate) setValue('licensePlate', deliveryData.licensePlate);
      if (deliveryData.vinVerificationCode) setValue('vinVerification', deliveryData.vinVerificationCode);
      if (deliveryData.vehicleMake) setValue('make', deliveryData.vehicleMake);
      if (deliveryData.vehicleModel) setValue('model', deliveryData.vehicleModel);
      if (deliveryData.vehicleColor) setValue('color', deliveryData.vehicleColor);
      if (deliveryData.transmission) setValue('transmission', deliveryData.transmission);

      // Recipient
      if (deliveryData.recipientName) setValue('recipientName', deliveryData.recipientName);
      if (deliveryData.recipientEmail) setValue('recipientEmail', deliveryData.recipientEmail);
      if (deliveryData.recipientPhone) setValue('recipientPhone', deliveryData.recipientPhone);

      // Quote data
      if (deliveryData.quoteId || deliveryData.quote?.id) {
        setQuoteId(deliveryData.quoteId || deliveryData.quote?.id);
        setHasCalculated(true);
      }
      if (deliveryData.quote) {
        setQuoteData({
          miles: deliveryData.quote.distanceMiles || 0,
          total: deliveryData.quote.estimatedAmount || deliveryData.quote.estimatedPrice || 0,
          base: deliveryData.quote.feesBreakdown?.baseFare || 0,
          distance: deliveryData.quote.feesBreakdown?.distanceCharge || 0,
          insurance: deliveryData.quote.feesBreakdown?.insuranceFee || 0,
          transaction: deliveryData.quote.feesBreakdown?.transactionFee || 0,
        });
      }

      // Payment type
      if (deliveryData.paymentType) {
        setValue('paymentType', deliveryData.paymentType);
      }

      setIsLoadingData(false);
      
      // Reset the ref after data loading is complete
      setTimeout(() => {
        isDataLoadingRef.current = false;
      }, 0);
    }
  }, [deliveryData, isLoaded, isLoadingData, setValue]);

  // Watch form values for dynamic behavior
  const serviceType = watch("serviceType");
  const pickupAddress = watch("pickupAddress");
  const dropoffAddress = watch("dropoffAddress");
  const dealerAuthorized = watch("dealerAuthorized");
  const transmission = watch("transmission");
  const make = watch("make");
  const model = watch("model");
  const color = watch("color");
  const licensePlate = watch("licensePlate");
  const vinVerification = watch("vinVerification");
  const recipientName = watch("recipientName");
  const recipientPhone = watch("recipientPhone");
  const recipientEmail = watch("recipientEmail");

  // Update dealer authorized state
  useEffect(() => {
    setIsDealerAuthorized(!!dealerAuthorized);
  }, [dealerAuthorized]);

  // Reset quote and schedule when location changes
  useEffect(() => {
    if (isDataLoadingRef.current) {
      prevPickupCoordsRef.current = pickupCoords;
      prevDropoffCoordsRef.current = dropoffCoords;
      return;
    }

    const pickupChanged = pickupCoords && (
      !prevPickupCoordsRef.current ||
      prevPickupCoordsRef.current.lat !== pickupCoords.lat ||
      prevPickupCoordsRef.current.lng !== pickupCoords.lng
    );
    const dropoffChanged = dropoffCoords && (
      !prevDropoffCoordsRef.current ||
      prevDropoffCoordsRef.current.lat !== dropoffCoords.lat ||
      prevDropoffCoordsRef.current.lng !== dropoffCoords.lng
    );

    prevPickupCoordsRef.current = pickupCoords;
    prevDropoffCoordsRef.current = dropoffCoords;

    if ((pickupChanged || dropoffChanged) && hasCalculated && quoteId) {
      console.log('Location changed, resetting quote and schedule...');
      setQuoteId(null);
      setHasCalculated(false);
      setQuoteData({ miles: 0, total: 0, base: 0, distance: 0, insurance: 0, transaction: 0 });
      setValidatedWindows(null);
      setSchedulePreviewData(null);
      setCustomerChose(null);
      setSelectedSlot(null);
      setSuggestedSlots({ pickup: [], dropoff: [] });
    }
  }, [pickupCoords, dropoffCoords]);

  // Helper functions
  // Saved addresses auto-select effect
  useEffect(() => {
    if (savedAddressesQuery.data) {
      setSavedAddresses(savedAddressesQuery.data);

      // Check if we have a pending saved address to restore
      if (pendingSavedAddressId) {
        const addr = savedAddressesQuery.data.find(a => a.id === pendingSavedAddressId);
        if (addr) {
          setSelectedSavedAddress(addr);
          setValue('pickupAddress', addr.address);
          setPickupCoords({ lat: addr.lat, lng: addr.lng });
          if (addr.state) setPickupState(addr.state);
          setPendingSavedAddressId(null);
          return;
        }
      }

      // Check if current pickup address matches a saved one
      if (pickupAddress && !selectedSavedAddress) {
        const matched = savedAddressesQuery.data.find(a => a.address === pickupAddress);
        if (matched) {
          setSelectedSavedAddress(matched);
          setPickupSaved(true);
        }
      }
    }
  }, [savedAddressesQuery.data, pendingSavedAddressId]);

  // Saved vehicles auto-select effect
  useEffect(() => {
    if (savedVehiclesQuery.data) {
      setSavedVehicles(savedVehiclesQuery.data);

      // Check if we have a pending saved vehicle to restore
      if (pendingSavedVehicleId) {
        const vehicle = savedVehiclesQuery.data.find(v => v.id === pendingSavedVehicleId);
        if (vehicle) {
          setSelectedSavedVehicle(vehicle);
          setPendingSavedVehicleId(null);
          return;
        }
      }

      // Check if current vehicle matches a saved one
      if (make && model && !selectedSavedVehicle) {
        const matched = savedVehiclesQuery.data.find(
          v => v.make === make && v.model === model && v.licensePlate === licensePlate
        );
        if (matched) {
          setSelectedSavedVehicle(matched);
          setUseSavedVehicle(true);
        }
      }
    }
  }, [savedVehiclesQuery.data, pendingSavedVehicleId]);

  // Handle saved address selection
  const handleSavedAddressSelect = async (addressId: string) => {
    const address = savedAddresses.find(a => a.id === addressId);
    if (address) {
      setSelectedSavedAddress(address);
      setValue("pickupAddress", address.address);
      setPickupCoords({ lat: address.lat, lng: address.lng });

      const isValidGooglePlaceId = address.placeId &&
        (address.placeId.startsWith('ChIJ') ||
         (address.placeId.length >= 20 && /^[A-Za-z0-9_-]+$/.test(address.placeId)));

      if (isValidGooglePlaceId) {
        setPickupPlaceId(address.placeId);
      } else if (isLoaded && address.address) {
        try {
          const geocoder = new google.maps.Geocoder();
          const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
            geocoder.geocode({ address: address.address }, (results, status) => {
              if (status === "OK" && results) resolve(results);
              else reject(new Error(`Geocoding failed: ${status}`));
            });
          });
          if (results[0]?.place_id) {
            setPickupPlaceId(results[0].place_id);
          } else {
            setPickupPlaceId(null);
          }
        } catch (error) {
          setPickupPlaceId(null);
        }
      } else {
        setPickupPlaceId(null);
      }

      if (address.state) setPickupState(address.state);
      if (address.city) setPickupCity(address.city);
    }
  };

  // Handle saved vehicle selection
  const handleSavedVehicleSelect = (vehicle: SavedVehicle) => {
    setSelectedSavedVehicle(vehicle);
    setValue("make", vehicle.make);
    setValue("model", vehicle.model);
    setValue("color", vehicle.color);
    setValue("licensePlate", vehicle.licensePlate);
    setShowVehicleDropdown(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // API Mutations
  const getQuotePreview = useCreate<QuotePreviewResponse, { pickupAddress: string; dropoffAddress: string; serviceType: string, customerId?: string }>(
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
        toast.success("Quote calculated", {
          description: `Estimated price: ${formatCurrency(data.estimatedPrice || 0)} for ${data.distanceMiles || 0} miles`,
        });
      },
      onError: (error: any) => {
        const errorMessage = error?.message || "Failed to calculate quote";
        toast.error("Quote calculation failed", {
          description: errorMessage,
        });
        console.error('Quote preview failed:', error);
        setQuoteData({ miles: 0, total: 0, base: 0, distance: 0, insurance: 0, transaction: 0 });
        setQuoteId(null);
        setHasCalculated(false);
      },
      successMessage: undefined,
    }
  );

  // Auto-calculate quote when both addresses are set
  useEffect(() => {
    if (isDataLoadingRef.current) return;
    if (pickupCoords && dropoffCoords && !hasCalculated && pickupAddress && dropoffAddress) {
      getQuotePreview.mutate({
        pickupAddress,
        dropoffAddress,
        serviceType,
        ...(customer?.profileId && { customerId: customer.profileId }),
      });
    }
  }, [pickupCoords, dropoffCoords]);

  // Mutation for schedule preview
  const getSchedulePreview = useCreate<SchedulePreviewResponse, SchedulePreviewRequest>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/schedule-preview`,
    {
      onSuccess: (data) => {
        console.log('Schedule Preview Response:', data);
        setSchedulePreviewData(data);
        setIsLoadingSlots(false);

        if (data.suggestedSlots) {
          setSuggestedSlots(data.suggestedSlots);
        }

        if (data.pickupWindowStart && data.dropoffWindowStart) {
          setValidatedWindows({
            pickupWindowStart: data.pickupWindowStart,
            pickupWindowEnd: data.pickupWindowEnd,
            dropoffWindowStart: data.dropoffWindowStart,
            dropoffWindowEnd: data.dropoffWindowEnd,
          });
        }

        if (!data.feasible) {
          toast.error("Schedule not feasible", {
            description: data.message || "The selected schedule windows may not work. Please adjust and try again.",
          });
        } else if (data.pickupWindowStart && data.dropoffWindowStart) {
          toast.success("Schedule verified", {
            description: `ETA: ${formatDuration(data.etaMinutes)}. ${data.sameDayEligible ? '✨ Same-day eligible!' : ''}`,
          });
        }
      },
      onError: (error: any) => {
        const errorMessage = error?.message || "Failed to check schedule feasibility";
        toast.error("Schedule check failed", {
          description: errorMessage,
        });
        console.error('Schedule preview failed:', error);
        setSchedulePreviewData(null);
        setIsLoadingSlots(false);
      },
      successMessage: undefined,
    }
  );

  // Discovery mode: called when user chooses which side they want to set
  const handleCustomerChoseChange = (choice: "PICKUP_WINDOW" | "DROPOFF_WINDOW") => {
    if (!quoteId) {
      toast.error("Missing quote", {
        description: "Please calculate a quote first.",
      });
      return;
    }

    setCustomerChose(choice);
    setSelectedSlot(null);
    setValidatedWindows(null);
    setSuggestedSlots({ pickup: [], dropoff: [] });

    setIsLoadingSlots(true);
    const request: SchedulePreviewRequest = {
      quoteId,
      serviceType,
      customerType: customerDataQuery.data?.customerType || 'BUSINESS',
      customerId: customer?.profileId,
      customerChose: choice,
      ...(selectedDate && { preferredDate: format(selectedDate, "yyyy-MM-dd") }),
    };

    console.log('Discovery Mode Request:', request);
    getSchedulePreview.mutate(request);
  };

  // Validation mode: called when user selects a specific slot
  const handleSlotSelect = (slot: SlotItem) => {
    if (!quoteId || !customerChose) {
      toast.error("Missing information", {
        description: "Please select whether you want to set pickup or dropoff time first.",
      });
      return;
    }

    setSelectedSlot(slot);

    const request: SchedulePreviewRequest = {
      quoteId,
      serviceType,
      customerType: customerDataQuery.data?.customerType || 'BUSINESS',
      customerId: customer?.profileId,
      customerChose,
      ...(selectedDate && { preferredDate: format(selectedDate, "yyyy-MM-dd") }),
    };

    if (customerChose === "PICKUP_WINDOW") {
      request.pickupWindowStart = slot.start;
      request.pickupWindowEnd = slot.end;
    } else {
      request.dropoffWindowStart = slot.start;
      request.dropoffWindowEnd = slot.end;
    }

    console.log('Validation Mode Request:', request);
    setIsLoadingSlots(true);
    getSchedulePreview.mutate(request);
  };

  // Called when user picks a date from the calendar
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);

    // Reset slot state
    setSelectedSlot(null);
    setValidatedWindows(null);
    setSuggestedSlots({ pickup: [], dropoff: [] });

    // Auto-discover slots for the currently chosen side
    if (quoteId && customerChose) {
      setIsLoadingSlots(true);
      const request: SchedulePreviewRequest = {
        quoteId,
        serviceType,
        customerType: customerDataQuery.data?.customerType || 'BUSINESS',
        customerId: customer?.profileId,
        customerChose,
        preferredDate: format(date, "yyyy-MM-dd"),
      };
      getSchedulePreview.mutate(request);
    }
  };

  const handleQuotePreview = () => {
    if (pickupAddress && dropoffAddress && serviceType) {
      getQuotePreview.mutate({
        pickupAddress,
        dropoffAddress,
        serviceType,
        ...(customer?.profileId && { customerId: customer.profileId }),
      });
    }
  };

  // Handle place selection from autocomplete
  const handlePickupSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setPickupCoords({ lat, lng });
      setPickupPlaceId(place.place_id || null);
      setValue("pickupAddress", place.formatted_address || "");
      setSelectedSavedAddress(null);
      setPickupSaved(false);

      if (place.address_components) {
        const stateComp = place.address_components.find(comp =>
          comp.types.includes('administrative_area_level_1')
        );
        if (stateComp) {
          setPickupState(stateComp.short_name || stateComp.long_name);
        }
        const cityComp = place.address_components.find(comp =>
          comp.types.includes('locality') || comp.types.includes('sublocality')
        );
        if (cityComp) {
          setPickupCity(cityComp.long_name || cityComp.short_name);
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

  // Handle clearing addresses
  const handlePickupClear = useCallback(() => {
    setPickupCoords(null);
    setPickupPlaceId(null);
    setPickupState(null);
    setPickupCity(null);
    setHasCalculated(false);
    setQuoteId(null);
    setQuoteData({ miles: 0, total: 0, base: 0, distance: 0, insurance: 0, transaction: 0 });
    setValidatedWindows(null);
    setSchedulePreviewData(null);
    setCustomerChose(null);
    setSelectedSlot(null);
    setSuggestedSlots({ pickup: [], dropoff: [] });
  }, []);

  const handleDropoffClear = useCallback(() => {
    setDropoffCoords(null);
    setDropoffPlaceId(null);
    setDropoffState(null);
    setHasCalculated(false);
    setQuoteId(null);
    setQuoteData({ miles: 0, total: 0, base: 0, distance: 0, insurance: 0, transaction: 0 });
    setValidatedWindows(null);
    setSchedulePreviewData(null);
    setCustomerChose(null);
    setSelectedSlot(null);
    setSuggestedSlots({ pickup: [], dropoff: [] });
  }, []);

  // Check if form is valid for submission
  const isFormValidForSubmission = useMemo(() => {
    if (!quoteId) return false;
    if (!pickupCoords || !dropoffCoords) return false;
    if (!validatedWindows || !validatedWindows.pickupWindowStart || !validatedWindows.dropoffWindowStart) return false;

    const finalMake = make === "Other" ? watch("makeOther") : make;
    const finalModel = model === "Other" ? watch("modelOther") : model;
    const finalColor = color === "Other" ? watch("colorOther") : color;

    if (!licensePlate || !finalMake || !finalModel || !finalColor) return false;
    if (!vinVerification || !/^\d{4}$/.test(vinVerification)) return false;

    if (!recipientName || recipientName.trim().length < 1) return false;
    if (!recipientPhone || recipientPhone.replace(/\D/g, '').length < 10) return false;
    if (!recipientEmail || recipientEmail.trim().length < 1) return false;

    return true;
  }, [quoteId, pickupCoords, dropoffCoords, validatedWindows, licensePlate, make, model, color, vinVerification, recipientName, recipientPhone, recipientEmail]);

  // Build payload for update
  const buildPayload = (data: DeliveryFormData) => {
    const finalMake = data.make === "Other" ? data.makeOther : data.make;
    const finalModel = data.model === "Other" ? data.modelOther : data.model;
    const finalColor = data.color === "Other" ? data.colorOther : data.color;

    return {
      quote: { id: quoteId },
      serviceType: data.serviceType,
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
      pickupWindowStart: validatedWindows?.pickupWindowStart,
      pickupWindowEnd: validatedWindows?.pickupWindowEnd,
      dropoffWindowStart: validatedWindows?.dropoffWindowStart,
      dropoffWindowEnd: validatedWindows?.dropoffWindowEnd,
      afterHours: schedulePreviewData?.afterHours || false,
      licensePlate: data.licensePlate,
      vinVerificationCode: data.vinVerification,
      vehicleMake: finalMake,
      vehicleModel: finalModel,
      vehicleColor: finalColor,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      isUrgent: false,
      requiresOpsConfirmation: schedulePreviewData?.requiresOpsConfirmation || false,
      sameDayEligible: schedulePreviewData?.sameDayEligible || false,
    };
  };

  const onSubmit = async (data: DeliveryFormData) => {
    if (!pickupCoords || !dropoffCoords) {
      toast.error("Missing location data", {
        description: "Please select valid pickup and drop-off addresses from the autocomplete suggestions.",
      });
      return;
    }

    if (!quoteId) {
      toast.error("Quote required", {
        description: "Please calculate a quote before updating the delivery request.",
      });
      return;
    }

    if (!validatedWindows || !validatedWindows.pickupWindowStart || !validatedWindows.dropoffWindowStart) {
      toast.error("Schedule required", {
        description: "Please select a time slot to set the schedule before updating the delivery request.",
      });
      return;
    }

    const payload = buildPayload(data);
    updateDelivery.mutate(payload, {
      onSuccess: async () => {
        // If the delivery was expired, auto-revive it to QUOTED so the dealer can re-list
        if (isExpired) {
          try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/api/deliveryRequests/${deliveryId}/transition-status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                toStatus: 'QUOTED',
                note: 'Delivery revived by dealer after adjusting schedule',
              }),
            });
            if (!response.ok) {
              console.error('Failed to revive expired delivery:', await response.text());
              toast.error('Revive failed', {
                description: 'Delivery updated but could not be reactivated. Please contact support.',
              });
            }
          } catch (error) {
            console.error('Failed to revive expired delivery:', error);
          }
        }
      },
    });
  };

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
                  {isExpired ? 'Reactivate Delivery' : 'Edit Delivery'} #{deliveryId?.slice(-6).toUpperCase()}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                  {isExpired
                    ? "This delivery expired. Adjust the date and schedule, then update to reactivate it."
                    : canEdit 
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
              {/* Step 1: Car Transfer */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                    Step 1
                  </CardDescription>
                  <CardTitle className="text-xl font-black mt-1">
                    Car Transfer
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Book 101 Drivers to move your car in Southern California.
                  </p>
                </CardContent>
              </Card>

              {/* Step 2: Addresses & Quote */}
              {canEdit && (
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                          Step 2
                        </CardDescription>
                        <CardTitle className="text-2xl font-black mt-2">
                          Route
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          CA-only addresses with autocomplete/search. Quote updates when route changes.
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
                      {/* Pickup Address */}
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress" className="text-xs font-bold">
                          From Where
                        </Label>
                        <LocationAutocomplete
                          key="pickup"
                          value={pickupAddress || ""}
                          onChange={(val) => {
                            setValue("pickupAddress", val);
                            if (!val) {
                              setSelectedSavedAddress(null);
                              setPickupSaved(false);
                            }
                          }}
                          onPlaceSelect={handlePickupSelect}
                          onClear={() => {
                            handlePickupClear();
                            setSelectedSavedAddress(null);
                            setPickupSaved(false);
                          }}
                          isLoaded={isLoaded}
                          placeholder="Search starting location (California only)"
                          icon={<MapPin className="h-5 w-5 text-slate-400" />}
                        />
                        {errors.pickupAddress && (
                          <p className="text-xs text-red-500">{errors.pickupAddress.message}</p>
                        )}
                        {/* Save location checkbox */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="savePickupLocation"
                            checked={pickupSaved}
                            disabled={!pickupAddress || !pickupCoords}
                            onCheckedChange={async (checked) => {
                              if (!checked) {
                                setPickupSaved(false);
                                setSelectedSavedAddress(null);
                                return;
                              }
                              const alreadySaved = savedAddresses.find(
                                (a) => a.address === pickupAddress
                              );
                              if (alreadySaved) {
                                setSelectedSavedAddress(alreadySaved);
                                setPickupSaved(true);
                                return;
                              }
                              let finalPlaceId = pickupPlaceId;
                              const isValid = pickupPlaceId &&
                                (pickupPlaceId.startsWith('ChIJ') || pickupPlaceId.startsWith('Eh'));
                              if (!isValid && pickupCoords && isLoaded) {
                                try {
                                  const geocoder = new google.maps.Geocoder();
                                  const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                                    geocoder.geocode({ location: pickupCoords }, (results, status) => {
                                      if (status === "OK" && results) resolve(results);
                                      else reject(new Error(status));
                                    });
                                  });
                                  if (results[0]?.place_id) {
                                    finalPlaceId = results[0].place_id;
                                    setPickupPlaceId(finalPlaceId);
                                  }
                                } catch (e) {
                                  console.warn('Reverse geocoding failed:', e);
                                }
                              }
                              saveAddressMutation.mutate({
                                label: '',
                                address: pickupAddress,
                                lat: pickupCoords!.lat,
                                lng: pickupCoords!.lng,
                                placeId: finalPlaceId || undefined,
                                city: pickupCity || '',
                                state: pickupState || '',
                                country: 'USA',
                                postalCode: '',
                                isDefault: savedAddresses.length === 0,
                                customer: { id: customer.profileId },
                              });
                            }}
                          />
                          <Label
                            htmlFor="savePickupLocation"
                            className={`text-xs font-bold cursor-pointer ${!pickupAddress || !pickupCoords ? 'text-slate-400 cursor-not-allowed' : ''}`}
                          >
                            {pickupSaved ? 'Saved' : 'Save location'}
                          </Label>
                        </div>
                      </div>

                      {/* Drop-off Address */}
                      <div className="space-y-2">
                        <Label htmlFor="dropoffAddress" className="text-xs font-bold">
                          Where To
                        </Label>
                        <LocationAutocomplete
                          key="dropoff"
                          value={dropoffAddress || ""}
                          onChange={(val) => setValue("dropoffAddress", val)}
                          onPlaceSelect={handleDropoffSelect}
                          onClear={handleDropoffClear}
                          isLoaded={isLoaded}
                          placeholder="Search destination (California only)"
                          icon={<Flag className="h-5 w-5 text-slate-400" />}
                        />
                        {errors.dropoffAddress && (
                          <p className="text-xs text-red-500">{errors.dropoffAddress.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Map Preview & Quote */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      {/* Map Preview */}
                      <div className="lg:col-span-7 relative min-h-[240px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <RouteMap
                          pickup={pickupCoords}
                          dropoff={dropoffCoords}
                          isLoaded={isLoaded}
                          zones={pickupZones}
                          fitZonesBounds={true}
                        />
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
                                Itemized breakdown updates if addresses or service type change.
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
                          {hasCalculated ? (
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400 font-semibold">Base fare</span>
                                <span className="text-slate-900 dark:text-white font-black">{formatCurrency(quoteData.base)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400 font-semibold">Distance charge</span>
                                <span className="text-slate-900 dark:text-white font-black">{formatCurrency(quoteData.distance)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400 font-semibold">Insurance fee</span>
                                <span className="text-slate-900 dark:text-white font-black">{formatCurrency(quoteData.insurance)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400 font-semibold">Transaction fee</span>
                                <span className="text-slate-900 dark:text-white font-black">{formatCurrency(quoteData.transaction)}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
                              Click "Calculate" to get a real-time quote based on the addresses and service type.
                            </p>
                          )}

                          <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex gap-3">
                            <Info className="h-5 w-5 text-amber-500 flex-shrink-0" />
                            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
                              Real-time quote from backend – updates automatically when addresses or service type change.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Scheduling */}
              <Card className={cn(
                "border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow",
                !quoteId && "opacity-60 pointer-events-none"
              )}>
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
                        Pickup or arrival
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col gap-2">
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        One-side-at-a-time
                      </Badge>
                      {schedulePreviewData?.sameDayEligible && (
                        <Badge className="bg-lime-500 text-slate-900 animate-pulse">
                          Same-day eligible!
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Gate: show message when quote is not yet calculated */}
                  {!quoteId && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center py-8">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                        <Clock className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        Calculate a quote first
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                        Enter pickup and destination addresses above and calculate a quote to unlock scheduling.
                      </p>
                    </div>
                  )}

                  {/* Date picker + controls only available after quote */}
                  {quoteId && (<>

                  {/* Date picker - Choose a date */}
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest">
                      Choose a date
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-14 justify-start text-left font-medium rounded-2xl border-slate-200 dark:border-slate-700",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                          {selectedDate ? format(selectedDate, "EEE MMM d, yyyy") : "Choose a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const maxDate = new Date(today);
                            maxDate.setDate(maxDate.getDate() + 7);
                            return date < today || date > maxDate;
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Choose which side to set */}
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest">
                      Pickup or arrival
                    </Label>
                    <RadioGroup
                      value={customerChose || ""}
                      onValueChange={(value) => handleCustomerChoseChange(value as "PICKUP_WINDOW" | "DROPOFF_WINDOW")}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <div className="flex items-center space-x-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-lime-500 transition-colors cursor-pointer">
                        <RadioGroupItem value="PICKUP_WINDOW" id="pickup-choice" />
                        <Label htmlFor="pickup-choice" className="cursor-pointer font-medium">
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-lime-500" />
                            I want to set pickup time
                          </span>
                          <span className="text-xs text-slate-500 font-normal">Arrival will be calculated</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-lime-500 transition-colors cursor-pointer">
                        <RadioGroupItem value="DROPOFF_WINDOW" id="dropoff-choice" />
                        <Label htmlFor="dropoff-choice" className="cursor-pointer font-medium">
                          <span className="flex items-center gap-2">
                            <Flag className="h-4 w-4 text-lime-500" />
                            I want to set arrival time
                          </span>
                          <span className="text-xs text-slate-500 font-normal">Pickup will be calculated</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  </>)}

                  {/* Loading state for discovery mode */}
                  {isLoadingSlots && !selectedSlot && (
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      Finding available time slots...
                    </div>
                  )}

                  {/* Step 2: Select a time slot */}
                  {customerChose && !isLoadingSlots && (
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase tracking-widest">
                        {customerChose === "PICKUP_WINDOW" ? "Pickup time" : "Arrival time"}
                      </Label>
                      
                      {suggestedSlots[customerChose === "PICKUP_WINDOW" ? "pickup" : "dropoff"].length > 0 ? (
                        <Select
                          value={selectedSlot?.label || ""}
                          onValueChange={(value) => {
                            const slots = suggestedSlots[customerChose === "PICKUP_WINDOW" ? "pickup" : "dropoff"];
                            const slot = slots.find(s => s.label === value);
                            if (slot) handleSlotSelect(slot);
                          }}
                        >
                          <SelectTrigger className="h-14 rounded-2xl">
                            <SelectValue placeholder="Choose a time slot..." />
                          </SelectTrigger>
                          <SelectContent>
                            {suggestedSlots[customerChose === "PICKUP_WINDOW" ? "pickup" : "dropoff"].map((slot) => (
                              <SelectItem key={slot.label} value={slot.label}>
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                  )}

                  {/* Loading state for validation mode */}
                  {isLoadingSlots && selectedSlot && (
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      Validating schedule...
                    </div>
                  )}

                  {/* Step 3: Show validated windows */}
                  {validatedWindows && schedulePreviewData?.feasible && !isLoadingSlots && (
                    <div className="p-5 rounded-2xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800 space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-lime-500" />
                        <span className="text-sm font-bold text-lime-700 dark:text-lime-300">Schedule Verified</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Pickup Window</div>
                          <div className="text-sm font-medium">
                            {customerChose === "PICKUP_WINDOW" ? (
                              <span className="text-lime-600 dark:text-lime-400">🎯 {selectedSlot?.label}</span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400">✨ {formatTimeRange(validatedWindows.pickupWindowStart, validatedWindows.pickupWindowEnd)}</span>
                            )}
                          </div>
                          {validatedWindows.pickupWindowStart && (
                            <div className="text-xs text-slate-500 mt-1">
                              {new Date(validatedWindows.pickupWindowStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Arrival Window</div>
                          <div className="text-sm font-medium">
                            {customerChose === "DROPOFF_WINDOW" ? (
                              <span className="text-lime-600 dark:text-lime-400">🎯 {selectedSlot?.label}</span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400">✨ {formatTimeRange(validatedWindows.dropoffWindowStart, validatedWindows.dropoffWindowEnd)}</span>
                            )}
                          </div>
                          {validatedWindows.dropoffWindowStart && (
                            <div className="text-xs text-slate-500 mt-1">
                              {new Date(validatedWindows.dropoffWindowStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default" className="bg-lime-500/20 text-lime-700 dark:text-lime-300 text-[10px]">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Feasible
                        </Badge>
                        {schedulePreviewData.sameDayEligible && (
                          <Badge className="bg-lime-500 text-slate-900 text-[10px]">
                            ✨ Same-day eligible
                          </Badge>
                        )}
                        {(schedulePreviewData.requiresOpsConfirmation || schedulePreviewData.afterHours) && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800 text-[10px]">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Requires ops confirmation
                          </Badge>
                        )}
                      </div>

                      {/* ETA info */}
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Estimated transit time: <span className="font-medium">{formatDuration(schedulePreviewData.etaMinutes)}</span>
                        {schedulePreviewData.bufferMinutes && schedulePreviewData.bufferMinutes > 0 && (
                          <span> • Buffer: {schedulePreviewData.bufferMinutes} min</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error state */}
                  {schedulePreviewData && !schedulePreviewData.feasible && !isLoadingSlots && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                      <AlertCircle className="h-4 w-4 inline mr-2" />
                      {schedulePreviewData.message || "This schedule is not feasible. Please try a different time."}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 4: Vehicle Details */}
              {canEdit && (
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
                          Make/model/color from dropdowns; "Other" unlocks free-text. VIN verification required.
                        </p>
                      </div>
                      <Badge variant="outline" className="hidden sm:flex">
                        <Car className="h-3 w-3 mr-1" />
                        Dropdown-driven
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Checkbox for saved vehicles */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="useSavedVehicle"
                        checked={useSavedVehicle}
                        onCheckedChange={(checked) => {
                          setUseSavedVehicle(!!checked);
                          if (!checked) {
                            setSelectedSavedVehicle(null);
                          }
                        }}
                      />
                      <Label
                        htmlFor="useSavedVehicle"
                        className="text-xs font-bold cursor-pointer"
                      >
                        Use saved vehicle
                      </Label>
                    </div>

                    {/* Saved vehicle dropdown */}
                    {useSavedVehicle && (
                      <div className="relative mb-4">
                        <Input
                          placeholder="Select saved vehicle..."
                          onFocus={() => setShowVehicleDropdown(true)}
                          onBlur={() => setTimeout(() => setShowVehicleDropdown(false), 200)}
                          value={selectedSavedVehicle ? `${selectedSavedVehicle.make} ${selectedSavedVehicle.model} (${selectedSavedVehicle.licensePlate})` : ""}
                          readOnly
                          className="h-14 rounded-2xl"
                        />
                        {showVehicleDropdown && savedVehicles.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {savedVehicles.map((vehicle) => (
                              <div
                                key={vehicle.id}
                                className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                onClick={() => handleSavedVehicleSelect(vehicle)}
                              >
                                {vehicle.make} {vehicle.model} - {vehicle.color} ({vehicle.licensePlate})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
                        <Label htmlFor="vinVerification" className="text-xs font-bold">
                          VIN verification code <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="vinVerification"
                          {...register("vinVerification")}
                          className="h-14 rounded-2xl"
                          placeholder="4 digits"
                          maxLength={4}
                        />
                        {errors.vinVerification && (
                          <p className="text-xs text-red-500">{errors.vinVerification.message}</p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          Must be exactly 4 numeric digits (no letters).
                        </p>
                      </div>
                    </div>

                    {/* Make & Model */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="make" className="text-xs font-bold">Make</Label>
                        <Select
                          value={make}
                          onValueChange={(value) => {
                            setValue("make", value);
                            if (value !== model) setValue("model", "");
                          }}
                        >
                          <SelectTrigger className="h-14 rounded-2xl">
                            <SelectValue placeholder="Select make..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getAllMakes().map((makeName) => (
                              <SelectItem key={makeName} value={makeName}>
                                {makeName}
                              </SelectItem>
                            ))}
                            <SelectItem value="Other">Other (not listed)</SelectItem>
                          </SelectContent>
                        </Select>
                        {make === "Other" && (
                          <Input {...register("makeOther")} className="h-14 rounded-2xl mt-2" placeholder="Enter make" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="model" className="text-xs font-bold">Model</Label>
                        {make && make !== "Other" ? (
                          <Select
                            value={model}
                            onValueChange={(value) => setValue("model", value)}
                          >
                            <SelectTrigger className="h-14 rounded-2xl">
                              <SelectValue placeholder="Select model..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getModelsForMake(make).map((modelName) => (
                                <SelectItem key={modelName} value={modelName}>
                                  {modelName}
                                </SelectItem>
                              ))}
                              <SelectItem value="Other">Other (not listed)</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : make === "Other" ? (
                          <Input
                            {...register("modelOther")}
                            className="h-14 rounded-2xl"
                            placeholder="Enter model"
                          />
                        ) : (
                          <Select disabled>
                            <SelectTrigger className="h-14 rounded-2xl">
                              <SelectValue placeholder="Select a make first..." />
                            </SelectTrigger>
                            <SelectContent />
                          </Select>
                        )}
                        {model === "Other" && make !== "Other" && (
                          <Input
                            {...register("modelOther")}
                            className="h-14 rounded-2xl mt-2"
                            placeholder="Enter model"
                          />
                        )}
                      </div>
                    </div>

                    {/* Color & Transmission */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="color" className="text-xs font-bold">
                          Color <span className="text-red-500">*</span>
                        </Label>
                        <Select value={color} onValueChange={(value) => setValue("color", value)}>
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
                          <Input {...register("colorOther")} className="h-14 rounded-2xl mt-2" placeholder="Enter color" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="transmission" className="text-xs font-bold">Transmission</Label>
                        <Select value={transmission} onValueChange={(value) => setValue("transmission", value)}>
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
                          <Input {...register("transmissionOther")} className="h-14 rounded-2xl mt-2" placeholder="Enter transmission" />
                        )}
                      </div>
                    </div>

                    {/* Save vehicle for future */}
                    {!useSavedVehicle && !selectedSavedVehicle && make && model && color && watch('licensePlate') && (
                      <div className="p-3 rounded-xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                        <div className="text-xs font-bold text-lime-700 dark:text-lime-300 mb-2">
                          Save vehicle for future use?
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const finalMake = make === "Other" ? watch('makeOther') : make;
                            const finalModel = model === "Other" ? watch('modelOther') : model;
                            const finalColor = color === "Other" ? watch('colorOther') : color;

                            if (!finalMake || !finalModel || !finalColor || !watch('licensePlate')) {
                              toast.error("Missing information", {
                                description: "Please fill in all vehicle details.",
                              });
                              return;
                            }

                            saveVehicleMutation.mutate({
                              make: finalMake,
                              model: finalModel,
                              color: finalColor,
                              licensePlate: watch('licensePlate'),
                              customer: { id: customer.profileId },
                            });
                          }}
                          disabled={saveVehicleMutation.isPending}
                          className="h-10"
                        >
                          {saveVehicleMutation.isPending ? "Saving..." : "Save Vehicle"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Step 5: Instructions */}
              {canEdit && (
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
                        Gate codes, key handoff notes, dealership contact at pickup, etc.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="instructions" className="text-xs font-black uppercase tracking-widest">
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
              )}
            </div>

            {/* RIGHT COLUMN - Recipient, Payment, Submit */}
            <div className="xl:col-span-5 space-y-8">
              {/* Recipient Tracking */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Required
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Recipient tracking
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Recipient phone is essential for driver communication during delivery. 
                      Email enables tracking notifications.
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="recipientName" className="text-xs font-bold">
                          Recipient name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="recipientName"
                          {...register("recipientName")}
                          className="h-14 rounded-2xl"
                          placeholder="Buyer / receiver"
                        />
                        {errors.recipientName && (
                          <p className="text-xs text-red-500">{errors.recipientName.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recipientEmail" className="text-xs font-bold">
                          Recipient email <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="recipientEmail"
                          {...register("recipientEmail")}
                          className="h-14 rounded-2xl"
                          placeholder="recipient@example.com"
                          type="email"
                        />
                        {errors.recipientEmail && (
                          <p className="text-xs text-red-500">{errors.recipientEmail.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recipientPhone" className="text-xs font-bold">
                        Recipient phone <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="recipientPhone"
                        value={watch("recipientPhone") || ""}
                        onChange={(e) => {
                          const formatted = formatUSPhone(e.target.value);
                          setValue("recipientPhone", formatted);
                        }}
                        className="h-14 rounded-2xl"
                        placeholder="(555) 123-4567"
                        type="tel"
                      />
                      {errors.recipientPhone && (
                        <p className="text-xs text-red-500">{errors.recipientPhone.message}</p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        Driver will communicate with recipient during delivery
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Tracking links are access-controlled and should expire after completion.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Payment */}
              {canEdit && (
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
                        {isPrivateCustomer
                          ? "Individual accounts use prepaid payment. Your card will be authorized now and charged upon delivery completion."
                          : postpaidEnabled
                            ? "You are authorized for postpaid billing. Choose prepaid or postpaid."
                            : "Your account is set to prepaid only. Contact admin for postpaid authorization."}
                      </p>
                    </div>
                    {postpaidEnabled && (
                      <Badge variant="secondary" className="bg-sky-500/10 text-sky-700 border-sky-500/20 mt-2">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Postpaid Authorized
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={watch("paymentType")}
                      className="space-y-3"
                      onValueChange={(value) => setValue("paymentType", value as any)}
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

                      {postpaidEnabled && (
                        <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <div className="flex items-center gap-3">
                            <Receipt className="h-5 w-5 text-lime-500" />
                            <div>
                              <div className="font-extrabold">Postpaid (credit)</div>
                              <div className="text-[11px] text-slate-500">
                                Bill to your account after delivery completion.
                              </div>
                            </div>
                          </div>
                          <RadioGroupItem value="POSTPAID" id="POSTPAID" />
                        </div>
                      )}
                    </RadioGroup>

                    {!postpaidEnabled && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-slate-400 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-sm font-extrabold">
                              {isPrivateCustomer ? 'Prepaid Payment' : 'Prepaid Only'}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                              {isPrivateCustomer 
                                ? "Your delivery will be prepaid. Payment authorization happens at booking, with capture on completion."
                                : "Your account is configured for prepaid payments only. Contact your administrator if you need postpaid billing access."}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Submit */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Submit
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Delivery Details
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Your changes will update the existing delivery while keeping its current status.
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="submit"
                      className="py-6 rounded-2xl bg-lime-500 hover:bg-lime-600 text-slate-950 font-extrabold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={updateDelivery.isPending || !isFormValidForSubmission}
                    >
                      {updateDelivery.isPending ? (
                        <>
                          Updating...
                          <RefreshCw className="ml-2 h-5 w-5 animate-spin" />
                        </>
                      ) : (
                        <>
                          Update Delivery
                          <ChevronRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="py-6 rounded-2xl border-slate-200 dark:border-slate-700 font-extrabold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={saveAsDraft.isPending}
                      onClick={handleSaveAsDraft}
                    >
                      {saveAsDraft.isPending ? (
                        <>
                          Saving...
                          <RefreshCw className="ml-2 h-5 w-5 animate-spin" />
                        </>
                      ) : (
                        "Save as Draft"
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center sm:text-right">
                    Saves changes and moves this delivery to the Drafts tab (you can delete it from there later)
                  </p>

                  {!isFormValidForSubmission && !updateDelivery.isPending && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-3 text-center">
                      Please complete all required fields: addresses, schedule window, vehicle details, and recipient info.
                    </p>
                  )}

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

                </CardContent>
              </Card>

              {/* Need Help */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="text-xl font-black">Need help?</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Need help with anything? Our support team is here to help.
                  </p>
                </CardHeader>
                <CardContent>
                  <a
                    href="/dealer-support-request"
                    className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold hover:bg-slate-800 dark:hover:bg-slate-100 transition"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Contact Support
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
