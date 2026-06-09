//@ts-nocheck
import { Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  ArrowRight as ArrowForward,
  LogIn,
  Building,
  Car,
  ChevronDown,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const RightHemisphereNav = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dotsMenuOpen, setDotsMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dotsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (dotsMenuRef.current && !dotsMenuRef.current.contains(e.target as Node)) {
        setDotsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loginItems = [
    { label: "Customer", icon: Building, to: "/auth/dealer-signin" },
    { label: "Driver", icon: Car, to: "/driver-signin" },
  ];

  return (
    <div className="flex items-center gap-3">
      {/* Log in dropdown — desktop */}
      <div className="hidden md:block relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Log in
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 flex flex-col gap-1">
            {loginItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <item.icon className="w-4 h-4 text-slate-400" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

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

      {/* Mobile Login / Sign Up button — compact pill */}
      <button
        onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setDotsMenuOpen(false); }}
        className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Log in</span>
      </button>

      {/* Mobile Hamburger Menu Button */}
      <button
        onClick={() => { setDotsMenuOpen(!dotsMenuOpen); setMobileMenuOpen(false); }}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        aria-label="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Login Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-20 right-16 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 flex flex-col gap-1">
          {loginItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <item.icon className="w-4 h-4 text-slate-400" />
              {item.label}
            </Link>
          ))}
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          <a
            href="#quote"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-lime-500 text-slate-950 font-bold text-sm hover:bg-lime-600 transition-colors"
          >
            Request a Delivery
            <ArrowForward className="w-4 h-4" />
          </a>
        </div>
      )}

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
        </div>
      )}
    </div>
  );
};
