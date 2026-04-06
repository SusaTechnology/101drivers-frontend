//@ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
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
  X,
  Info,
  Settings,
  Headset as SupportAgent,
  Badge,
  Sparkles as AutoFixHigh,
  MapPin as Place,
  ArrowRight as ArrowForward,
  CheckCircle,
  Building,
  UserCircle,
  Globe,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Camera,
  KeyRound,
  FileText,
  CreditCard,
  Shield,
  ClipboardCheck,
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

// Props
interface DealerSignupFormProps {
  isLoaded?: boolean;
  embedded?: boolean;
}

// Form schemas - Updated to include placeId
const dealerSignupSchema = z
  .object({
    // Hidden field for placeId
    placeId: z.string().optional(),
    
    // Contact fields - Contact Person is now the primary account holder
    contactName: z.string().min(1, "Contact name is required"),
    contactEmail: z.string().email("Valid email is required"),
    contactPhone: z.string().min(1, "Mobile number is required"),
    
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
    
    // Business primary contact info (fullName, phone) - businessEmail is optional
    fullName: z.string().min(1, "Business contact full name is required"),
    businessEmail: z.string().email("Valid business email").optional().or(z.literal("")), // Optional - only if found from directory
    businessPhone: z.string().min(1, "Business phone is required"),
    
    // Terms
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type DealerSignupFormData = z.infer<typeof dealerSignupSchema>;

// localStorage key for persisting signup draft
const DEALER_SIGNUP_DRAFT_KEY = "dealerSignupDraft";

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

export function DealerSignupForm({ isLoaded: isLoadedProp, embedded = false }: DealerSignupFormProps) {
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
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Phone display states for formatting
  const [businessPhoneDisplay, setBusinessPhoneDisplay] = useState("");
  const [contactPhoneDisplay, setContactPhoneDisplay] = useState("");

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Services for Places API
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  // Load Google Maps API only if isLoaded is not provided externally
  const internalLoader = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry','places'],
  });

  const isLoaded = isLoadedProp !== undefined ? isLoadedProp : internalLoader.isLoaded;

  // Initialize services when API loads
  useEffect(() => {
    if (!isLoaded) return;
    setAutocompleteService(new google.maps.places.AutocompleteService());
    const dummyDiv = document.createElement('div');
    setPlacesService(new google.maps.places.PlacesService(dummyDiv));
  }, [isLoaded]);

  // Format phone number to US format: (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const truncated = digits.slice(0, 10);
    
    // Format based on length
    if (truncated.length === 0) return '';
    if (truncated.length <= 3) return truncated;
    if (truncated.length <= 6) return `(${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6)}`;
  };

  // Handle business phone input with formatting
  const handleBusinessPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setBusinessPhoneDisplay(formatted);
    // Store only digits for form submission
    const digits = formatted.replace(/\D/g, '');
    setSignupValue("businessPhone", digits);
  };

  // Handle contact phone input with formatting
  const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setContactPhoneDisplay(formatted);
    // Store only digits for form submission
    const digits = formatted.replace(/\D/g, '');
    setSignupValue("contactPhone", digits);
  };

  // Mutation for sending OTP (first step)
  const sendOtpMutation = useDataMutation<
    { message: string },
    DealerSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/business/`, // Adjust endpoint as needed
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data, variables) => {
      toast.success("Code sent to your email", {
        description: data.message || "Please check your inbox.",
      });
      setOtpSent(true);
      setPendingSignupData(variables); // Store data for second step
    },
    onError: (error) => {
      const errorMessage = error.message || "Please try again later.";
      
      // Check if error is related to email already existing
      const isEmailExistsError = errorMessage.toLowerCase().includes("email") && 
        (errorMessage.toLowerCase().includes("already") || 
         errorMessage.toLowerCase().includes("exists") ||
         errorMessage.toLowerCase().includes("registered"));
      
      if (isEmailExistsError) {
        toast.error("Email already registered", {
          description: "This email is already associated with an account. Please sign in instead.",
          action: {
            label: "Log In",
            onClick: () => { window.location.href = '/auth/dealer-signin'; },
          },
          duration: 8000,
        });
      } else {
        toast.error("Failed to send code", {
          description: errorMessage,
        });
      }
    },
    successMessage: "Code sent successfully",
    errorMessage: "Failed to send code",
  });

  // Mutation for verifying OTP and final registration (second step)
  const verifyOtpMutation = useDataMutation<
    { message: string },
    DealerSignupPayloadWithOtp
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/business`, // Adjust endpoint as needed
    fetchWithoutRefresh: true,
    publicEndpoint: true, // Skip token refresh on 401 - this is a public endpoint
    onSuccess: (data, variables) => {
      toast.success("Application submitted successfully!", {
        description: "Your account is pending admin approval.",
      });
      // Clear draft from localStorage
      localStorage.removeItem(DEALER_SIGNUP_DRAFT_KEY);
      // Store dealer info in localStorage (excluding password)
      const { password, ...safeData } = variables;
      localStorage.setItem("dealerSignupData", JSON.stringify(safeData));
      setRegistrationComplete(true);
      
      // Auto-redirect to sign in page after 5 seconds
      setTimeout(() => {
        window.location.href = '/auth/dealer-signin';
      }, 5000);
    },
    onError: (error) => {
      toast.error("Verification failed", {
        description: error.message || "Invalid code or server error.",
      });
    },
    successMessage: "Signup submitted successfully",
    errorMessage: "Failed to submit signup",
  });

  // Mutation for resending code
  const resendCodeMutation = useDataMutation<
    { message: string },
    DealerSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/business/`, // Same endpoint as send
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    onSuccess: (data) => {
      toast.success("Code resent successfully", {
        description: "Check your email for the new verification code.",
      });
    },
    onError: (error) => {
      toast.error("Failed to resend code", {
        description: error.message || "Please try again later.",
      });
    },
    successMessage: "Code resent successfully",
    errorMessage: "Failed to resend code",
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

  // Check for OTP in URL and restore draft from localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOtp = urlParams.get('otp');
    
    if (urlOtp) {
      const draftStr = localStorage.getItem(DEALER_SIGNUP_DRAFT_KEY);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.formData && draft.selectedBusiness) {
            // Restore form data
            resetSignupForm(draft.formData, { keepDefaultValues: false });
            // Restore selected business
            setSelectedBusiness(draft.selectedBusiness);
            setSearchQuery(draft.selectedBusiness.name);
            // Set OTP and show verification step
            setOtpValue(urlOtp);
            setOtpSent(true);
            console.log("Draft restored from localStorage for OTP verification");
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      } else {
        // No draft found - user might have cleared storage or link expired
        toast.error("Session expired", {
          description: "Please start a new registration.",
        });
      }
    }
  }, [resetSignupForm]);

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
          
          // Format and set business phone
          const formattedPhone = formatPhoneNumber(business.phone);
          setBusinessPhoneDisplay(formattedPhone);
          setSignupValue("businessPhone", business.phone.replace(/\D/g, ''));
          
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
    setBusinessPhoneDisplay("");
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

    // Prepare base payload - contactEmail is the primary account email
    const basePayload: DealerSignupPayload = {
      email: data.contactEmail, // Contact email is now the primary account email
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
      // Save draft to localStorage so user can resume via email link
      const draft = {
        formData: data,
        selectedBusiness: selectedBusiness,
      };
      localStorage.setItem(DEALER_SIGNUP_DRAFT_KEY, JSON.stringify(draft));
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
  const watchPassword = watch("password");
  const watchConfirmPassword = watch("confirmPassword");

  // Password validation checks
  const passwordChecks = {
    minLength: (watchPassword?.length || 0) >= 8,
    hasUppercase: /[A-Z]/.test(watchPassword || ''),
    hasLowercase: /[a-z]/.test(watchPassword || ''),
    hasNumber: /[0-9]/.test(watchPassword || ''),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(watchPassword || ''),
    hasMatch: watchPassword && watchConfirmPassword && watchPassword === watchConfirmPassword,
    allValid: false, // Will be calculated below
  };
  passwordChecks.allValid = passwordChecks.minLength && passwordChecks.hasUppercase && passwordChecks.hasLowercase && passwordChecks.hasNumber && passwordChecks.hasSpecial && passwordChecks.hasMatch;

  // Determine if any mutation is pending
  const isPending = sendOtpMutation.isPending || verifyOtpMutation.isPending || resendCodeMutation.isPending;

  return (
    <div className={embedded ? "w-full" : "w-full max-w-[1100px] mx-auto px-6 lg:px-8 py-10 lg:py-14"}>
      {/* Title Section — skip when embedded (landing page has its own intro) */}
      {!embedded && <section className="flex flex-col gap-6 mb-2">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-slate-800 dark:text-slate-200 text-xs font-extrabold">
              <Store className="w-3 h-3 text-primary" />
              Business Signup
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold">
              <Verified className="w-3 h-3 text-primary" />
              Pending approval
            </div>
          </div>

          <h1 className={embedded ? "text-2xl lg:text-3xl font-black text-slate-900 dark:text-white" : "text-3xl lg:text-4xl font-black text-slate-900 dark:text-white"}>
            Create your account
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl">
            Need drivers for vehicle delivery?{" "}
            <span className="font-extrabold">
              Pick your company from our directory
            </span>{" "}
            —it auto-fills everything. Add a contact person. Submitted?{" "}
            <span className="font-extrabold">Stays Pending Approval</span>{" "}
            till an admin approves.
          </p>
        </div>
      </section>}

      {/* ===== QUICK STEPS — skip when embedded ===== */}
      {!embedded && <section className="mt-6 mb-2">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="h-4 w-4 text-[#00C853]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-[#00C853]">Quick Steps</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { title: "Get quote", desc: "Pickup/drop-off (CA only). See route + price.", icon: MapPin },
            { title: "Add info", desc: "Vehicle details, schedule, contacts.", icon: Settings },
            { title: "Track live & pay", desc: "Real-time vehicle tracking for all, secure payment, proof delivered.", icon: Shield },
          ].map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F5] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"
              >
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-[#00C853]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>}

      {!registrationComplete ? (
        <section className={embedded ? "grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start" : "mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"}>
          {/* Left: Directory search + autofill */}
          <div className="lg:col-span-7">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 hover-lift">
              <CardHeader className="p-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Step 1
                    </p>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                      Pick your company
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Directory search (Google Places). Info auto-fills—no manual edits for accuracy.
                    </CardDescription>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    <Place className="w-3 h-3 text-primary" />
                    Directory
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0 mt-8 space-y-4">
                {/* Directory Search */}
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
                      placeholder="Search: Your company name here…"
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

                  {/* Search results dropdown */}
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
                    Powered by Google Places. Select your business to auto-fill.
                  </p>
                </div>

                {/* Auto-filled business details */}
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
                          Name
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
                          Phone
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
                        Address
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

                    {/* Business Email - Optional, manually entered if available */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="businessEmailDirectory"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300"
                      >
                        Business Email <span className="text-slate-400">(optional)</span>
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="businessEmailDirectory"
                          {...registerSignup("businessEmail")}
                          type="email"
                          className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                          placeholder="business@example.com (if available)"
                          disabled={isPending}
                        />
                      </div>
                      {signupErrors.businessEmail && (
                        <p className="text-sm text-red-500">
                          {signupErrors.businessEmail.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>

                      {/* Support note — skip when embedded */}
              {!embedded && <Card className="mt-6 bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7">
                <CardContent className="p-0">
                  <div className="flex gap-3">
                    <SupportAgent className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">
                        Business not found?
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Businesses must be selected from a directory.
                        If missing, contact support to onboard your business.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>}
            </div>

            {/* Right: Contact Details + OTP */}
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
                        Required for accounts. After submission, status
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

                    {/* Your Contact Details */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <UserCircle className="w-4 h-4" />
                        Your Contact Details
                      </h4>
                      
                      <div className="space-y-2">
                        <Label
                          htmlFor="contactName"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Name <span className="text-red-500">*</span>
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
                          Email <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="contactEmail"
                            {...registerSignup("contactEmail")}
                            type="email"
                            autoComplete="off"
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="your@email.com"
                            disabled={isPending}
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
                          Mobile <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="contactPhone"
                            name="contactPhone"
                            value={contactPhoneDisplay}
                            onChange={handleContactPhoneChange}
                            type="tel"
                            autoComplete="off"
                            inputMode="tel"
                            maxLength={14}
                            className="w-full h-14 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                            placeholder="(555) 123-4567"
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

                    {/* Password */}
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
                            Password <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                              id="password"
                              {...registerSignup("password")}
                              type={showPassword ? "text" : "password"}
                              autoComplete="off"
                              className="w-full h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                              placeholder="Create password"
                              disabled={isPending}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                            >
                              {showPassword ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
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
                            Confirm Password <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                              id="confirmPassword"
                              {...registerSignup("confirmPassword")}
                              type={showConfirmPassword ? "text" : "password"}
                              autoComplete="off"
                              className="w-full h-14 pl-12 pr-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                              placeholder="Repeat password"
                              disabled={isPending}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {signupErrors.confirmPassword && (
                            <p className="text-sm text-red-500">
                              {signupErrors.confirmPassword.message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Password Requirements - Below password fields */}
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 space-y-2">
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Password Requirements
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          <div className="flex items-center gap-2">
                            {passwordChecks.minLength ? (
                              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs ${passwordChecks.minLength ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                              8+ characters
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordChecks.hasUppercase ? (
                              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs ${passwordChecks.hasUppercase ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                              1 uppercase
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordChecks.hasLowercase ? (
                              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs ${passwordChecks.hasLowercase ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                              1 lowercase
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordChecks.hasNumber ? (
                              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs ${passwordChecks.hasNumber ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                              1 number
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordChecks.hasSpecial ? (
                              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs ${passwordChecks.hasSpecial ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                              1 special char
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {passwordChecks.hasMatch ? (
                              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs ${passwordChecks.hasMatch ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                              Passwords match
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Code Input Field - appears only after code sent */}
                    {otpSent && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="otp" className="text-xs font-bold">
                            Enter Verification Code
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (pendingSignupData) {
                                resendCodeMutation.mutate(pendingSignupData);
                              }
                            }}
                            disabled={resendCodeMutation.isPending}
                            className="text-xs h-8 px-3 text-primary hover:text-primary/80 font-semibold"
                          >
                            {resendCodeMutation.isPending ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2"></div>
                                Sending...
                              </>
                            ) : (
                              "Resend Code"
                            )}
                          </Button>
                        </div>
                        <Input
                          id="otp"
                          value={otpValue}
                          onChange={(e) => setOtpValue(e.target.value)}
                          className="h-14 rounded-2xl text-center text-lg tracking-widest font-mono border-2 border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-950/30 focus:border-red-500 focus:ring-red-200 focus:ring-2"
                          placeholder="123456"
                          maxLength={6}
                          disabled={isPending}
                        />
                        <p className="text-[11px] text-slate-500">
                          Enter the 6-digit code sent to your email.
                        </p>
                      </div>
                    )}

                    {/* Terms and Conditions */}
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
                        Accounts require Admin approval before accessing
                        dashboard features. You'll receive updates by{" "}
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
                          {sendOtpMutation.isPending || resendCodeMutation.isPending ? "Sending Code..." : "Verifying..."}
                        </>
                      ) : !selectedBusiness ? (
                        "Select Business First"
                      ) : !acceptTerms ? (
                        "Accept Terms & Conditions"
                      ) : otpSent ? (
                        <>
                          Verify & Submit
                          <ArrowRight className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          Send Code to Email
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </Button>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                      {otpSent
                        ? "After verification, your application will be submitted for admin approval."
                        : "After submission, you'll receive a verification code via email."}
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>
          </section>
        ) : (
          /* Success/Pending Approval Panel */
          <section className={embedded ? "mt-6" : "mt-10"}>
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
              {/* Success Header with gradient */}
              <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent py-12 px-6 sm:px-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.1),transparent_50%)]" />
                <div className="relative flex flex-col items-center text-center">
                  {/* Animated Checkmark */}
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                      <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute -inset-2 rounded-full border-2 border-green-400/30 animate-pulse" />
                  </div>
                  
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                    Application Submitted!
                  </h2>
                  <p className="text-lg text-slate-600 dark:text-slate-400 mt-3 max-w-md">
                    Your account application has been received and is pending admin approval.
                  </p>
                  
                  {/* Status Badge */}
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      Pending Approval
                    </span>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 sm:p-10">
                {/* What's Next Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-primary" />
                    What Happens Next?
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">1</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">Admin Review</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Our team will verify your business details within 1-2 business days.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                        <span className="text-lg font-black text-purple-600 dark:text-purple-400">2</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">Email Confirmation</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You'll receive an email once your account is approved.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                        <span className="text-lg font-black text-green-600 dark:text-green-400">3</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">Start Delivering</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Access your dashboard and start creating deliveries!</p>
                    </div>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="mb-8 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">While You Wait</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        You can bookmark the sign-in page. Once approved, you'll use your email and password to access your dashboard.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/auth/dealer-signin"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold hover:opacity-90 transition shadow-lg"
                  >
                    <LoginIcon className="w-5 h-5" />
                    Go to Log In
                  </Link>

                  <Link
                    to="/"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <Home className="w-5 h-5" />
                    Back to Home
                  </Link>
                </div>

                {/* Help Text */}
                <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Questions? Contact support at{" "}
                  <a href="mailto:support@101drivers.com" className="font-bold text-primary hover:underline">
                    support@101drivers.com
                  </a>
                </p>
              </CardContent>
            </Card>
          </section>
        )}
    </div>
  );
}
