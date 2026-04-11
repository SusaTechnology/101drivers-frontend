import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Mail,
  MapPin,
  Shield,
  ArrowRight,
  Menu,
  X,
  Search,
  Users,
  Route,
  LogIn,
  Verified,
  Car,
  Calendar,
  Clock,
  User,
  KeyRound,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const DRAFT_KEY = "quoteDraft";

export default function QuoteConfirmation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get delivery data from location state or localStorage
  const [deliveryData, setDeliveryData] = useState<any>(null);

  useEffect(() => {
    // First try to get from location state
    const state = location.state as any;
    if (state?.delivery) {
      setDeliveryData(state.delivery);
    } else {
      // Try to get from localStorage draft
      const draftStr = localStorage.getItem(DRAFT_KEY);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          setDeliveryData({
            formData: draft.formData,
            quoteData: draft.quoteData,
          });
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, [location.state]);

  // Extract data for display
  const formData = deliveryData?.formData;
  const quoteData = deliveryData?.quoteData;
  
  const deliveryId = quoteData?.id || "N/A";
  const pickupAddress = quoteData?.pickupAddress || formData?.pickupAddress || "Pickup Address";
  const dropoffAddress = quoteData?.dropoffAddress || formData?.dropoffAddress || "Drop-off Address";
  const distance = quoteData?.distanceMiles ? `${Math.round(quoteData.distanceMiles)} mi` : "—";
  const estimatedPrice = quoteData?.estimatedPrice || 0;
  const serviceType = formData?.serviceType || "home";
  const preferredDate = formData?.preferredDate || "";
  const timeWindow = formData?.timeWindow || "";
  const vehicleColor = formData?.vehicleColor || "";
  const vehicleMake = formData?.carMake || "";
  const vehicleModel = formData?.carModel || "";
  const customerEmail = formData?.email || "";
  const customerName = formData?.fullName || "";

  const serviceTypeDisplay: Record<string, string> = {
    home: "Car Transfer",
    dealer: "Car Transfer",
    service: "Car Transfer",
  };

  const nextSteps = [
    {
      step: 1,
      title: 'Review',
      description: 'We validate your request and confirm the route is within California.',
      icon: Search,
    },
    {
      step: 2,
      title: 'Match',
      description: 'Driver assignment based on availability, scheduling window, and policy.',
      icon: Users,
    },
    {
      step: 3,
      title: 'Notify',
      description: 'Status updates sent to your email. SMS optional if enabled.',
      icon: Mail,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/landing" className="flex items-center" aria-label="101 Drivers">
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
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
              >
                How it works
              </a>
              <a
                href="/landing#standard"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
              >
                Compliance
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/auth/dealer-signin"
              className="hidden sm:inline-flex items-center gap-2 px-6 py-3 rounded-full bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold text-sm transition-all"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open menu</span>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
            <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
              <a
                href="/landing#how"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
              >
                How it works
              </a>
              <a
                href="/landing#standard"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
              >
                Compliance
              </a>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <Link
                  to="/auth/dealer-signin"
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-lime-500 text-slate-950 font-extrabold text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column - Success Message */}
          <div className="lg:col-span-7">
            {/* Success Card */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
              {/* Success Banner */}
              <div className="bg-gradient-to-r from-lime-500 to-lime-600 px-7 sm:px-9 py-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-lime-950/70 text-xs font-black uppercase tracking-widest">
                      Delivery Request Submitted
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-black text-white">
                      Request Confirmed!
                    </h1>
                  </div>
                </div>
              </div>

              <CardContent className="p-7 sm:p-9">
                {/* Account Created Notice */}
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 mb-6">
                  <div className="flex items-start gap-3">
                    <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                        Your account has been created
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Email: <span className="font-bold">{customerEmail}</span>
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        Sign in with the password you created to track your delivery, view history, and manage requests.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  Your delivery request has been submitted successfully. Our team will review the details 
                  and match you with an available driver. You'll receive status updates 
                  <span className="font-bold"> by email</span> at each step.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Badge variant="secondary" className="gap-2 px-4 py-2 text-xs font-extrabold">
                    <Mail className="h-3 w-3" />
                    Email updates
                  </Badge>
                  <Badge variant="outline" className="gap-2 px-4 py-2 text-xs font-extrabold">
                    <MapPin className="h-3 w-3" />
                    California only
                  </Badge>
                  <Badge variant="outline" className="gap-2 px-4 py-2 text-xs font-extrabold">
                    <Shield className="h-3 w-3" />
                    101 Standard
                  </Badge>
                </div>

                {/* CTA Button */}
                <div className="mt-8">
                  <Link
                    to="/auth/dealer-signin"
                    className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 font-extrabold text-base transition-all"
                  >
                    <LogIn className="h-5 w-5" />
                    Sign In to Your Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Forgot Password Note */}
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Forgot your password? Use the <span className="font-bold">"Forgot Password"</span> link on the sign-in page to reset it.
                </p>
              </CardContent>
            </Card>

            {/* What Happens Next */}
            <Card className="mt-6 border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardContent className="p-7 sm:p-9">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">What happens next</h2>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {nextSteps.map((step) => {
                    const Icon = step.icon
                    return (
                      <div key={step.step} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                        <div className="w-10 h-10 rounded-xl bg-lime-500/15 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-lime-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {step.step}) {step.title}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Delivery Summary */}
          <div className="lg:col-span-5">
            {/* Delivery Details Card */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl">
              <CardContent className="p-7 sm:p-9">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Delivery Request
                    </p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      Reference #{deliveryId.substring(0, 8).toUpperCase()}
                    </h2>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                    <Route className="h-6 w-6 text-lime-500" />
                  </div>
                </div>

                {/* Route Info */}
                <div className="space-y-4">
                  {/* Pickup */}
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="w-8 h-8 rounded-lg bg-lime-500/15 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-lime-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{pickupAddress}</p>
                    </div>
                  </div>

                  {/* Drop-off */}
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="w-8 h-8 rounded-lg bg-lime-500/15 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-lime-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drop-off</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{dropoffAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Car className="h-3 w-3" />
                      Vehicle
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {vehicleColor} {vehicleMake} {vehicleModel}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Route className="h-3 w-3" />
                      Distance
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{distance}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Calendar className="h-3 w-3" />
                      Date
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {preferredDate || "TBD"}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Clock className="h-3 w-3" />
                      Time Window
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {timeWindow || "TBD"}
                    </p>
                  </div>
                </div>

                {/* Service Type */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Type</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {serviceTypeDisplay[serviceType] || serviceType}
                  </p>
                </div>

                {/* Price */}
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Price</p>
                    <p className="text-2xl font-black text-lime-500">${estimatedPrice.toFixed(2)}</p>
                  </div>
                  <Badge variant="secondary" className="px-3 py-1">
                    Pending Review
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Sign In CTA */}
            <Card className="mt-6 border-lime-200 dark:border-lime-900/30 rounded-3xl bg-lime-50 dark:bg-lime-900/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center flex-shrink-0">
                    <LogIn className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white">Access Your Dashboard</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Sign in to track deliveries, view history, and manage your account.
                    </p>
                    <Link
                      to="/auth/dealer-signin"
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-lime-500 text-slate-950 font-bold text-sm hover:bg-lime-600 transition"
                    >
                      Sign In Now
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* The 101 Standard */}
            <Card className="mt-6 border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-lime-500" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white">The 101 Standard</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Every delivery includes VIN last-4 verification, photo documentation, odometer logging, 
                  GPS tracking, and a complete post-trip report.
                </p>
                <a
                  href="/landing#standard"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-lime-600 dark:text-lime-400 hover:underline"
                >
                  <Verified className="h-4 w-4" />
                  Learn More
                </a>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-8 mt-14">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">101 Drivers</p>
                <p className="text-xs text-slate-500">California-only operations</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">© 2024 101 Drivers Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
