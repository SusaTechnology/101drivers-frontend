//@ts-nocheck
import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config';
import {
  LogIn as LoginIcon,
  Menu,
  X,
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
                  Log In
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

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
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
