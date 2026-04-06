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
    setPickupInZone(null); // reset zone check for new pickup
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setPickupCoords({ lat, lng });
      const address = place.formatted_address || '';
      setPickupAddress(address);
      console.log('Pickup address set:', address, 'Coords:', { lat, lng });
    }
  }, []);

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

  // Check if pickup is in a service zone after quote result
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

  const handleCalculateEstimate = () => {
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
    // Clear any previous errors
    setPickupError("");
    setDropoffError("");
    setIsLoadingQuote(true);
    getQuote.mutate({
      pickupAddress,
      dropoffAddress,
    });
  };

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

        {/* ===== SECTION 1: HERO MAP CARD ===== */}
        <section id="quote" className="relative w-full">
          {/* Headline above map */}
          <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 pt-8 lg:pt-12 pb-5">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#39FF14] leading-tight">
              We Move Your Car
            </h2>
            <div className="inline-flex items-center gap-2 text-lime-500 font-black text-[11px] uppercase tracking-widest mt-2">
              <Bolt className="h-4 w-4" />
              Instant Quote
            </div>
            <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 mt-3 leading-relaxed max-w-xl">
              Pickup from our Westside zone. Drop-off anywhere in Southern California.
            </p>
          </div>

          {/* Full-width map card */}
          <div className="relative w-full h-[65vh] min-h-[480px] lg:min-h-[560px] overflow-hidden">
            <RouteMap
              isLoaded={isLoaded}
              zones={zones}
              initialCenter={{ lat: 33.98, lng: -118.45 }}
              initialZoom={13}
              lockViewport={!quoteResult}
              showMapTypeControl={false}
            />

            {/* Semi-transparent overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 z-[1] pointer-events-none" />

            {/* Centered "Pickup Area Only" text overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-[2] pointer-events-none px-6">
              <div className="text-center mt-[-60px]">
                <p className="text-white font-black text-2xl sm:text-3xl lg:text-4xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                  Pickup Area Only
                </p>
                <p className="text-white/80 text-xs sm:text-sm mt-2 max-w-md mx-auto drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] leading-relaxed">
                  Westside LA: Santa Monica, Venice, Marina del Rey, Playa del Rey, Culver City, Westchester, West LA &amp; nearby
                </p>
              </div>
            </div>

            {/* Dealerships Welcome badge — top-right, overlapping map */}
            <div className="absolute top-5 right-5 z-10">
              <div className="bg-lime-100/95 dark:bg-lime-900/80 backdrop-blur px-4 py-2 rounded-full text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-lime-200 dark:border-lime-700">
                <Car className="h-4 w-4 text-lime-600 dark:text-lime-400" />
                Dealerships Welcome
              </div>
            </div>

            {/* Pickup Zone legend — bottom-right, above input panel */}
            <div className="absolute bottom-[180px] lg:bottom-[160px] right-5 z-10">
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                <span className="w-3 h-3 rounded-sm bg-[#39FF14] inline-block shrink-0" />
                Green area = Pickup Zone
              </div>
            </div>

            {/* Floating input panel at bottom of map */}
            <div className="absolute bottom-0 left-0 right-0 z-10">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-5 lg:pb-7">
                <Card className="rounded-3xl shadow-2xl border-slate-200/70 dark:border-slate-800">
                  <CardContent className="p-4 sm:p-5 lg:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
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

                      {/* Get Estimate button */}
                      <a
                        href="#estimate"
                        onClick={handleCalculateEstimate}
                        className={`px-6 sm:px-8 py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition flex items-center justify-center gap-2 whitespace-nowrap ${
                          isLoadingQuote || !pickupAddress || !dropoffAddress || pickupError || dropoffError || quoteLimitReached
                            ? "opacity-50 pointer-events-none"
                            : ""
                        }`}
                      >
                        {isLoadingQuote
                          ? "Calculating..."
                          : quoteLimitReached
                            ? `Limit (${QUOTE_MAX_ATTEMPTS}/${QUOTE_MAX_ATTEMPTS})`
                            : `Get Estimate`}
                        {!isLoadingQuote && !quoteLimitReached && <ArrowRight className="h-4 w-4" />}
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 2+3: ROUTE PREVIEW MAP + PRICE ESTIMATE (only after quote) ===== */}
        {quoteResult && (
        <section id="estimate" className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Section 2: Route Preview Map */}
              <div className="lg:col-span-7 min-h-[380px] lg:min-h-[520px] relative overflow-hidden bg-slate-50 dark:bg-slate-950">
                <RouteMap
                  pickup={pickupCoords}
                  dropoff={dropoffCoords}
                  isLoaded={isLoaded}
                  zones={zones}
                  initialCenter={{ lat: 33.98, lng: -118.45 }}
                  initialZoom={13}
                  showMapTypeControl={true}
                />

                {/* Distance badge — top-left */}
                <div className="absolute top-5 left-5 z-10">
                  <Badge variant="secondary" className="gap-2 px-4 py-2 backdrop-blur bg-white/95 dark:bg-slate-900/95 shadow-lg border border-slate-200 dark:border-slate-700">
                    <Ruler className="h-4 w-4 text-lime-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest">
                      {quoteResult ? `${Math.round(quoteResult.distanceMiles)} miles` : '— miles'}
                    </span>
                  </Badge>
                </div>

                {/* Route label — bottom-left */}
                <div className="absolute bottom-5 left-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700 z-10">
                  <Navigation className="h-4 w-4 text-lime-500" />
                  {pickupAddress || 'From'} → {dropoffAddress || 'To'}
                </div>

                {/* Pickup Zone legend — bottom-right */}
                <div className="absolute bottom-5 right-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700 z-10">
                  <span className="w-3 h-3 rounded-sm bg-[#39FF14] inline-block shrink-0" />
                  Green area = Pickup Zone
                </div>
              </div>

              {/* Section 3: Price Estimate Panel */}
              <div className="lg:col-span-5 p-7 sm:p-8 lg:p-10 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-7">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                        Estimated Price
                      </h3>
                      <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400 font-semibold text-sm">
                        <span>From</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>To</span>
                      </div>

                      <Badge variant="secondary" className="mt-4 gap-2 px-3 py-2">
                        <Ruler className="h-4 w-4 text-lime-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          {quoteResult ? `${Math.round(quoteResult.distanceMiles)} miles` : '— miles'}
                        </span>
                      </Badge>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-4xl font-black text-lime-500">
                        {quoteResult ? `$${quoteResult.estimatedPrice.toFixed(2)}` : ''}
                      </p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        Total Estimate
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 py-6 border-y border-slate-100 dark:border-slate-800">
                    {quoteResult?.feesBreakdown && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                          Base Transportation
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          ${quoteResult.feesBreakdown.baseFare.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <div className="mt-6 flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <Info className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                      Estimate only. Final scheduling depends on driver availability and operational policy.
                    </p>
                  </div>
                </div>

                {/* Out of zone — red error overlay */}
                {pickupInZone === false && quoteResult && (
                  <div className="mt-6 p-5 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-900/30">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          Pickup Outside Our Current Zones
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal mt-1">
                          Must be in our Westside zone. Service isn't available for this pickup area yet — we're expanding soon!
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                          <a
                            href="#dealers"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition text-sm"
                          >
                            Join Waitlist
                            <ArrowRight className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              handlePickupClear();
                              handleDropoffClear();
                            }}
                            className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-2xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                          >
                            Try a Different Pickup
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Desktop action buttons */}
                <div className="hidden sm:flex mt-8 gap-3">
                  <Link
                    to={quoteResult && pickupInZone !== false ? "/quote-details" : "#"}
                    state={
                      quoteResult && pickupInZone !== false
                        ? {
                            quote: quoteResult,
                            pickupCoords,
                            dropoffCoords,
                            pickupAddress,
                            dropoffAddress,
                          }
                        : undefined
                    }
                    onClick={(e) => {
                      if (!quoteResult || pickupInZone === false) e.preventDefault();
                    }}
                    className={`flex-1 font-extrabold rounded-2xl py-4 text-center transition shadow-lg
                    ${
                      quoteResult && pickupInZone !== false
                        ? "bg-slate-900 dark:bg-white dark:text-slate-950 text-white hover:opacity-90"
                        : "bg-gray-400 text-gray-600 cursor-not-allowed pointer-events-none"
                    }`}
                  >
                    Continue
                  </Link>
                  <Button
                    variant="outline"
                    className="flex-1 py-4 rounded-2xl font-extrabold"
                  >
                    Save Quote
                  </Button>
                </div>

                {/* Mobile action buttons */}
                <div className="sm:hidden mt-8 flex flex-col gap-3">
                  <Link
                    to={quoteResult && pickupInZone !== false ? "/quote-details" : "#"}
                    state={
                      quoteResult && pickupInZone !== false
                        ? {
                            quote: quoteResult,
                            pickupCoords,
                            dropoffCoords,
                            pickupAddress,
                            dropoffAddress,
                          }
                        : undefined
                    }
                    onClick={(e) => {
                      if (!quoteResult || pickupInZone === false) e.preventDefault();
                    }}
                    className={`font-extrabold rounded-2xl py-4 text-center transition shadow-lg ${
                      quoteResult && pickupInZone !== false
                        ? "bg-slate-900 dark:bg-white dark:text-slate-950 text-white hover:opacity-90"
                        : "bg-gray-400 text-gray-600 cursor-not-allowed pointer-events-none"
                    }`}
                  >
                    Continue
                  </Link>
                  <Button
                    variant="outline"
                    className="py-4 rounded-2xl font-extrabold"
                  >
                    Save Quote
                  </Button>
                </div>

                <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Service type and scheduling come after you review the estimate.
                </p>
              </div>
            </div>
          </Card>
        </section>
        )}

        {/* ===== SECTION 4: BUSINESS ACCOUNT ===== */}
        <section className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-5">
              <Badge variant="secondary" className="gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">
                <Building className="h-3.5 w-3.5 text-lime-500" />
                Business Accounts
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">
                Create Your Account
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed max-w-md">
                Need drivers? Create a dealer account. We auto-fill everything from our directory. Pending Admin approval after signup.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/auth/dealer-signin"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition text-base"
                >
                  Sign Up as a Dealer
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/auth/dealer-signin"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold text-base transition"
                >
                  Dealer Sign In
                  <LogIn className="h-4 w-4 text-lime-500" />
                </Link>
              </div>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-950 p-8 lg:p-10 rounded-3xl relative overflow-hidden border-slate-200 dark:border-slate-800">
              <div className="absolute -bottom-10 -right-10 opacity-10 text-slate-900 dark:text-white transform rotate-12">
                <Briefcase className="h-64 w-64" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <ClipboardCheck className="h-5 w-5 text-lime-500" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      Directory-based Onboarding
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Select your dealership from search results. We auto-fill business details and capture a contact person.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="h-5 w-5 text-lime-500" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      Admin Approval
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Dealer access is granted after Admin review. Notifications are email-first (SMS optional).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="h-5 w-5 text-lime-500" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      Schedule Drivers Instantly
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Once approved, create delivery requests with instant price estimates and real-time tracking.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* ===== SECTION 5: HOW IT WORKS — delivery process ===== */}
        <section id="how" className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-14 lg:py-20 bg-white dark:bg-slate-950">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">
              We Move Your Car — Safe &amp; Sound
            </h2>
            <p className="text-lg text-slate-400 dark:text-slate-500 mt-4 italic max-w-md mx-auto">
              We handle every mile like it's ours.
            </p>
          </div>

          {/* Mobile: vertical stack. Desktop: 5 boxes side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-3 max-w-5xl mx-auto">
            {deliverySteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="flex md:flex-col items-start md:items-center gap-4 md:gap-3 p-5 md:p-6 rounded-xl bg-[#F5F5F5] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 md:text-center"
                >
                  <div className="w-10 h-10 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 md:h-5 md:w-5 text-[#00C853]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer text */}
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-10 font-medium">
            Greater LA only {"\u2022"} 25+ drivers {"\u2022"} No passengers
          </p>
        </section>

        {/* ===== SECTION 6: DEALER LEAD FORM (Get Started) ===== */}
        {settings?.dealerLeadEnabled && (
        <section
          id="dealers"
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 lg:px-8 py-16 lg:py-20 bg-white/60 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800"
        >
          <div className="space-y-7">
            <div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white">
                Get Started
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg mt-3">
                Request a quick call—get onboarded fast.
              </p>
            </div>

            {/* Dealer Lead Form */}
            {!dealerLeadSuccess ? (
              <form onSubmit={handleDealerLeadSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-xs font-bold">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={dealerLeadForm.businessName}
                    onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, businessName: e.target.value })}
                    placeholder="e.g., ABC Motors"
                    className="h-12 rounded-2xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName" className="text-xs font-bold">Contact Name *</Label>
                  <Input
                    id="contactName"
                    value={dealerLeadForm.contactName}
                    onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, contactName: e.target.value })}
                    placeholder="Who we call—e.g., Jane Doe"
                    className="h-12 rounded-2xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealerPhone" className="text-xs font-bold">Phone *</Label>
                  <Input
                    id="dealerPhone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={14}
                    value={dealerPhoneDisplay}
                    onChange={handleDealerPhoneChange}
                    placeholder="(555) 555-5555"
                    className="h-12 rounded-2xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealerEmail" className="text-xs font-bold">Email *</Label>
                  <Input
                    id="dealerEmail"
                    type="email"
                    value={dealerLeadForm.email}
                    onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, email: e.target.value })}
                    placeholder="owner@abcmotors.com"
                    className="h-12 rounded-2xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealerMessage" className="text-xs font-bold">Message</Label>
                  <Textarea
                    id="dealerMessage"
                    value={dealerLeadForm.message}
                    onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, message: e.target.value })}
                    placeholder="Tell us about your dealership..."
                    className="rounded-2xl min-h-[80px]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    disabled={submitDealerLead.isPending}
                    className="bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold gap-2"
                  >
                    {submitDealerLead.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      <><Send className="h-4 w-4" /> Get Started</>
                    )}
                  </Button>
                  <Link
                    to="/auth/dealer-signin"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold text-base transition"
                  >
                    Dealer Sign In
                    <LogIn className="h-4 w-4 text-lime-500" />
                  </Link>
                </div>
              </form>
            ) : (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">Thank you!</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">We've received your request and will be in touch soon.</div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Dealer access is granted after Admin approval. Notifications are
              email-first (SMS optional if enabled by policy).
            </p>
          </div>

          <Card className="bg-slate-50 dark:bg-slate-950 p-10 rounded-3xl relative overflow-hidden border-slate-200 dark:border-slate-800">
            <div className="absolute -bottom-10 -right-10 opacity-10 text-slate-900 dark:text-white transform rotate-12">
              <Store className="h-64 w-64" />
            </div>

            <div className="relative z-10">
              <Badge
                variant="secondary"
                className="gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest"
              >
                Dealer workflow
              </Badge>
              <h3 className="text-3xl font-black mt-5 text-slate-900 dark:text-white">
                Directory-based onboarding
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mt-3 max-w-md">
                Select your dealership from search results. We auto-fill
                business details and capture a contact person.
              </p>
            </div>
          </Card>
        </section>
        )}

        {/* ===== SECTION 7: DRIVER CTA (moved from top hero) ===== */}
        <section className="flex flex-col items-center justify-center text-center px-6 py-16 lg:py-24 min-h-[50vh]">
          {/* User icon in rounded square */}
          <div className="w-20 h-20 rounded-2xl bg-lime-500/15 flex items-center justify-center mb-8">
            <User className="h-10 w-10 text-lime-500" />
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] text-slate-900 dark:text-white max-w-2xl tracking-tight">
            Move Cars in LA – Schedule Ahead, Know Your Pay
          </h2>

          {/* Subheadline with bullet separators */}
          <p className="mt-6 text-base lg:text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
            25+, clean record {"\u2022"} Greater LA only {"\u2022"} No own car needed {"\u2022"} No passengers {"\u2022"} Plan routes, keep all tips
          </p>

          {/* CTAs */}
          <div className="w-full max-w-sm mt-10 flex flex-col gap-3">
            <Link
              to="/driver-onboarding"
              className="w-full py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition flex items-center justify-center gap-2 text-lg"
            >
              Join the Waitlist
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/auth/dealer-signin"
              className="w-full py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold transition flex items-center justify-center gap-2 text-lg"
            >
              Already In? Log In
              <LogIn className="h-5 w-5 text-lime-500" />
            </Link>
          </div>
        </section>

        {/* ===== FUNDRAISING / INVESTOR SECTION ===== */}
        {settings?.fundraisingEnabled && (
        <section
          id="fundraising"
          className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-16 lg:py-20 bg-slate-50 dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800"
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
              {/* Investor Deck Download */}
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

              {/* Investor Lead Form */}
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
                            <div className="text-sm text-slate-600 dark:text-slate-400">We'll be in touch soon.</div>
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
