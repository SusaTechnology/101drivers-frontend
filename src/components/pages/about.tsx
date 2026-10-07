// src/routes/about/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Verified,
  Bolt,
  CheckCircle2 as FactCheck,
  MailCheck as MarkEmailRead,
  Route,
  BadgeCheck as VerifiedUser,
  LifeBuoy as SupportAgent,
  Eye as Visibility,
  Shield,
  Gauge as Speed,
  MapPin as LocationOn,
  ArrowRight as ArrowForward,
  User as PersonPin,
  Info,
  Store,
  Menu,
} from "lucide-react";
import { NavBar } from "../shared/layout/navbar";
import { SEOHead } from "../shared/SEOHead";
import { SiteFooter } from "../shared/SiteFooter";

function AboutPage() {

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <SEOHead
        title="About Us | 101 Drivers — California Vehicle Delivery Marketplace"
        description="Learn about 101 Drivers: California's compliance-first, flat-rate vehicle delivery service for dealerships and individuals with documented proof and GPS tracking at every step."
        canonicalUrl="https://101drivers.com/about"
        schema={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": "About 101 Drivers",
          "description": "Learn about 101 Drivers: California's compliance-first, flat-rate vehicle delivery service for dealerships and individuals.",
          "url": "https://101drivers.com/about",
          "mainEntity": {
            "@type": "Organization",
            "name": "101 Drivers",
            "url": "https://101drivers.com/",
            "logo": "https://101drivers.com/assets/101drivers-logo.jpg",
            "areaServed": "California"
          }
        }}
      />
      {/* Header */}
      <NavBar />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
              <Verified className="w-4 h-4 font-bold text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700">
                California Operations Only
              </span>
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.06] text-slate-900 dark:text-white">
              Compliance-first vehicle delivery,
              <span className="text-primary italic"> built for trust.</span>
            </h1>

            <p className="mt-6 text-lg lg:text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-[720px]">
              101 Drivers is a California-focused vehicle delivery marketplace
              designed around a simple idea: get a quote fast, then deliver with
              documented proof at every step.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/home#quote"
                className="lime-btn px-8 py-4 rounded-2xl text-base hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
              >
                Get an Instant Quote
                <ArrowForward className="w-5 h-5" />
              </Link>
              <a
                href="/driver-onboarding"
                className="px-8 py-4 rounded-2xl text-base font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-2"
              >
                Become a Driver
                <PersonPin className="w-5 h-5 text-primary" />
              </a>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover-lift">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                  <Bolt className="w-6 h-6 text-primary font-bold" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Quote-first
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  See route + estimate before entering details.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover-lift">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                  <FactCheck className="w-6 h-6 text-primary font-bold" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Proof-driven
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  VIN last-4, photos, odometer, and delivery report.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover-lift">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                  <MarkEmailRead className="w-6 h-6 text-primary font-bold" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Email-first
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Updates sent by email (SMS optional if enabled).
                </p>
              </div>
            </div>
          </div>

          {/* Right card */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-7 sm:p-8 hover-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Our focus
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                    California-only operations
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    We operate in California and optimize for local compliance,
                    reliability, and fast communication.
                  </p>
                </div>

                <div
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300"
                  title="California only"
                >
                  <LocationOn className="w-4 h-4 text-primary" />
                  CA Only
                </div>
              </div>

              <div className="mt-7 space-y-4">
                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Route className="w-6 h-6 text-primary font-bold" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      Transparent pricing flow
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Quote first, then choose your schedule.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <VerifiedUser className="w-6 h-6 text-primary font-bold" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      Verified delivery steps
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Pickup and drop-off checklists ensure proof and
                      accountability.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <SupportAgent className="w-6 h-6 text-primary font-bold" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      Operations visibility
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Admin review, driver assignment, and status updates for
                      all parties.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                <Info className="w-5 h-5 text-amber-500" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                  Pricing, routing, and notifications reflect current system policy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="mt-14 lg:mt-18">
          <div className="max-w-2xl">
            <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              What we believe
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-4">
              We're building a delivery marketplace where every relocation is
              predictable, documented, and easy to track.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 hover-lift">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                <Visibility className="w-6 h-6 text-primary font-bold" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Transparency
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Stakeholders see status updates and compliance proofs throughout
                the job.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 hover-lift">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                <Shield className="w-6 h-6 text-primary font-bold" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Compliance
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                VIN last-4 verification, photos, odometer readings, and a
                post-trip report.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 hover-lift">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                <Speed className="w-6 h-6 text-primary font-bold" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Reliability
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Clear steps for booking, pickup, transit, and drop-off—no
                surprises.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-14 lg:mt-18">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 hover-lift">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  Ready to move a vehicle?
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-lg mt-3 max-w-2xl">
                  Get an estimate first, then provide details. We'll send
                  updates by email (SMS optional if enabled).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/home#quote"
                  className="lime-btn px-8 py-4 rounded-2xl text-base hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                >
                  Get an Instant Quote
                  <ArrowForward className="w-5 h-5" />
                </Link>
                {/* <a
                  href="/dealer-inquiry"
                  className="px-8 py-4 rounded-2xl text-base font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
                >
                  Dealer Inquiry
                  <Store className="w-5 h-5 text-primary" />
                </a> */}
              </div>
            </div>
          </div>

          <p className="mt-6 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Additional links and features are added as the platform expands.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default AboutPage;
