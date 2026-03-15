//@ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  Store,
  Verified,
  MapPin,
  Search,
  ArrowRight,
  User as Person,
  Phone,
  Mail,
  Lock,
  Clock,
  Home,
  LogIn as LoginIcon,
  Menu,
  X,
  Info,
  Headset as SupportAgent,
  Badge,
  Sparkles as AutoFixHigh,
  MapPin as Place,
  ArrowRight as ArrowForward,
  CheckCircle,
  Building,
  UserCircle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDataMutation } from "@/lib/tanstack/dataQuery";

// Form schemas - Updated to include placeId
const dealerSignupSchema = z
  .object({
    // Hidden field for placeId
    placeId: z.string().optional(),
    
    // Contact fields
    contactName: z.string().min(1, "Contact name is required"),
    contactEmail: z.string().email("Valid email is required"),
    contactPhone: z.string().min(1, "Contact phone is required"),
    
    // Account fields
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    
    // Business primary contact info (fullName, phone, email)
    fullName: z.string().min(1, "Business contact full name is required"),
    businessEmail: z.string().email("Valid business email is required"),
    businessPhone: z.string().min(1, "Business phone is required"),
    
    // Terms
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }).refine((data) => data.contactEmail !== data.businessEmail, {
    message: "Contact email and business email cannot be the same",
    path: ["businessEmail"],
  });

type DealerSignupFormData = z.infer<typeof dealerSignupSchema>;

interface Business {
  id?: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  city?: string;
  state?: string;
  type?: string;
  placeId: string;
}

interface DealerSignupPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessName: string;
  businessPlaceId: string;
  businessAddress: string;
  businessPhone: string;
  businessWebsite: string;
}

interface DealerSignupPayloadWithOtp extends DealerSignupPayload {
  verificationToken: string;
}

