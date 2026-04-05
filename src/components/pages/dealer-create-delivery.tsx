// app/pages/dealer/create-delivery.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  FileText,
  HelpCircle,
  Rocket,
  RefreshCw,
} from "lucide-react";
import LocationAutocomplete from "@/components/map/LocationAutocomplete";
import RouteMap from "@/components/map/RouteMap";
import { getUser, useCreate, useDataQuery, usePatch, authFetch } from "@/lib/tanstack/dataQuery";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Form validation schema
const deliverySchema = z.object({
  serviceType: z.enum([
    "HOME_DELIVERY",
    "BETWEEN_LOCATIONS",
    "SERVICE_PICKUP_RETURN",
  ]),
  pickupAddress: z.string().min(1, "From location is required"),
  dropoffAddress: z.string().min(1, "To location is required"),
  rememberPickup: z.boolean().optional(),
  // Schedule fields - now populated from backend schedule-preview
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
  enableRecipient: z.boolean().optional(), // Kept for backward compatibility
  recipientName: z.string().min(1, "Recipient name is required").optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientPhone: z.string().min(10, "Valid phone number is required").optional(),
  paymentType: z.enum(["PREPAID", "POSTPAID"]).optional(),
  dealerAuthorized: z.boolean().optional(),
  status: z.enum( ["DRAFT", "QUOTED", "LISTED", "BOOKED", "ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]),
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

// Helper functions for draft data conversion
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
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  if (limited.length === 0) return '';
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

interface CreateDeliveryPageProps {
  draftId?: string;
}

export default function CreateDeliveryPage({ draftId }: CreateDeliveryPageProps) {
  const navigate = useNavigate();
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
  
  // Track original delivery status when editing existing delivery
  const [originalDeliveryStatus, setOriginalDeliveryStatus] = useState<string | null>(null);
  
  // Schedule section - new one-side-at-a-time flow
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
  
  const [isLoadingDraft, setIsLoadingDraft] = useState(!!draftId);

  // Ref to prevent quote reset during session restoration
  const isRestoringFromSession = useRef(false);
  // Ref to track previous coordinates for detecting actual changes
  const prevPickupCoordsRef = useRef<google.maps.LatLngLiteral | null>(null);
  const prevDropoffCoordsRef = useRef<google.maps.LatLngLiteral | null>(null);

  // Release dialog state
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);
  const customer = getUser();

  // Fetch customer data to check postpaidEnabled status
  const customerDataQuery = useDataQuery<CustomerData>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${customer?.profileId}`,
    enabled: !!customer?.profileId,
    staleTime: 5 * 60 * 1000,
    queryKey: ['customerData', customer?.profileId],
    noFilter: true,
  });

  // Derived postpaid enabled status from backend
  // PRIVATE customers are always prepaid only (per PRD IND-002)
  const isPrivateCustomer = customerDataQuery.data?.customerType === 'PRIVATE';
  const isBusinessCustomer = customerDataQuery.data?.customerType === 'BUSINESS';
  const postpaidEnabled = isBusinessCustomer && (customerDataQuery.data?.postpaidEnabled ?? false);

  // Saved addresses state
  const [useSavedAddresses, setUseSavedAddresses] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<SavedAddress | null>(null);
  const [pickupLabel, setPickupLabel] = useState('');
  const [pendingSavedAddressId, setPendingSavedAddressId] = useState<string | null>(null);

  // Saved vehicles state
  const [useSavedVehicle, setUseSavedVehicle] = useState(false);
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [selectedSavedVehicle, setSelectedSavedVehicle] = useState<SavedVehicle | null>(null);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [pendingSavedVehicleId, setPendingSavedVehicleId] = useState<string | null>(null);

  // Mutation for creating delivery
  const createDelivery = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/create-from-quote`, {
    onSuccess: async (data: any) => {
      // If editing a draft, delete it after successful submission
      if (draftId) {
        try {
          await authFetch(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`, {
            method: 'DELETE',
          });
        } catch (e) {
          console.error('Failed to delete draft after submission:', e);
        }
      }
      // Show release dialog instead of navigating
      setCreatedDeliveryId(data?.id || data?.deliveryRequest?.id || null);
      setShowReleaseDialog(true);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to create delivery request";
      const errorDetails = error?.response?.data?.details || error?.details;

      toast.error("Failed to create delivery", {
        description: errorDetails || errorMessage,
      });

      console.error("Delivery creation failed:", {
        message: errorMessage,
        details: errorDetails,
        error: error,
      });
    },
    successMessage: undefined, // Using custom toast above
  });

  // Query client for invalidating queries
  const queryClient = useQueryClient();

  // Mutation for releasing to marketplace
  const releaseToMarketMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      return authFetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/release-to-marketplace`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    },
    onSuccess: () => {
      toast.success("Released to market", {
        description: "Your delivery is now visible to drivers. You will be notified when a driver books it."
      });
      setShowReleaseDialog(false);
      navigate({ to: "/dealer-dashboard" });
    },
    onError: (error: Error) => {
      toast.error("Failed to release to market", { description: error.message });
    }
  });

  // Mutation for saving as draft (new draft)
  const saveDraftMutation = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/create-draft-from-quote`, {
    onSuccess: () => {
      toast.success("Draft saved successfully", {
        description: "You can continue editing this draft later from the Drafts page.",
      });
      navigate({ to: "/dealer-drafts" });
    },
    onError: (error: any) => {
      toast.error("Failed to save draft", {
        description: error?.message || "Please try again.",
      });
      console.error("Failed to save draft:", error);
    },
    successMessage: undefined,
  });

  // Mutation for updating existing draft
  const updateDraftMutation = usePatch(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`, {
    onSuccess: () => {
      toast.success("Draft updated successfully", {
        description: "Your changes have been saved.",
      });
      navigate({ to: "/dealer-drafts" });
    },
    onError: (error: any) => {
      toast.error("Failed to update draft", {
        description: error?.message || "Please try again.",
      });
      console.error("Failed to update draft:", error);
    },
    successMessage: undefined,
  });

  // Mutation for updating existing LISTED/QUOTED delivery (PATCH - keep status)
  const updateDeliveryMutation = usePatch(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`, {
    onSuccess: () => {
      toast.success("Delivery updated successfully", {
        description: "Your changes have been saved.",
      });
      // Navigate to delivery details or dashboard
      navigate({ to: "/dealer-dashboard" });
    },
    onError: (error: any) => {
      toast.error("Failed to update delivery", {
        description: error?.message || "Please try again.",
      });
      console.error("Failed to update delivery:", error);
    },
    successMessage: undefined,
  });

  // Effect to load data - prioritizes session data (from review page) over draft data
  useEffect(() => {
    const loadData = async () => {
      // First check for session data (coming back from review page - highest priority)
      const stored = sessionStorage.getItem("reviewDeliveryData");
      if (stored) {
        try {
          const data = JSON.parse(stored);

          // Set flag to prevent reset effect from clearing restored data
          isRestoringFromSession.current = true;

          // Restore form values
          setValue('serviceType', data.serviceType || 'HOME_DELIVERY');
          setValue('pickupAddress', data.pickupAddress || '');
          setValue('dropoffAddress', data.dropoffAddress || '');
          setValue('licensePlate', data.licensePlate || '');
          setValue('vinVerification', data.vinVerification || '');
          setValue('make', data.make || '');
          setValue('model', data.model || '');
          setValue('color', data.color || '');
          setValue('transmission', data.transmission || 'Automatic');
          
          if (data.makeOther) setValue('makeOther', data.makeOther);
          if (data.modelOther) setValue('modelOther', data.modelOther);
          if (data.colorOther) setValue('colorOther', data.colorOther);
          
          // Restore recipient (always required)
          if (data.recipientName) setValue('recipientName', data.recipientName);
          if (data.recipientEmail) setValue('recipientEmail', data.recipientEmail);
          if (data.recipientPhone) setValue('recipientPhone', data.recipientPhone);
          
          // Restore coordinates and initialize refs to prevent false change detection
          if (data.pickupLat && data.pickupLng) {
            const coords = { lat: data.pickupLat, lng: data.pickupLng };
            setPickupCoords(coords);
            prevPickupCoordsRef.current = coords; // Initialize ref to prevent false change detection
          }
          if (data.dropoffLat && data.dropoffLng) {
            const coords = { lat: data.dropoffLat, lng: data.dropoffLng };
            setDropoffCoords(coords);
            prevDropoffCoordsRef.current = coords; // Initialize ref to prevent false change detection
          }

          // Restore place IDs - validate and geocode if invalid
          const isValidPlaceId = (placeId: string | undefined) =>
            placeId && (placeId.startsWith('ChIJ') || (placeId.length >= 20 && /^[A-Za-z0-9_-]+$/.test(placeId)));

          if (isValidPlaceId(data.pickupPlaceId)) {
            setPickupPlaceId(data.pickupPlaceId);
          } else if (data.pickupAddress && isLoaded) {
            // Geocode pickup address to get real placeId
            try {
              const geocoder = new google.maps.Geocoder();
              const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                geocoder.geocode({ address: data.pickupAddress }, (results, status) => {
                  if (status === "OK" && results) resolve(results);
                  else reject(new Error(`Geocoding failed: ${status}`));
                });
              });
              if (results[0]?.place_id) {
                console.log('Geocoded pickup placeId during restoration:', results[0].place_id);
                setPickupPlaceId(results[0].place_id);
              } else {
                setPickupPlaceId(null);
              }
            } catch (e) {
              console.error('Failed to geocode pickup address:', e);
              setPickupPlaceId(null);
            }
          } else {
            setPickupPlaceId(null);
          }

          if (isValidPlaceId(data.dropoffPlaceId)) {
            setDropoffPlaceId(data.dropoffPlaceId);
          } else if (data.dropoffAddress && isLoaded) {
            // Geocode dropoff address to get real placeId
            try {
              const geocoder = new google.maps.Geocoder();
              const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                geocoder.geocode({ address: data.dropoffAddress }, (results, status) => {
                  if (status === "OK" && results) resolve(results);
                  else reject(new Error(`Geocoding failed: ${status}`));
                });
              });
              if (results[0]?.place_id) {
                console.log('Geocoded dropoff placeId during restoration:', results[0].place_id);
                setDropoffPlaceId(results[0].place_id);
              } else {
                setDropoffPlaceId(null);
              }
            } catch (e) {
              console.error('Failed to geocode dropoff address:', e);
              setDropoffPlaceId(null);
            }
          } else {
            setDropoffPlaceId(null);
          }

          setPickupState(data.pickupState || null);
          setPickupCity(data.pickupCity || null);
          setDropoffState(data.dropoffState || null);
          
          // Restore schedule windows
          if (data.pickupWindowStart && data.pickupWindowEnd) {
            setValidatedWindows({
              pickupWindowStart: data.pickupWindowStart,
              pickupWindowEnd: data.pickupWindowEnd,
              dropoffWindowStart: data.dropoffWindowStart,
              dropoffWindowEnd: data.dropoffWindowEnd,
            });
            setCustomerChose(data.customerChose || "PICKUP_WINDOW");
            setSelectedSlot({
              label: isoToTimeWindow(data.pickupWindowStart, data.pickupWindowEnd),
              start: data.pickupWindowStart,
              end: data.pickupWindowEnd,
            });
            if (data.etaMinutes) {
              setSchedulePreviewData({
                feasible: true,
                message: null,
                pickupWindowStart: data.pickupWindowStart,
                pickupWindowEnd: data.pickupWindowEnd,
                dropoffWindowStart: data.dropoffWindowStart,
                dropoffWindowEnd: data.dropoffWindowEnd,
                etaMinutes: data.etaMinutes,
                bufferMinutes: data.bufferMinutes || 15,
                sameDayEligible: false,
                requiresOpsConfirmation: false,
                afterHours: false,
              });
            }
          }
          
          // Restore quote data
          if (data.quoteId) {
            setQuoteId(data.quoteId);
            setHasCalculated(true);
          }
          if (data.miles !== undefined) {
            setQuoteData({
              miles: data.miles,
              total: data.total,
              base: data.base,
              distance: data.distance,
              insurance: data.insurance,
              transaction: data.transaction,
            });
          }
          
          // Restore payment type
          if (data.paymentType) {
            setValue('paymentType', data.paymentType);
          }
          
          // Restore saved address/vehicle state
          if (data.useSavedAddresses !== undefined) {
            setUseSavedAddresses(data.useSavedAddresses);
          }
          if (data.selectedSavedAddressId) {
            // Store ID for later restoration when savedAddresses query completes
            setPendingSavedAddressId(data.selectedSavedAddressId);
            // Try immediate restoration if addresses are already loaded
            if (savedAddresses.length > 0) {
              const addr = savedAddresses.find(a => a.id === data.selectedSavedAddressId);
              if (addr) setSelectedSavedAddress(addr);
            }
          }
          if (data.useSavedVehicle !== undefined) {
            setUseSavedVehicle(data.useSavedVehicle);
          }
          if (data.selectedSavedVehicleId) {
            // Store ID for later restoration when savedVehicles query completes
            setPendingSavedVehicleId(data.selectedSavedVehicleId);
            // Try immediate restoration if vehicles are already loaded
            if (savedVehicles.length > 0) {
              const vehicle = savedVehicles.find(v => v.id === data.selectedSavedVehicleId);
              if (vehicle) setSelectedSavedVehicle(vehicle);
            }
          }
          
          // Clear session storage after restoring
          sessionStorage.removeItem("reviewDeliveryData");
          setIsLoadingDraft(false);

          // Reset the flag after restoration is complete
          // Use setTimeout to ensure it happens after the reset effect would have run
          setTimeout(() => {
            isRestoringFromSession.current = false;
          }, 0);

          toast.success("Data restored", {
            description: "Your delivery details have been restored.",
          });
          return; // Don't load draft if session data exists
        } catch (e) {
          console.error('Failed to restore from session:', e);
          isRestoringFromSession.current = false;
        }
      }
      
      // No session data - try loading draft if draftId exists
      if (!draftId) {
        setIsLoadingDraft(false);
        return;
      }

      try {
        // Set flag to prevent reset effect from clearing draft data
        isRestoringFromSession.current = true;

        const draft = await authFetch(
          `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        // Store the original status to determine if we should PATCH or POST
        setOriginalDeliveryStatus(draft.status || null);

        // Populate form with draft data
        setValue('serviceType', draft.serviceType || 'HOME_DELIVERY');
        setValue('pickupAddress', draft.pickupAddress || '');
        setValue('dropoffAddress', draft.dropoffAddress || '');
        
        // Set coordinates and initialize refs to prevent false change detection
        if (draft.pickupLat && draft.pickupLng) {
          const coords = { lat: draft.pickupLat, lng: draft.pickupLng };
          setPickupCoords(coords);
          prevPickupCoordsRef.current = coords;
        }
        if (draft.dropoffLat && draft.dropoffLng) {
          const coords = { lat: draft.dropoffLat, lng: draft.dropoffLng };
          setDropoffCoords(coords);
          prevDropoffCoordsRef.current = coords;
        }
        setPickupPlaceId(draft.pickupPlaceId || null);
        setDropoffPlaceId(draft.dropoffPlaceId || null);
        setPickupState(draft.pickupState || null);
        setDropoffState(draft.dropoffState || null);

        // Schedule - populate validatedWindows for new flow
        if (draft.pickupWindowStart && draft.pickupWindowEnd && draft.dropoffWindowStart && draft.dropoffWindowEnd) {
          setValidatedWindows({
            pickupWindowStart: draft.pickupWindowStart,
            pickupWindowEnd: draft.pickupWindowEnd,
            dropoffWindowStart: draft.dropoffWindowStart,
            dropoffWindowEnd: draft.dropoffWindowEnd,
          });
          setCustomerChose("PICKUP_WINDOW");
          setSelectedSlot({
            label: isoToTimeWindow(draft.pickupWindowStart, draft.pickupWindowEnd),
            start: draft.pickupWindowStart,
            end: draft.pickupWindowEnd,
          });
          setSchedulePreviewData({
            feasible: true,
            message: null,
            pickupWindowStart: draft.pickupWindowStart,
            pickupWindowEnd: draft.pickupWindowEnd,
            dropoffWindowStart: draft.dropoffWindowStart,
            dropoffWindowEnd: draft.dropoffWindowEnd,
            etaMinutes: draft.etaMinutes || 60,
            bufferMinutes: draft.bufferMinutes || 15,
            sameDayEligible: draft.sameDayEligible || false,
            requiresOpsConfirmation: draft.requiresOpsConfirmation || false,
            afterHours: draft.afterHours || false,
          });
        }

        // Vehicle info
        if (draft.licensePlate) setValue('licensePlate', draft.licensePlate);
        if (draft.vinVerificationCode) setValue('vinVerification', draft.vinVerificationCode);
        if (draft.vehicleMake) setValue('make', draft.vehicleMake);
        if (draft.vehicleModel) setValue('model', draft.vehicleModel);
        if (draft.vehicleColor) setValue('color', draft.vehicleColor);
        if (draft.transmission) setValue('transmission', draft.transmission);

        // Recipient (always enabled)
        if (draft.recipientName) setValue('recipientName', draft.recipientName);
        if (draft.recipientEmail) setValue('recipientEmail', draft.recipientEmail);
        if (draft.recipientPhone) setValue('recipientPhone', draft.recipientPhone);

        // Quote data
        if (draft.quoteId || draft.quote?.id) {
          setQuoteId(draft.quoteId || draft.quote?.id);
          setHasCalculated(true);
        }
        if (draft.quote) {
          setQuoteData({
            miles: draft.quote.distanceMiles || 0,
            total: draft.quote.estimatedAmount || draft.quote.estimatedPrice || 0,
            base: draft.quote.feesBreakdown?.baseFare || 0,
            distance: draft.quote.feesBreakdown?.distanceCharge || 0,
            insurance: draft.quote.feesBreakdown?.insuranceFee || 0,
            transaction: draft.quote.feesBreakdown?.transactionFee || 0,
          });
        }

        setIsLoadingDraft(false);

        // Reset the flag after draft loading is complete
        setTimeout(() => {
          isRestoringFromSession.current = false;
        }, 0);
      } catch (error) {
        console.error('Failed to load draft:', error);
        toast.error("Failed to load draft", {
          description: "Redirecting to drafts page...",
        });
        isRestoringFromSession.current = false;
        navigate({ to: "/dealer-drafts" });
      }
    };

    loadData();
  }, [draftId]);

  // Helper to validate placeId
  const isValidPlaceId = (placeId: string | null | undefined) => {
    // Valid Google Place IDs start with "ChIJ" or "Eh" (base64 encoded)
    const valid = placeId && (placeId.startsWith('ChIJ') || placeId.startsWith('Eh'));
    console.log('isValidPlaceId check:', placeId, '-> ', valid);
    return valid;
  };

  // Helper to reverse geocode coordinates to get placeId
  const reverseGeocodeForPlaceId = async (lat: number, lng: number): Promise<string | null> => {
    console.log('=== reverseGeocodeForPlaceId START ===');
    console.log('Coordinates:', lat, lng);
    console.log('isLoaded:', isLoaded);
    console.log('window.google?.maps:', !!window.google?.maps);

    // Wait for Google Maps to be ready (poll for up to 5 seconds)
    let attempts = 0;
    while (!window.google?.maps && attempts < 50) {
      console.log(`Waiting for Google Maps... attempt ${attempts + 1}`);
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    if (!window.google?.maps) {
      console.error('Google Maps not loaded after waiting 5 seconds');
      return null;
    }

    console.log('Google Maps ready, calling reverse geocoder...');

    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        console.log('=== Reverse Geocoder callback ===');
        console.log('Status:', status);
        console.log('Results count:', results?.length);
        if (results && results[0]) {
          console.log('First result place_id:', results[0].place_id);
        }
        if (status === "OK" && results && results[0]?.place_id) {
          console.log('SUCCESS - Got placeId:', results[0].place_id);
          resolve(results[0].place_id);
        } else {
          console.error('FAILED to reverse geocode:', status);
          resolve(null);
        }
      });
    });
  };

  // Handler for navigating to review page
  const handleGoToReview = async () => {
    console.log('=== handleGoToReview START ===');

    if (!isFormValidForSubmission) {
      toast.error("Incomplete form", {
        description: "Please complete all required fields before reviewing.",
      });
      return;
    }

    const data = watch();

    console.log('Current state:');
    console.log('  pickupPlaceId:', pickupPlaceId);
    console.log('  pickupAddress:', data.pickupAddress);
    console.log('  pickupCoords:', pickupCoords);
    console.log('  dropoffPlaceId:', dropoffPlaceId);
    console.log('  dropoffAddress:', data.dropoffAddress);
    console.log('  dropoffCoords:', dropoffCoords);

    // Ensure we have valid placeIds - use REVERSE geocoding with coordinates
    let finalPickupPlaceId = pickupPlaceId;
    let finalDropoffPlaceId = dropoffPlaceId;

    if (!isValidPlaceId(pickupPlaceId) && pickupCoords) {
      console.log('>>> Pickup placeId is INVALID, reverse geocoding with coordinates...');
      finalPickupPlaceId = await reverseGeocodeForPlaceId(pickupCoords.lat, pickupCoords.lng);
      console.log('>>> Reverse geocoded pickup placeId result:', finalPickupPlaceId);
      if (finalPickupPlaceId) {
        setPickupPlaceId(finalPickupPlaceId);
      }
    } else {
      console.log('>>> Pickup placeId is VALID or no coordinates');
    }

    if (!isValidPlaceId(dropoffPlaceId) && dropoffCoords) {
      console.log('>>> Dropoff placeId is INVALID, reverse geocoding with coordinates...');
      finalDropoffPlaceId = await reverseGeocodeForPlaceId(dropoffCoords.lat, dropoffCoords.lng);
      console.log('>>> Reverse geocoded dropoff placeId result:', finalDropoffPlaceId);
      if (finalDropoffPlaceId) {
        setDropoffPlaceId(finalDropoffPlaceId);
      }
    } else {
      console.log('>>> Dropoff placeId is VALID or no coordinates');
    }

    console.log('=== Final placeIds ===');
    console.log('  finalPickupPlaceId:', finalPickupPlaceId);
    console.log('  finalDropoffPlaceId:', finalDropoffPlaceId);

    const reviewData = {
      // Service & Route
      serviceType: data.serviceType,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      pickupLat: pickupCoords?.lat,
      pickupLng: pickupCoords?.lng,
      dropoffLat: dropoffCoords?.lat,
      dropoffLng: dropoffCoords?.lng,
      pickupPlaceId: finalPickupPlaceId,
      dropoffPlaceId: finalDropoffPlaceId,
      pickupState: pickupState,
      pickupCity: pickupCity,
      dropoffState: dropoffState,

      // Schedule
      pickupWindowStart: validatedWindows?.pickupWindowStart,
      pickupWindowEnd: validatedWindows?.pickupWindowEnd,
      dropoffWindowStart: validatedWindows?.dropoffWindowStart,
      dropoffWindowEnd: validatedWindows?.dropoffWindowEnd,
      etaMinutes: schedulePreviewData?.etaMinutes,
      customerChose: customerChose,
      bufferMinutes: schedulePreviewData?.bufferMinutes,

      // Vehicle
      licensePlate: data.licensePlate,
      vinVerification: data.vinVerification,
      make: data.make,
      makeOther: data.makeOther,
      model: data.model,
      modelOther: data.modelOther,
      color: data.color,
      colorOther: data.colorOther,
      transmission: data.transmission || "Automatic",

      // Recipient (always required)
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,

      // Quote
      quoteId: quoteId,
      miles: quoteData.miles,
      total: quoteData.total,
      base: quoteData.base,
      distance: quoteData.distance,
      insurance: quoteData.insurance,
      transaction: quoteData.transaction,

      // Payment
      paymentType: data.paymentType || "PREPAID",
      postpaidEnabled: postpaidEnabled,

      // Saved address/vehicle state
      useSavedAddresses: useSavedAddresses,
      selectedSavedAddressId: selectedSavedAddress?.id,
      useSavedVehicle: useSavedVehicle,
      selectedSavedVehicleId: selectedSavedVehicle?.id,

      // Draft
      draftId: draftId,
    };

    console.log('=== SAVING TO SESSION STORAGE ===');
    console.log('pickupPlaceId being saved:', reviewData.pickupPlaceId);
    console.log('dropoffPlaceId being saved:', reviewData.dropoffPlaceId);

    // Store in sessionStorage
    sessionStorage.setItem("reviewDeliveryData", JSON.stringify(reviewData));

    // Navigate to review page
    navigate({ to: "/dealer-review-delivery" });
  };

  // Handler for saving as draft
  const handleSaveAsDraft = async () => {
    // Minimum requirement: quote must be calculated
    if (!quoteId) {
      toast.error("Quote required", {
        description: "Please calculate a quote before saving as draft.",
      });
      return;
    }

    const data = watch();

    // Ensure we have valid placeIds - use REVERSE geocoding with coordinates
    let finalPickupPlaceId = pickupPlaceId;
    let finalDropoffPlaceId = dropoffPlaceId;

    if (!isValidPlaceId(pickupPlaceId) && pickupCoords) {
      console.log('Draft: Pickup placeId invalid, reverse geocoding...');
      finalPickupPlaceId = await reverseGeocodeForPlaceId(pickupCoords.lat, pickupCoords.lng);
      if (finalPickupPlaceId) {
        setPickupPlaceId(finalPickupPlaceId);
      }
    }

    if (!isValidPlaceId(dropoffPlaceId) && dropoffCoords) {
      console.log('Draft: Dropoff placeId invalid, reverse geocoding...');
      finalDropoffPlaceId = await reverseGeocodeForPlaceId(dropoffCoords.lat, dropoffCoords.lng);
      if (finalDropoffPlaceId) {
        setDropoffPlaceId(finalDropoffPlaceId);
      }
    }

    const payload: any = {
      customerId: customer?.profileId,
      quoteId,
      serviceType: data.serviceType,
      // Schedule (optional for draft) - use validatedWindows from new flow
      pickupWindowStart: validatedWindows?.pickupWindowStart,
      pickupWindowEnd: validatedWindows?.pickupWindowEnd,
      dropoffWindowStart: validatedWindows?.dropoffWindowStart,
      dropoffWindowEnd: validatedWindows?.dropoffWindowEnd,
      afterHours: schedulePreviewData?.afterHours || false,
      isUrgent: false,
      // Vehicle info (optional for draft)
      licensePlate: data.licensePlate || undefined,
      vinVerificationCode: data.vinVerification || undefined,
      vehicleMake: data.make === "Other" ? data.makeOther : data.make,
      vehicleModel: data.model === "Other" ? data.modelOther : data.model,
      vehicleColor: data.color === "Other" ? data.colorOther : data.color,
      transmission: data.transmission,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      // Coordinates
      pickupLat: pickupCoords?.lat,
      pickupLng: pickupCoords?.lng,
      dropoffLat: dropoffCoords?.lat,
      dropoffLng: dropoffCoords?.lng,
      pickupPlaceId: finalPickupPlaceId,
      dropoffPlaceId: finalDropoffPlaceId,
      pickupState: pickupState,
      dropoffState: dropoffState,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
    };

    console.log('Saving draft with payload:', JSON.stringify(payload, null, 2));

    // If editing existing draft, update it; otherwise create new
    if (draftId) {
      updateDraftMutation.mutate(payload);
    } else {
      saveDraftMutation.mutate(payload);
    }
  };

  // Mutation for saving pickup address
  const saveAddressMutation = useCreate(`${import.meta.env.VITE_API_URL}/api/savedAddresses`, {
    onSuccess: () => {
      toast.success("Pickup address saved for future use");
      savedAddressesQuery.refetch();
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

  // Get tomorrow's date as default pickup date
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
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
      enableRecipient: true, // Always enabled
      dealerAuthorized: false,
      status: "DRAFT",
    },
  });

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Fetch saved addresses on page load - using useQuery directly to avoid pagination params
  const savedAddressesQuery = useQuery<SavedAddress[]>({
    queryKey: ['savedAddresses', customer?.profileId],
    queryFn: async () => {
      return authFetch(
        `${import.meta.env.VITE_API_URL}/api/savedAddresses?where[customer][id]=${customer?.profileId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    },
    enabled: !!customer?.profileId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (savedAddressesQuery.data) {
      setSavedAddresses(savedAddressesQuery.data);

      // First check if we have a pending saved address to restore
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

      // Auto-select default address if exists and no address selected
      const defaultAddress = savedAddressesQuery.data.find(addr => addr.isDefault);
      if (defaultAddress && !selectedSavedAddress) {
        setSelectedSavedAddress(defaultAddress);
        setValue('pickupAddress', defaultAddress.address);
        setPickupCoords({ lat: defaultAddress.lat, lng: defaultAddress.lng });
        if (defaultAddress.state) setPickupState(defaultAddress.state);
        setUseSavedAddresses(true);
      }
    }
  }, [savedAddressesQuery.data, pendingSavedAddressId]);

  // Separate effect to handle placeId geocoding when we have a selected saved address
  useEffect(() => {
    console.log('=== Saved Address Geocoding Effect ===');
    console.log('selectedSavedAddress:', selectedSavedAddress);
    console.log('isLoaded:', isLoaded);

    if (!selectedSavedAddress || !isLoaded) {
      console.log('Effect returning early - no address or maps not loaded');
      return;
    }

    const address = selectedSavedAddress;
    const isValid = address.placeId &&
      (address.placeId.startsWith('ChIJ') || address.placeId.startsWith('Eh'));

    console.log('Saved address placeId:', address.placeId);
    console.log('Is valid placeId:', isValid);

    if (isValid) {
      console.log('Using existing valid placeId:', address.placeId);
      setPickupPlaceId(address.placeId);
    } else if (address.lat && address.lng) {
      // Use REVERSE geocoding with coordinates (not address text which might be a label)
      console.log('Using reverse geocoding with coordinates:', address.lat, address.lng);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: address.lat, lng: address.lng } }, (results, status) => {
        console.log('Reverse geocode result - status:', status);
        if (status === "OK" && results && results[0]?.place_id) {
          console.log('SUCCESS - Reverse geocoded placeId:', results[0].place_id);
          setPickupPlaceId(results[0].place_id);
        } else {
          console.warn('FAILED to reverse geocode:', status);
          setPickupPlaceId(null);
        }
      });
    } else {
      console.log('No coordinates available, cannot geocode');
      setPickupPlaceId(null);
    }
  }, [selectedSavedAddress, isLoaded]);

  // Fetch saved vehicles on page load - using useQuery directly to avoid pagination params
  const savedVehiclesQuery = useQuery<SavedVehicle[]>({
    queryKey: ['savedVehicles', customer?.profileId],
    queryFn: async () => {
      return authFetch(
        `${import.meta.env.VITE_API_URL}/api/savedVehicles?where[customer][id]=${customer?.profileId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    },
    enabled: !!customer?.profileId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (savedVehiclesQuery.data) {
      setSavedVehicles(savedVehiclesQuery.data);

      // First check if we have a pending saved vehicle to restore
      if (pendingSavedVehicleId) {
        const vehicle = savedVehiclesQuery.data.find(v => v.id === pendingSavedVehicleId);
        if (vehicle) {
          setSelectedSavedVehicle(vehicle);
          setPendingSavedVehicleId(null); // Clear pending after restoration
          return; // Don't auto-select if we're restoring
        }
      }

      // Auto-select first vehicle if exists and no vehicle selected
      if (savedVehiclesQuery.data.length > 0 && !selectedSavedVehicle) {
        const firstVehicle = savedVehiclesQuery.data[0];
        setSelectedSavedVehicle(firstVehicle);
        setValue('make', firstVehicle.make);
        setValue('model', firstVehicle.model);
        setValue('color', firstVehicle.color);
        setValue('licensePlate', firstVehicle.licensePlate);
        setUseSavedVehicle(true);
      }
    }
  }, [savedVehiclesQuery.data, pendingSavedVehicleId]);

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

  // Check if form is valid for submission
  const isFormValidForSubmission = useMemo(() => {
    // Must have quote calculated
    if (!quoteId) return false;

    // Must have coordinates
    if (!pickupCoords || !dropoffCoords) return false;

    // Must have validated schedule (new flow)
    if (!validatedWindows || !validatedWindows.pickupWindowStart || !validatedWindows.dropoffWindowStart) return false;

    // Must have vehicle details
    const finalMake = make === "Other" ? watch("makeOther") : make;
    const finalModel = model === "Other" ? watch("modelOther") : model;
    const finalColor = color === "Other" ? watch("colorOther") : color;

    if (!licensePlate || !finalMake || !finalModel || !finalColor) return false;

    // VIN verification must be 4 digits
    if (!vinVerification || !/^\d{4}$/.test(vinVerification)) return false;

    // Recipient is required - must have name, phone, and email
    if (!recipientName || recipientName.trim().length < 1) return false;
    if (!recipientPhone || recipientPhone.replace(/\D/g, '').length < 10) return false;
    if (!recipientEmail || recipientEmail.trim().length < 1) return false;

    return true;
  }, [quoteId, pickupCoords, dropoffCoords, validatedWindows, licensePlate, make, model, color, vinVerification, recipientName, recipientPhone, recipientEmail]);
  // Removed - recipient is always shown now

  // Update dealer authorized state
  useEffect(() => {
    setIsDealerAuthorized(!!dealerAuthorized);
  }, [dealerAuthorized]);

  // Reset quote and schedule when location changes
  useEffect(() => {
    // Don't reset if we're restoring from session
    if (isRestoringFromSession.current) {
      // Update refs to track current coords
      prevPickupCoordsRef.current = pickupCoords;
      prevDropoffCoordsRef.current = dropoffCoords;
      return;
    }

    // Check if coordinates actually changed (not just re-set to same values)
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

    // Update refs to current values
    prevPickupCoordsRef.current = pickupCoords;
    prevDropoffCoordsRef.current = dropoffCoords;

    // Only reset if coordinates actually changed and we have a previous quote
    if ((pickupChanged || dropoffChanged) && hasCalculated && quoteId) {
      console.log('Location actually changed, resetting quote and schedule...');
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

  // Note: Auto-check schedule useEffect removed - now using one-side-at-a-time flow

  // Helper functions - defined before use
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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
      // Reset quote data on error
      setQuoteData({ miles: 0, total: 0, base: 0, distance: 0, insurance: 0, transaction: 0 });
      setQuoteId(null);
      setHasCalculated(false);
    },
    successMessage: undefined,
  }
);

  // Auto-calculate quote when both addresses are set
  useEffect(() => {
    // Don't auto-calculate if we're restoring from session (quote already exists)
    if (isRestoringFromSession.current) {
      return;
    }
    if (pickupCoords && dropoffCoords && !hasCalculated && pickupAddress && dropoffAddress) {
      getQuotePreview.mutate({
        pickupAddress,
        dropoffAddress,
        serviceType,
        ...(customer?.profileId && { customerId: customer.profileId }),
      });
    }
  }, [pickupCoords, dropoffCoords]);

  // Mutation for schedule preview - handles both discovery and validation modes
  const getSchedulePreview = useCreate<SchedulePreviewResponse, SchedulePreviewRequest>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/schedule-preview`,
    {
      onSuccess: (data) => {
        console.log('Schedule Preview Response:', data);
        setSchedulePreviewData(data);
        setIsLoadingSlots(false);

        // Store suggested slots for dropdown
        if (data.suggestedSlots) {
          setSuggestedSlots(data.suggestedSlots);
        }

        // Only set validated windows if we actually have both window times from the API
        // This should happen after user selects a slot in validation mode
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
          // Validation mode success
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

    // Call discovery mode API
    setIsLoadingSlots(true);
    const request: SchedulePreviewRequest = {
      quoteId,
      serviceType,
      customerType: customerDataQuery.data?.customerType || 'BUSINESS',
      customerId: customer?.profileId,
      customerChose: choice,
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

    // Build validation request with the selected slot times
    const request: SchedulePreviewRequest = {
      quoteId,
      serviceType,
      customerType: customerDataQuery.data?.customerType || 'BUSINESS',
      customerId: customer?.profileId,
      customerChose,
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
      // Extract city (locality)
      const cityComp = place.address_components.find(comp =>
        comp.types.includes('locality') || comp.types.includes('sublocality')
      );
      if (cityComp) {
        setPickupCity(cityComp.long_name || cityComp.short_name);
      }
    }
  }
  }, []);

  // Handle clearing pickup address
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

  // Handle clearing dropoff address
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

  // Handle saved address selection
  const handleSavedAddressSelect = async (addressId: string) => {
    const address = savedAddresses.find(a => a.id === addressId);
    if (address) {
      setSelectedSavedAddress(address);
      setValue("pickupAddress", address.address);
      setPickupCoords({ lat: address.lat, lng: address.lng });

      // Check if placeId is a valid Google Place ID
      // Valid Google Place IDs typically start with "ChIJ" and are 20+ characters
      const isValidGooglePlaceId = address.placeId &&
        (address.placeId.startsWith('ChIJ') ||
         (address.placeId.length >= 20 && /^[A-Za-z0-9_-]+$/.test(address.placeId)));

      if (isValidGooglePlaceId) {
        setPickupPlaceId(address.placeId);
      } else {
        // Geocode the address to get a real placeId
        if (isLoaded && address.address) {
          try {
            const geocoder = new google.maps.Geocoder();
            const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: address.address }, (results, status) => {
                if (status === "OK" && results) {
                  resolve(results);
                } else {
                  reject(new Error(`Geocoding failed: ${status}`));
                }
              });
            });
            if (results[0]?.place_id) {
              console.log('Geocoded placeId for saved address:', results[0].place_id);
              setPickupPlaceId(results[0].place_id);
            } else {
              console.warn('No place_id found for address:', address.address);
              setPickupPlaceId(null);
            }
          } catch (error) {
            console.error('Geocoding error:', error);
            setPickupPlaceId(null);
          }
        } else {
          setPickupPlaceId(null);
        }
      }

      if (address.state) {
        setPickupState(address.state);
      }
      if (address.city) {
        setPickupCity(address.city);
      }
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

    // Use validated windows from schedule preview (new flow)
    const pickupStart = validatedWindows?.pickupWindowStart;
    const pickupEnd = validatedWindows?.pickupWindowEnd;
    const dropoffStart = validatedWindows?.dropoffWindowStart;
    const dropoffEnd = validatedWindows?.dropoffWindowEnd;

    return {
      quoteId: quoteId,
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
      pickupWindowStart: pickupStart,
      pickupWindowEnd: pickupEnd,
      dropoffWindowStart: dropoffStart,
      dropoffWindowEnd: dropoffEnd,
      afterHours: schedulePreviewData?.afterHours || false,
      licensePlate: data.licensePlate,
      vinVerificationCode: data.vinVerification,
      vehicleMake: finalMake,
      vehicleModel: finalModel,
      vehicleColor: finalColor,
      // specialInstructions: data.instructions,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      // paymentType: data.paymentType,
      // customerContact: {
      //   name: data.contactName,
      //   email: data.contactEmail,
      //   phone: data.contactPhone,
      // },
        isUrgent: false,
  requiresOpsConfirmation: schedulePreviewData?.requiresOpsConfirmation || false,
  sameDayEligible: schedulePreviewData?.sameDayEligible || false,
  status: "QUOTED", // Initial status - dealer must review and release to market
  customerId: customer.profileId

    };
  };

  const onSubmit = async (data: DeliveryFormData) => {
    // Validate required fields before submission
    if (!pickupCoords || !dropoffCoords) {
      toast.error("Missing location data", {
        description: "Please select valid pickup and drop-off addresses from the autocomplete suggestions.",
      });
      return;
    }

    if (!quoteId) {
      toast.error("Quote required", {
        description: "Please calculate a quote before creating the delivery request.",
      });
      return;
    }

    // Validate that schedule has been set (new flow)
    if (!validatedWindows || !validatedWindows.pickupWindowStart || !validatedWindows.dropoffWindowStart) {
      toast.error("Schedule required", {
        description: "Please select a time slot to set the schedule before creating the delivery request.",
      });
      return;
    }

    const payload = buildPayload(data);

    // Check if we're editing an existing LISTED/QUOTED delivery
    // If so, use PATCH to update (keep status) instead of POST (create new)
    if (draftId && (originalDeliveryStatus === 'LISTED' || originalDeliveryStatus === 'QUOTED')) {
      // Remove status from payload - we want to keep the existing status
      const { status, ...updatePayload } = payload;
      updateDeliveryMutation.mutate(updatePayload);
    } else {
      // Create new delivery (or replace draft with new delivery)
      createDelivery.mutate(payload);
    }
  };

  // Header component
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
            className="inline-flex items-center gap-2"
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

      {/* Loading state for draft */}
      {isLoadingDraft && (
        <div className="fixed inset-0 bg-white/80 dark:bg-slate-950/80 z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading draft...</p>
          </div>
        </div>
      )}

      {/* Release to Market Dialog */}
      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-lime-500" />
              Delivery Created Successfully
            </DialogTitle>
            <DialogDescription>
              Your delivery request has been created with status "Quoted". Would you like to release it to the marketplace now?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Releasing to the marketplace will make your delivery visible to available drivers. You'll be notified when a driver books it.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/dealer-dashboard" })}
              className="w-full sm:w-auto"
            >
              View in Dashboard
            </Button>
            <Button
              onClick={() => createdDeliveryId && releaseToMarketMutation.mutate(createdDeliveryId)}
              disabled={releaseToMarketMutation.isPending}
              className="w-full sm:w-auto bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold"
            >
              {releaseToMarketMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950 mr-2"></div>
                  Releasing...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Release to Market
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Title section */}
        <section className="flex flex-col gap-6 mb-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center">
                {draftId ? <FileText className="h-6 w-6 text-lime-600 dark:text-lime-400" /> : <Route className="h-6 w-6 text-lime-600 dark:text-lime-400" />}
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  {draftId ? 'Edit draft delivery' : 'Create delivery request'}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                  {draftId 
                    ? 'Continue editing your draft. Update addresses, schedule, and vehicle details, then submit when ready.'
                    : 'Our service is currently available in California only. Please enter CA addresses below.'}
                </p>
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-end gap-2">
              {draftId && (
                <Badge className="bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-amber-200">
                  <FileText className="h-3 w-3 mr-1" />
                  Editing Draft
                </Badge>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN - Form */}
          <div className="xl:col-span-7 space-y-8">
            {/* Step 1: Addresses & Quote */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Step 1
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Route
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Pickup Address - with saved addresses toggle */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="pickupAddress"
                      className="text-xs font-bold"
                    >
                      From Where
                    </Label>
                    {useSavedAddresses ? (
                      <Select
                        onValueChange={handleSavedAddressSelect}
                        value={selectedSavedAddress?.id || ""}
                      >
                        <SelectTrigger className="h-14 rounded-2xl w-full">
                          <SelectValue placeholder="Select saved address" />
                        </SelectTrigger>
                        <SelectContent>
                          {savedAddresses.map((addr) => (
                            <SelectItem key={addr.id} value={addr.id}>
                              {addr.label ? `${addr.label}: ${addr.address}` : addr.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <LocationAutocomplete
                        key="pickup"
                        value={pickupAddress || ""}
                        onChange={(val) => setValue("pickupAddress", val)}
                        onPlaceSelect={handlePickupSelect}
                        onClear={handlePickupClear}
                        isLoaded={isLoaded}
                        placeholder="Search Pickup (California Only)"
                        icon={<MapPin className="h-5 w-5 text-slate-400" />}
                      />
                    )}
                    {errors.pickupAddress && (
                      <p className="text-xs text-red-500">
                        {errors.pickupAddress.message}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="useSavedAddresses"
                          checked={useSavedAddresses}
                          onCheckedChange={(checked) => {
                            setUseSavedAddresses(!!checked);
                            if (!checked) {
                              // Reset to autocomplete mode
                              setSelectedSavedAddress(null);
                              setValue("pickupAddress", "");
                              setPickupCoords(null);
                              setPickupPlaceId(null);
                              setPickupState(null);
                              setPickupCity(null);
                            }
                          }}
                        />
                        <Label
                          htmlFor="useSavedAddresses"
                          className="text-xs font-bold cursor-pointer"
                        >
                          Use saved addresses
                        </Label>
                      </div>
                    </div>
                    {/* Save pickup for future - only show when user entered a NEW address (not using saved, has valid address selected) */}
                    {!useSavedAddresses && !selectedSavedAddress && pickupAddress && pickupCoords && (
                      <div className="space-y-2 p-3 rounded-xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                        <div className="text-xs font-bold text-lime-700 dark:text-lime-300 mb-2">
                          Save this address for future deliveries?
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            placeholder="Label (e.g., Main Lot, Storage Unit)"
                            value={pickupLabel}
                            onChange={(e) => setPickupLabel(e.target.value)}
                            className="h-10 rounded-xl flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!pickupLabel.trim()) {
                                toast.error("Label required", {
                                  description: "Please enter a label for this address.",
                                });
                                return;
                              }

                              // Validate and geocode placeId if needed BEFORE saving
                              let finalPlaceId = pickupPlaceId;
                              const isValidPlaceId = pickupPlaceId &&
                                (pickupPlaceId.startsWith('ChIJ') || pickupPlaceId.startsWith('Eh'));

                              if (!isValidPlaceId && pickupCoords && isLoaded) {
                                console.log('PlaceId invalid at save time, doing reverse geocoding...');
                                // Use reverse geocoding with coordinates (more reliable than address text)
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
                                    console.log('Reverse geocoded placeId at save time:', finalPlaceId);
                                    setPickupPlaceId(finalPlaceId);
                                  }
                                } catch (e) {
                                  console.warn('Reverse geocoding failed at save time:', e);
                                }
                              }

                              const addressPayload = {
                                label: pickupLabel.trim(),
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
                              };
                              console.log('=== SAVING ADDRESS ===');
                              console.log('pickupCoords:', pickupCoords);
                              console.log('finalPlaceId:', finalPlaceId);
                              saveAddressMutation.mutate(addressPayload);
                              setPickupLabel('');
                            }}
                            disabled={saveAddressMutation.isPending || !pickupLabel.trim()}
                            className="h-10"
                          >
                            {saveAddressMutation.isPending ? "Saving..." : "Save Address"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Drop-off Address - unchanged */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="dropoffAddress"
                      className="text-xs font-bold"
                    >
                      Where To
                    </Label>
                    <LocationAutocomplete
                      key="dropoff"
                      value={dropoffAddress || ""}
                      onChange={(val) => setValue("dropoffAddress", val)}
                      onPlaceSelect={handleDropoffSelect}
                      onClear={handleDropoffClear}
                      isLoaded={isLoaded}
                      placeholder="Search Destination (California Only)"
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
                            Itemized breakdown updates if addresses change.
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
                            Click "Calculate" to get a real-time quote based on the addresses.
                          </p>}


                      <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex gap-3">
                        <Info className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
                          Real-time quote updates automatically when address or service type changes.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Scheduling */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Step 2
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Schedule window
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Choose which time you want to set. The other will be calculated automatically.
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col gap-2">
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      One-side-at-a-time
                    </Badge>
                    {schedulePreviewData?.sameDayEligible && (
                      <Badge className="bg-lime-500 text-slate-900 animate-pulse">
                        ✨ Same-day eligible!
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step 1: Choose which side to set */}
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    Which time do you want to set?
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
                        <span className="text-xs text-slate-500 font-normal">Dropoff will be calculated</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-lime-500 transition-colors cursor-pointer">
                      <RadioGroupItem value="DROPOFF_WINDOW" id="dropoff-choice" />
                      <Label htmlFor="dropoff-choice" className="cursor-pointer font-medium">
                        <span className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-lime-500" />
                          I want to set dropoff time
                        </span>
                        <span className="text-xs text-slate-500 font-normal">Pickup will be calculated</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Loading state for discovery mode */}
                {isLoadingSlots && !selectedSlot && (
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    Finding available time slots...
                  </div>
                )}

                {/* Step 2: Select a time slot (only shown after user chooses side) */}
                {customerChose && !isLoadingSlots && (
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest">
                      {customerChose === "PICKUP_WINDOW" ? "Select pickup window" : "Select dropoff window"}
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
                    ) : (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        No available slots found. Please try a different option.
                      </div>
                    )}
                  </div>
                )}

                {/* Loading state for validation mode */}
                {isLoadingSlots && selectedSlot && (
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    Validating schedule...
                  </div>
                )}

                {/* Step 3: Show validated windows (after slot selection) */}
                {validatedWindows && schedulePreviewData?.feasible && !isLoadingSlots && (
                  <div className="p-5 rounded-2xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800 space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-lime-500" />
                      <span className="text-sm font-bold text-lime-700 dark:text-lime-300">Schedule Verified</span>
                    </div>
                    
                    {/* Validated windows display */}
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
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1">Dropoff Window</div>
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
                      {schedulePreviewData.sameDay?.status && (
                        <Badge variant="outline" className="text-[10px]">
                          Same-day: {schedulePreviewData.sameDay.status}
                        </Badge>
                      )}
                      {schedulePreviewData.sameDay?.warnings && schedulePreviewData.sameDay.warnings.length > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800 text-[10px]">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {schedulePreviewData.sameDay.warnings[0]}
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

                {/* Hint when no quote calculated */}
                {!quoteId && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                    <Info className="h-3 w-3 inline mr-1" />
                    Please select your Schedule Window.
                  </div>
                )}

                {/* Info box explaining the flow */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-extrabold text-slate-700 dark:text-slate-300">How it works</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Choose whether you want to set the pickup or dropoff time. Select an available slot, and we'll automatically calculate the other window based on transit time and verify feasibility.
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Step 3: Vehicle Details */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                      Step 3
                    </CardDescription>
                    <CardTitle className="text-2xl font-black mt-2">
                      Vehicle details
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Make/model/color from dropdowns; "Other" unlocks
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
                {/* Checkbox for saved vehicles */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useSavedVehicle"
                    checked={useSavedVehicle}
                    onCheckedChange={(checked) => {
                      setUseSavedVehicle(!!checked);
                      if (!checked) {
                        setSelectedSavedVehicle(null);
                        // Optionally clear fields? We'll leave them as is.
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

                {/* Extra input for saved vehicle selection */}
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

                {/* Save vehicle for future - only show when user entered NEW vehicle details (not using saved, has required fields filled) */}
                {!useSavedVehicle && !selectedSavedVehicle && make && model && color && watch('licensePlate') && (
                  <div className="p-3 rounded-xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                    <div className="text-xs font-bold text-lime-700 dark:text-lime-300 mb-2">
                      Save this vehicle for future deliveries?
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
                </div>

                {/* Make & Model */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="make" className="text-xs font-bold">
                      Make
                    </Label>
                    <Select
                      value={make}
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
                      value={model}
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

                {/* Color & Transmission */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="color" className="text-xs font-bold">
                      Color <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={color}
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

                  <div className="space-y-2">
                    <Label htmlFor="transmission" className="text-xs font-bold">
                      Transmission
                    </Label>
                    <Select
                      value={transmission}
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
              </CardContent>
            </Card>

            {/* Step 4: Instructions */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div>
                  <CardDescription className="text-[11px] font-black uppercase tracking-widest">
                    Step 4
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
                  Same as saved business contact
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
                      <Label
                        htmlFor="recipientName"
                        className="text-xs font-bold"
                      >
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
                      <Label
                        htmlFor="recipientEmail"
                        className="text-xs font-bold"
                      >
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
                    <Label
                      htmlFor="recipientPhone"
                      className="text-xs font-bold"
                    >
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
                    Tracking links are access-controlled and should expire
                    after completion.
                  </p>
                </div>
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
                    {draftId && (originalDeliveryStatus === 'LISTED' || originalDeliveryStatus === 'QUOTED') 
                      ? 'Update Delivery' 
                      : draftId 
                        ? 'Review & Submit Draft' 
                        : 'Review & Create'}
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {draftId && (originalDeliveryStatus === 'LISTED' || originalDeliveryStatus === 'QUOTED')
                      ? 'Your changes will update the existing delivery while keeping its current status.'
                      : 'Review all details before submitting. You\'ll see a complete summary of your delivery request.'}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  className="w-full py-6 rounded-2xl bg-lime-500 hover:bg-lime-600 text-slate-950 font-extrabold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleGoToReview}
                  disabled={createDelivery.isPending || updateDeliveryMutation.isPending || !isFormValidForSubmission}
                >
                  {(createDelivery.isPending || updateDeliveryMutation.isPending) ? (
                    <>
                      {updateDeliveryMutation.isPending ? 'Updating...' : 'Creating...'}
                      <RefreshCw className="ml-2 h-5 w-5 animate-spin" />
                    </>
                  ) : (
                    <>
                      {draftId && (originalDeliveryStatus === 'LISTED' || originalDeliveryStatus === 'QUOTED') 
                        ? 'Update Delivery' 
                        : 'Review & Continue'}
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                {!isFormValidForSubmission && !createDelivery.isPending && !updateDeliveryMutation.isPending && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 text-center">
                    Please complete all required fields: addresses, schedule window, vehicle details, and recipient info.
                  </p>
                )}

                {/* Save as Draft button - shown after quote is calculated */}
                {hasCalculated && (
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full py-4 rounded-2xl font-extrabold"
                      onClick={handleSaveAsDraft}
                      disabled={saveDraftMutation.isPending || updateDraftMutation.isPending}
                    >
                      {(saveDraftMutation.isPending || updateDraftMutation.isPending) ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          {draftId ? 'Updating Draft...' : 'Saving Draft...'}
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          {draftId ? 'Update Draft' : 'Save as Draft'}
                        </>
                      )}
                    </Button>
                    <p className="text-[11px] text-slate-500 mt-2 text-center">
                      {draftId 
                        ? 'Save your changes to this draft. You can continue editing later.'
                        : 'Save your progress and continue later. Drafts are stored in the Drafts folder.'}
                    </p>
                  </div>
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

                <p className="text-[11px] text-slate-500 mt-4 text-center">
                  Compliance evidence (VIN verification, photos, odometer,
                  Start/Stop tracking) is captured by driver during delivery.
                </p>
              </CardContent>
            </Card>

            {/* Need Help */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-black">Need help?</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Having trouble creating a delivery? Our support team is here to help.
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
      </main>

      <Footer />
    </div>
  );
}