import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Menu,
  X,
  Shield,
  Info,
  AlertTriangle,
  Handshake,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function IndependentDriverAgreement() {
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
              to="/agreement"
              className="text-sm font-semibold text-lime-500"
              aria-current="page"
            >
              Driver Agreement
            </Link>
            <Link
              to="/privacy"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Terms
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/driver-onboarding"
            className="hidden sm:inline-flex items-center gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 px-6 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-lime-500/20 transition-all font-extrabold"
          >
            Apply to Drive
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
            <Link to="/" className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors">
              Landing
            </Link>
            <Link to="/about" className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors">
              About
            </Link>
            <Link to="/agreement" className="text-sm font-semibold text-lime-500">
              Driver Agreement
            </Link>
            <Link to="/privacy" className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors">
              Terms
            </Link>
            <Link
              to="/driver-onboarding"
              className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-lime-500 text-slate-950 hover:opacity-95 transition"
            >
              Apply to Drive
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
              California-only operations &bull; Email-first notifications
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">&copy; 2026 101 Drivers Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )

  // Section Header Component
  const SectionHeader = ({ icon: Icon, title, id }: { icon: React.ElementType; title: string; id: string }) => (
    <div id={id} className="flex items-center gap-3 mt-8 mb-4 scroll-mt-24">
      <div className="w-8 h-8 rounded-xl bg-lime-500/15 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-lime-500" />
      </div>
      <h2 className="text-xl font-black text-slate-900 dark:text-white">{title}</h2>
    </div>
  )

  // Paragraph Component
  const P = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={cn("text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-4", className)}>
      {children}
    </p>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="w-full max-w-[1024px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
          <CardContent className="p-7 sm:p-10">
            {/* Title */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
                <Handshake className="h-6 w-6 text-lime-500 font-bold" />
              </div>
              <div>
                <CardTitle className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  Independent Driver Agreement
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  This Independent Driver Agreement (&quot;Agreement&quot;) is entered into by and between the driver (&quot;Driver&quot;) and 101 Drivers, Inc. (&quot;Company&quot;). By checking the agreement box during signup, the Driver acknowledges and agrees to the following terms and conditions.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                  Effective: <span className="font-bold">April 1, 2026</span>
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6 text-slate-600 dark:text-slate-300">
              {/* Section 1: Independent Contractor Status */}
              <SectionHeader icon={Shield} title="1. Independent Contractor Status" id="contractor-status" />
              <P>
                The Driver acknowledges and agrees that they are an independent contractor and not an employee of the Company. The Driver shall be solely responsible for determining the manner and means by which services are performed. The Company does not control the Driver&apos;s work schedule, methods, or procedures, except as may be reasonably necessary to ensure the quality of services provided. Nothing in this Agreement shall be construed to create an employment relationship, partnership, joint venture, or agency relationship between the Driver and the Company.
              </P>

              {/* Section 2: Services */}
              <SectionHeader icon={Handshake} title="2. Services" id="services" />
              <P>
                The Driver agrees to perform vehicle delivery services as requested through the Company&apos;s platform. The Driver shall use their own vehicle, equipment, and tools to perform the services. The Driver represents that they possess a valid driver&apos;s license, appropriate insurance coverage, and any other licenses or permits required by law to perform the services.
              </P>

              {/* Section 3: Compensation */}
              <SectionHeader icon={Handshake} title="3. Compensation" id="compensation" />
              <P>
                The Driver shall be compensated for completed delivery services as outlined on the Company&apos;s platform. Compensation rates may be adjusted by the Company from time to time with reasonable notice. The Driver acknowledges that they are responsible for all taxes, including self-employment taxes, related to the compensation received under this Agreement.
              </P>

              {/* Section 4: Insurance and Liability */}
              <SectionHeader icon={Shield} title="4. Insurance and Liability" id="insurance" />
              <P>
                The Driver shall maintain, at their own expense, appropriate automobile liability insurance that meets or exceeds the minimum requirements of the state(s) in which they operate. The Driver agrees to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from the Driver&apos;s negligent acts or omissions in the performance of services under this Agreement.
              </P>

              {/* Section 5: Background Check */}
              <SectionHeader icon={Shield} title="5. Background Check" id="background-check" />
              <P>
                The Driver consents to a background check and driving record review as a condition of providing services through the Company&apos;s platform. The Company reserves the right to suspend or terminate this Agreement if the results of such checks do not meet the Company&apos;s standards.
              </P>

              {/* Section 6: Confidentiality */}
              <SectionHeader icon={Shield} title="6. Confidentiality" id="confidentiality" />
              <P>
                The Driver agrees to maintain the confidentiality of any proprietary or sensitive information received from the Company or its customers, including but not limited to customer contact information, delivery addresses, and business practices. This obligation survives the termination of this Agreement.
              </P>

              {/* Section 7: Termination */}
              <SectionHeader icon={Shield} title="7. Termination" id="termination" />
              <P>
                Either party may terminate this Agreement at any time, with or without cause, by providing written notice to the other party. Upon termination, the Driver shall return any Company property and cease representing themselves as affiliated with the Company.
              </P>

              {/* Section 8: Governing Law */}
              <SectionHeader icon={Shield} title="8. Governing Law" id="governing-law" />
              <P>
                This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the courts located in the State of Georgia.
              </P>

              {/* Section 9: Entire Agreement */}
              <SectionHeader icon={Shield} title="9. Entire Agreement" id="entire-agreement" />
              <P>
                This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.
              </P>

              {/* Section 10: Acknowledgment */}
              <SectionHeader icon={Info} title="10. Acknowledgment" id="acknowledgment" />
              <P>
                BY CHECKING THE AGREEMENT BOX DURING DRIVER SIGNUP, THE DRIVER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. THE DRIVER FURTHER ACKNOWLEDGES THAT THEY HAVE HAD THE OPPORTUNITY TO REVIEW THIS AGREEMENT AND TO ASK QUESTIONS ABOUT ITS PROVISIONS.
              </P>

              {/* Warning box */}
              <div className={cn("mt-6 p-4 rounded-2xl border flex gap-3", "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200")}>
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-[11px] leading-normal font-medium">
                  This Agreement contains provisions that dictate how claims between you and 101 Drivers can be brought. By agreeing during signup, you acknowledge that you understand and accept all of the terms outlined in this Agreement.
                </p>
              </div>
            </div>

            {/* Back to links */}
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link to="/privacy">
                <Button variant="outline" className="w-full sm:w-auto h-12 rounded-2xl font-bold">
                  View Privacy Policy
                </Button>
              </Link>
              <Link to="/terms">
                <Button variant="outline" className="w-full sm:w-auto h-12 rounded-2xl font-bold">
                  View Terms of Service
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}
