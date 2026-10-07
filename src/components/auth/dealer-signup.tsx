//@ts-nocheck
import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "../shared/SiteFooter"
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config';
import {
  LogIn as LoginIcon,
  Menu,
  X,
  Building,
  UserCircle,
  CheckCircle,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealerSignupForm } from "./DealerSignupForm";

export function DealerSignUp() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ─── Landing-page quote handoff ─────────────────────────────────────
  // A business visitor who quoted on the public landing page arrives with
  // a quoteDraft in localStorage (written by "Sign up and request a
  // delivery"). Show their saved request — addresses + the real price —
  // with the same confirm question as the personal signup page:
  // "Use the same addresses?" Confirm collapses the card; editing goes
  // back to the landing map (which remembers the addresses). After signup
  // (once approved and logged in) the dashboard attaches the saved quote
  // as a server-side draft, so nothing has to be retyped.
  const [savedDraft, setSavedDraft] = useState<any>(null);
  const [addressesConfirmed, setAddressesConfirmed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("quoteDraft");
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.deliveryType === "BUSINESS" && draft?.quoteData?.id) {
        setSavedDraft(draft);
        if (draft.addressesConfirmed) setAddressesConfirmed(true);
      }
    } catch { /* ignore malformed draft */ }
  }, []);

  const confirmSavedAddresses = () => {
    setAddressesConfirmed(true);
    try {
      const raw = localStorage.getItem("quoteDraft");
      if (raw) {
        const draft = JSON.parse(raw);
        draft.addressesConfirmed = true;
        localStorage.setItem("quoteDraft", JSON.stringify(draft));
      }
    } catch { /* ignore */ }
  };

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
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
                href="/home#how"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                How it works
              </a>
              <a
                href="/home#standard"
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
              Log In
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

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top">
            <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
              <a
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                href="/home#how"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it works
              </a>
              <a
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                href="/home#standard"
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
                  Log In
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Signup type switcher — card-style buttons matching the homepage.
          Business is the active/selected option here (dark bg + checkmark). */}
      <div className="w-full max-w-[1100px] mx-auto px-6 lg:px-8 pt-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white text-center mb-4">
          Choose your delivery type.
        </h1>
        <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">

                    {/* Business Delivery — selected (this is the business signup page) */}
          <Link
            to="/auth/dealer-signup"
            className="flex-1 group relative cursor-pointer rounded-2xl bg-slate-900 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-lg shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-lime-400 flex items-center justify-center shadow-md">
              <CheckCircle className="w-4 h-4 text-slate-900" strokeWidth={3} />
            </div>
            <div className="p-4 sm:p-5 text-left">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Building className="w-4 h-4 text-lime-400" />
                </div>
                <span className="text-base font-extrabold text-white">
                  Business Delivery
                </span>
              </div>
              <p className="text-xs text-slate-300 dark:text-slate-400 leading-relaxed">
                For dealerships, rental companies, and other business needing vehicle delivery services.
              </p>
            </div>
          </Link>
          
          {/* Personal Delivery — not selected, light card */}
          <Link
            to="/auth/individual-signup"
            className="flex-1 group relative cursor-pointer rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none hover:shadow-xl hover:border-lime-400 dark:hover:border-lime-500 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            <div className="p-4 sm:p-5 text-left">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <UserCircle className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-lime-500 transition-colors" />
                </div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  Personal Delivery
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                For individuals who need their own car moved from point A to point B
              </p>
            </div>
          </Link>
        </div>
      </div>
<div className="text-center pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                to="/auth/dealer-signin"
                className="text-primary hover:underline font-semibold"
              >
                Sign in
              </Link>
            </span>
          </div>
      {/* Saved request from the landing page — "Use the same addresses?"
          (same card as the personal signup page, BUSINESS flavor) */}
      {savedDraft && (
        <div className="w-full max-w-[1100px] mx-auto px-6 lg:px-8">
          <div className="max-w-md mx-auto mb-6">
            {addressesConfirmed ? (
              <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
                <CheckCircle className="w-4 h-4 text-lime-600 dark:text-lime-400 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                  Using your saved addresses — {savedDraft.pickupAddress || "Pickup"} → {savedDraft.dropoffAddress || "Drop-off"}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-lime-400/60 dark:border-lime-500/40 shadow-lg shadow-slate-200/50 dark:shadow-none">
                <p className="text-xs font-black uppercase tracking-widest text-lime-600 dark:text-lime-400">
                  Your delivery request is saved
                </p>
                <div className="mt-2.5 space-y-1.5 text-sm">
                  <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <MapPin className="w-4 h-4 text-lime-600 dark:text-lime-400 mt-0.5 shrink-0" />
                    <span className="font-semibold break-words">{savedDraft.pickupAddress || "Pickup"}</span>
                  </p>
                  <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <span className="font-semibold break-words">{savedDraft.dropoffAddress || "Drop-off"}</span>
                  </p>
                </div>
                {typeof savedDraft.quoteData?.estimatedPrice === "number" && (
                  <p className="mt-2.5 text-sm font-extrabold text-slate-900 dark:text-white">
                    ${savedDraft.quoteData.estimatedPrice.toFixed(2)} — prepaid
                    {savedDraft.quoteData?.distanceMiles != null && (
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                        {" \u00b7 "}{Math.round(savedDraft.quoteData.distanceMiles)} mi
                      </span>
                    )}
                  </p>
                )}
                <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                  Use the same addresses?
                </p>
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <Button
                    className="flex-1 bg-primary text-slate-950 hover:bg-primary/90 rounded-xl font-extrabold"
                    onClick={confirmSavedAddresses}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Yes, use these
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl font-extrabold"
                    asChild
                  >
                    <a href="/home#quote">Edit addresses</a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <main className="w-full">
        <DealerSignupForm isLoaded={isLoaded} />
      </main>

      <SiteFooter />
    </div>
  );
}
