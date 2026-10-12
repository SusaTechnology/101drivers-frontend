// src/routes/about/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type MouseEvent } from "react";
import { ArrowRight as ArrowForward, Menu } from "lucide-react";
import { RightHemisphereNav } from "./rightHemisphereNav";
import {
  useRequestDelivery,
  selectSignupCardOnLanding,
  type SignupCard,
} from "@/hooks/useRequestDelivery";

/**
 * Smooth-scroll to a landing-page section when we're ALREADY on it.
 *
 * These tabs are hash links to /home — clicking one while the landing
 * page is open changes no route, so nothing re-scrolled and the tab felt
 * dead (the user's report: "clicking does nothing... over and over").
 * When we're on the landing page (it lives at both "/" and "/home") we
 * take over: glide to the section and keep the URL hash in sync. From
 * any other page we do nothing here and let the <Link> navigate
 * normally — the landing page handles the section on arrival.
 *
 * Business and Personal BOTH land on the #dealers signup section — the
 * user asked for Personal to move there from #quote. Since two tabs now
 * share one section, the clicked tab is expressed by the matching signup
 * card switching to its selected color (dark + lime ring + check); the
 * handler dispatches "101drivers:select-signup-card" on the landing page.
 * The hash carries the card (e.g. #dealers-personal) so cross-page
 * navigation and refresh re-select the same card — homePage parses it.
 *   How it works → #how                  (step-by-step cards)
 *   Business     → #dealers-business     (signup cards, Business colored)
 *   Personal     → #dealers-personal     (signup cards, Personal colored)
 *   Drivers      → #jointhewaitlist      ("Be Your Own Boss" recruitment)
 */
const makeSectionNavHandler = (sectionId: string, card?: SignupCard) =>
  (e: MouseEvent<HTMLAnchorElement>) => {
  const { pathname } = window.location;
  if (pathname !== "/" && pathname !== "/home") return;
  e.preventDefault();
  document
    .getElementById(sectionId)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (card) selectSignupCardOnLanding(card);
  try {
    const hash = card ? `${sectionId}-${card.toLowerCase()}` : sectionId;
    history.replaceState(null, "", `${pathname}#${hash}`);
  } catch { /* ignore */ }
};

export const NavBar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { requestDelivery } = useRequestDelivery();

  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
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
                width={40}
                height={40}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/home#how"
              onClick={makeSectionNavHandler("how")}
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              How it works
            </Link>
            <Link
              to="/home#dealers-business"
              onClick={makeSectionNavHandler("dealers", "BUSINESS")}
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Business
            </Link>
            <Link
              to="/home#dealers-personal"
              onClick={makeSectionNavHandler("dealers", "PERSONAL")}
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Personal
            </Link>
            <Link
              to="/home#jointhewaitlist"
              onClick={makeSectionNavHandler("jointhewaitlist")}
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
              to="/home#how"
              onClick={(e) => { setMobileMenuOpen(false); makeSectionNavHandler("how")(e); }}
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
            >
              How it works
            </Link>
            <Link
              to="/home#dealers-business"
              onClick={(e) => { setMobileMenuOpen(false); makeSectionNavHandler("dealers", "BUSINESS")(e); }}
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
            >
              Business
            </Link>
            <Link
              to="/home#dealers-personal"
              onClick={(e) => { setMobileMenuOpen(false); makeSectionNavHandler("dealers", "PERSONAL")(e); }}
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
            >
              Personal
            </Link>
            <Link
              to="/home#jointhewaitlist"
              onClick={(e) => { setMobileMenuOpen(false); makeSectionNavHandler("jointhewaitlist")(e); }}
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
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
              {/* Auth-aware CTA: logged-in customers open the delivery request
                  directly; logged-out visitors go to the delivery-type chooser.
                  The old /home#quote Link dumped everyone on the home page. */}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-lime-500 text-slate-950 hover:opacity-95 transition"
                onClick={() => {
                  setMobileMenuOpen(false);
                  requestDelivery();
                }}
              >
                Request a Delivery
                <ArrowForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
