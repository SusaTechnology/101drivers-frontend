// privacy-policy.tsx
import React, { useState, useEffect } from 'react'
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
  Shield,
  Mail,
  Camera,
  Ruler,
  Clock,
  Users,
  Lock,
  AlertCircle,
  Info,
  ChevronDown,
  Scale,
  Gavel,
  CreditCard,
  Car,
  MessageSquare,
  UserCheck,
  Ban,
  DollarSign,
  Bell,
  Database,
  Gift,
  Stamp,
  AlertTriangle,
  FileWarning,
  XCircle,
  Handshake,
  Building,
  Globe,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PrivacyPolicy() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('terms')

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
              className="text-sm font-semibold text-lime-500"
              aria-current="page"
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
            to="/"
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
          <p className="text-xs text-slate-500 font-medium">© 2026 101 Drivers Inc. All rights reserved.</p>
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

  // List Item Component
  const Li = ({ children }: { children: React.ReactNode }) => (
    <li className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 ml-4 mb-2 list-disc">
      {children}
    </li>
  )

  // Sub-section Header
  const SubHeader = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mt-6 mb-3">{children}</h3>
  )

  // Alert Box Component
  const AlertBox = ({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warning' | 'danger' }) => {
    const styles = {
      info: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-900 dark:text-blue-200',
      warning: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
      danger: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-900 dark:text-red-200'
    }
    const Icon = type === 'info' ? Info : type === 'warning' ? AlertTriangle : AlertCircle
    
    return (
      <div className={cn("mt-4 p-4 rounded-2xl border flex gap-3", styles[type])}>
        <Icon className="h-5 w-5 shrink-0" />
        <p className="text-[11px] leading-normal font-medium">{children}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />
      
      <main className="w-full max-w-[1024px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Quick Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={activeSection === 'terms' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveSection('terms')
              document.getElementById('terms-top')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className={cn(
              "rounded-full",
              activeSection === 'terms' && "bg-lime-500 text-slate-950 hover:bg-lime-600"
            )}
          >
            <Scale className="h-4 w-4 mr-2" />
            Terms of Service
          </Button>
          <Button
            variant={activeSection === 'privacy' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveSection('privacy')
              document.getElementById('privacy-top')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className={cn(
              "rounded-full",
              activeSection === 'privacy' && "bg-lime-500 text-slate-950 hover:bg-lime-600"
            )}
          >
            <Shield className="h-4 w-4 mr-2" />
            Privacy Policy
          </Button>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
          <CardContent className="p-7 sm:p-10">
            {/* Terms of Service Section */}
            <div id="terms-top">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
                  <Scale className="h-6 w-6 text-lime-500 font-bold" />
                </div>
                <div>
                  <CardTitle className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                    Terms of Service
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    The following Terms of Service establish a legally binding agreement between you and 101 Drivers, Inc.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                    Effective: <span className="font-bold">April 1, 2026</span>
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-6 text-slate-600 dark:text-slate-300">
                <P>
                  The following Terms of Service establish a legally binding agreement between you and 101 Drivers, Inc. and its affiliates, officers, and directors (collectively referred to as "101 Drivers," "we," "us," or "our"). These terms govern your use of the 101 Drivers Platform, which includes applications, websites, technology, facilities, and platform.
                </P>

                <AlertBox type="warning">
                  This Agreement contains provisions that dictate how claims between you and 101 Drivers can be brought. These provisions require you to waive your right to a jury trial and submit claims against 101 Drivers to binding and final arbitration on an individual basis, not as a plaintiff or class member in any class, group, or representative action or proceeding. However, as a driver, you have the option to opt-out of arbitration for certain claims.
                </AlertBox>

                <P>
                  By using or accessing the 101 Drivers Platform, you acknowledge that you understand and accept all of the terms outlined in this Agreement. If you do not agree to be bound by these terms and conditions, you may not use or access the 101 Drivers Platform or any of the services provided through it.
                </P>

                <P>
                  The 101 Drivers Platform serves as a connection between drivers and Customers who require their services. Customers can create vehicle delivery requests on 101drivers.com, and Drivers can book these requests through the same website. All Users of the 101 Drivers Platform, including Drivers and Customers, are subject to the terms outlined in this Agreement. The act of driving vehicles for Customers is referred to as Vehicle Delivery Services.
                </P>

                <P>
                  As a Customer, you authorize Drivers to match and/or re-match your vehicle delivery request based on various factors, such as location, pickup and drop-off times, and regulatory requirements. The decision to list Vehicle Delivery Services is solely at the discretion of the Customer.
                </P>

                <P>
                  Additional agreements, known as Supplemental Agreements, may apply to specific services in certain markets. It is important to review these agreements carefully, as they may contain terms and conditions that differ from those outlined in this Agreement. If you do not agree to be bound by the terms of a Supplemental Agreement, you may not use 101 Drivers Services in that particular market.
                </P>

                <P>
                  In the event of any conflict between this Agreement and the terms of a Supplemental Agreement, the terms of this Agreement will prevail, unless the Supplemental Agreement explicitly states otherwise.
                </P>

                {/* Modification to Agreement */}
                <SectionHeader icon={FileText} title="Modification to the Agreement" id="modification" />
                <P>
                  101 Drivers reserves the right to modify the terms and conditions of this Agreement. Any modifications will be binding on you only upon your acceptance of the modified Agreement. 101 Drivers also reserves the right to modify any information on pages referenced in the hyperlinks from this Agreement from time to time, and such modifications shall become effective upon posting. Your continued use of the 101 Drivers Platform after any such changes shall constitute your acceptance of such changes. Unless material changes are made to the arbitration provisions herein, you agree that modification of this Agreement does not create a renewed opportunity to opt out of arbitration (if applicable).
                </P>

                {/* Eligibility */}
                <SectionHeader icon={UserCheck} title="Eligibility" id="eligibility" />
                <P>
                  The 101 Drivers Platform is only available to companies and individuals who have the right and authority to enter into this Agreement and are fully able and competent to satisfy the terms, conditions, and obligations herein.
                </P>
                <P>
                  The 101 Drivers Platform is not available to Drivers who have had their User account temporarily or permanently deactivated. To use the 101 Drivers Platform, each User must create a User account. Each person may only create one User account, and 101 Drivers reserves the right to deactivate any additional or duplicate accounts.
                </P>
                <P>
                  Your eligibility to participate in certain 101 Drivers services may be subject to additional requirements as determined by 101 Drivers.
                </P>
                <P>
                  By becoming a Driver, you represent and warrant that you are at least 21 years old and meet the following criteria:
                </P>
                <ul className="list-disc pl-5 space-y-1">
                  <Li>No more than 1 distracted driving violation in the last 36 months</Li>
                  <Li>No more than 2 moving violations in the last 36 months</Li>
                  <Li>No more than 2 at-fault accidents in the last 60 months</Li>
                  <Li>No major moving violation in the last 36 months</Li>
                  <Li>No DUI or other drug-related driving violation in the last 84 months</Li>
                  <Li>No Auto Related Felonies of any kind</Li>
                </ul>

                {/* Charges */}
                <SectionHeader icon={CreditCard} title="Charges" id="charges" />
                <P>
                  As a Customer, you acknowledge that using the Vehicle Delivery Services or 101 Drivers Services may result in Charges to you or your organization, if applicable. These Charges include Prices and other fees, tolls, surcharges, and taxes, as set forth in the service region, plus any tips you choose to give to the Driver.
                </P>
                <P>
                  101 Drivers has the authority to determine and modify pricing by quoting you a price for a specific vehicle delivery at the time you create a vehicle delivery request. You are responsible for reviewing the price quote within the 101 Drivers Platform and will be responsible for all Charges incurred under your User account, regardless of your awareness of such Charges or the amounts thereof.
                </P>

                <SubHeader>Vehicle Delivery Service Price ("Prices")</SubHeader>
                <P>
                  When you request a vehicle delivery using the 101 Drivers Platform, 101 Drivers will quote you a price at the time of your request. Quoted Prices may include the Vehicle Delivery Service Fees and Other Charges below, as applicable. Please note that we use Google Maps' data to calculate the distance and the price for the vehicle delivery request. We cannot guarantee the accuracy of Google Maps' data.
                </P>
                <ul className="list-disc pl-5 space-y-2">
                  <Li><strong>Setup Fee:</strong> 101 Drivers may charge a one-time "Setup Fee" to sign up. For now, this fee is waived.</Li>
                  <Li><strong>Cancellation Fee:</strong> If you cancel a vehicle delivery request through the 101 Drivers Platform, a cancellation fee may apply in certain cases. 101 Drivers may also charge a fee if you fail to have a vehicle ready after requesting a vehicle delivery.</Li>
                  <Li><strong>Tolls:</strong> In some instances, tolls, toll estimates, or return tolls may apply to your vehicle delivery (not in Wyoming).</Li>
                  <Li><strong>Other Charges:</strong> Other fees and surcharges may apply to your vehicle delivery, including but not limited to actual or anticipated airport fees, state fees, local fees, event fees, or fuel surcharges.</Li>
                  <Li>In addition, where required by law, 101 Drivers will collect applicable taxes.</Li>
                  <Li><strong>Tips:</strong> After a delivery, you may have the opportunity to tip your Driver in cash, Zelle, or through the 101 Drivers Platform. Any tips will be provided entirely to the applicable Driver.</Li>
                </ul>

                <SubHeader>Charges Generally</SubHeader>
                <ul className="list-disc pl-5 space-y-2">
                  <Li><strong>Facilitation of Charges:</strong> All Charges are processed through a third-party payment processor (Stripe, Inc., Zelle, Banks, etc.). 101 Drivers may replace its third-party payment processor without notice to you.</Li>
                  <Li><strong>Cash Payments:</strong> With the exception of tips, cash payments are strictly prohibited unless expressly permitted by 101 Drivers.</Li>
                  <Li><strong>Billing:</strong> Certain Charges may be collectively billed as a single purchase transaction to your selected payment method based on the payment frequency indicated in your settings. If your primary payment method expires, is invalid, or if Charges to your primary payment method are unable to be processed for any reason, then you agree that 101 Drivers may charge your other available payment methods in the 101 Drivers Platform. If you do not recognize a transaction, check your vehicle delivery receipts and payment history.</Li>
                  <Li><strong>No Refunds:</strong> All Charges are non-refundable except to the extent required by law. This no-refund policy applies at all times, regardless of your decision to terminate usage of the 101 Drivers Platform, any disruption to the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, or Vehicle Delivery Services, or any other reason whatsoever.</Li>
                  <Li><strong>Payment Card Authorization:</strong> Upon addition of a new payment method or each request for 101 Drivers Services and Vehicle Delivery Services, 101 Drivers may seek authorization of your selected payment method to verify the payment method, ensure the Charges will be covered, and protect against unauthorized behavior. The authorization is not a charge, but it may reduce your available credit by the authorization amount until your bank's next processing cycle. If the amount of our authorization exceeds the total funds on deposit in your account, you may be subject to overdraft or NSF charges by the bank issuing your debit or prepaid card. 101 Drivers is not responsible for these charges and is unable to assist you in recovering them from your issuing bank.</Li>
                  <Li><strong>Fees:</strong> For clarity, 101 Drivers does not charge a fee for Users to access the 101 Drivers Platform, but retains the right to charge Users and/or organizations, if applicable, a fee or any other Charge for accessing or using 101 Drivers Services and Vehicle Delivery Services made available through the 101 Drivers Platform.</Li>
                </ul>

                {/* Driver Payments */}
                <SectionHeader icon={DollarSign} title="Driver Payments" id="driver-payments" />
                <P>
                  If you are a Driver, you will receive payment for your provision of Vehicle Delivery Services according to the terms of the Driver Agreement, which is part of this Agreement between you and 101 Drivers.
                </P>

                {/* 101 Drivers Communications */}
                <SectionHeader icon={Bell} title="101 Drivers Communications" id="communications" />
                <P>
                  By entering into this Agreement or using the 101 Drivers Platform, you agree to receive communications from us, our affiliates, or our third-party partners, at any of the phone numbers provided to 101 Drivers by you or on your behalf, and also via email, text message, calls, and push notifications. You agree that texts, calls, or prerecorded messages may be generated by automatic telephone dialing systems. Communications from 101 Drivers, its affiliated companies, and/or Drivers may include but are not limited to: operational communications concerning your User account or use of the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, or Vehicle Delivery Services, updates concerning new and existing features on the 101 Drivers Platform, communications concerning marketing or promotions run by us or our third-party partners, and news concerning 101 Drivers and industry developments. If you change or deactivate the phone number you provided to 101 Drivers, you agree to update your User account information to help prevent us from inadvertently communicating with anyone who acquires your old number. Standard text messaging charges applied by your cell phone carrier will apply to text messages we send.
                </P>
                <P>
                  If you wish to opt-out of promotional emails, you can unsubscribe from our promotional email list by following the unsubscribe options in the promotional email itself.
                </P>

                {/* Your Information */}
                <SectionHeader icon={Database} title="Your Information" id="your-information" />
                <P>
                  Your Information is any information you provide, publish, or post, and any information provided on your behalf, to or through the 101 Drivers Platform (including any profile information you provide) or send to other Users (including via in-application feedback, any email feature, or through any 101 Drivers-related Facebook, Twitter, or other social media posting) (your "Information"). You consent to us using your Information to create a User account that will allow you to use the 101 Drivers Platform, 101 Drivers Services, and participate in the Vehicle Delivery Services. Our collection and use of personal information in connection with the 101 Drivers Platform, 101 Drivers Services, and Vehicle Delivery Services are as provided in 101 Drivers's Privacy Policy. You are solely responsible for your Information and your interactions with other members of the public, and we act only as a passive conduit for your online posting of your Information. You agree to provide and maintain accurate, current, and complete Information, and that we and other members of the public may rely on your Information as accurate, current, and complete.
                </P>
                <P>
                  To enable 101 Drivers to use your Information for the purposes described in the Privacy Policy and this Agreement, or to otherwise improve the 101 Drivers Platform, 101 Drivers Services, or Vehicle Delivery Services, you grant to us a non-exclusive, worldwide, perpetual, irrevocable, royalty-free, transferable, sub-licensable (through multiple tiers) right and license to exercise the copyright, publicity, and database rights you have in your Information, and to use, copy, perform, display, and distribute such Information to prepare derivative works or incorporate into other works, such Information, in any media now known or not currently known. 101 Drivers does not assert any ownership over your Information; rather, as between you and 101 Drivers, subject to the rights granted to us in this Agreement, you retain full ownership of all of your Information and any intellectual property rights or other proprietary rights associated with your Information.
                </P>

                {/* Promotions, Referrals, and Loyalty Programs */}
                <SectionHeader icon={Gift} title="Promotions, Referrals, and Loyalty Programs" id="promotions" />
                <P>
                  101 Drivers may make available promotions, referral programs, and loyalty programs with different features to any Users or prospective Users at its sole discretion. 101 Drivers reserves the right to withhold or deduct credits or benefits obtained through a promotion or program if 101 Drivers determines or believes that the redemption of the promotion or receipt of the credit or benefit was in error, fraudulent, illegal, or in violation of the applicable promotion or program terms or this Agreement. 101 Drivers also reserves the right to terminate, discontinue, modify, or cancel any promotions or programs at any time and in its sole discretion without notice to you.
                </P>

                {/* Restricted Activities */}
                <SectionHeader icon={Ban} title="Restricted Activities" id="restricted-activities" />
                <P>
                  With respect to your use of the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, and your participation in the Vehicle Delivery Services, you agree that you will not:
                </P>
                <ul className="list-disc pl-5 space-y-1">
                  <Li>impersonate any person or entity;</Li>
                  <Li>stalk, threaten, or otherwise harass any person or carry any weapons;</Li>
                  <Li>violate any law, statute, rule, permit, ordinance, or regulation;</Li>
                  <Li>interfere with or disrupt the 101 Drivers Platform or the servers or networks connected to the 101 Drivers Platform;</Li>
                  <Li>post Information or interact on the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, or Vehicle Delivery Services in a manner that is fraudulent, libelous, abusive, obscene, profane, sexually oriented, harassing, or illegal;</Li>
                  <Li>use the 101 Drivers Platform in any way that infringes any third party's rights, including intellectual property rights, copyright, patent, trademark, trade secret, or other proprietary rights or rights of publicity or privacy;</Li>
                  <Li>post, email, or otherwise transmit any malicious code, files, or programs designed to interrupt, damage, destroy, or limit the functionality of the 101 Drivers Platform or any computer software or hardware or telecommunications equipment or surreptitiously intercept or expropriate any system, data, or personal information;</Li>
                  <Li>forge headers or otherwise manipulate identifiers to disguise the origin of any information transmitted through the 101 Drivers Platform;</Li>
                  <Li>"frame" or "mirror" any part of the 101 Drivers Platform without our prior written authorization or use meta tags or code or other devices containing any reference to us to direct any person to any other website for any purpose;</Li>
                  <Li>modify, adapt, translate, reverse engineer, decipher, decompile, or otherwise disassemble any portion of the 101 Drivers Platform;</Li>
                  <Li>rent, lease, lend and sell.</Li>
                </ul>
                <P>
                  You agree not to engage in any of the restricted activities listed above with respect to your use of the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, and your participation in the Vehicle Delivery Services. If you suspect that any unauthorized party may be using your User account or you suspect any other breach of security or violation of this Agreement, you agree to notify us immediately.
                </P>
                <P>
                  Additionally, you agree not to discriminate against or harass anyone on the basis of race, national origin, religion, gender, gender identity or expression, physical or mental disability, medical condition, marital status, age, or sexual orientation. You also agree not to violate any of the rules if you participate in the Referral Program, commercialize the Vehicle Delivery Services, Third-Party Services, or our 101 Drivers Services without an agreement directly with 101 Drivers, misuse or abuse the Vehicle Delivery Services, Third-Party Services, or our 101 Drivers Services in violation of eligibility requirements as determined by 101 Drivers, circumvent any measures implemented by 101 Drivers to prevent or address violations of this Agreement, or cause any third party to engage in the restricted activities listed above.
                </P>

                <SubHeader>Driver Representations and Warranties</SubHeader>
                <P>As a Driver providing Vehicle Delivery Services on the 101 Drivers Platform, you represent, warrant, and agree to the following:</P>
                <ul className="list-disc pl-5 space-y-2">
                  <Li>You possess a valid driver's license and are authorized and medically fit to operate a motor vehicle, and you have all appropriate licenses, approvals, and authority to provide transportation to Customers in all jurisdictions in which you provide Vehicle Delivery Services.</Li>
                  <Li>You will not engage in reckless behavior while driving or otherwise providing Vehicle Delivery Services, drive unsafely, operate a vehicle that is unsafe to drive, permit an unauthorized third party to accompany you in the vehicle while providing Vehicle Delivery Services, provide Vehicle Delivery Services as a Driver while under the influence of alcohol or drugs, or take action that harms or threatens to harm the safety of the 101 Drivers community or third parties.</Li>
                  <Li>You will not discriminate against Customers with disabilities.</Li>
                  <Li>You agree that we may obtain information about you, including your criminal and driving records, and you agree to provide any further necessary authorizations to facilitate our access to such records during the term of the Agreement.</Li>
                  <Li>You will comply with 101 Drivers's reasonable requests to provide information in connection with Customers' complaints, law enforcement requests, or any other incident.</Li>
                </ul>
                <P>
                  By agreeing to these representations, warranties, and agreements, you acknowledge that any breach of these terms may result in the immediate termination of your access to the 101 Drivers Platform and your ability to provide Vehicle Delivery Services.
                </P>

                {/* Intellectual Property */}
                <SectionHeader icon={Stamp} title="Intellectual Property" id="intellectual-property" />
                <P>
                  All intellectual property rights in and to the 101 Drivers Platform are owned by 101 Drivers absolutely and in their entirety. This includes database rights, inventions and patentable subject-matter, patents, copyright, design rights (whether registered or unregistered), trademarks (whether registered or unregistered), and other similar rights wherever existing in the world, together with the right to apply for protection of the same. Any questions, comments, suggestions, ideas, feedback, or other information provided by you to us are non-confidential and shall become the sole property of 101 Drivers. 101 Drivers shall own exclusive rights, including all intellectual property rights, and shall be entitled to the unrestricted use and dissemination of these Submissions for any purpose, commercial or otherwise, without acknowledgment or compensation to you.
                </P>
                <P>
                  Except for the explicit license grants hereunder, nothing in this Agreement shall be construed to transfer ownership of or grant a license under any intellectual property rights. The 101 Drivers Marks are registered trademarks, trademarks, or trade dress of 101 Drivers in the United States and/or other countries. If you provide Vehicle Delivery Services as a Driver, 101 Drivers grants you a limited, revocable, non-exclusive license to display and use the 101 Drivers Marks solely on the 101 Drivers stickers/decals and any other 101 Drivers-branded items provided by 101 Drivers directly to you in connection with providing the Vehicle Delivery Services. The License is non-transferable and non-assignable, and you shall not grant any third party any right, permission, license, or sublicense with respect to any of the rights granted hereunder without 101 Drivers's prior written permission, which it may withhold in its sole discretion.
                </P>
                <P>
                  The 101 Drivers logo (or any 101 Drivers Marks) may not be used in any manner that is likely to cause confusion, including but not limited to: use of a 101 Drivers Mark in a domain name or 101 Drivers referral code, or use of a 101 Drivers Mark as a social media handle or name, avatar, profile photo, icon, favicon, or banner. You may identify yourself as a Driver on the 101 Drivers Platform, but may not misidentify yourself as 101 Drivers, an employee of 101 Drivers, or a representative or agent of 101 Drivers.
                </P>
                <P>
                  As a Driver providing Vehicle Delivery Services on the 101 Drivers Platform, you acknowledge that 101 Drivers is the owner and licensor of the 101 Drivers Marks, including all goodwill associated therewith, and that your use of the 101 Drivers logo (or any 101 Drivers Marks) will confer no interest in or ownership of the 101 Drivers Marks in you but rather inures to the benefit of 101 Drivers. You agree to use the 101 Drivers logo strictly in accordance with 101 Drivers's Brand Guidelines, as may be provided to you and revised from time to time, and to immediately cease any use that 101 Drivers determines to be nonconforming or otherwise unacceptable.
                </P>

                {/* Disclaimers */}
                <SectionHeader icon={AlertTriangle} title="Disclaimers" id="disclaimers" />
                <P>
                  As a Driver providing Vehicle Delivery Services on the 101 Drivers Platform, you acknowledge and agree to the following disclaimers made on behalf of 101 Drivers, our affiliates, subsidiaries, parents, successors and assigns, and each of our respective officers, directors, employees, agents, and shareholders:
                </P>
                <ul className="list-disc pl-5 space-y-2">
                  <Li>101 Drivers does not provide transportation services, and 101 Drivers is not a transportation carrier. 101 Drivers is not a common carrier or public carrier. It is up to the Driver to decide whether or not to book the vehicle delivery request through the 101 Drivers Platform.</Li>
                  <Li>We cannot ensure that a Driver or Customer will complete an arranged vehicle delivery service.</Li>
                  <Li>We have no control over the quality or safety of the transportation that occurs as a result of the Vehicle Delivery Services. Any safety-related feature, process, policy, standard, or other effort undertaken by 101 Drivers is not an indication of any employment or agency relationship with any User.</Li>
                  <Li>The 101 Drivers Platform is provided on an "as is" basis and without any warranty or condition, express, implied or statutory. We do not guarantee and do not promise any specific results from use of the 101 Drivers Platform, 101 Drivers Services and/or the Vehicle Delivery Services, including the ability to provide or receive Vehicle Delivery Services at any given location or time.</Li>
                  <Li>101 Drivers reserves the right, for example, to limit or eliminate access to the 101 Drivers Platform for Vehicle Delivery Services and/or 101 Drivers Services in specific geographic areas and/or at specific times based on commercial viability, public health concerns, or changes in law.</Li>
                  <Li>We do not warrant that your use of the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, or Vehicle Delivery Services will be accurate, complete, reliable, current, secure, uninterrupted, always available, or error-free, or will meet your requirements, that any defects in the 101 Drivers Platform will be corrected, or that the 101 Drivers Platform is free of viruses or other harmful components.</Li>
                  <Li>We disclaim liability for, and no warranty is made with respect to, connectivity, availability, accuracy, completeness, and reliability of the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, or Vehicle Delivery Services, including with respect to mapping, navigation, estimated times of arrival, and routing services.</Li>
                  <Li>We cannot guarantee that each Customer or Driver is who he or she claims to be.</Li>
                  <Li>101 Drivers is not responsible for the conduct, whether online or offline, of any User of the 101 Drivers Platform.</Li>
                </ul>

                {/* Indemnity */}
                <SectionHeader icon={Shield} title="Indemnity" id="indemnity" />
                <P>
                  You will indemnify and hold harmless and, at 101 Drivers's election, defend 101 Drivers including our affiliates, subsidiaries, parents, successors and assigns, and each of our respective officers, directors, employees, agents, or shareholders (collectively, the "Indemnified Parties") from and against any claims, actions, suits, losses, costs, liabilities and expenses (including reasonable attorneys' fees) relating to or arising out of your use of the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, and participation in the Vehicle Delivery Services, including: (1) your breach of this Agreement or the documents it incorporates by reference; (2) your violation of any law or the rights of a third party; (3) any allegation that any materials or Information that you submit to us or transmit through the 101 Drivers Platform or to us infringes, misappropriates, or otherwise violates the copyright, trademark, trade secret or other intellectual property or other rights of any third party; (4) your ownership, use or operation of a motor vehicle or passenger vehicle, including your provision of Vehicle Delivery Services as a Driver; and/or (5) any other activities in connection with the 101 Drivers Platform, 101 Drivers Services, Third-Party Services, or Vehicle Delivery Services.
                </P>

                {/* Limitation of Liability */}
                <SectionHeader icon={AlertCircle} title="Limitation of Liability" id="limitation-liability" />
                <AlertBox type="danger">
                  IN NO EVENT WILL 101 DRIVERS BE LIABLE TO YOU FOR ANY INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, CONSEQUENTIAL, OR INDIRECT DAMAGES ARISING OUT OF OR IN CONNECTION WITH THE 101 DRIVERS PLATFORM, 101 DRIVERS SERVICES, THE VEHICLE DELIVERY SERVICES, OR THIS AGREEMENT, HOWEVER ARISING INCLUDING NEGLIGENCE, EVEN IF WE OR OUR AGENTS OR REPRESENTATIVES KNOW OR HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </AlertBox>

                {/* Term and Termination */}
                <SectionHeader icon={XCircle} title="Term and Termination" id="termination" />
                <P>
                  This Agreement is effective upon your acceptance of this Agreement. This Agreement may be terminated: (a) by User, without cause, upon seven (7) days' prior written notice to 101 Drivers; or (b) by either Party immediately, without notice, upon the other Party's material breach of this Agreement. In addition, 101 Drivers may terminate this Agreement or deactivate your User account immediately in the event: (1) you are no longer eligible to qualify as a User; (2) you no longer qualify to provide Vehicle Delivery Services or to operate the approved vehicle under applicable law, rule, permit, ordinance or regulation; (3) you fall below 101 Drivers's star rating or cancellation threshold; or (4) 101 Drivers has the good faith belief that such action is necessary to protect the safety of the 101 Drivers community or third parties.
                </P>

                {/* Dispute Resolution and Arbitration */}
                <SectionHeader icon={Gavel} title="Dispute Resolution and Arbitration" id="dispute-resolution" />
                <AlertBox type="warning">
                  YOU AND 101 DRIVERS MUTUALLY AGREE TO WAIVE OUR RESPECTIVE RIGHTS TO RESOLUTION OF DISPUTES IN A COURT OF LAW BY A JUDGE OR JURY AND AGREE TO RESOLVE ANY DISPUTE BY ARBITRATION. ANY ARBITRATION UNDER THIS AGREEMENT WILL TAKE PLACE ON AN INDIVIDUAL BASIS; CLASS ARBITRATIONS AND CLASS ACTIONS ARE NOT PERMITTED.
                </AlertBox>
                <P>
                  This agreement to arbitrate ("Arbitration Agreement") is governed by the Federal Arbitration Act ("FAA"); but if the FAA is inapplicable for any reason, then this Arbitration Agreement is governed by the laws of the State of Wyoming. This Arbitration Agreement survives after the Agreement terminates or your relationship with 101 Drivers ends.
                </P>

                <SubHeader>Opting Out of Arbitration</SubHeader>
                <P>
                  As a Driver or Driver applicant, you may opt out of the requirement to arbitrate Driver Claims by notifying 101 Drivers in writing of your desire to opt out of arbitration. The writing must be dated, signed, and delivered by electronic mail to arbitrationoptout@101Drivers.com within 30 days after the date you execute this Agreement.
                </P>

                {/* Confidentiality */}
                <SectionHeader icon={Lock} title="Confidentiality" id="confidentiality" />
                <P>
                  You agree to maintain the confidentiality of any technical, financial, strategic, and other proprietary information related to 101 Drivers' business, operations, and properties, as well as any information about a User that is made available to you through the 101 Drivers Platform, including the User's name, pick-up location, contact information, and photo (collectively, "Confidential Information"). You may not use Confidential Information for any purpose other than as contemplated in this Agreement, and you may not disclose or permit the disclosure of Confidential Information to any third party.
                </P>

                {/* Relationship of Parties */}
                <SectionHeader icon={Handshake} title="Relationship of Parties" id="relationship" />
                <P>
                  As a Driver utilizing the 101 Drivers Platform, you and 101 Drivers are in a direct business relationship, and both parties agree that this Agreement does not create an employment relationship. There is no joint venture, franchisor-franchisee, partnership, or agency relationship intended or created by this Agreement. You are not authorized to act as an employee, agent, or representative of 101 Drivers and agree not to hold yourself out as such.
                </P>

                {/* Third-Party Services */}
                <SectionHeader icon={Building} title="Third-Party Services" id="third-party" />
                <P>
                  The 101 Drivers Platform may offer Third-Party Services that allow Users to receive or provide services from other third parties. These services may include public transportation, roadside assistance, financial, vehicle repair, insurance, or other services provided by third parties. Your use of the 101 Drivers Platform in connection with Third-Party Services is governed by this Agreement between you and 101 Drivers.
                </P>

                {/* General Terms */}
                <SectionHeader icon={FileText} title="General Terms" id="general" />
                <P>
                  This Agreement is governed by the laws of the State of Wyoming, and any disputes arising from this Agreement shall be resolved in accordance with Wyoming law. If any provision of this Agreement is found to be invalid or non-binding, the parties will remain bound by all other provisions of this Agreement. The parties will replace the invalid or non-binding provision with a valid and binding provision that has a similar effect to the invalid or non-binding provision.
                </P>
                <P>
                  101 Drivers may assign this Agreement without notice to you, but you may not assign this Agreement without 101 Drivers' prior written approval. Any notices to 101 Drivers should be sent by certified mail to the address provided. Notices to you will be provided through the 101 Drivers Platform or the email or physical address you provided during registration.
                </P>
                <P>
                  This Agreement represents the entire understanding and agreement between you and 101 Drivers and supersedes all previous agreements, whether oral or written. If you have any questions about the 101 Drivers Platform, Services, or Vehicle Delivery Services, please contact the Help Center.
                </P>

                {/* Separator between Terms and Privacy */}
                <Separator className="my-12" />

                {/* Privacy Policy Section */}
                <div id="privacy-top">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
                      <Shield className="h-6 w-6 text-lime-500 font-bold" />
                    </div>
                    <div>
                      <CardTitle className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                        Privacy Policy
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        How we collect, use, and share your personal information as a user of the 101 Drivers Platform.
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                        Effective: <span className="font-bold">May 14, 2023</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-6 text-slate-600 dark:text-slate-300">
                    <P>
                      101 Drivers Privacy Policy outlines how we collect, use, and share your personal information as a user of the 101 Drivers Platform. Our goal is to simplify your life by providing a reliable vehicle delivery platform, and to do so, we need to collect some of your personal information. This Privacy Policy is designed to help you understand how we use your information and how you can exercise your rights and choices.
                    </P>
                    <P>
                      This policy applies to all users of the 101 Drivers Platform, including Customers and Drivers (including Driver applicants), and all 101 Drivers services, including our applications, websites, technology, facilities, and other services. It only applies to personal information and not to aggregate information or information that does not identify you.
                    </P>

                    {/* Information We Collect */}
                    <SectionHeader icon={Database} title="The Information We Collect" id="info-collect" />
                    <P>
                      When you use the 101 Drivers Platform, we collect information about how you use the platform, including:
                    </P>
                    <ul className="list-disc pl-5 space-y-2">
                      <Li><strong>Device Information:</strong> We collect information about the device you use to access the 101 Drivers Platform, including the hardware model, operating system and version, unique device identifiers, and mobile network information.</Li>
                      <Li><strong>Log Information:</strong> We collect log information about your use of the 101 Drivers Platform, including the type of browser you use, access times, pages viewed, your IP address, and the page you visited before navigating to our website.</Li>
                      <Li><strong>Location Information:</strong> We collect information about your location when you use the 101 Drivers Platform, including your device's GPS signal or information about nearby Wi-Fi access points and cell towers.</Li>
                    </ul>

                    <SubHeader>Information from Other Sources</SubHeader>
                    <P>We may also collect information about you from other sources, including:</P>
                    <ul className="list-disc pl-5 space-y-2">
                      <Li><strong>Service Providers:</strong> We may receive information about you from our service providers, such as payment processors, fraud detection services, and background check providers.</Li>
                      <Li><strong>Optional Programs:</strong> We may collect information about you from optional programs in which you participate, such as referral programs or promotional offers.</Li>
                    </ul>

                    <SubHeader>Location, Usage, and Device Data</SubHeader>
                    <P>
                      When you use the 101 Drivers Platform, we collect information about your location, usage, and device. For Customers, we collect your device's precise location from the time you request a vehicle delivery until it ends. For Drivers, we collect your device's precise location when you use the app. We also collect information about your use of the 101 Drivers Platform, including delivery information like the date, time, destination, distance, route, and payment. We may also collect device information, such as device model, IP address, browser type, operating system version, and device identifiers.
                    </P>

                    <SubHeader>Communications Data</SubHeader>
                    <P>
                      We facilitate phone calls and text messages between Customers and Drivers without sharing either party's actual phone number with the other. However, we collect information about these communications, including the participants' phone numbers, the date and time, and the contents of SMS and chat messages.
                    </P>

                    <SubHeader>Cookies and Tracking Technologies</SubHeader>
                    <P>
                      We also collect information through the use of cookies, tracking pixels, data analytics tools like Google Analytics, SDKs, and other third-party technologies to understand how you navigate through the 101 Drivers Platform and interact with 101 Drivers advertisements. We use this information to make your 101 Drivers experience safer, to learn what content is popular, to improve your site experience, to serve you better ads on other sites, and to save your preferences.
                    </P>

                    {/* How We Use Information */}
                    <SectionHeader icon={Clock} title="How We Use Your Information" id="info-use" />
                    <P>We use your personal information to:</P>
                    <ul className="list-disc pl-5 space-y-2">
                      <Li>Provide an intuitive, useful, efficient, and worthwhile experience on our platform</Li>
                      <Li>Verify your identity, maintain your account, settings, and preferences</Li>
                      <Li>Connect you to your vehicle deliveries and provide various 101 Drivers Platform offerings</Li>
                      <Li>Calculate prices and process payments</Li>
                      <Li>Allow Customers and Drivers to connect and share their location</Li>
                      <Li>Communicate with you about your use of the platform</Li>
                      <Li>Maintain the security and safety of the 101 Drivers Platform and its users</Li>
                      <Li>Authenticate and verify users, investigate and resolve incidents</Li>
                      <Li>Encourage safe driving behavior, find and prevent fraud</Li>
                      <Li>Provide customer support</Li>
                      <Li>Improve the 101 Drivers Platform through research, testing, and analysis</Li>
                    </ul>

                    {/* How We Share Information */}
                    <SectionHeader icon={Users} title="How We Share Your Information" id="info-share" />
                    <P>
                      We do not sell your personal information to third parties for money, and we do not act as a data broker. However, we may need to share your personal information with other users, third parties, and service providers to make the 101 Drivers Platform work and to deliver relevant personalized ads to you on and off the platform.
                    </P>
                    <P>We share information between Customers and Drivers, such as:</P>
                    <ul className="list-disc pl-5 space-y-1">
                      <Li>The Customer's Vehicle pickup and destination location, name, and information about the vehicle</Li>
                      <Li>The Driver's name and profile photo</Li>
                    </ul>
                    <P>
                      We help Customers and Drivers communicate with each other to arrange a vehicle delivery, but we do not share actual phone numbers or contact information. If you report a lost or found item, we may share actual contact information with your consent to connect you with the relevant Customer or Driver.
                    </P>

                    <SubHeader>Sharing with Service Providers</SubHeader>
                    <P>
                      We may share your personal information with service providers and other parties to maintain and service your 101 Drivers account, process transactions and payments, verify the identity of users, detect and prevent fraud and unsafe activity, provide Driver loyalty and promotional programs, provide marketing and advertising services, provide financing, provide requested emergency services, provide analytics services, and undertake research to develop and improve the 101 Drivers Platform.
                    </P>

                    <SubHeader>Legal Requirements</SubHeader>
                    <P>
                      We may also share your personal information in response to a legal obligation or if we have determined that sharing your personal information is reasonably necessary or appropriate to comply with any applicable federal, state, or local law or regulation, respond to legal process, enforce our Terms of Service, cooperate with law enforcement agencies, or exercise or defend legal claims.
                    </P>

                    {/* Data Retention and Security */}
                    <SectionHeader icon={Lock} title="Data Retention and Security" id="data-security" />
                    <P>
                      We retain your information for as long as necessary to provide you and our other users the 101 Drivers Platform. We take reasonable and appropriate measures to protect your personal information, but we cannot guarantee the security of your information against unauthorized intrusions or acts by third parties.
                    </P>

                    {/* Your Rights and Choices */}
                    <SectionHeader icon={UserCheck} title="Your Rights and Choices" id="your-rights" />
                    <P>101 Drivers provides ways for you to access and delete your personal information as well as exercise applicable data rights:</P>
                    <ul className="list-disc pl-5 space-y-2">
                      <Li>You can unsubscribe from our commercial or promotional emails by clicking unsubscribe in those messages</Li>
                      <Li>You can opt out of receiving commercial or promotional text messages and push notifications through your device settings</Li>
                      <Li>You can review and edit certain account information by logging in to your account settings and profile</Li>
                      <Li>You can prevent your device from sharing location information through your device's system settings</Li>
                      <Li>You can modify your cookie settings on your browser</Li>
                      <Li>If you would like to delete your 101 Drivers account, you can visit our privacy homepage (we may retain certain information for legitimate business purposes or to comply with legal or regulatory obligations)</Li>
                    </ul>

                    {/* Contact */}
                    <SectionHeader icon={Mail} title="Contact Us" id="privacy-contact" />
                    <P>
                      If you have any questions or concerns about your privacy or anything in this policy, you can contact us at:
                    </P>
                    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50">
                      <a href="mailto:driver@101drivers.com" className="text-lime-500 font-bold hover:underline">
                        driver@101drivers.com
                      </a>
                    </div>

                    <AlertBox type="info">
                      The 101 Drivers Platform may contain links or references to third-party websites, products, or services, and we recommend that you review their privacy policies. We may update this policy from time to time, and if we make material changes, we will let you know through the 101 Drivers Platform or by some other method of communication like email.
                    </AlertBox>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-8 mt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
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
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  )
}
