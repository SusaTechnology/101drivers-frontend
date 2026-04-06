//@ts-nocheck
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Menu,
  X,
  Verified,
  Mail,
  Bolt,
  Target,
  Flag,
  Ruler,
  Map,
  Navigation,
  Phone,
  Store,
  User,
  LogIn,
  Home,
  Shield,
  Camera,
  Gauge,
  FileText,
  CheckCircle,
  AlertTriangle,
  Settings,
  QrCode,
  Truck,
  Package,
  Users,
  Award,
  Lock,
  Info,
  ChevronRight,
  MapPinned,
  Car,
  Building,
  Briefcase,
  KeyRound,
  CreditCard,
  Sparkles,
  Download,
  Send,
  Loader2,
  Check,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavBar } from "../shared/layout/navbar";
import { DealerSignupForm } from "../auth/DealerSignupForm";
import RouteMap from '@/components/map/RouteMap';
import LocationAutocomplete from "../map/LocationAutocomplete";
import { useJsApiLoader } from "@react-google-maps/api";
import { useCreate, useDataQuery } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";
import { usePickupZones } from "@/hooks/usePickupZones";
import { isInPickupZone } from "@/lib/geo-utils";

// Types for landing page settings
interface LandingPageSettings {
  fundraisingEnabled: boolean;
  dealerLeadEnabled: boolean;
  investorLeadEnabled: boolean;
  investorDeckTitle: string | null;
  investorDeckUrl: string | null;
  dealerLeadCtaTitle: string | null;
  dealerLeadCtaDescription: string | null;
  investorLeadCtaTitle: string | null;
  investorLeadCtaDescription: string | null;
}

// Types for lead submissions
interface DealerLeadForm {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  message: string;
}

interface InvestorLeadForm {
  name: string;
  email: string;
  message: string;
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [quoteResult, setQuoteResult] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // Rate limit quote calculations to 2 per session
  const QUOTE_MAX_ATTEMPTS = 2;
  const [quoteAttempts, setQuoteAttempts] = useState<number>(() => {
    const stored = sessionStorage.getItem("quoteAttempts");
    return stored ? parseInt(stored, 10) : 0;
  });
  const quoteLimitReached = quoteAttempts >= QUOTE_MAX_ATTEMPTS;

  // Error states for validation
  const [pickupError, setPickupError] = useState("");
  const [dropoffError, setDropoffError] = useState("");

  // Pickup zone check state (null = not checked yet)
  const [pickupInZone, setPickupInZone] = useState<boolean | null>(null);

  // Lead form states
  const [dealerLeadForm, setDealerLeadForm] = useState<DealerLeadForm>({
    businessName: '',
    contactName: '',
    phone: '',
    email: '',
    message: '',
  });
  const [dealerPhoneDisplay, setDealerPhoneDisplay] = useState('');

