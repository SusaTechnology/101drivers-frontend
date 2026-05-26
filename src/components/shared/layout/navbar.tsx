// src/routes/about/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight as ArrowForward, Menu } from "lucide-react";
import { RightHemisphereNav } from "./rightHemisphereNav";

export const NavBar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-10">
          {/* Logo ONLY */}
          <Link to="/" className="flex items-center" aria-label="101 Drivers">
            <div
              className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200"
              title="101 Drivers"
            >
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/landing#how"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              How it works
            </Link>
            <Link
              to="/landing#standard"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Compliance
            </Link>
            <Link
              to="/landing#dealers"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Dealers
            </Link>
            <Link
              to="/landing#drivers"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Drivers
            </Link>
            {/* <Link
              to="/about"
              className="text-sm font-semibold text-primary dark:text-primary hover:text-primary transition-colors"
              aria-current="page"
            >
              About
            </Link> */}
          </nav>
        </div>

        <RightHemisphereNav />
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/landing#how"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              How it works
            </Link>
            <Link
              to="/landing#standard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Compliance
            </Link>
            <Link
              to="/landing#dealers"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dealers
            </Link>
            <Link
              to="/landing#drivers"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Drivers
            </Link>
            <Link
              to="/about"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <Link
                to="/auth/dealer-signin"
                className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dealer Sign In
              </Link>
              <a
                href="/driver-signin"
                className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Driver Sign In
              </a>
              <Link
                to="/landing#quote"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-lime-500 text-slate-950 hover:opacity-95 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Request a Delivery
                <ArrowForward className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
