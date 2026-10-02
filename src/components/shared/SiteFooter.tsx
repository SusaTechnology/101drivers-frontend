import { Link } from "@tanstack/react-router";

import { SocialLinks } from "./SocialLinks";
import { WhatsAppIcon } from "./WhatsAppSupportButton";

/**
 * SiteFooter — the shared three-section public footer (Customers /
 * Drivers / Company) for the standalone public pages (news, careers,
 * blog). The landing page (homePage.tsx) and the About page keep their
 * own inline footers with the SAME structure — they predate this
 * component; consolidating them is a separate decision.
 */
export function SiteFooter() {
  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-8">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand blurb */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-base font-black tracking-tightest uppercase text-slate-900 dark:text-white">
                101 Drivers
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              101 Drivers is a platform that connects drivers with businesses
              and individuals who need drivers.
            </p>
          </div>

          {/* Customers — one section per user type so logins, signups and
              help never mix. */}
          <div>
            <h5 className="font-extrabold mb-4 uppercase text-[10px] tracking-widest text-slate-400">
              Customers
            </h5>
            <ul className="space-y-2.5 text-sm">
              <li>
                {/* Auth hub: sign-in for both customer types + the
                    business/personal sign-up choice live on this page. */}
                <Link
                  to="/auth/dealer-signin"
                  className="font-bold text-slate-900 dark:text-white hover:text-lime-500 transition-colors"
                >
                  Customer Login / Sign Up
                </Link>
              </li>
              <li>
                <Link
                  to="/help-customer"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  Customer Help
                </Link>
              </li>
            </ul>
          </div>

          {/* Drivers */}
          <div>
            <h5 className="font-extrabold mb-4 uppercase text-[10px] tracking-widest text-slate-400">
              Drivers
            </h5>
            <ul className="space-y-2.5 text-sm">
              <li>
                {/* Auth hub: driver sign-in + "Become a Driver" onboarding
                    live on this page. */}
                <Link
                  to="/driver-signin"
                  className="font-bold text-slate-900 dark:text-white hover:text-lime-500 transition-colors"
                >
                  Driver Sign Up / Login
                </Link>
              </li>
              <li>
                <Link
                  to="/help-driver"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  Driver Help
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h5 className="font-extrabold mb-4 uppercase text-[10px] tracking-widest text-slate-400">
              Company
            </h5>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/about"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/news"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  News
                </Link>
              </li>
              <li>
                <Link
                  to="/careers"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  to="/help-customer"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  to="/help-customer"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="https://wa.me/message/YQXTDFV6STKUP1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-[#25D366] hover:opacity-80 transition-opacity"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Social — Instagram / X / YouTube / WhatsApp */}
        <SocialLinks className="mb-6" />

        {/* Legal — pipe-separated, one line */}
        <div className="mb-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <Link
              to="/privacy"
              className="hover:text-lime-500 transition-colors"
            >
              Privacy Policy
            </Link>
            {" "}&bull;{" "}
            <Link to="/terms" className="hover:text-lime-500 transition-colors">
              Terms of Service
            </Link>
          </p>
        </div>

        {/* Bottom line */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em]">
            Strictly California-only operations
          </p>
          <p className="text-xs text-slate-500 font-medium">
            &copy; 2026 101 Drivers Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