  // Format phone to (555) 555-5555
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleDealerPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits immediately
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setDealerLeadForm({ ...dealerLeadForm, phone: raw });
    setDealerPhoneDisplay(formatPhoneNumber(raw));
  };
  const [investorLeadForm, setInvestorLeadForm] = useState<InvestorLeadForm>({
    name: '',
    email: '',
    message: '',
  });
  const [dealerLeadSuccess, setDealerLeadSuccess] = useState(false);
  const [investorLeadSuccess, setInvestorLeadSuccess] = useState(false);

  // Fetch pickup zones (public endpoint)
  const { zones } = usePickupZones();

  // Fetch landing page settings (public endpoint, no auth)
  const { data: settings, isLoading: settingsLoading, isError: settingsError, error: settingsErrorMsg } = useDataQuery<LandingPageSettings>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/appSettings/public/landing-page`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
  });

  // Debug: log settings
  useEffect(() => {
    console.log('Landing page settings:', settings);
    if (settingsError) {
      console.error('Settings fetch error:', settingsErrorMsg);
    }
  }, [settings, settingsError, settingsErrorMsg]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places'], 
  });

  const getQuote = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/individual/quote-preview`, {
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data) => {
      setQuoteResult(data);
      setIsLoadingQuote(false);
      // Increment attempt counter
      const newCount = quoteAttempts + 1;
      setQuoteAttempts(newCount);
      sessionStorage.setItem("quoteAttempts", String(newCount));
      setDistance(data.distanceMiles);
      if (data.pickupLat && data.pickupLng) {
        setPickupCoords({ lat: data.pickupLat, lng: data.pickupLng });
      }
      if (data.dropoffLat && data.dropoffLng) {
        setDropoffCoords({ lat: data.dropoffLat, lng: data.dropoffLng });
      }
    },
    onError: (error) => {
      console.error("Failed to get quote:", error);
      setIsLoadingQuote(false);
    },
  });

  const handlePickupSelect = useCallback((place: google.maps.places.PlaceResult) => {
    setPickupError("");
    setPickupInZone(null);
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const address = place.formatted_address || '';

      // Immediately check if pickup is inside a service zone
      if (zones.length > 0) {
        const { inZone } = isInPickupZone(lat, lng, zones);
        if (!inZone) {
          // Reject out-of-zone pickup immediately
          setPickupAddress("");
          setPickupCoords(null);
          setPickupInZone(false);
          setPickupError("This address is outside our Westside pickup zone.");
          setDropoffAddress("");
          setDropoffCoords(null);
          setQuoteResult(null);
          setDistance(null);
          toast.error("Outside service area", {
            description: "Pickup must be in our Westside LA zone. See the green area on the map.",
          });
          return;
        }
      }

      setPickupCoords({ lat, lng });
      setPickupAddress(address);
      setPickupInZone(true);
      console.log('Pickup address set:', address, 'Coords:', { lat, lng });
    }
  }, [zones]);

  const handleDropoffSelect = useCallback((place: google.maps.places.PlaceResult) => {
    setDropoffError("");
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setDropoffCoords({ lat, lng });
      const address = place.formatted_address || '';
      setDropoffAddress(address);
      console.log('Dropoff address set:', address, 'Coords:', { lat, lng });
    }
  }, []);

  // Handle clearing pickup address
  const handlePickupClear = useCallback(() => {
    setPickupAddress("");
    setPickupCoords(null);
    setPickupError("");
    setDistance(null);
    setQuoteResult(null);
    setPickupInZone(null);
  }, []);

  // Handle clearing dropoff address
  const handleDropoffClear = useCallback(() => {
    setDropoffAddress("");
    setDropoffCoords(null);
    setDropoffError("");
    setDistance(null);
    setQuoteResult(null);
    setPickupInZone(null);
  }, []);

  // Double-check zone after quote result (server-side validation)
  useEffect(() => {
    if (quoteResult && pickupCoords && zones.length > 0) {
      const { inZone } = isInPickupZone(pickupCoords.lat, pickupCoords.lng, zones);
      setPickupInZone(inZone);
    }
  }, [quoteResult, pickupCoords, zones]);

  const calculateDistance = () => {
    if (!pickupCoords || !dropoffCoords) return;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: pickupCoords,
        destination: dropoffCoords,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          const distanceInMeters = result.routes[0].legs[0].distance?.value;
          if (distanceInMeters) {
            const miles = distanceInMeters * 0.000621371;
            setDistance(Math.round(miles));
          }
        }
      }
    );
  };

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      calculateDistance();
    }
  }, [pickupCoords, dropoffCoords]);

  // Fire estimate automatically once both addresses are confirmed
  const handleCalculateEstimate = useCallback(() => {
    if (quoteLimitReached) {
      toast.error("Quote limit reached", {
        description: `You've used all ${QUOTE_MAX_ATTEMPTS} free quote calculations. Please sign up for a dealer account to get unlimited quotes.`,
      });
      return;
    }
    if (!pickupAddress || !dropoffAddress) {
      if (!pickupAddress) setPickupError("From address is required");
      if (!dropoffAddress) setDropoffError("To address is required");
      return;
    }
    // Block if pickup is already confirmed out of zone
    if (pickupInZone === false) {
      setPickupError("This address is outside our Westside pickup zone.");
      return;
    }
    // Clear any previous errors
    setPickupError("");
    setDropoffError("");
    setIsLoadingQuote(true);
    getQuote.mutate({
      pickupAddress,
      dropoffAddress,
    });
  }, [pickupAddress, dropoffAddress, pickupInZone, quoteLimitReached, getQuote]);

  // Auto-trigger estimate as soon as both addresses are set and pickup is in zone
  useEffect(() => {
    if (pickupAddress && dropoffAddress && pickupInZone === true && !quoteLimitReached && !isLoadingQuote) {
      handleCalculateEstimate();
    }
  }, [pickupAddress, dropoffAddress, pickupInZone, handleCalculateEstimate, quoteLimitReached, isLoadingQuote]);

  // Dealer lead submission
  const submitDealerLead = useCreate(`${import.meta.env.VITE_API_URL}/api/dealerLeads/public`, {
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: () => {
      setDealerLeadSuccess(true);
      setDealerLeadForm({ businessName: '', contactName: '', email: '', phone: '', message: '' });
      setDealerPhoneDisplay('');
      toast.success('Thank you! We\'ll be in touch soon.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit. Please try again.');
    },
  });

  // Investor lead submission
  const submitInvestorLead = useCreate(`${import.meta.env.VITE_API_URL}/api/investorLeads/public`, {
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: () => {
      setInvestorLeadSuccess(true);
      setInvestorLeadForm({ name: '', email: '', message: '' });
      toast.success('Thank you for your interest! We\'ll be in touch.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit. Please try again.');
    },
  });

  const handleDealerLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealerLeadForm.businessName || !dealerLeadForm.email) {
      toast.error('Business name and email are required');
      return;
    }
    submitDealerLead.mutate(dealerLeadForm);
  };

  const handleInvestorLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorLeadForm.name || !investorLeadForm.email) {
      toast.error('Name and email are required');
      return;
    }
    submitInvestorLead.mutate(investorLeadForm);
  };

  // Delivery process steps — customer-facing
  const deliverySteps = [
    {
      step: 1,
      title: "Pickup",
      description:
        "Driver takes 6 photos, logs mileage, you see instantly.",
      icon: Camera,
    },
    {
      step: 2,
      title: "Drop-Off",
      description:
        "Six more photos. Final mileage check. Keys handed over.",
      icon: KeyRound,
    },
    {
      step: 3,
      title: "Proof",
      description:
        "Email report: before/after shots, mileage, times.",
      icon: FileText,
    },
    {
      step: 4,
      title: "Payment",
      description:
        "Only after delivery—no upfront risk.",
      icon: CreditCard,
    },
    {
      step: 5,
      title: "Insurance",
      description:
        "Mile-for-mile coverage while on the road.",
      icon: Shield,
    },
  ];

  // Hero features
  const heroFeatures = [
    {
      title: "Route + Miles",
      description: "Map autocomplete (CA only).",
      icon: Map,
    },
    {
      title: "Notifications",
      description: "Email-first, SMS optional.",
      icon: Mail,
    },
  ];

  // Footer component
  const Footer = () => (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-8">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand blurb */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-base font-black tracking-tightest uppercase text-slate-900 dark:text-white">
                101 Drivers
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              101 Drivers is a platform that connects drivers with businesses and individuals who need drivers.
            </p>
          </div>

          {/* Accounts — Business, Individual, Driver */}
          <div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/auth/dealer-signin"
                  className="font-bold text-slate-900 dark:text-white hover:text-lime-500 transition-colors"
                >
                  Business
                </Link>
              </li>
              <li>
                <span className="text-slate-400 dark:text-slate-600 font-semibold cursor-default">
                  Individual
                </span>
              </li>
              <li>
                <Link
                  to="/auth/dealer-signin"
                  search={{ userType: 'driver' }}
                  className="font-bold text-slate-900 dark:text-white hover:text-lime-500 transition-colors"
                >
                  Driver
                </Link>
              </li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/help-customer"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  Customer Help
                </Link>
              </li>
              <li>
                <Link
                  to="/help-driver"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  Driver Help
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <Link
              to="/help-customer"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>

        {/* Legal — pipe-separated, one line */}
        <div className="mb-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <Link to="/privacy" className="hover:text-lime-500 transition-colors">Privacy Policy</Link>
            {" "}&bull;{" "}
            <Link to="/terms" className="hover:text-lime-500 transition-colors">Terms of Service</Link>
          </p>
        </div>

        {/* Bottom line */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em]">
            Strictly California-only operations
          </p>
          <p className="text-xs text-slate-500 font-medium">
            &copy; 2026 101 Drivers Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950">
      <NavBar />
      <main className="w-full">

        {/* ===== SECTION 1 — Instant Quote Entry ===== */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12 pb-6">
          {/* Hero heading */}
          <div>
            <h2 className="text-4xl sm:text-5xl lg:text-[44px] font-black text-[#39FF14] leading-tight">
              We Move Your Car
            </h2>
            <div className="inline-flex items-center gap-2 text-lime-500 font-black text-[11px] uppercase tracking-widest mt-2">
              <Bolt className="h-4 w-4" />
              Instant Quote
            </div>
            <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              Pickup from our Westside zone. Drop-off anywhere in Southern California.
            </p>
          </div>

          {/* Input panel card */}
          <Card className="mt-5 rounded-2xl shadow-lg border-slate-200/70 dark:border-slate-800">
            <CardContent className="p-4 sm:p-5">
              <div className="space-y-3">
                {/* From input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    From Where
                  </Label>
                  <LocationAutocomplete
                    key="pickup"
                    value={pickupAddress}
                    onChange={setPickupAddress}
                    onPlaceSelect={handlePickupSelect}
                    onClear={handlePickupClear}
                    placeholder="Enter address in pickup area"
                    isLoaded={isLoaded}
                    icon={<Target className="h-4 w-4 text-slate-400" />}
                    strictBounds={true}
                    bounds={{
                      north: 34.050,
                      south: 33.930,
                      east: -118.350,
                      west: -118.520,
                    }}
                  />
                  {pickupError && (
                    <p className={cn(
                      "text-xs mt-1 font-semibold",
                      pickupInZone === false ? "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg" : "text-red-500"
                    )}>
                      {pickupInZone === false
                        ? "Must be in our Westside zone."
                        : pickupError
                      }
                    </p>
                  )}
                </div>

                {/* To input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    To Where
                  </Label>
                  <LocationAutocomplete
                    key="dropoff"
                    value={dropoffAddress}
                    onChange={setDropoffAddress}
                    onPlaceSelect={handleDropoffSelect}
                    onClear={handleDropoffClear}
                    placeholder="Anywhere in SoCal"
                    isLoaded={isLoaded}
                    icon={<Flag className="h-4 w-4 text-slate-400" />}
                  />
                  {dropoffError && (
                    <p className="text-xs text-red-500 mt-1">{dropoffError}</p>
                  )}
                </div>

                {/* Recalculate button — estimate auto-fires when both addresses are set */}
                <a
                  href="#estimate"
                  onClick={(e) => { e.preventDefault(); handleCalculateEstimate(); }}
                  className={`w-full px-6 py-3.5 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition flex items-center justify-center gap-2 ${
                    isLoadingQuote || !pickupAddress || !dropoffAddress || pickupInZone === false || quoteLimitReached
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                >
                  {isLoadingQuote
                    ? "Calculating..."
                    : quoteResult
                      ? "Recalculate"
                      : quoteLimitReached
                        ? `Limit (${QUOTE_MAX_ATTEMPTS}/${QUOTE_MAX_ATTEMPTS})`
                        : "Get Estimate"}
                  {!isLoadingQuote && !quoteLimitReached && <ArrowRight className="h-4 w-4" />}
                </a>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ===== SECTION 2 — Map View ===== */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="relative w-full h-[340px] sm:h-[420px] lg:h-[500px] rounded-3xl overflow-hidden">
            <RouteMap
              pickup={pickupCoords}
              dropoff={dropoffCoords}
              isLoaded={isLoaded}
              zones={zones}
              initialCenter={{ lat: 33.98, lng: -118.45 }}
              initialZoom={13}
              fitZonesBounds={!pickupCoords && !dropoffCoords}
              showMapTypeControl={true}
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 z-[1] pointer-events-none" />

            {/* "Pickup Area Only" centered overlay — only when no route */}
            {!quoteResult && (
              <div className="absolute inset-0 flex items-center justify-center z-[2] pointer-events-none px-4">
                <div className="text-center mt-[-50px]">
                  <p className="text-white font-black text-xl sm:text-2xl lg:text-3xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                    Pickup Area Only
                  </p>
                  <p className="text-white/80 text-[10px] sm:text-xs mt-1.5 max-w-xs mx-auto drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] leading-relaxed">
                    Westside LA: Santa Monica, Venice, Marina del Rey, Playa del Rey, Culver City, Westchester, West LA &amp; nearby
                  </p>
                </div>
              </div>
            )}

            {/* Dealerships Welcome badge — top-right */}
            <div className="absolute top-3 right-3 z-10">
              <div className="bg-lime-100/95 dark:bg-lime-900/80 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-1.5 border border-lime-200 dark:border-lime-700">
                <Car className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400" />
                Dealerships Welcome
              </div>
            </div>

            {/* Distance badge — top-left (when route available) */}
            {quoteResult && (
              <div className="absolute top-3 left-3 z-10">
                <Badge variant="secondary" className="gap-2 px-3 py-1.5 backdrop-blur bg-white/95 dark:bg-slate-900/95 shadow-lg border border-slate-200 dark:border-slate-700">
                  <Ruler className="h-3.5 w-3.5 text-lime-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {Math.round(quoteResult.distanceMiles)} miles
                  </span>
                </Badge>
              </div>
            )}

            {/* Route label — bottom-left (when route available) */}
            {quoteResult && (
              <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700 z-10">
                <Navigation className="h-4 w-4 text-lime-500" />
                {pickupAddress || 'From'} → {dropoffAddress || 'To'}
              </div>
            )}

            {/* Zone legend — bottom-right */}
            <div className="absolute bottom-3 right-3 z-10">
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-2.5 py-1.5 rounded-xl text-[9px] font-bold text-slate-700 dark:text-slate-300 shadow-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#39FF14] inline-block shrink-0" />
                Green area = Pickup Zone
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 3 — Price Estimate ===== */}
        <section id="estimate" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              {!quoteResult ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Ruler className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Estimated Price</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Enter locations above for estimate
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        Estimated Price
                      </h3>
                      <Badge variant="secondary" className="mt-2 gap-1.5 px-3 py-1.5">
                        <Ruler className="h-3.5 w-3.5 text-lime-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          {Math.round(quoteResult.distanceMiles)} miles
                        </span>
                      </Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-3xl sm:text-4xl font-black text-lime-500">
                        ${quoteResult.estimatedPrice.toFixed(2)}
                      </p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        Total Estimate
                      </p>
                    </div>
                  </div>

                  {quoteResult?.feesBreakdown && (
                    <div className="flex justify-between items-center py-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Base Transportation
                      </span>
                      <span className="font-black text-sm text-slate-900 dark:text-white">
                        ${quoteResult.feesBreakdown.baseFare.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                      Estimate only. Final scheduling depends on driver availability and operational policy.
                    </p>
                  </div>

                  {/* Out of zone error */}
                  {pickupInZone === false && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30">
                      <div className="flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal">
                          Pickup is outside our Westside zone. Service isn&apos;t available here yet.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="#dealers"
                      onClick={(e) => { if (pickupInZone === false) e.preventDefault(); }}
                      className={`flex-1 font-extrabold rounded-2xl py-3.5 text-center transition shadow-lg text-sm block ${
                        pickupInZone !== false
                          ? "bg-slate-900 dark:bg-white dark:text-slate-950 text-white hover:opacity-90"
                          : "bg-gray-400 text-gray-600 cursor-not-allowed pointer-events-none"
                      }`}
                    >
                      Continue — Sign Up
                    </a>
                    <Button variant="outline" className="flex-1 py-3.5 rounded-2xl font-extrabold text-sm">
                      Save Quote
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ===== SECTION 4 — Business Account Introduction ===== */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="gap-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <Building className="h-3 w-3 text-lime-500" />
              Business Signup
            </Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight mt-4">
              Create your account
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
              Need drivers for vehicle delivery? Pick your company from our directory — it auto-fills everything. Add a contact person. Submitted? Stays Pending Approval till an admin approves.
            </p>

            {/* Feature highlights */}
            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <ClipboardCheck className="h-5 w-5 text-lime-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Directory-based Onboarding
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Select your dealership from search results. We auto-fill business details and capture a contact person.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="h-5 w-5 text-lime-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Admin Approval
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Dealer access is granted after Admin review. Notifications are email-first (SMS optional).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Truck className="h-5 w-5 text-lime-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Schedule Drivers Instantly
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Once approved, create delivery requests with instant price estimates and real-time tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 5 — How the Service Works ===== */}
        <section id="how" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight">
              How It Works
            </h2>
            <p className="text-base text-slate-400 dark:text-slate-500 mt-2 italic">
              We handle every mile like it&apos;s ours.
            </p>

            {/* Delivery step cards — grid on desktop, stack on mobile */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {deliverySteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.step}
                    className="flex flex-col items-center text-center p-5 rounded-2xl bg-[#F5F5F5] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <Icon className="h-5 w-5 text-[#00C853]" />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3">
                      Step {step.step}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1">
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Footer text */}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-6 font-medium text-center">
              Greater LA only {"\u2022"} 25+ drivers {"\u2022"} No passengers
            </p>
          </div>
        </section>

        {/* ===== SECTION 6 — Signup Form (Dealer Signup) ===== */}
        <section id="dealers" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <DealerSignupForm isLoaded={isLoaded} embedded={true} />
        </section>

        {/* ===== SECTION 7 — Driver Recruitment ===== */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="max-w-3xl mx-auto">
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardContent className="p-6 sm:p-8">
                <div className="w-12 h-12 rounded-xl bg-lime-500/15 flex items-center justify-center mb-4">
                  <User className="h-6 w-6 text-lime-500" />
                </div>

                <h2 className="text-2xl font-black leading-tight text-slate-900 dark:text-white">
                  Drivers
                </h2>
                <h3 className="text-lg font-black leading-tight text-slate-900 dark:text-white mt-2">
                  Move Cars in LA — Schedule Ahead, Know Your Pay
                </h3>

                <div className="mt-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-lime-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 dark:text-slate-400">25+ years old, clean driving record</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-lime-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 dark:text-slate-400">Greater LA area only</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-lime-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 dark:text-slate-400">No own car needed — use the customer&apos;s vehicle</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-lime-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 dark:text-slate-400">No passengers — just you and the car</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-lime-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 dark:text-slate-400">Plan your routes, keep all tips</p>
                  </div>
                </div>

                <div className="mt-6 space-y-2.5">
                  <Link
                    to="/driver-onboarding"
                    className="w-full py-3 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition flex items-center justify-center gap-2 text-sm"
                  >
                    Join the Waitlist
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/auth/dealer-signin"
                    className="w-full py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold transition flex items-center justify-center gap-2 text-sm"
                  >
                    Already In? Log In
                    <LogIn className="h-4 w-4 text-lime-500" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ===== CONDITIONAL: Dealer Lead (separate from 7 sections) ===== */}
        {settings?.dealerLeadEnabled && (
          <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 border-t border-slate-200 dark:border-slate-800">
            <div className="max-w-3xl mx-auto">
              <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    Get Started
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    {settings?.dealerLeadCtaDescription || 'Request a quick call — get onboarded fast.'}
                  </p>

                  {!dealerLeadSuccess ? (
                    <form onSubmit={handleDealerLeadSubmit} className="mt-5 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="dlBusinessName" className="text-xs font-bold">Business Name *</Label>
                        <div className="relative">
                          <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="dlBusinessName"
                            value={dealerLeadForm.businessName}
                            onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, businessName: e.target.value })}
                            placeholder="ABC Motors"
                            className="h-11 pl-10 rounded-2xl text-sm"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dlContactName" className="text-xs font-bold">Contact Name</Label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="dlContactName"
                            value={dealerLeadForm.contactName}
                            onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, contactName: e.target.value })}
                            placeholder="who we call — e.g., Jane Doe"
                            className="h-11 pl-10 rounded-2xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="dlPhone" className="text-xs font-bold">Phone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                              id="dlPhone"
                              type="tel"
                              value={dealerPhoneDisplay}
                              onChange={handleDealerPhoneChange}
                              placeholder="(555) 555-5555"
                              className="h-11 pl-10 rounded-2xl text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="dlEmail" className="text-xs font-bold">Email *</Label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                              id="dlEmail"
                              type="email"
                              value={dealerLeadForm.email}
                              onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, email: e.target.value })}
                              placeholder="owner@abcmotors.com"
                              className="h-11 pl-10 rounded-2xl text-sm"
                              required
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dlMessage" className="text-xs font-bold">Message</Label>
                        <Textarea
                          id="dlMessage"
                          value={dealerLeadForm.message}
                          onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, message: e.target.value })}
                          placeholder="Tell us about your needs..."
                          className="rounded-2xl min-h-[70px] text-sm"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={submitDealerLead.isPending}
                        className="w-full bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold gap-2 h-11 rounded-2xl text-sm"
                      >
                        {submitDealerLead.isPending ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                        ) : (
                          <><Send className="h-4 w-4" /> Get Started</>
                        )}
                      </Button>
                    </form>
                  ) : (
                    <div className="mt-5 p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                        <div>
                          <div className="font-extrabold text-lg text-slate-900 dark:text-white">Thank you!</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">We&apos;ve received your request and will be in touch soon.</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-center">
                    <Link
                      to="/auth/dealer-signin"
                      className="text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                    >
                      Signup &rarr;
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* ===== FUNDRAISING / INVESTOR SECTION ===== */}
        {settings?.fundraisingEnabled && (
        <section
          id="fundraising"
          className="relative w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 bg-slate-50 dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="secondary" className="gap-2 px-4 py-1.5 mb-4">
                <Sparkles className="h-3 w-3" />
                Investment Opportunity
              </Badge>
              <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">
                Partner with 101 Drivers
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mt-4 max-w-2xl mx-auto">
                Support, sponsor, or invest in the future of California vehicle delivery.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {settings?.investorDeckUrl && (
                <Card className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                        <FileText className="h-7 w-7 text-lime-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                          {settings?.investorDeckTitle || 'Investor Deck'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mt-2">
                          Download our pitch deck to learn about our business model, traction, and investment opportunity.
                        </p>
                        <Button
                          onClick={() => window.open(settings.investorDeckUrl!, '_blank')}
                          className="mt-4 bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download Deck
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {settings?.investorLeadEnabled && (
                <Card className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow">
                  <CardContent className="p-8">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                      {settings?.investorLeadCtaTitle || 'Request Investor Deck'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">
                      {settings?.investorLeadCtaDescription || 'Interested in partnering? Get in touch.'}
                    </p>
                    
                    {!investorLeadSuccess ? (
                      <form onSubmit={handleInvestorLeadSubmit} className="mt-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="investorName" className="text-xs font-bold">Name *</Label>
                          <Input
                            id="investorName"
                            value={investorLeadForm.name}
                            onChange={(e) => setInvestorLeadForm({ ...investorLeadForm, name: e.target.value })}
                            placeholder="Jane Doe"
                            className="h-12 rounded-2xl"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="investorEmail" className="text-xs font-bold">Email *</Label>
                          <Input
                            id="investorEmail"
                            type="email"
                            value={investorLeadForm.email}
                            onChange={(e) => setInvestorLeadForm({ ...investorLeadForm, email: e.target.value })}
                            placeholder="jane@example.com"
                            className="h-12 rounded-2xl"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="investorMessage" className="text-xs font-bold">Message</Label>
                          <Textarea
                            id="investorMessage"
                            value={investorLeadForm.message}
                            onChange={(e) => setInvestorLeadForm({ ...investorLeadForm, message: e.target.value })}
                            placeholder="Tell us about your interest..."
                            className="rounded-2xl min-h-[80px]"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={submitInvestorLead.isPending}
                          className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-extrabold gap-2"
                        >
                          {submitInvestorLead.isPending ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                          ) : (
                            <><Send className="h-4 w-4" /> Submit Request</>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <div className="mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white">Thank you!</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">We&apos;ll be in touch soon.</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>
        )}

      </main>

      <Footer />
    </div>
  );
}
