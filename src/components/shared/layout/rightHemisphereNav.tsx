//@ts-nocheck
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight as ArrowForward,
  Menu,
  X,
  MapPin as PersonPin,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const RightHemisphereNav = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-4">
      {/* Dealer Sign In with userType=dealer */}
      <Link
        to="/auth/dealer-signin"
        search={{ userType: "dealer" }}
        className="hidden lg:inline-flex text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
      >
        Dealer Sign In
      </Link>

      {/* Driver Sign In with userType=driver */}
      <Link
        to="/auth/dealer-signin" // Same page but different param
        search={{ userType: "driver" }}
        className="hidden lg:inline-flex text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
      >
        Driver Sign In
      </Link>

      <Link
        to="/driver-onboarding"
        className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <PersonPin className="w-4 h-4" />
        Become a Driver
      </Link>
      <Link
        to="/auth/dealer-signup"
        className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      >
        <Store className="h-4 w-4 text-lime-500" />
        Become a Dealer
        
      </Link>

      <Button
        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-primary/20 transition-all inline-flex items-center gap-2"
        asChild
      >
        <a href="#quote">
          Request a Delivery
          <ArrowForward className="w-4 h-4" />
        </a>
      </Button>

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
  );
};
