//@ts-nocheck
import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config';
import {
  LogIn as LoginIcon,
  Menu,
  X,
  Building,
  UserCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealerSignupForm } from "./DealerSignupForm";

export function DealerSignUp() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
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
        <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
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
                Pay per delivery with upfront pricing
              </p>
            </div>
          </Link>
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
                Weekly invoiced billing + postpaid options
              </p>
            </div>
          </Link>
        </div>
      </div>

      <main className="w-full">
        <DealerSignupForm isLoaded={isLoaded} />
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
                Business signup • Pending approval • Email-first
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2026 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
