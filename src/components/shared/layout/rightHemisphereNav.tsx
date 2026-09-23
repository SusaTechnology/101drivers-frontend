//@ts-nocheck
import { Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  ArrowRight as ArrowForward,
  LogIn,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const RightHemisphereNav = () => {
  const [dotsMenuOpen, setDotsMenuOpen] = useState(false);
  const dotsMenuRef = useRef<HTMLDivElement>(null);

  // Close dots menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dotsMenuRef.current && !dotsMenuRef.current.contains(e.target as Node)) {
        setDotsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Owner request: tapping "Log in / Sign Up" must land the customer DIRECTLY
  // on the "Choose your delivery type." section of the home page (the Business
  // vs Personal cards) — no intermediate Customer/Driver choice dropdown.
  // That section also carries an "Already have an account? Log in" link, so
  // login is covered there too. Drivers keep one-tap login via the mobile
  // dots menu ("Driver Login") and the Drivers section on desktop.

  return (
    <div className="flex items-center gap-3">
      {/* Log in / Sign Up — desktop: straight to Choose your delivery type */}
      <Link
        to="/home#dealers"
        className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Log in / Sign Up
      </Link>

      {/* Request a Delivery — CTA */}
      <Button
        className="bg-lime-500 text-slate-950 hover:bg-lime-600 px-5 py-2.5 rounded-full text-sm font-bold transition-all hidden sm:inline-flex items-center gap-2"
        asChild
      >
        <a href="#quote">
          Request a Delivery
          <ArrowForward className="w-4 h-4" />
        </a>
      </Button>

      {/* Mobile Log in / Sign Up — straight to Choose your delivery type */}
      <Link
        to="/home#dealers"
        className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Log in / Sign Up</span>
      </Link>

      {/* Mobile Hamburger Menu Button */}
      <button
        onClick={() => setDotsMenuOpen(!dotsMenuOpen)}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        aria-label="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Three-Dots Menu Dropdown */}
      {dotsMenuOpen && (
        <div ref={dotsMenuRef} className="absolute top-20 right-4 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 flex flex-col gap-1">
          <a
            href="#how"
            onClick={() => setDotsMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            How it Works
          </a>
          <Link
            to="/about"
            onClick={() => setDotsMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            About Us
          </Link>
          <Link
            to="/about#help"
            onClick={() => setDotsMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Help
          </Link>
          <a
            href="mailto:support@101drivers.com"
            onClick={() => setDotsMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Contact
          </a>
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          {/* Driver login keeps a one-tap home after the Customer/Driver
              dropdown was removed from the Log in / Sign Up button */}
          <Link
            to="/driver-signin"
            onClick={() => setDotsMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Driver Login
          </Link>
        </div>
      )}
    </div>
  );
};
