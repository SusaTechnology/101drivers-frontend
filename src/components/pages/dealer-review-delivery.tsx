// app/pages/dealer/review-delivery.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from "@/lib/google-maps-config";
import {
  Card,
  CardContent,
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
  Info,
  AlertCircle,
  ChevronRight,
  Home,
  Shuffle as SwapHorizontal,
  Wrench,
  Route,
  CheckCircle,
  Edit2,
  X,
  FileText,
} from "lucide-react";
import { getUser, authFetch } from "@/lib/tanstack/dataQuery";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

// Types for review data
interface ReviewDeliveryData {
  // Service & Route
  serviceType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupPlaceId?: string;
  dropoffPlaceId?: string;
  pickupState?: string;
  pickupCity?: string;
  dropoffState?: string;

  // Schedule
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  dropoffWindowStart?: string;
  dropoffWindowEnd?: string;
  etaMinutes?: number;
  customerChose?: "PICKUP_WINDOW" | "DROPOFF_WINDOW";
  bufferMinutes?: number;

  // Vehicle
  licensePlate: string;
  vinVerification: string;
  make: string;
  makeOther?: string;
  model: string;
  modelOther?: string;
  color: string;
  colorOther?: string;
  transmission: string;

  // Recipient
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;

  // Quote
  quoteId?: string;
  miles?: number;
  total?: number;
  base?: number;
  distance?: number;
  insurance?: number;
  transaction?: number;

  // Payment
  paymentType?: string;
  postpaidEnabled?: boolean;

  // Saved address/vehicle state
  useSavedAddresses?: boolean;
  selectedSavedAddressId?: string;
  useSavedVehicle?: boolean;
  selectedSavedVehicleId?: string;

  // Draft
  draftId?: string;
}

