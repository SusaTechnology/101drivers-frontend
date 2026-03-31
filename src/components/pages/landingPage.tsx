//@ts-nocheck
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  MapPin,
  DollarSign,
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
  Sparkles,
  Download,
  Send,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavBar } from "../shared/layout/navbar";
import RouteMap from '@/components/map/RouteMap';
import LocationAutocomplete from "../map/LocationAutocomplete";
import { useJsApiLoader } from "@react-google-maps/api";
import { useCreate, useDataQuery } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";

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
  email: string;
  phone: string;
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
  
  // Error states for CA validation
  const [pickupError, setPickupError] = useState("");
  const [dropoffError, setDropoffError] = useState("");

  // Lead form states
  const [dealerLeadForm, setDealerLeadForm] = useState<DealerLeadForm>({
    businessName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [investorLeadForm, setInvestorLeadForm] = useState<InvestorLeadForm>({
    name: '',
    email: '',
    message: '',
  });
  const [dealerLeadSuccess, setDealerLeadSuccess] = useState(false);
  const [investorLeadSuccess, setInvestorLeadSuccess] = useState(false);

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

  // Helper to check if address is in California
  const isAddressInCA = (place: google.maps.places.PlaceResult): boolean => {
    if (!place.address_components) return false;
    return place.address_components.some(
      (comp) =>
        comp.types.includes('administrative_area_level_1') &&
        (comp.short_name === 'CA' || comp.long_name === 'California')
    );
  };

  const getQuote = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/individual/quote-preview`, {
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data) => {
      setQuoteResult(data);
      setIsLoadingQuote(false);
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
    // Check if this is a NOT_CA error from autocomplete
    const addressComponents = place.address_components || [];
    const isNotCAError = addressComponents.some(
      (comp) => comp.types.includes('non_ca_error')
    );
    
    if (isNotCAError) {
      setPickupError("Address must be in California");
      setPickupAddress("");
      setPickupCoords(null);
      return;
    }
    
    // Double-check CA validation
    const isInCalifornia = addressComponents.some(
      (comp) =>
        comp.types.includes('administrative_area_level_1') &&
        (comp.short_name === 'CA' || comp.long_name === 'California')
    );
    
    if (!isInCalifornia) {
      setPickupError("Address must be in California");
      setPickupAddress("");
      setPickupCoords(null);
      return;
    }
    
    setPickupError("");
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
    // Check if this is a NOT_CA error from autocomplete
    const addressComponents = place.address_components || [];
    const isNotCAError = addressComponents.some(
      (comp) => comp.types.includes('non_ca_error')
    );
    
    if (isNotCAError) {
      setDropoffError("Address must be in California");
      setDropoffAddress("");
      setDropoffCoords(null);
      return;
    }
    
    // Double-check CA validation
    const isInCalifornia = addressComponents.some(
      (comp) =>
        comp.types.includes('administrative_area_level_1') &&
        (comp.short_name === 'CA' || comp.long_name === 'California')
    );
    
    if (!isInCalifornia) {
      setDropoffError("Address must be in California");
      setDropoffAddress("");
      setDropoffCoords(null);
      return;
    }
    
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
  }, []);

  // Handle clearing dropoff address
  const handleDropoffClear = useCallback(() => {
    setDropoffAddress("");
    setDropoffCoords(null);
    setDropoffError("");
    setDistance(null);
    setQuoteResult(null);
  }, []);

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
    if (!pickupAddress || !dropoffAddress) {
      if (!pickupAddress) setPickupError("Pickup address is required");
      if (!dropoffAddress) setDropoffError("Drop-off address is required");
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
      setDealerLeadForm({ businessName: '', email: '', phone: '', message: '' });
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

  // How it works steps
  const howItWorks = [
    {
      step: 1,
      title: "Get an estimate",
      description:
        "Enter pickup & drop-off (CA only). See route, miles, and estimate.",
      icon: MapPinned,
    },
    {
      step: 2,
      title: "Add details",
      description:
        "Choose service type, scheduling, and provide contact details (after estimate).",
      icon: Settings,
    },
    {
      step: 3,
      title: "Deliver with proof",
      description:
        "Compliance proofs captured by drivers; stakeholders receive updates (email-first).",
      icon: Shield,
    },
  ];

  // The 101 Standard features
  const standards = [
    {
      title: "VIN last-4 verification",
      description:
        "Driver confirms the vehicle at pickup using the required VIN last-4.",
      icon: QrCode,
    },
    {
      title: "Photo documentation",
      description:
        "Required pickup and drop-off photos captured as part of the delivery process.",
      icon: Camera,
    },
    {
      title: "Odometer start/end",
      description: "Mileage logging with photo evidence at both trip ends.",
      icon: Gauge,
    },
    {
      title: "Start/stop tracking",
      description:
        "Tracking begins when the driver taps Start and ends when delivery completes.",
      icon: Navigation,
    },
    {
      title: "Compliance checks",
      description: "Verification checkpoints throughout relocation per policy.",
      icon: CheckCircle,
    },
    {
      title: "Post-trip report",
      description:
        "A complete digital record of delivery events and proofs for stakeholders.",
      icon: FileText,
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
      title: "Estimate",
      description: "Transparent breakdown.",
      icon: DollarSign,
    },
    {
      title: "Notifications",
      description: "Email-first, SMS optional.",
      icon: Mail,
    },
  ];

  // Footer component
  const Footer = () => (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-14 pb-10">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-lg font-black tracking-tightest uppercase text-slate-900 dark:text-white">
                101 Drivers
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              California vehicle delivery marketplace focused on
              compliance-driven relocations and transparent delivery proofs.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Email-first notifications; SMS optional when enabled by Admin
              policy.
            </p>
          </div>

          <div>
            <h5 className="font-extrabold mb-6 uppercase text-[10px] tracking-widest text-slate-400">
              Explore
            </h5>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-semibold">
              <li>
                <a
                  href="#quote"
                  className="hover:text-lime-500 transition-colors"
                >
                  Instant Quote
                </a>
              </li>
              <li>
                <a
                  href="#how"
                  className="hover:text-lime-500 transition-colors"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  href="#standard"
                  className="hover:text-lime-500 transition-colors"
                >
                  Compliance
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-extrabold mb-6 uppercase text-[10px] tracking-widest text-slate-400">
              Accounts
            </h5>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-semibold">
              <li>
                <Link
                  to="/auth/dealer-signin"
                  userType={"dealer"}
                  className="hover:text-lime-500 transition-colors"
                >
                  Dealer Sign In
                </Link>
              </li>
              <li>
                <Link
                  to="/auth/dealer-signin"
                  userType={"driver"}
                  className="hover:text-lime-500 transition-colors"
                >
                  Driver Sign In
                </Link>
              </li>
              <li>
                <Link
                  to="/auth/dealer-signup"
                  className="hover:text-lime-500 transition-colors"
                >
                  Become a Dealer
                </Link>
              </li>
              <li>
                <Link
                  to="/driver-onboarding"
                  className="hover:text-lime-500 transition-colors"
                >
                  Become a Driver
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-extrabold mb-6 uppercase text-[10px] tracking-widest text-slate-400">
              Governance
            </h5>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-semibold">
              <li>
                <Link
                  to="/privacy"
                  className="hover:text-lime-500 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="hover:text-lime-500 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="#standard"
                  className="hover:text-lime-500 transition-colors"
                >
                  Carrier Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em]">
            Strictly California-Only Operations
          </p>
          <p className="text-xs text-slate-500 font-medium">
            © 2024 101 Drivers Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <NavBar />
      <main className="w-full max-w-[1440px] mx-auto">
        {/* Hero + Quote */}
        <section
          id="quote"
          className="grid grid-cols-1 lg:grid-cols-2 gap-14 px-6 lg:px-8 py-16 lg:py-24 items-center"
        >
          <div className="flex flex-col gap-8">
            <Badge variant="secondary" className="w-fit gap-2 px-4 py-1.5">
              <Verified className="h-3 w-3" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest">
                California Operations Only
              </span>
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-black leading-[1.06] text-slate-900 dark:text-white">
              Get an instant estimate for
              <span className="text-lime-500 italic"> vehicle delivery</span>
              across California.
            </h1>

            <p className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-[640px]">
              Quote-first: enter pickup + drop-off, review route, miles and
              estimate.
              <span className="font-bold">
                {" "}
                Service type and contact details come after
              </span>{" "}
              you see the price.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#estimate"
                onClick={handleCalculateEstimate}
                className={`w-full py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition flex items-center justify-center gap-2 ${
                  isLoadingQuote || !pickupAddress || !dropoffAddress || pickupError || dropoffError
                    ? "opacity-50 pointer-events-none"
                    : ""
                }`}
              >
                {isLoadingQuote ? "Calculating..." : "Calculate Estimate"}
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                to="/driver-onboarding"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold text-sm sm:text-base transition"
              >
                Become a Driver
                <User className="h-4 w-4 text-lime-500" />
              </Link>

              <Link
                to="/auth/dealer-signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold text-sm sm:text-base transition"
              >
                Become a Dealer
                <Store className="h-4 w-4 text-lime-500" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {heroFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={index}
                    className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow"
                  >
                    <CardContent className="p-5">
                      <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center mb-4">
                        <Icon className="h-5 w-5 text-lime-500 font-bold" />
                      </div>
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {feature.title}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {feature.description}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Quote card */}
          <Card
            id="quoteCard"
            className="rounded-3xl shadow-xl border-slate-200/70 dark:border-slate-800 relative"
          >
            <div className="absolute -top-6 -right-6 w-28 h-28 bg-lime-500/10 rounded-full blur-3xl" />
            <CardContent className="p-8 lg:p-10">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 text-lime-500 font-black text-[11px] uppercase tracking-widest">
                    <Bolt className="h-4 w-4" />
                    Instant Quote
                  </div>
                  <CardTitle className="text-2xl font-extrabold mt-2 text-slate-900 dark:text-white">
                    Enter addresses
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    We'll ask service type + contact details after you review
                    the estimate.
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-widest"
                >
                  <MapPin className="h-4 w-4 text-lime-500" />
                  CA Only
                </Badge>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="pickup" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Pickup Address
                  </Label>
                  <LocationAutocomplete
                    key="pickup"
                    value={pickupAddress}
                    onChange={setPickupAddress}
                    onPlaceSelect={handlePickupSelect}
                    onClear={handlePickupClear}
                    placeholder="Search and select pickup location (CA only)"
                    isLoaded={isLoaded}
                    icon={<Target className="h-4 w-4 text-slate-400" />}
                  />
                  {pickupError && (
                    <p className="text-xs text-red-500 mt-1">{pickupError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dropoff" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Drop-off Address
                  </Label>
                  <LocationAutocomplete
                    key="dropoff"
                    value={dropoffAddress}
                    onChange={setDropoffAddress}
                    onPlaceSelect={handleDropoffSelect}
                    onClear={handleDropoffClear}
                    placeholder="Search and select drop-off location (CA only)"
                    isLoaded={isLoaded}
                    icon={<Flag className="h-4 w-4 text-slate-400" />}
                  />
                  {dropoffError && (
                    <p className="text-xs text-red-500 mt-1">{dropoffError}</p>
                  )}
                </div>

                <a
                  href="#estimate"
                  onClick={handleCalculateEstimate}
                  className={`w-full py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold transition flex items-center justify-center gap-2 ${
                    isLoadingQuote || !pickupAddress || !dropoffAddress || pickupError || dropoffError
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                >
                  {isLoadingQuote ? "Calculating..." : "Calculate Estimate"}
                  <ArrowRight className="h-4 w-4" />
                </a>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Notifications are{" "}
                  <span className="font-bold">email-first</span>. SMS may be
                  used optionally if enabled by Admin policy.
                </p>

                {/* <div className="mt-2 flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-5 w-5 text-amber-500" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    Prototype: map autocomplete + California-only enforcement
                    will be implemented in the real app.
                  </p>
                </div> */}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Estimate output */}
        <section id="estimate" className="px-6 lg:px-8 pb-16">
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-7 min-h-[340px] lg:min-h-[520px] relative overflow-hidden bg-slate-50 dark:bg-slate-950">
                <RouteMap pickup={pickupCoords} dropoff={dropoffCoords} isLoaded={isLoaded}/>

                <div className="absolute top-5 left-5 flex flex-col gap-2 z-10">
                  <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                    <Map className="h-4 w-6 text-lime-500" />
                    Route Preview
                  </div>
                  {distance && (
                    <Badge variant="secondary" className="w-fit gap-2 px-4 py-2 backdrop-blur">
                      <Ruler className="h-4 w-4 text-lime-500" />
                      <span className="text-[11px] font-black uppercase tracking-widest">
                        Distance: {quoteResult ? `${Math.round(quoteResult.distanceMiles)} miles` : '— miles'}
                      </span>
                    </Badge>
                  )}
                </div>

                <div className="absolute bottom-5 left-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700 z-10">
                  <Navigation className="h-4 w-4 text-lime-500" />
                  {pickupAddress || 'Pickup'} → {dropoffAddress || 'Drop-off'}
                </div>
              </div>

              <div className="lg:col-span-5 p-7 sm:p-8 lg:p-10 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-7">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                        Estimated Price
                      </h3>
                      <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400 font-semibold text-sm">
                        <span>Pickup</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>Drop-off</span>
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
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                            Base Transportation
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            ${quoteResult.feesBreakdown.baseFare.toFixed(2)}
                          </span>
                        </div>
                        {/* <div className="flex justify-between items-center">
                          <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                            Insurance Fee
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            ${quoteResult.feesBreakdown.insuranceFee.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                            Transaction Fee
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            ${quoteResult.feesBreakdown.transactionFee.toFixed(2)}
                          </span>
                        </div>
                        {quoteResult.feesBreakdown.distanceCharge > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">
                              Distance Charge
                            </span>
                            <span className="font-black text-slate-900 dark:text-white">
                              ${quoteResult.feesBreakdown.distanceCharge.toFixed(2)}
                            </span>
                          </div>
                        )} */}
                      </>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <Info className="h-5 w-5 text-amber-500" />
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                      Quote-first: service type + contact details are collected
                      after estimate. Final scheduling depends on driver
                      availability and operational policy.
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex mt-8 gap-3">
<Link
  to={quoteResult ? "/quote-details" : "#"}
  state={
    quoteResult
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
    if (!quoteResult) e.preventDefault();
  }}
  className={`flex-1 font-extrabold rounded-2xl py-4 text-center transition shadow-lg
  ${
    quoteResult
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

                <div className="sm:hidden mt-8 flex flex-col gap-3">
                  <Link
                    to="/quote-details"
                    state={{
                      quote: quoteResult,
                      pickupCoords,
                      dropoffCoords,
                      pickupAddress,
                      dropoffAddress,
                    }}
                    className="bg-slate-900 text-white font-extrabold rounded-2xl py-4 text-center hover:opacity-90 transition shadow-lg"
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
                  Next step: choose service type, scheduling, and provide
                  contact details (collected after estimate).
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* How it works */}
        <section id="how" className="px-6 lg:px-8 py-16 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">
              How it works
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-4">
              Quote-first, then details.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {howItWorks.map((step) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.step}
                  className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow"
                >
                  <CardContent className="p-7">
                    <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center mb-5">
                      <Icon className="h-6 w-6 text-lime-500 font-bold" />
                    </div>
                    <CardTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
                      {step.step}) {step.title}
                    </CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* The 101 Standard */}
        <section id="standard" className="px-6 lg:px-8 py-16 lg:py-20">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">
              The 101 Standard
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-4">
              Transparency is our protocol.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {standards.map((standard, index) => {
              const Icon = standard.icon;
              return (
                <Card
                  key={index}
                  className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow"
                >
                  <CardContent className="p-7">
                    <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center mb-5">
                      <Icon className="h-6 w-6 text-lime-500 font-bold" />
                    </div>
                    <CardTitle className="font-extrabold text-xl text-slate-900 dark:text-white">
                      {standard.title}
                    </CardTitle>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-2">
                      {standard.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Dealer Lead Section - controlled by settings */}
        {settings?.dealerLeadEnabled && (
        <section
          id="dealers"
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 lg:px-8 py-16 lg:py-20 bg-white/60 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800"
        >
          <div className="space-y-7">
            <div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white">
                {settings?.dealerLeadCtaTitle || 'Onboard your dealership'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg mt-3">
                {settings?.dealerLeadCtaDescription || 'Create a dealer account and submit for Admin approval. Business details are selected from a directory.'}
              </p>
            </div>

            {/* Dealer Lead Form */}
            {!dealerLeadSuccess ? (
              <form onSubmit={handleDealerLeadSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName" className="text-xs font-bold">Business Name *</Label>
                    <Input
                      id="businessName"
                      value={dealerLeadForm.businessName}
                      onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, businessName: e.target.value })}
                      placeholder="ABC Motors"
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealerPhone" className="text-xs font-bold">Phone</Label>
                  <Input
                    id="dealerPhone"
                    type="tel"
                    value={dealerLeadForm.phone}
                    onChange={(e) => setDealerLeadForm({ ...dealerLeadForm, phone: e.target.value })}
                    placeholder="+1-555-100-2000"
                    className="h-12 rounded-2xl"
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
                      <><Send className="h-4 w-4" /> Submit Request</>
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
                    <div className="text-sm text-slate-600 dark:text-slate-400">We\'ve received your request and will be in touch soon.</div>
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

        {/* Fundraising / Investor Section - controlled by settings */}
        {settings?.fundraisingEnabled && (
        <section
          id="fundraising"
          className="px-6 lg:px-8 py-16 lg:py-20 bg-slate-50 dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800"
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
                            <div className="text-sm text-slate-600 dark:text-slate-400">We\'ll be in touch soon.</div>
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

        {/* Drivers */}
        <section
          id="drivers"
          className="px-6 lg:px-8 py-16 lg:py-20 text-center"
        >
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="w-20 h-20 bg-lime-500/15 text-lime-500 rounded-3xl flex items-center justify-center mx-auto">
              <User className="h-8 w-8" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight">
              Professional driving opportunities
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xl leading-relaxed">
              Join a professional network that values protocol and reliability.
              Help move California with 101 Drivers.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Link
                to="/driver-onboarding"
                className="inline-flex items-center justify-center px-12 py-5 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-black text-lg transition-all"
              >
                Become a Certified Driver
              </Link>
              <Link
                to="/auth/dealer-signin"
                search={{ userType: "driver" }}
                className="inline-flex items-center justify-center px-12 py-5 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-black text-lg transition"
              >
                Driver Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}