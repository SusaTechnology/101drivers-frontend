//@ts-nocheck
/**
 * IndividualSignUp — page wrapper for the personal customer signup.
 *
 * Mirrors the DealerSignUp page structure (header + form) but renders
 * the IndividualSignupForm instead of DealerSignupForm.
 * No Google Maps API needed (no business directory search).
 */
import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LogIn as LoginIcon,
  Menu,
  X,
  Building,
  UserCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndividualSignupForm } from "./IndividualSignupForm";

export function IndividualSignUp() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header — same structure as DealerSignUp for consistency */}
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
                Pricing
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth/dealer-signin" className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors">
              <LoginIcon className="w-4 h-4" />
              Sign in
            </Link>
            <Button asChild className="hidden sm:inline-flex bg-primary text-slate-950 hover:bg-primary/90 rounded-xl">
              <Link to="/auth/dealer-signup">Business signup</Link>
            </Button>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark">
            <div className="px-6 py-4 space-y-3">
              <a
                href="/home#how"
                className="block text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary"
              >
                How it works
              </a>
              <a
                href="/home#standard"
                className="block text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary"
              >
                Pricing
              </a>
              <Link
                to="/auth/dealer-signin"
                className="block text-sm font-bold text-slate-700 dark:text-slate-300"
              >
                Sign in
              </Link>
              <Link
                to="/auth/dealer-signup"
                className="block text-sm font-bold text-primary"
              >
                Business signup
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-md mx-auto">
          {/* Back link */}
          <div className="mb-6">
            <Link
              to="/home"
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
            >
              ← Back to home
            </Link>
          </div>

          {/* Signup type switcher — card-style buttons matching the homepage.
              Personal is the active/selected option here (dark bg + checkmark). */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            {/* Personal Delivery — selected (this is the personal signup page) */}
            <Link
              to="/auth/individual-signup"
              className="flex-1 group relative cursor-pointer rounded-2xl bg-slate-900 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-lg shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
            >
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-lime-400 flex items-center justify-center shadow-md">
                <CheckCircle className="w-4 h-4 text-slate-900" strokeWidth={3} />
              </div>
              <div className="p-4 sm:p-5 text-left">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <UserCircle className="w-4 h-4 text-lime-400" />
                  </div>
                  <span className="text-base font-extrabold text-white">
                    Personal Delivery
                  </span>
                </div>
                <p className="text-xs text-slate-300 dark:text-slate-400 leading-relaxed">
                  Pay per delivery with upfront pricing
                </p>
              </div>
            </Link>
            {/* Business Delivery — not selected, light card */}
            <Link
              to="/auth/dealer-signup"
              className="flex-1 group relative cursor-pointer rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none hover:shadow-xl hover:border-lime-400 dark:hover:border-lime-500 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
            >
              <div className="p-4 sm:p-5 text-left">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-lime-500 transition-colors" />
                  </div>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    Business Delivery
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Weekly invoiced billing + postpaid options
                </p>
              </div>
            </Link>
          </div>

          <IndividualSignupForm />
        </div>
      </main>
    </div>
  );
}
