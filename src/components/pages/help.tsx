import React, { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
  HelpCircle,
  Car,
  Truck,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  Shield,
  Clock,
  CreditCard,
  FileText,
  CheckCircle,
  Package,
  User,
  Users,
  Route,
  AlertCircle,
  BookOpen,
  Settings,
  Star,
} from 'lucide-react'

// FAQ data
const customerFaqs = [
  {
    question: 'How do I request a vehicle delivery?',
    answer: 'Enter your pickup and drop-off addresses on our homepage, get an instant quote, then proceed to book. You can track your delivery in real-time once a driver is assigned.',
  },
  {
    question: 'What areas do you serve?',
    answer: 'We currently operate in California only. Both pickup and drop-off locations must be within California.',
  },
  {
    question: 'How is the price calculated?',
    answer: 'Pricing is based on the driving distance between pickup and drop-off locations, plus a base fee, insurance fee, and transaction fee. You get an instant quote before committing.',
  },
  {
    question: 'Can I schedule a delivery for a specific time?',
    answer: 'Yes! When creating a delivery, you can choose your preferred pickup or drop-off time window. We\'ll show you available slots based on our scheduling policies.',
  },
  {
    question: 'What happens after I book a delivery?',
    answer: 'Once submitted, your delivery is immediately visible to our driver marketplace. An available driver will accept the gig, and you\'ll receive a tracking link to monitor the delivery in real-time.',
  },
  {
    question: 'How do I cancel a delivery?',
    answer: 'You can cancel a delivery from your dashboard as long as it hasn\'t been picked up yet. Active deliveries (already in transit) cannot be cancelled — please contact support instead.',
  },
  {
    question: 'Is my vehicle insured during delivery?',
    answer: 'Yes. Every delivery includes an insurance fee that covers the vehicle during transit. Refer to our Terms of Service for full coverage details.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept online payments at the time of booking. For business accounts, postpaid invoicing may be available upon approval.',
  },
]

const driverFaqs = [
  {
    question: 'How do I become a 101 Drivers driver?',
    answer: 'Sign up on our driver registration page. You\'ll need to verify your email, provide your details, and get approved by our team before you can start accepting deliveries.',
  },
  {
    question: 'How do I find and accept deliveries?',
    answer: 'Once approved, browse the job feed on your dashboard. Available deliveries are shown with distance, pay estimate, and pickup time. Tap "Book" to accept a job.',
  },
  {
    question: 'What is the pickup checklist?',
    answer: 'Before starting a trip, you must verify the last 4 digits of the VIN, record the odometer reading, and take 6 photos of the vehicle at pickup. All steps are required.',
  },
  {
    question: 'What is the drop-off checklist?',
    answer: 'At drop-off, record the final odometer reading (must be higher than pickup), and take 6 photos showing the vehicle at the destination. Complete the trip to trigger payment.',
  },
  {
    question: 'How and when do I get paid?',
    answer: 'Payment is processed automatically after trip completion. Your share is calculated based on the delivery fee minus platform and insurance fees. Payouts are managed by the 101 Drivers team.',
  },
  {
    question: 'Can I set my preferred areas?',
    answer: 'Yes! Go to your preferences to set your home city, preferred radius, and district preferences. The job feed prioritizes deliveries near your location.',
  },
  {
    question: 'What if there\'s an issue during delivery?',
    answer: 'Use the "Report Issue" button on your active delivery screen to submit a support request immediately. Our operations team will assist you.',
  },
  {
    question: 'Can I cancel a delivery I already accepted?',
    answer: 'Drivers cannot cancel deliveries directly. If there\'s a problem, please report it through the app so our team can assist or reassign the delivery.',
  },
]

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button className="w-full text-left py-4 group">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
            {question}
          </span>
          <HelpCircle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
        </div>
      </button>
      <p className="text-sm text-slate-600 dark:text-slate-400 pb-4 leading-relaxed">
        {answer}
      </p>
    </div>
  )
}