export function DealerSignUp() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [pendingSignupData, setPendingSignupData] = useState<DealerSignupPayload | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Services for Places API
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry','places'],
  });

  // Initialize services when API loads
  useEffect(() => {
    if (!isLoaded) return;
    setAutocompleteService(new google.maps.places.AutocompleteService());
    const dummyDiv = document.createElement('div');
    setPlacesService(new google.maps.places.PlacesService(dummyDiv));
  }, [isLoaded]);

  // Mutation for sending OTP (first step)
  const sendOtpMutation = useDataMutation<
    { message: string },
    DealerSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/business/`, // Adjust endpoint as needed
    onSuccess: (data, variables) => {
      toast.success("OTP sent to your email", {
        description: data.message || "Please check your inbox.",
      });
      setOtpSent(true);
      setPendingSignupData(variables); // Store data for second step
    },
    onError: (error) => {
      toast.error("Failed to send OTP", {
        description: error.message || "Please try again later.",
      });
    },
    successMessage: "OTP sent successfully",
    errorMessage: "Failed to send OTP",
    fetchWithoutRefresh: true,
  });

  // Mutation for verifying OTP and final registration (second step)
  const verifyOtpMutation = useDataMutation<
    { message: string },
    DealerSignupPayloadWithOtp
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/business`, // Adjust endpoint as needed
    onSuccess: (data, variables) => {
      toast.success("Application submitted successfully!", {
        description: "Your dealer account is pending admin approval.",
      });
      // Store dealer info in localStorage (excluding password)
      const { password, ...safeData } = variables;
      localStorage.setItem("dealerSignupData", JSON.stringify(safeData));
      setRegistrationComplete(true);
    },
    onError: (error) => {
      toast.error("Verification failed", {
        description: error.message || "Invalid OTP or server error.",
      });
    },
    successMessage: "Dealer signup submitted successfully",
    errorMessage: "Failed to submit dealer signup",
    fetchWithoutRefresh: true,
  });

  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    formState: { errors: signupErrors },
    reset: resetSignupForm,
    setValue: setSignupValue,
    watch,
    trigger,
  } = useForm<DealerSignupFormData>({
    resolver: zodResolver(dealerSignupSchema),
    defaultValues: {
      placeId: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      businessEmail: "",
      businessPhone: "",
      acceptTerms: false,
    },
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch predictions when debounced search changes
  useEffect(() => {
    if (!autocompleteService || debouncedSearch.length < 2) {
      setPredictions([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    if (selectedBusiness && debouncedSearch === selectedBusiness.name) {
      setPredictions([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    const request: google.maps.places.AutocompletionRequest = {
      input: debouncedSearch,
      types: ['establishment'],
      componentRestrictions: { country: 'us' },
    };

    autocompleteService.getPlacePredictions(request, (predictions, status) => {
      setIsSearching(false);
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        setPredictions(predictions);
      } else {
        setPredictions([]);
      }
    });
  }, [autocompleteService, debouncedSearch]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePredictionSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService) return;
    
    placesService.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'international_phone_number', 'website'],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const business: Business = {
            name: place.name || prediction.structured_formatting.main_text || '',
            address: place.formatted_address || '',
            phone: place.formatted_phone_number || place.international_phone_number || '',
            website: place.website || '',
            placeId: prediction.place_id,
          };

          setSelectedBusiness(business);
          setShowSearchResults(false);
          setPredictions([]); 
          setSearchQuery(business.name);
          
          // Auto-fill business fields
          setSignupValue("placeId", business.placeId);
          setSignupValue("fullName", business.name);
          setSignupValue("businessPhone", business.phone);
          
          toast.success(`Selected: ${business.name}`, {
            description: "Business details auto-filled",
          });
        } else {
          toast.error("Could not fetch business details. Please try again.");
        }
      }
    );
  };

  const clearBusinessSelection = () => {
    setSelectedBusiness(null);
    setSearchQuery("");
    setSignupValue("placeId", "");
    setSignupValue("fullName", "");
    setSignupValue("businessEmail", "");
    setSignupValue("businessPhone", "");
    setPredictions([]);
  };

  const onSignupSubmit = async (data: DealerSignupFormData) => {
    if (!selectedBusiness) {
      toast.error("Please select your business from the directory first");
      return;
    }

    if (!data.acceptTerms) {
      toast.error("Please accept the terms and conditions");
      return;
    }

    // Prepare base payload
    const basePayload: DealerSignupPayload = {
      email: data.businessEmail,
      password: data.password,
      fullName: data.fullName,
      businessPhone: data.businessPhone,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      businessName: selectedBusiness.name,
      businessPlaceId: selectedBusiness.placeId,
      businessAddress: selectedBusiness.address,
      businessWebsite: selectedBusiness.website || "",
    };

    if (!otpSent) {
      // Step 1: Send OTP
      sendOtpMutation.mutate(basePayload);
    } else {
      // Step 2: Verify OTP and complete registration
      if (!otpValue.trim()) {
        toast.error("Please enter the OTP");
        return;
      }
      const payloadWithOtp: DealerSignupPayloadWithOtp = {
        ...basePayload,
        verificationToken: otpValue,
      };
      verifyOtpMutation.mutate(payloadWithOtp);
    }
  };

  // Watch acceptTerms for validation feedback
  const acceptTerms = watch("acceptTerms");

  // Determine if any mutation is pending
  const isPending = sendOtpMutation.isPending || verifyOtpMutation.isPending;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header (unchanged) */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <a
                href="/landing#how"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                How it works
              </a>
              <a
                href="/landing#standard"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Compliance
              </a>
              <Link
                to="/about"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                About
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/auth/dealer-signin"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <LoginIcon className="w-4 h-4" />
              Dealer Sign In
            </Link>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile menu (unchanged) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top">
            <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
              <a
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                href="/landing#how"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it works
              </a>
              <a
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                href="/landing#standard"
                onClick={() => setMobileMenuOpen(false)}
              >
                Compliance
              </a>
              <Link
                to="/about"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <Link
                  to="/auth/dealer-signin"
                  className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors py-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dealer Sign In
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-[1100px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Title Section (unchanged) */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-4">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-slate-800 dark:text-slate-200 text-xs font-extrabold">
                <Store className="w-3 h-3 text-primary" />
                Dealer (Business) Signup
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold">
                <Verified className="w-3 h-3 text-primary" />
                Pending approval after signup
              </div>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Create your dealership account
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl">
              Per PRD, dealers must{" "}
              <span className="font-extrabold">
                select their business from a directory
              </span>{" "}
              so details can be auto-filled. A{" "}
              <span className="font-extrabold">contact person</span> is
              required. After submission, your account will be{" "}
              <span className="font-extrabold">Pending Approval</span> until an
              Admin approves it.
            </p>
          </div>

          <div className="flex gap-3 mb-3">
            <Link
              to="/auth/dealer-signin"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <LoginIcon className="w-4 h-4" />
              Already have an account?
            </Link>
          </div>
        </section>

        {!registrationComplete ? (
          <section className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Directory search + autofill (unchanged) */}
            <div className="lg:col-span-7">
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 hover-lift">
                <CardHeader className="p-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Step 1
                      </p>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                        Find your business
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Directory search (Google Places). Business info is
                        auto-filled; manual entry is disabled to match PRD intent.
                      </CardDescription>
                    </div>

                    <span className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      <Place className="w-3 h-3 text-primary" />
                      Directory
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-0 mt-8 space-y-4">
                  {/* Directory Search (unchanged) */}
                  <div className="group relative" ref={searchRef}>
                    <Label
                      htmlFor="businessSearch"
                      className="text-xs font-black uppercase tracking-widest text-slate-500"
                    >
                      Business search
                    </Label>
                    <div className="mt-2 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="businessSearch"
                        ref={inputRef}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (
                            selectedBusiness &&
                            e.target.value !== selectedBusiness.name
                          ) {
                            clearBusinessSelection();
                          }
                        }}
                        onFocus={() => {
                          if (predictions.length > 0) {
                            setShowSearchResults(true);
                          }
                        }}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                        placeholder="Search dealership name (e.g., 'Cali Motors')"
                        autoComplete="off"
                        disabled={!isLoaded}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={clearBusinessSelection}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Search results dropdown (unchanged) */}
                    {showSearchResults && (
                      <div className="absolute z-50 w-full mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                        {isSearching ? (
                          <div className="p-4 text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                            <p className="text-sm text-slate-500 mt-2">
                              Searching businesses...
                            </p>
                          </div>
                        ) : predictions.length > 0 ? (
                          <>
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Matching Businesses ({predictions.length})
                              </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {predictions.map((prediction) => (
                                <button
                                  key={prediction.place_id}
                                  type="button"
                                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                  onClick={() => handlePredictionSelect(prediction)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Building className="w-5 h-5 text-primary" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-bold text-slate-900 dark:text-white truncate">
                                          {prediction.structured_formatting.main_text}
                                        </div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {prediction.structured_formatting.secondary_text}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <ArrowForward className="w-4 h-4 text-primary flex-shrink-0 mt-2" />
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto">
                              <Info className="w-6 h-6 text-amber-500" />
                            </div>
                            <p className="font-medium text-slate-900 dark:text-white mt-3">
                              No businesses found
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              Try a different search term or contact support
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Powered by Google Places. Select your business to auto‑fill details.
                    </p>
                  </div>

                  {/* Auto-filled business details (unchanged) */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Auto-filled business details
                      </Label>
                      {selectedBusiness && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-bold">
                          <AutoFixHigh className="w-3 h-3 text-primary" />
                          Auto-filled
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Business Name
                          </Label>
                          <div className="relative">
                            <Input
                              value={selectedBusiness?.name || ""}
                              className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-sm cursor-not-allowed pr-10"
                              placeholder="Select from directory"
                              disabled
                            />
                            {selectedBusiness && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Business Phone
                          </Label>
                          <div className="relative">
                            <Input
                              value={selectedBusiness?.phone || ""}
                              className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-sm cursor-not-allowed pr-10"
                              placeholder="Auto-filled"
                              disabled
                            />
                            {selectedBusiness && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Business Address
                        </Label>
                        <div className="relative">
                          <Input
                            value={selectedBusiness?.address || ""}
                            className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-sm cursor-not-allowed pr-10"
                            placeholder="Auto-filled"
                            disabled
                          />
                          {selectedBusiness && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Website (optional)
                        </Label>
                        <div className="relative">
                          <Input
                            value={selectedBusiness?.website || ""}
                            className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-sm cursor-not-allowed pr-10"
                            placeholder="Auto-filled"
                            disabled
                          />
                          {selectedBusiness && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Support note (unchanged) */}
              <Card className="mt-6 bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7">
                <CardContent className="p-0">
                  <div className="flex gap-3">
                    <SupportAgent className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">
                        Business not found?
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        PRD: dealers must be selected from a business directory.
                        If missing, contact support to onboard your business.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Account & Contact Information + OTP */}
            <div className="lg:col-span-5">
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 hover-lift">
                <CardHeader className="p-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Step 2
                      </p>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                        Account & Contact Information
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Required for Dealer accounts. After submission, status
                        becomes{" "}
                        <span className="font-extrabold">Pending Approval</span>.
                      </CardDescription>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      <Badge className="w-3 h-3 text-primary" />
                      Required
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-0 mt-8 space-y-5">
                  <form
                    id="dealerSignupForm"
                    onSubmit={handleSignupSubmit(onSignupSubmit)}
                    className="space-y-5"
                  >
                    {/* Hidden field for placeId */}
                    <input type="hidden" {...registerSignup("placeId")} />

                    {/* Business Primary Contact Info (unchanged) */}
                    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Business Primary Contact
                      </h4>
                      
                      <div className="space-y-2">
                        <Label
                          htmlFor="fullName"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Business Contact Full Name
                        </Label>
                        <div className="relative">
                          <Person className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="fullName"
                            {...registerSignup("fullName")}
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="Business contact person name"
                            disabled={isPending || !!selectedBusiness}
                          />
                        </div>
                        {signupErrors.fullName && (
                          <p className="text-sm text-red-500">
                            {signupErrors.fullName.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="businessEmail"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Business Email
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="businessEmail"
                            {...registerSignup("businessEmail")}
                            type="email"
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="business@example.com"
                            disabled={isPending}
                            onChange={() => trigger("businessEmail")}
                          />
                        </div>
                        {signupErrors.businessEmail && (
                          <p className="text-sm text-red-500">
                            {signupErrors.businessEmail.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="businessPhone"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Business Phone
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="businessPhone"
                            {...registerSignup("businessPhone")}
                            type="tel"
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="+1 (___) ___-____"
                            disabled={isPending || !!selectedBusiness}
                          />
                        </div>
                        {signupErrors.businessPhone && (
                          <p className="text-sm text-red-500">
                            {signupErrors.businessPhone.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Additional Contact Person (unchanged) */}
                    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <UserCircle className="w-4 h-4" />
                        Additional Contact Person (Optional)
                      </h4>
                      
                      <div className="space-y-2">
                        <Label
                          htmlFor="contactName"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Contact Person Name
                        </Label>
                        <div className="relative">
                          <Person className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="contactName"
                            {...registerSignup("contactName")}
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="John Doe"
                            disabled={isPending}
                          />
                        </div>
                        {signupErrors.contactName && (
                          <p className="text-sm text-red-500">
                            {signupErrors.contactName.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="contactEmail"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Contact Person Email
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="contactEmail"
                            {...registerSignup("contactEmail")}
                            type="email"
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="contact@example.com"
                            disabled={isPending}
                            onChange={() => trigger("businessEmail")}
                          />
                        </div>
                        {signupErrors.contactEmail && (
                          <p className="text-sm text-red-500">
                            {signupErrors.contactEmail.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="contactPhone"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Contact Person Phone
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="contactPhone"
                            {...registerSignup("contactPhone")}
                            type="tel"
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="+1 (___) ___-____"
                            disabled={isPending}
                          />
                        </div>
                        {signupErrors.contactPhone && (
                          <p className="text-sm text-red-500">
                            {signupErrors.contactPhone.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Password (unchanged) */}
                    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Account Password
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="password"
                            className="text-xs font-bold text-slate-700 dark:text-slate-300"
                          >
                            Password
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                              id="password"
                              {...registerSignup("password")}
                              type="password"
                              className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                              placeholder="Create password"
                              disabled={isPending}
                            />
                          </div>
                          {signupErrors.password && (
                            <p className="text-sm text-red-500">
                              {signupErrors.password.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="confirmPassword"
                            className="text-xs font-bold text-slate-700 dark:text-slate-300"
                          >
                            Confirm Password
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                              id="confirmPassword"
                              {...registerSignup("confirmPassword")}
                              type="password"
                              className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                              placeholder="Repeat password"
                              disabled={isPending}
                            />
                          </div>
                          {signupErrors.confirmPassword && (
                            <p className="text-sm text-red-500">
                              {signupErrors.confirmPassword.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Must be at least 8 characters with uppercase, lowercase,
                        number, and special character
                      </p>
                    </div>

                    {/* OTP Input Field - appears only after OTP sent */}
                    {otpSent && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label htmlFor="otp" className="text-xs font-bold">
                          Enter OTP
                        </Label>
                        <Input
                          id="otp"
                          value={otpValue}
                          onChange={(e) => setOtpValue(e.target.value)}
                          className="h-14 rounded-2xl text-center text-lg tracking-widest font-mono"
                          placeholder="123456"
                          maxLength={6}
                          disabled={isPending}
                        />
                        <p className="text-[11px] text-slate-500">
                          Enter the 6-digit code sent to your email.
                        </p>
                      </div>
                    )}

                    {/* Terms and Conditions (unchanged) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-start space-x-2">
                        <input
                          type="checkbox"
                          id="acceptTerms"
                          {...registerSignup("acceptTerms")}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary focus:ring-offset-0"
                          disabled={isPending}
                        />
                        <Label
                          htmlFor="acceptTerms"
                          className={cn(
                            "text-xs text-slate-600 dark:text-slate-400 cursor-pointer",
                            !acceptTerms && "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          I agree to the{" "}
                          <Link
                            to="/terms"
                            className="font-extrabold hover:text-primary underline"
                            target="_blank"
                          >
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link
                            to="/privacy"
                            className="font-extrabold hover:text-primary underline"
                            target="_blank"
                          >
                            Privacy Policy
                          </Link>
                        </Label>
                      </div>
                      {signupErrors.acceptTerms && (
                        <p className="text-sm text-red-500">
                          {signupErrors.acceptTerms.message}
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                      <Info className="w-5 h-5 text-amber-500 shrink-0" />
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                        Dealer accounts require Admin approval before accessing
                        dealer features. You'll receive updates by{" "}
                        <span className="font-black">email-first</span> (SMS
                        optional if enabled by Admin policy).
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={
                        isPending ||
                        !selectedBusiness ||
                        !acceptTerms ||
                        (otpSent && !otpValue.trim())
                      }
                      className={cn(
                        "w-full py-4 rounded-2xl transition flex items-center justify-center gap-2 text-lg font-extrabold",
                        !selectedBusiness || !acceptTerms
                          ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                          : "bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 hover:brightness-95",
                      )}
                    >
                      {isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-950"></div>
                          {sendOtpMutation.isPending ? "Sending OTP..." : "Verifying..."}
                        </>
                      ) : !selectedBusiness ? (
                        "Select Business First"
                      ) : !acceptTerms ? (
                        "Accept Terms & Conditions"
                      ) : otpSent ? (
                        <>
                          Verify OTP & Submit
                          <ArrowRight className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          Send OTP to Email
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </Button>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                      {otpSent
                        ? "After verification, your application will be submitted for admin approval."
                        : "After submission, you'll receive an OTP via email to verify your identity."}
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : (
          /* Success/Pending Approval Panel (unchanged) */
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="pt-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    Submitted — Pending Approval
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-2">
                    Thanks! Your dealership signup is pending Admin approval.
                    We'll email you when it's approved.
                  </p>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/auth/dealer-signin"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition"
                    >
                      Go to Sign In
                      <LoginIcon className="w-4 h-4" />
                    </Link>

                    <Link
                      to="/"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-extrabold border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                    >
                      Back to Home
                      <Home className="w-4 h-4" />
                    </Link>
                  </div>

                  <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
                    Note: Admin will review your application and approve it
                    within 1-2 business days.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* IND note (unchanged) */}
        <section className="mt-10">
          <Card className="bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7">
            <CardContent className="p-0">
              <div className="flex gap-3">
                <Person className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-slate-900 dark:text-white">
                    Are you an individual customer?
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Individuals use a simplified flow and do not select a
                    business from the directory. Start from{" "}
                    <Link
                      to="/landing"
                      className="font-extrabold hover:text-primary"
                    >
                      Landing
                    </Link>
                    .
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

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
                Dealer signup • Pending approval • Email-first
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