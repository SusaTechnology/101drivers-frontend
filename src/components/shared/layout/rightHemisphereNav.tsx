//@ts-nocheck
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight as ArrowForward,
  Menu,
  X,
  MapPin as PersonPin,
  Store,
  LogIn,
  Car,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const RightHemisphereNav = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {/* Dealer Sign In - Primary */}
      <Link
        to="/auth/dealer-signin"
        className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-500 text-slate-950 font-bold text-sm hover:bg-lime-600 transition-colors"
      >
        <Building className="w-4 h-4" />
        Dealer Sign In
      </Link>

      {/* Driver Sign In - Secondary */}
      <Link
        to="/driver-signin"
        className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Car className="w-4 h-4" />
        Driver Sign In
      </Link>

      {/* Become a Driver */}
      <Link
        to="/driver-onboarding"
        className="hidden xl:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <PersonPin className="w-4 h-4" />
        Become a Driver
      </Link>

      {/* Become a Dealer */}
      <Link
        to="/auth/dealer-signup"
        className="hidden xl:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <Store className="h-4 w-4 text-lime-500" />
        Become a Dealer
      </Link>

      {/* Request a Delivery - CTA */}
      <Button
        className="bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-5 py-2.5 rounded-full text-sm hover:opacity-90 transition-all hidden sm:inline-flex items-center gap-2"
        asChild
      >
        <a href="#quote">
          Request a Delivery
          <ArrowForward className="w-4 h-4" />
        </a>
      </Button>

      {/* Mobile Menu Toggle */}
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

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-20 right-4 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 flex flex-col gap-2">
          <Link
            to="/auth/dealer-signin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-lime-500 text-slate-950 font-bold text-sm"
          >
            <Building className="w-4 h-4" />
            Dealer Sign In
          </Link>
          <Link
            to="/driver-signin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm"
          >
            <Car className="w-4 h-4" />
            Driver Sign In
          </Link>
          <div className="border-t border-slate-200 dark:border-slate-700 my-2" />
          <Link
            to="/driver-onboarding"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <PersonPin className="w-4 h-4" />
            Become a Driver
          </Link>
          <Link
            to="/auth/dealer-signup"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Store className="w-4 h-4" />
            Become a Dealer
          </Link>
          <a
            href="#quote"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold text-sm mt-2"
          >
            Request a Delivery
            <ArrowForward className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
};