export default function HelpPage({ type }: { type?: 'customer' | 'driver' }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const isCustomer = type === 'customer'
  const isDriver = type === 'driver'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Nav bar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg hover:text-lime-500 transition-colors"
          >
            <Truck className="h-5 w-5" />
            101 Drivers
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 lg:py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-lime-600 dark:text-lime-400" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                Help Center
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Find answers to common questions
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-8">
          <Link
            to="/help-customer"
            className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
              isCustomer
                ? 'bg-lime-500 text-slate-950 shadow-lg shadow-lime-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-lime-300'
            }`}
          >
            <User className="h-4 w-4 inline mr-2" />
            Customer Help
          </Link>
          <Link
            to="/help-driver"
            className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
              isDriver
                ? 'bg-lime-500 text-slate-950 shadow-lg shadow-lime-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-lime-300'
            }`}
          >
            <Truck className="h-4 w-4 inline mr-2" />
            Driver Help
          </Link>
        </div>

        {/* Content */}
        {isCustomer && (
          <div className="space-y-8">
            {/* Customer FAQ */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-lime-500" />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y-0">
                  {customerFaqs.map((faq, i) => (
                    <FaqItem key={i} question={faq.question} answer={faq.answer} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Customer quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-3">
                    <MapPin className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Get a Quote</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Calculate delivery cost instantly
                  </p>
                  <Link to="/">
                    <Button size="sm" className="w-full bg-lime-500 hover:bg-lime-600 text-slate-950 text-xs font-bold rounded-xl">
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-3">
                    <Users className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Dealer Sign Up</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Business account with unlimited quotes
                  </p>
                  <Link to="/auth/dealer-signin" search={{ mode: 'signup' }}>
                    <Button size="sm" className="w-full bg-lime-500 hover:bg-lime-600 text-slate-950 text-xs font-bold rounded-xl">
                      Sign Up
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Contact Support</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Need help? Reach out to our team
                  </p>
                  <a href="mailto:ops@101drivers.techbee.et?subject=Customer Support Request">
                    <Button size="sm" variant="outline" className="w-full text-xs font-bold rounded-xl">
                      <Mail className="h-3 w-3 mr-1" />
                      Email Us
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {isDriver && (
          <div className="space-y-8">
            {/* Driver FAQ */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-lime-500" />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y-0">
                  {driverFaqs.map((faq, i) => (
                    <FaqItem key={i} question={faq.question} answer={faq.answer} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Driver quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-3">
                    <Star className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Become a Driver</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Sign up and start earning
                  </p>
                  <Link to="/driver-onboarding">
                    <Button size="sm" className="w-full bg-lime-500 hover:bg-lime-600 text-slate-950 text-xs font-bold rounded-xl">
                      Apply Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-3">
                    <Settings className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Driver Preferences</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Set your preferred areas and radius
                  </p>
                  <Link to="/driver-signin">
                    <Button size="sm" className="w-full bg-lime-500 hover:bg-lime-600 text-slate-950 text-xs font-bold rounded-xl">
                      Sign In
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Report an Issue</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Having trouble? Let us know
                  </p>
                  <a href="mailto:ops@101drivers.techbee.et?subject=Driver Support Request">
                    <Button size="sm" variant="outline" className="w-full text-xs font-bold rounded-xl">
                      <Mail className="h-3 w-3 mr-1" />
                      Email Us
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Contact section */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-lime-50 to-white dark:from-lime-950/20 dark:to-slate-900">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                Still need help?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Our operations team is available to assist you with any questions or issues.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="mailto:ops@101drivers.techbee.et?subject=Support Request from Help Center">
                  <Button className="bg-lime-500 hover:bg-lime-600 text-slate-950 font-bold rounded-xl px-6">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Support
                  </Button>
                </a>
                <a href="tel:+13109628402">
                  <Button variant="outline" className="font-bold rounded-xl px-6">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Us
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} 101 Drivers. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
