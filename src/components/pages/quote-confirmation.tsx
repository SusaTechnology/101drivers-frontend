// quote-submitted.tsx
import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle,
  Mail,
  MapPin,
  Shield,
  ArrowRight,
  Plus,
  Menu,
  X,
  Search,
  Users,
  Truck,
  Home,
  Calendar,
  Clock,
  Ruler,
  Edit,
  Route,
  Settings,
  LogIn,
  Verified,
  Info,
  ChevronRight,
  FileText,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function QuoteConfirmation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const quote = {
    id: 'Q-101-000123',
    pickup: 'San Francisco, CA',
    dropoff: 'Los Angeles, CA',
    distance: '142 mi',
    serviceType: 'Home',
    timeWindow: 'Morning',
    date: '2026-01-25',
    vehicle: '2023 Toyota Camry',
    price: 230.00,
    status: 'submitted',
  }

  const nextSteps = [
    {
      step: 1,
      title: 'Review',
      description: 'We validate the request details and confirm the route is within California.',
      icon: Search,
    },
    {
      step: 2,
      title: 'Match',
      description: 'Driver assignment is based on availability, scheduling window, and policy.',
      icon: Users,
    },
    {
      step: 3,
      title: 'Notify',
      description: 'Status updates are emailed. SMS can be used only if enabled by Admin policy.',
      icon: Mail,
    },
  ]

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
            <a
              href="/#how"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              How it works
            </a>
            <a
              href="/#standard"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Compliance
            </a>
            <a
              href="/#dealers"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Dealers
            </a>
            <a
              href="/#drivers"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Drivers
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/dealer/signin"
            className="hidden lg:inline-flex text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
          >
            Dealer Sign In
          </Link>
          <Link
            to="/driver/signin"
            className="hidden lg:inline-flex text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
          >
            Driver Sign In
          </Link>

          <Link
            to="/quote"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <Plus className="h-4 w-4" />
            New Quote
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
            <a
              href="/#how"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              How it works
            </a>
            <a
              href="/#standard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Compliance
            </a>
            <a
              href="/#dealers"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dealers
            </a>
            <a
              href="/#drivers"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Drivers
            </a>
            <Separator className="my-2" />
            <Link
              to="/quote"
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors"
            >
              New Quote
            </Link>
            <Link
              to="/dealer/signin"
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors"
            >
              Dealer Sign In
            </Link>
            <Link
              to="/driver/signin"
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors"
            >
              Driver Sign In
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
      
      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Success hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl">
              <CardContent className="p-7 sm:p-9">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-3xl bg-lime-500/15 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-lime-500" />
                  </div>

                  <div className="flex-1">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Request Submitted
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mt-2 leading-tight">
                      We received your delivery request.
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 mt-4 leading-relaxed max-w-2xl">
                      Next steps: our team reviews the request, confirms eligibility (California-only), and
                      then we match you with an available driver. Updates are sent
                      <span className="font-bold"> by email first</span> (SMS optional if enabled by Admin policy).
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Badge variant="secondary" className="gap-2 px-4 py-2 text-xs font-extrabold">
                        <Mail className="h-3 w-3" />
                        Email-first notifications
                      </Badge>
                      <Badge variant="outline" className="gap-2 px-4 py-2 text-xs font-extrabold">
                        <MapPin className="h-3 w-3" />
                        California only
                      </Badge>
                      <Badge variant="outline" className="gap-2 px-4 py-2 text-xs font-extrabold">
                        <Shield className="h-3 w-3" />
                        Compliance-driven flow
                      </Badge>
                    </div>

                    <div className="mt-7 flex flex-col sm:flex-row gap-3">
                      <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 font-extrabold text-base transition-all"
                      >
                        Back to Home
                        <ArrowRight className="h-4 w-4" />
                      </Link>

                      <Link
                        to="/quote"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold text-base transition"
                      >
                        Create Another Quote
                        <Plus className="h-4 w-4 text-lime-500" />
                      </Link>
                    </div>

                    <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                      <Info className="h-5 w-5 text-amber-500" />
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                        Prototype note: quote ID, exact pricing, and real-time driver matching will be implemented
                        in the production app.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="mt-8 border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardContent className="p-7 sm:p-9">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">What happens next</h2>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">PRD Flow</span>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                  {nextSteps.map((step) => {
                    const Icon = step.icon
                    return (
                      <Card key={step.step} className="rounded-3xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-lime-500 font-bold" />
                            </div>
                            <div className="text-sm font-black">{step.step}) {step.title}</div>
                          </div>
                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {step.description}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Quote summary */}
          <div className="lg:col-span-5">
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl">
              <CardContent className="p-7 sm:p-9">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Quote Summary</div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                      Quote ID:
                      <span className="text-lime-500"> {quote.id}</span>
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Keep this ID for reference. (Prototype value)
                    </p>
                  </div>
                  <Link
                    to="/quote/details"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold hover:opacity-90 transition border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    <Edit className="h-4 w-4 text-lime-500" />
                    Edit
                  </Link>
                </div>

                <div className="mt-6 space-y-4">
                  {/* Route */}
                  <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        <Route className="h-4 w-4 text-lime-500" />
                        Route
                      </div>
                      <div className="mt-3 flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600 dark:text-slate-400">Pickup</span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-right">{quote.pickup}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600 dark:text-slate-400">Drop-off</span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-right">{quote.dropoff}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-slate-600 dark:text-slate-400">Distance</span>
                          <span className="font-black text-slate-900 dark:text-white">{quote.distance}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Details */}
                  <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        <Settings className="h-4 w-4 text-lime-500" />
                        Details
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
                          <span className="text-slate-600 dark:text-slate-400">Service Type</span>
                          <span className="font-extrabold text-slate-900 dark:text-white">{quote.serviceType}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
                          <span className="text-slate-600 dark:text-slate-400">Window</span>
                          <span className="font-extrabold text-slate-900 dark:text-white">{quote.timeWindow}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
                          <span className="text-slate-600 dark:text-slate-400">Date</span>
                          <span className="font-extrabold text-slate-900 dark:text-white">{quote.date}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
                          <span className="text-slate-600 dark:text-slate-400">Vehicle</span>
                          <span className="font-extrabold text-slate-900 dark:text-white">{quote.vehicle}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Estimated Price</span>
                        <span className="text-2xl font-black text-lime-500">${quote.price.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notification note */}
                  <Card className="rounded-3xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        <Mail className="h-4 w-4 text-lime-500" />
                        Notifications
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Updates will be sent to your email. SMS can be used only if enabled by Admin policy.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <Link
                      to="/dealer/signin"
                      className="px-6 py-4 rounded-2xl font-extrabold text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-lime-500/5 transition flex items-center justify-center gap-2"
                    >
                      Dealer Sign In
                      <LogIn className="h-4 w-4 text-lime-500" />
                    </Link>
                    <Link
                      to="/driver/signin"
                      className="px-6 py-4 rounded-2xl font-extrabold text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-lime-500/5 transition flex items-center justify-center gap-2"
                    >
                      Driver Sign In
                      <LogIn className="h-4 w-4 text-lime-500" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compliance reminder */}
            <Card className="mt-6 border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardContent className="p-7 sm:p-9">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">The 101 Standard</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  VIN last-4 verification, required photos, odometer start/end, start/stop tracking, and post-trip report.
                </p>
                <Link
                  to="/#standard"
                  className="mt-5 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition"
                >
                  View Compliance
                  <Verified className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  )
}