const formatTimeRange = (startIso?: string, endIso?: string) => {
  if (!startIso || !endIso) return "Not set";
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

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

const serviceTypeLabels: Record<string, string> = {
  HOME_DELIVERY: "Car Transfer",
  BETWEEN_LOCATIONS: "Car Transfer",
  SERVICE_PICKUP_RETURN: "Car Transfer",
};

export default function ReviewDeliveryPage() {
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<ReviewDeliveryData | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<ReviewDeliveryData>>({});
  const customer = getUser();

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Helper to validate placeId
  const isValidPlaceId = (placeId: string | null | undefined) =>
    placeId && (placeId.startsWith('ChIJ') || placeId.startsWith('Eh'));

  // Helper to reverse geocode coordinates to get placeId
  const reverseGeocodeForPlaceId = async (lat: number, lng: number): Promise<string | null> => {
    // Wait for Google Maps to be ready
    let attempts = 0;
    while (!window.google?.maps && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    if (!window.google?.maps) {
      console.error('Google Maps not loaded');
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]?.place_id) {
          console.log('Reverse geocoded placeId for', lat, lng, ':', results[0].place_id);
          resolve(results[0].place_id);
        } else {
          console.warn('Failed to reverse geocode:', lat, lng, status);
          resolve(null);
        }
      });
    });
  };

  // Load review data from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("reviewDeliveryData");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setReviewData(data);
        setEditedValues({});
      } catch (e) {
        console.error("Failed to parse review data:", e);
        toast.error("Failed to load delivery data");
        navigate({ to: "/dealer-create-delivery" });
      }
    } else {
      toast.error("No delivery data found");
      navigate({ to: "/dealer-create-delivery" });
    }
  }, [navigate]);

  // Mutation for creating and releasing delivery
  const createAndReleaseDelivery = useMutation({
    mutationFn: async () => {
      if (!reviewData) throw new Error('No review data');

      const finalMake = reviewData.make === "Other" ? reviewData.makeOther : reviewData.make;
      const finalModel = reviewData.model === "Other" ? reviewData.modelOther : reviewData.model;
      const finalColor = reviewData.color === "Other" ? reviewData.colorOther : reviewData.color;

      // Geocode placeIds if they're invalid - use REVERSE geocoding with coordinates
      let finalPickupPlaceId = reviewData.pickupPlaceId;
      let finalDropoffPlaceId = reviewData.dropoffPlaceId;

      console.log('Review page - pickupPlaceId:', reviewData.pickupPlaceId, 'isValid:', isValidPlaceId(reviewData.pickupPlaceId));
      console.log('Review page - pickupLat:', reviewData.pickupLat, 'pickupLng:', reviewData.pickupLng);

      if (!isValidPlaceId(reviewData.pickupPlaceId) && reviewData.pickupLat && reviewData.pickupLng) {
        console.log('Pickup placeId invalid, reverse geocoding with coordinates...');
        finalPickupPlaceId = await reverseGeocodeForPlaceId(reviewData.pickupLat, reviewData.pickupLng);
        console.log('Reverse geocoded pickup placeId:', finalPickupPlaceId);
      }

      if (!isValidPlaceId(reviewData.dropoffPlaceId) && reviewData.dropoffLat && reviewData.dropoffLng) {
        console.log('Dropoff placeId invalid, reverse geocoding with coordinates...');
        finalDropoffPlaceId = await reverseGeocodeForPlaceId(reviewData.dropoffLat, reviewData.dropoffLng);
        console.log('Reverse geocoded dropoff placeId:', finalDropoffPlaceId);
      }

      const payload = {
        quoteId: reviewData.quoteId,
        customerId: customer?.profileId,
        serviceType: reviewData.serviceType,
        pickupAddress: reviewData.pickupAddress,
        pickupLat: reviewData.pickupLat,
        pickupLng: reviewData.pickupLng,
        pickupPlaceId: finalPickupPlaceId,
        pickupState: reviewData.pickupState,
        dropoffAddress: reviewData.dropoffAddress,
        dropoffLat: reviewData.dropoffLat,
        dropoffLng: reviewData.dropoffLng,
        dropoffPlaceId: finalDropoffPlaceId,
        dropoffState: reviewData.dropoffState,
        pickupWindowStart: reviewData.pickupWindowStart,
        pickupWindowEnd: reviewData.pickupWindowEnd,
        dropoffWindowStart: reviewData.dropoffWindowStart,
        dropoffWindowEnd: reviewData.dropoffWindowEnd,
        licensePlate: reviewData.licensePlate,
        vinVerificationCode: reviewData.vinVerification,
        vehicleMake: finalMake,
        vehicleModel: finalModel,
        vehicleColor: finalColor,
        transmission: reviewData.transmission,
        recipientName: reviewData.recipientName,
        recipientEmail: reviewData.recipientEmail,
        recipientPhone: reviewData.recipientPhone,
        paymentType: reviewData.paymentType,
      };

      console.log('Submitting payload:', JSON.stringify(payload, null, 2));

      // Step 1: Create the delivery
      const delivery = await authFetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests/create-from-quote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const deliveryId = delivery?.id || delivery?.deliveryRequest?.id;

      // Step 2: Delete draft if editing one
      if (reviewData.draftId) {
        try {
          await authFetch(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${reviewData.draftId}`, {
            method: 'DELETE',
          });
        } catch (e) {
          console.error('Failed to delete draft after submission:', e);
        }
      }

      // Step 3: Release to marketplace
      if (deliveryId) {
        await authFetch(
          `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/release-to-marketplace`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return delivery;
    },
    onSuccess: () => {
      // Clear session storage
      sessionStorage.removeItem("reviewDeliveryData");
      
      toast.success("Delivery submitted & released!", {
        description: "Your delivery is now visible to drivers. You will be notified when a driver books it."
      });
      
      navigate({ to: "/dealer-dashboard" });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to create delivery";
      const errorDetails = error?.response?.data?.details || error?.details;
      toast.error("Failed to submit delivery", {
        description: errorDetails || errorMessage,
      });
      console.error("Delivery creation failed:", error);
    },
  });

  const handleEditField = (field: string) => {
    setEditField(field);
    setEditedValues({});
  };

  const handleCancelEdit = () => {
    setEditField(null);
    setEditedValues({});
  };

  const handleSaveEdit = () => {
    if (!reviewData) return;

    const updatedData = { ...reviewData, ...editedValues };
    setReviewData(updatedData);
    sessionStorage.setItem("reviewDeliveryData", JSON.stringify(updatedData));
    setEditField(null);
    setEditedValues({});
    toast.success("Field updated");
  };

  const handleSubmit = () => {
    createAndReleaseDelivery.mutate();
  };

  const handleGoBack = () => {
    // Save data back to session storage so user can continue editing
    if (reviewData) {
      sessionStorage.setItem("reviewDeliveryData", JSON.stringify(reviewData));
    }
    navigate({ to: "/dealer-create-delivery", search: { draftId: reviewData?.draftId } });
  };

  // Mutation for saving as draft
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!reviewData) throw new Error('No review data');

      const finalMake = reviewData.make === "Other" ? reviewData.makeOther : reviewData.make;
      const finalModel = reviewData.model === "Other" ? reviewData.modelOther : reviewData.model;
      const finalColor = reviewData.color === "Other" ? reviewData.colorOther : reviewData.color;

      // Geocode placeIds if they're invalid - use REVERSE geocoding with coordinates
      let finalPickupPlaceId = reviewData.pickupPlaceId;
      let finalDropoffPlaceId = reviewData.dropoffPlaceId;

      if (!isValidPlaceId(reviewData.pickupPlaceId) && reviewData.pickupLat && reviewData.pickupLng) {
        finalPickupPlaceId = await reverseGeocodeForPlaceId(reviewData.pickupLat, reviewData.pickupLng);
      }

      if (!isValidPlaceId(reviewData.dropoffPlaceId) && reviewData.dropoffLat && reviewData.dropoffLng) {
        finalDropoffPlaceId = await reverseGeocodeForPlaceId(reviewData.dropoffLat, reviewData.dropoffLng);
      }

      const payload = {
        customerId: customer?.profileId,
        quoteId: reviewData.quoteId,
        serviceType: reviewData.serviceType,
        pickupAddress: reviewData.pickupAddress,
        pickupLat: reviewData.pickupLat,
        pickupLng: reviewData.pickupLng,
        pickupPlaceId: finalPickupPlaceId,
        pickupState: reviewData.pickupState,
        dropoffAddress: reviewData.dropoffAddress,
        dropoffLat: reviewData.dropoffLat,
        dropoffLng: reviewData.dropoffLng,
        dropoffPlaceId: finalDropoffPlaceId,
        dropoffState: reviewData.dropoffState,
        pickupWindowStart: reviewData.pickupWindowStart,
        pickupWindowEnd: reviewData.pickupWindowEnd,
        dropoffWindowStart: reviewData.dropoffWindowStart,
        dropoffWindowEnd: reviewData.dropoffWindowEnd,
        afterHours: false,
        isUrgent: false,
        licensePlate: reviewData.licensePlate,
        vinVerificationCode: reviewData.vinVerification,
        vehicleMake: finalMake,
        vehicleModel: finalModel,
        vehicleColor: finalColor,
        transmission: reviewData.transmission,
        recipientName: reviewData.recipientName,
        recipientEmail: reviewData.recipientEmail,
        recipientPhone: reviewData.recipientPhone,
        paymentType: reviewData.paymentType,
      };

      // If editing existing draft, update it; otherwise create new
      if (reviewData.draftId) {
        return authFetch(
          `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${reviewData.draftId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
      } else {
        return authFetch(
          `${import.meta.env.VITE_API_URL}/api/deliveryRequests/create-draft-from-quote`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
      }
    },
    onSuccess: () => {
      // Clear session storage
      sessionStorage.removeItem("reviewDeliveryData");
      
      toast.success("Draft saved successfully", {
        description: "You can continue editing this draft later from the Drafts page.",
      });
      
      navigate({ to: "/dealer-drafts" });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to save draft";
      const errorDetails = error?.response?.data?.details || error?.details;
      toast.error("Failed to save draft", {
        description: errorDetails || errorMessage,
      });
      console.error("Draft save failed:", error);
    },
  });

  const handleSaveAsDraft = () => {
    saveDraftMutation.mutate();
  };

  if (!reviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              className="w-10 h-10 rounded-2xl"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="leading-tight">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
                Review
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Delivery Request
              </div>
            </div>
          </div>
          <Badge variant="outline" className="bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-900/30 text-lime-700 dark:text-lime-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ready to submit
          </Badge>
        </div>
      </header>

      <main className="w-full max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-8">
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center flex-shrink-0">
                  <Route className="h-7 w-7 text-lime-600 dark:text-lime-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                    Review Your Delivery Request
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Please review all details below. Click "Edit" on any section to make changes, then submit when ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Transport */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black">Vehicle Transport</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                101 Drivers will transport your vehicle in Southern California.
              </p>
            </CardContent>
          </Card>

          {/* Route */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Route</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <MapPin className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-500">From</p>
                    <p className="text-sm font-bold">{reviewData.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <Flag className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-500">To</p>
                    <p className="text-sm font-bold">{reviewData.dropoffAddress}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-500">Pickup Time</p>
                  <p className="text-sm font-bold">{formatTimeRange(reviewData.pickupWindowStart, reviewData.pickupWindowEnd)}</p>
                  {reviewData.pickupWindowStart && (
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(reviewData.pickupWindowStart).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-500">Arrival Time</p>
                  <p className="text-sm font-bold">{formatTimeRange(reviewData.dropoffWindowStart, reviewData.dropoffWindowEnd)}</p>
                  {reviewData.dropoffWindowStart && (
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(reviewData.dropoffWindowStart).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {reviewData.etaMinutes && (
                <p className="text-xs text-slate-500 mt-3">
                  Estimated trip duration: {formatDuration(reviewData.etaMinutes)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Vehicle Details */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black">Vehicle</CardTitle>
                {editField !== "vehicle" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditField("vehicle");
                      setEditedValues({
                        make: reviewData.make,
                        model: reviewData.model,
                        color: reviewData.color,
                        transmission: reviewData.transmission,
                        licensePlate: reviewData.licensePlate,
                        vinVerification: reviewData.vinVerification,
                      });
                    }}
                    className="text-lime-600 hover:text-lime-700"
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editField === "vehicle" ? (
                <div className="space-y-5 p-5 bg-lime-50 dark:bg-lime-900/10 rounded-2xl border border-lime-200 dark:border-lime-900/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Make</Label>
                      <Select
                        value={editedValues.make ?? reviewData.make}
                        onValueChange={(value) => setEditedValues({ ...editedValues, make: value, makeOther: value === "Other" ? "" : undefined })}
                      >
                        <SelectTrigger className="h-14 rounded-2xl">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Toyota">Toyota</SelectItem>
                          <SelectItem value="Honda">Honda</SelectItem>
                          <SelectItem value="Ford">Ford</SelectItem>
                          <SelectItem value="Chevrolet">Chevrolet</SelectItem>
                          <SelectItem value="BMW">BMW</SelectItem>
                          <SelectItem value="Mercedes">Mercedes</SelectItem>
                          <SelectItem value="Tesla">Tesla</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {(editedValues.make ?? reviewData.make) === "Other" && (
                        <Input
                          value={editedValues.makeOther ?? reviewData.makeOther ?? ""}
                          onChange={(e) => setEditedValues({ ...editedValues, makeOther: e.target.value })}
                          className="h-14 rounded-2xl"
                          placeholder="Enter make"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Model</Label>
                      <Select
                        value={editedValues.model ?? reviewData.model}
                        onValueChange={(value) => setEditedValues({ ...editedValues, model: value, modelOther: value === "Other" ? "" : undefined })}
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
                      {(editedValues.model ?? reviewData.model) === "Other" && (
                        <Input
                          value={editedValues.modelOther ?? reviewData.modelOther ?? ""}
                          onChange={(e) => setEditedValues({ ...editedValues, modelOther: e.target.value })}
                          className="h-14 rounded-2xl"
                          placeholder="Enter model"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Color</Label>
                      <Select
                        value={editedValues.color ?? reviewData.color}
                        onValueChange={(value) => setEditedValues({ ...editedValues, color: value, colorOther: value === "Other" ? "" : undefined })}
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
                      {(editedValues.color ?? reviewData.color) === "Other" && (
                        <Input
                          value={editedValues.colorOther ?? reviewData.colorOther ?? ""}
                          onChange={(e) => setEditedValues({ ...editedValues, colorOther: e.target.value })}
                          className="h-14 rounded-2xl"
                          placeholder="Enter color"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Transmission</Label>
                      <Select
                        value={editedValues.transmission ?? reviewData.transmission}
                        onValueChange={(value) => setEditedValues({ ...editedValues, transmission: value })}
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
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">License Plate</Label>
                      <Input
                        value={editedValues.licensePlate ?? reviewData.licensePlate}
                        onChange={(e) => setEditedValues({ ...editedValues, licensePlate: e.target.value })}
                        className="h-14 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">VIN Code (4 digits)</Label>
                      <Input
                        value={editedValues.vinVerification ?? reviewData.vinVerification}
                        onChange={(e) => setEditedValues({ ...editedValues, vinVerification: e.target.value })}
                        maxLength={4}
                        className="h-14 rounded-2xl"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={handleCancelEdit} className="h-11 px-5 rounded-xl">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit} className="h-11 px-5 rounded-xl bg-lime-500 hover:bg-lime-600 text-slate-950 font-bold">
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500">Make</p>
                      <p className="text-sm font-bold">{reviewData.make === "Other" ? reviewData.makeOther : reviewData.make}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Model</p>
                      <p className="text-sm font-bold">{reviewData.model === "Other" ? reviewData.modelOther : reviewData.model}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Color</p>
                      <p className="text-sm font-bold">{reviewData.color === "Other" ? reviewData.colorOther : reviewData.color}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Transmission</p>
                      <p className="text-sm font-bold">{reviewData.transmission || "Automatic"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">License Plate</p>
                      <p className="text-sm font-bold">{reviewData.licensePlate}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">VIN Code</p>
                      <p className="text-sm font-bold font-mono">{reviewData.vinVerification}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipient */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black">Recipient</CardTitle>
                  {editField !== "recipient" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditField("recipient");
                        setEditedValues({
                          recipientName: reviewData.recipientName,
                          recipientEmail: reviewData.recipientEmail,
                          recipientPhone: reviewData.recipientPhone,
                        });
                      }}
                      className="text-lime-600 hover:text-lime-700"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editField === "recipient" ? (
                  <div className="space-y-5 p-5 bg-lime-50 dark:bg-lime-900/10 rounded-2xl border border-lime-200 dark:border-lime-900/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Name <span className="text-red-500">*</span></Label>
                        <Input
                          value={editedValues.recipientName ?? reviewData.recipientName ?? ""}
                          onChange={(e) => setEditedValues({ ...editedValues, recipientName: e.target.value })}
                          className="h-14 rounded-2xl"
                          placeholder="Recipient name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Phone <span className="text-red-500">*</span></Label>
                        <Input
                          value={editedValues.recipientPhone ?? reviewData.recipientPhone ?? ""}
                          onChange={(e) => setEditedValues({ ...editedValues, recipientPhone: formatUSPhone(e.target.value) })}
                          className="h-14 rounded-2xl"
                          placeholder="(555) 123-4567"
                          type="tel"
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <Label className="text-xs font-bold">Email <span className="text-red-500">*</span></Label>
                        <Input
                          value={editedValues.recipientEmail ?? reviewData.recipientEmail ?? ""}
                          onChange={(e) => setEditedValues({ ...editedValues, recipientEmail: e.target.value })}
                          className="h-14 rounded-2xl"
                          placeholder="recipient@example.com"
                          type="email"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={handleCancelEdit} className="h-11 px-5 rounded-xl">
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button onClick={handleSaveEdit} className="h-11 px-5 rounded-xl bg-lime-500 hover:bg-lime-600 text-slate-950 font-bold">
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-900/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Phone className="h-4 w-4 text-lime-600" />
                      <span className="text-xs font-bold text-lime-700 dark:text-lime-400">Driver will contact recipient</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-500">Name</p>
                        <p className="text-sm font-bold">{reviewData.recipientName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500">Phone</p>
                        <p className="text-sm font-bold">{reviewData.recipientPhone}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-bold text-slate-500">Email</p>
                        <p className="text-sm font-bold">{reviewData.recipientEmail || "Not provided"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Price Estimate */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Price Estimate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-500">Distance</p>
                    <p className="text-sm font-bold">{reviewData.miles} miles</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">Estimated Total</p>
                    <p className="text-2xl font-black text-lime-600">{formatCurrency(reviewData.total)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>Base fare:</span><span>{formatCurrency(reviewData.base)}</span></div>
                  <div className="flex justify-between"><span>Distance charge:</span><span>{formatCurrency(reviewData.distance)}</span></div>
                  <div className="flex justify-between"><span>Insurance fee:</span><span>{formatCurrency(reviewData.insurance)}</span></div>
                  <div className="flex justify-between"><span>Transaction fee:</span><span>{formatCurrency(reviewData.transaction)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-bold">
                    {reviewData.postpaidEnabled && reviewData.paymentType === "POSTPAID" ? "Postpaid (Credit)" : "Prepaid"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {reviewData.postpaidEnabled && reviewData.paymentType === "POSTPAID"
                      ? "Billed to your account after delivery completion"
                      : "Card authorized at booking, charged on completion"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Section */}
          <Card className="border-lime-200 dark:border-lime-900/30 shadow-lg bg-lime-50 dark:bg-lime-900/10">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                {/* Primary actions row */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 py-4 rounded-2xl font-bold"
                    onClick={handleGoBack}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back & Edit
                  </Button>
                  <Button
                    className="flex-1 py-4 rounded-2xl bg-lime-500 hover:bg-lime-600 text-slate-950 font-bold text-lg"
                    onClick={handleSubmit}
                    disabled={createAndReleaseDelivery.isPending}
                  >
                    {createAndReleaseDelivery.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit & Release to Market
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Save as Draft button */}
                <Button
                  variant="outline"
                  className="w-full py-3 rounded-2xl font-bold border-slate-300 dark:border-slate-700"
                  onClick={handleSaveAsDraft}
                  disabled={saveDraftMutation.isPending}
                >
                  {saveDraftMutation.isPending ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Saving Draft...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      {reviewData.draftId ? 'Update Draft' : 'Save as Draft'}
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-500 text-center">
                  {reviewData.draftId 
                    ? 'Save your changes to this draft. You can continue editing later.'
                    : 'Save your progress and continue later from the Drafts page.'}
                </p>
              </div>
              <p className="text-xs text-slate-500 text-center mt-4">
                By submitting, you agree to the terms of service. Your delivery will be listed for drivers to book.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
