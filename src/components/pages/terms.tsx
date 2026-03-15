// terms-of-service.tsx
import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  Menu,
  X,
  Gavel,
  CheckCircle,
  Shield,
  Mail,
  Users,
  AlertCircle,
  Info,
  FileSearch,
  UserCheck,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TermsOfService() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Header component
  const Header = () => (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
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
            <Link
              to="/"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Landing
            </Link>
            <Link
              to="/about"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              About
            </Link>
            <Link
              to="/privacy"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-sm font-semibold text-lime-500"
              aria-current="page"
            >
              Terms
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/quote"
            className="inline-flex items-center gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 px-6 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-lime-500/20 transition-all font-extrabold"
          >
            Request a Delivery
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Landing
            </Link>
            <Link
              to="/about"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              About
            </Link>
            <Link
              to="/privacy"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/quote"
              className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-lime-500 text-slate-950 hover:opacity-95 transition"
            >
              Request a Delivery
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  )

  // Footer component
  const Footer = () => (
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
              California-only operations • Email-first notifications
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">© 2024 101 Drivers Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />
      
      <main className="w-full max-w-[1024px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
          <CardContent className="p-7 sm:p-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
                <Gavel className="h-6 w-6 text-lime-500 font-bold" />
              </div>
              <div>
                <CardTitle className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  Terms of Service
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Placeholder page for stakeholder review. Final legal text will be published before production launch.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                  Effective date: <span className="font-bold">TBD</span>
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6 text-slate-600 dark:text-slate-300">
              <p className="text-sm leading-relaxed">
                These Terms will govern your use of the 101 Drivers platform, including quote requests, delivery coordination, and compliance evidence handling.
                The final version will be aligned with the PRD and applicable laws for California operations.
              </p>

              {/* Key concepts */}
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <CardContent className="p-5">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileSearch className="h-5 w-5 text-lime-500" />
                    Key concepts (high-level)
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm list-disc pl-5">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <span>Quote-first flow: you can view an estimate before providing additional details.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <span>Compliance evidence: deliveries may require photos, odometer readings, and VIN last-4 verification.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <span>Notifications: email-first updates (SMS optional if enabled by Admin policy).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Settings className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <span>Platform rules: cancellation, rescheduling, and dispute handling will follow published policies.</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Accounts & eligibility */}
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <CardContent className="p-5">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-lime-500" />
                    Accounts & eligibility (placeholder)
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm list-disc pl-5">
                    <li>Dealers/individual customers may create delivery requests after authentication (when enabled).</li>
                    <li>Drivers may require onboarding and approval before booking jobs.</li>
                    <li>Admin oversight may be required for certain operations and compliance.</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Info alert */}
              <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                <Info className="h-5 w-5 text-amber-500" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                  This page is intentionally non-legal placeholder text for prototype review. Replace with attorney-reviewed terms before launch.
                </p>
              </div>

              {/* Action buttons */}
              <div className="pt-3 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                >
                  <ArrowLeft className="h-4 w-4 text-lime-500" />
                  Back to Home
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 transition font-extrabold"
                >
                  Go to Landing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  )
}