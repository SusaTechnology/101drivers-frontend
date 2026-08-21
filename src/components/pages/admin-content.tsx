//@ts-nocheck
import React, { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  FileText, HelpCircle, Save, Loader2, ArrowLeft, Plus, Trash2,
  Shield, Download, Handshake, Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Navbar } from '../shared/layout/testNavbar'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { RichTextEditor } from '@/components/shared/RichTextEditor'
import { getAccessToken } from '@/lib/tanstack/dataQuery'
import { useQueryClient } from '@tanstack/react-query'
import { driverFaqs, customerFaqs } from '@/components/pages/help'

const API_BASE = import.meta.env.VITE_API_URL

// ── Pre-built HTML extracted from PolicySheet.tsx ──
const AGREEMENT_HTML = `<h2>Independent Driver Agreement</h2>
<p><em>Effective: April 1, 2026</em></p>
<p>This Independent Driver Agreement ("Agreement") is entered into by and between the driver ("Driver") and 101 Drivers, Inc. ("Company"). By checking the agreement box during signup, the Driver acknowledges and agrees to the following terms and conditions.</p>
<h3>1. Independent Contractor Status</h3>
<p>The Driver acknowledges and agrees that they are an independent contractor and not an employee of the Company. The Driver shall be solely responsible for determining the manner and means by which services are performed. The Company does not control the Driver's work schedule, methods, or procedures, except as may be reasonably necessary to ensure the quality of services provided. Nothing in this Agreement shall be construed to create an employment relationship, partnership, joint venture, or agency relationship between the Driver and the Company.</p>
<h3>2. Services</h3>
<p>The Driver agrees to perform vehicle delivery services as requested through the Company's platform. The Driver shall use their own vehicle, equipment, and tools to perform the services. The Driver represents that they possess a valid driver's license, appropriate insurance coverage, and any other licenses or permits required by law to perform the services.</p>
<h3>3. Compensation</h3>
<p>The Driver shall be compensated for completed delivery services as outlined on the Company's platform. Compensation rates may be adjusted by the Company from time to time with reasonable notice. The Driver acknowledges that they are responsible for all taxes, including self-employment taxes, related to the compensation received under this Agreement.</p>
<h3>4. Insurance and Liability</h3>
<p>The Driver shall maintain, at their own expense, appropriate automobile liability insurance that meets or exceeds the minimum requirements of the state(s) in which they operate. The Driver agrees to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from the Driver's negligent acts or omissions in the performance of services under this Agreement.</p>
<h3>5. Background Check</h3>
<p>The Driver consents to a background check and driving record review as a condition of providing services through the Company's platform. The Company reserves the right to suspend or terminate this Agreement if the results of such checks do not meet the Company's standards.</p>
<h3>6. Confidentiality</h3>
<p>The Driver agrees to maintain the confidentiality of any proprietary or sensitive information received from the Company or its customers, including but not limited to customer contact information, delivery addresses, and business practices. This obligation survives the termination of this Agreement.</p>
<h3>7. Termination</h3>
<p>Either party may terminate this Agreement at any time, with or without cause, by providing written notice to the other party. Upon termination, the Driver shall return any Company property and cease representing themselves as affiliated with the Company.</p>
<h3>8. Governing Law</h3>
<p>This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the courts located in the State of Georgia.</p>
<h3>9. Entire Agreement</h3>
<p>This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.</p>
<h3>10. Acknowledgment</h3>
<p><strong>BY CHECKING THE AGREEMENT BOX DURING DRIVER SIGNUP, THE DRIVER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. THE DRIVER FURTHER ACKNOWLEDGES THAT THEY HAVE HAD THE OPPORTUNITY TO REVIEW THIS AGREEMENT AND TO ASK QUESTIONS ABOUT ITS PROVISIONS.</strong></p>`

const TERMS_HTML = `<h2>Terms of Service</h2>
<p><em>Effective date: March 2026</em></p>
<p>These Terms will govern your use of the 101 Drivers platform, including quote requests, delivery coordination, and compliance evidence handling. The terms are aligned with applicable laws for California operations.</p>
<h3>Key Concepts</h3>
<ul>
<li>Quote-first flow: you can view an estimate before providing additional details.</li>
<li>Compliance evidence: deliveries may require photos, odometer readings, and VIN last-4 verification.</li>
<li>Notifications: email-first updates (SMS optional if enabled by Admin policy).</li>
<li>Platform rules: cancellation, rescheduling, and dispute handling will follow published policies.</li>
</ul>
<h3>Accounts &amp; Eligibility</h3>
<ul>
<li>Dealers/individual customers may create delivery requests after authentication (when enabled).</li>
<li>Drivers may require onboarding and approval before booking jobs.</li>
<li>Admin oversight may be required for certain operations and compliance.</li>
</ul>`

const PRIVACY_HTML = `<h2>Privacy Policy</h2>
<p><em>Last updated: March 2026</em></p>
<p>101 Drivers Privacy Policy outlines how we collect, use, and share your personal information as a user of the 101 Drivers Platform. Our goal is to simplify your life by providing a reliable vehicle delivery platform, and to do so, we need to collect some of your personal information.</p>
<p>This policy applies to all users of the 101 Drivers Platform, including Customers and Drivers (including Driver applicants), and all 101 Drivers services.</p>
<h3>The Information We Collect</h3>
<ul>
<li><strong>Device Information:</strong> Hardware model, operating system, unique device identifiers, and mobile network information.</li>
<li><strong>Log Information:</strong> Browser type, access times, pages viewed, IP address, and referring page.</li>
<li><strong>Location Information:</strong> GPS signal or information about nearby Wi-Fi access points and cell towers.</li>
</ul>
<h4>Location, Usage, and Device Data</h4>
<p>For Customers, we collect your device's precise location from the time you request a vehicle delivery until it ends. For Drivers, we collect your device's precise location when you use the app. We also collect delivery information like date, time, destination, distance, route, and payment.</p>
<h4>Communications Data</h4>
<p>We facilitate phone calls and text messages between Customers and Drivers without sharing either party's actual phone number. However, we collect information about these communications, including phone numbers, date/time, and contents of SMS and chat messages.</p>
<h3>How We Use Your Information</h3>
<ul>
<li>Provide an intuitive, useful, efficient experience on our platform</li>
<li>Verify your identity, maintain your account, settings, and preferences</li>
<li>Connect you to your vehicle deliveries and provide various offerings</li>
<li>Calculate prices and process payments</li>
<li>Allow Customers and Drivers to connect and share their location</li>
<li>Communicate with you about your use of the platform</li>
<li>Maintain the security and safety of the platform and its users</li>
<li>Authenticate users, investigate and resolve incidents, prevent fraud</li>
<li>Provide customer support and improve the platform through research</li>
</ul>
<h3>How We Share Your Information</h3>
<p>We do not sell your personal information to third parties for money, and we do not act as a data broker.</p>
<ul>
<li>The Customer's vehicle pickup and destination location, name, and vehicle info</li>
<li>The Driver's name and profile photo</li>
<li>We do not share actual phone numbers or contact information</li>
</ul>
<h3>Data Retention and Security</h3>
<p>We retain your information for as long as necessary to provide you and our other users the 101 Drivers Platform. We take reasonable measures to protect your personal information, but we cannot guarantee security against unauthorized intrusions.</p>
<h3>Your Rights and Choices</h3>
<ul>
<li>Unsubscribe from commercial/promotional emails by clicking unsubscribe</li>
<li>Opt out of promotional text messages and push notifications through device settings</li>
<li>Review and edit account information through your account settings</li>
<li>Prevent location sharing through your device's system settings</li>
<li>Modify cookie settings on your browser</li>
<li>Delete your 101 Drivers account by contacting us</li>
</ul>
<h3>Contact Us</h3>
<p>For any questions or concerns about your privacy, contact us at: <a href="mailto:driver@101drivers.com">driver@101drivers.com</a></p>`

// Placeholder content for the Customer Agreement.
// Admins are expected to replace this with the actual dealer/customer-facing
// agreement via the WYSIWYG editor on first use.
const CUSTOMER_AGREEMENT_HTML = `<h2>Customer Agreement</h2>
<p><em>Effective date: To be set by administrator.</em></p>
<p>This Customer Agreement ("Agreement") governs the use of the 101 Drivers platform by customers and dealers (collectively, "Customer"). By checking the agreement box during signup, the Customer acknowledges that they have read, understood, and agree to be bound by the terms and conditions below.</p>
<div class="blockquote"><p><strong>Placeholder content.</strong> An administrator must publish the full Customer Agreement via this editor before it is shown to customers. The text above will appear as a fallback until replaced.</p></div>`

// Placeholder content for the Customer Terms of Service.
// Distinct from the driver-facing Terms of Service (TERMS_HTML above).
const CUSTOMER_TERMS_HTML = `<h2>Customer Terms of Service</h2>
<p><em>Effective date: To be set by administrator.</em></p>
<p>These Customer Terms of Service ("Terms") govern the use of the 101 Drivers platform by customers and dealers ("Customer") for booking and managing vehicle delivery services. By creating an account or submitting a Delivery Request, the Customer agrees to be bound by these Terms.</p>
<h3>1. Acceptance of Terms</h3>
<p>By accessing or using the 101 Drivers platform, the Customer agrees to these Terms, the Customer Agreement, and the Customer Privacy Policy. If the Customer does not agree to any of these terms, they must not use the platform.</p>
<h3>2. Account Registration</h3>
<p>The Customer must provide accurate and complete information during registration and keep that information current. The Customer is responsible for safeguarding their account credentials and for all activity that occurs under their account.</p>
<h3>3. Delivery Requests &amp; Quotes</h3>
<p>Quotes are estimates based on the information provided at the time of the request. The actual charge may differ if the Customer modifies the request after the Quote is generated. Submitting a Delivery Request does not guarantee a Driver will accept it, and estimated pickup and drop-off times are not guaranteed commitments.</p>
<h3>4. Payment &amp; Billing</h3>
<p>By submitting a Delivery Request, the Customer authorizes the Company to charge the saved payment method for the full amount of the Quote. If the charge fails, the Delivery Request will be cancelled automatically. Business Customers on postpaid invoicing are billed according to the terms separately agreed with the Company.</p>
<h3>5. Customer Responsibilities</h3>
<ul>
<li>Provide accurate pickup and drop-off addresses</li>
<li>Ensure the vehicle is accessible at the scheduled pickup time</li>
<li>Provide the pickup authorization PIN to the Driver</li>
<li>Ensure the recipient or an authorized representative is available at drop-off</li>
<li>Ensure the vehicle meets the Platform's published vehicle standards</li>
</ul>
<h3>6. Cancellation &amp; Refunds</h3>
<p>The Customer may cancel a Delivery Request before a Driver has been assigned at no charge. Once a Driver has accepted, cancellation may be subject to a fee. Refunds are processed back to the original payment method and may take several business days to appear.</p>
<h3>7. Insurance</h3>
<p>Every Delivery Request includes an insurance fee that covers the vehicle during transit, subject to the coverage limits and exclusions published by the Company.</p>
<h3>8. Limitation of Liability</h3>
<p>To the maximum extent permitted by law, the Company's total liability for any claim is limited to the amount the Customer paid for the Delivery Request giving rise to the claim.</p>
<h3>9. Governing Law</h3>
<p>These Terms shall be governed by the laws of the State of California. Any disputes shall be resolved in the courts located in the State of California.</p>
<h3>10. Contact</h3>
<p>For any questions about these Terms, contact: <a href="mailto:support@101drivers.com">support@101drivers.com</a></p>
<div class="blockquote"><p><strong>Placeholder content.</strong> These Customer Terms of Service are provided as a starting point. An administrator must review and refine them with legal counsel before publishing. These Terms are distinct from the driver-facing Terms of Service.</p></div>`

// Placeholder content for the Customer Privacy Policy.
// Distinct from the driver-facing Privacy Policy (PRIVACY_HTML above).
const CUSTOMER_PRIVACY_HTML = `<h2>Customer Privacy Policy</h2>
<p><em>Last updated: To be set by administrator.</em></p>
<p>This Customer Privacy Policy describes how 101 Drivers, Inc. ("Company") collects, uses, and shares personal information of customers and dealers ("Customer") who use the 101 Drivers platform to book and manage vehicle delivery services.</p>
<h3>1. Information We Collect</h3>
<ul>
<li><strong>Account Information:</strong> Name, email, phone, password (hashed), account preferences.</li>
<li><strong>Business Information:</strong> For business customers, business name, address, contact info, monthly delivery volume.</li>
<li><strong>Payment Information:</strong> Stripe customer ID, saved payment method identifiers (we do not store full card numbers).</li>
<li><strong>Vehicle Information:</strong> License plate, make, model, color, VIN last-4, vehicle standards attestation.</li>
<li><strong>Recipient Information:</strong> Recipient name, email, phone for delivery coordination.</li>
<li><strong>Delivery Information:</strong> Pickup/drop-off addresses, scheduled times, delivery status, compliance evidence.</li>
<li><strong>Location Information:</strong> Precise device location during active delivery coordination.</li>
</ul>
<h3>2. How We Use Your Information</h3>
<ul>
<li>Register and authenticate Customer accounts</li>
<li>Process Delivery Requests, Quotes, and payments</li>
<li>Coordinate pickup and drop-off with Drivers</li>
<li>Provide real-time tracking and delivery status updates</li>
<li>Investigate and resolve disputes, claims, and insurance incidents</li>
<li>Detect and prevent fraud, abuse, and prohibited conduct</li>
<li>Provide customer support and improve the Platform</li>
<li>Send service notifications (email-first; SMS optional)</li>
</ul>
<h3>3. How We Share Your Information</h3>
<ul>
<li><strong>Drivers:</strong> Pickup/drop-off addresses, vehicle info, recipient contact info, pickup PIN — only after a Driver accepts the Delivery Request.</li>
<li><strong>Payment Processors:</strong> Stripe and other processors to charge saved payment methods and process refunds.</li>
<li><strong>Insurance Partners:</strong> Coverage and claims information in the event of an insurance incident.</li>
<li><strong>Service Providers:</strong> Infrastructure, analytics, and communications providers that support the Platform.</li>
<li><strong>Legal Authorities:</strong> When required by law or to protect rights, property, or safety.</li>
</ul>
<p>We do not sell Customer personal information to third parties for money.</p>
<h3>4. Data Retention</h3>
<p>We retain Customer information for as long as the account is active, and for a reasonable period thereafter to comply with legal obligations, resolve disputes, and enforce agreements. Delivery records and compliance evidence may be retained longer as required by insurance, tax, or regulatory requirements.</p>
<h3>5. Security</h3>
<p>We take reasonable measures to protect Customer information, including encryption in transit and at rest, access controls, and regular security reviews. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>
<h3>6. Customer Rights</h3>
<ul>
<li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
<li><strong>Correction:</strong> Request correction of inaccurate or incomplete information.</li>
<li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal retention obligations.</li>
<li><strong>Opt-Out:</strong> Unsubscribe from promotional emails and text messages at any time.</li>
<li><strong>Data Portability:</strong> Receive your personal information in a structured, machine-readable format.</li>
</ul>
<p>To exercise any of these rights, contact <a href="mailto:support@101drivers.com">support@101drivers.com</a>.</p>
<h3>7. Cookies</h3>
<p>The Platform uses cookies and similar technologies for authentication, session management, and analytics. Customers can control cookies through their browser settings.</p>
<h3>8. Children's Privacy</h3>
<p>The Platform is not directed to children under 18, and we do not knowingly collect personal information from children.</p>
<h3>9. Changes to This Policy</h3>
<p>We may update this Privacy Policy from time to time. We will notify Customers of material changes by email or by posting a notice on the Platform.</p>
<h3>10. Contact Us</h3>
<p>For any questions or concerns about this Privacy Policy, contact: <a href="mailto:support@101drivers.com">support@101drivers.com</a></p>
<div class="blockquote"><p><strong>Placeholder content.</strong> This Customer Privacy Policy is provided as a starting point. An administrator must review and refine it with legal counsel before publishing. This Privacy Policy is distinct from the driver-facing Privacy Policy.</p></div>`

const CONTENT_SECTIONS = [
  { key: 'customer-agreement', label: 'Customer Agreement', icon: Handshake, type: 'richtext', importHtml: CUSTOMER_AGREEMENT_HTML },
  { key: 'customer-terms', label: 'Customer Terms of Service', icon: FileText, type: 'richtext', importHtml: CUSTOMER_TERMS_HTML },
  { key: 'customer-privacy', label: 'Customer Privacy Policy', icon: Shield, type: 'richtext', importHtml: CUSTOMER_PRIVACY_HTML },
  { key: 'agreement', label: 'Independent Driver Agreement', icon: Handshake, type: 'richtext', importHtml: AGREEMENT_HTML },
  { key: 'terms', label: 'Driver Terms of Service', icon: FileText, type: 'richtext', importHtml: TERMS_HTML },
  { key: 'privacy', label: 'Driver Privacy Policy', icon: Shield, type: 'richtext', importHtml: PRIVACY_HTML },
  { key: 'help-driver', label: 'Driver Help FAQs', icon: HelpCircle, type: 'faq', importHtml: null },
  { key: 'help-customer', label: 'Customer Help FAQs', icon: HelpCircle, type: 'faq', importHtml: null },
]

export default function AdminContentPage() {
  const { actionItems, signOut } = useAdminActions()
  const queryClient = useQueryClient()
  const [activeKey, setActiveKey] = useState('agreement')
  const [content, setContent] = useState<string>('')
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  // Refs for auto-scrolling to newly added FAQ items.
  // faqRefs maps index → the question Input element for that FAQ.
  const faqRefs = useRef<Array<HTMLDivElement | null>>([])
  // Tracks which FAQ index was just added (so we scroll to it + focus).
  const [newFaqIndex, setNewFaqIndex] = useState<number | null>(null)

  const activeSection = CONTENT_SECTIONS.find(s => s.key === activeKey)!

  // Fetch content for the active tab directly with fetch().
  // We intentionally do NOT use useDataQuery here because it uses
  // `keepPreviousData` (placeholderData: keepPreviousData), which keeps
  // the PREVIOUS tab's data visible as a placeholder while the new tab
  // is fetching. That caused a bug where switching from Agreement to
  // Privacy would briefly show the Agreement content under the Privacy
  // heading. A plain fetch gives us full control: we clear state
  // immediately on tab switch, show a loading spinner, and only apply
  // data that matches the currently active tab.
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setContent('')
    setFaqs([])

    fetch(`${API_BASE}/api/content/${activeKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data && data.key === activeKey) {
          if (activeSection.type === 'richtext') {
            setContent(typeof data.content === 'string' ? data.content : '')
          } else {
            setFaqs(Array.isArray(data.content) ? data.content : [])
          }
        }
      })
      .catch(() => {
        /* swallow — empty state will show */
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeKey, activeSection.type])

  const handleSave = () => {
    setIsSaving(true)
    const body = activeSection.type === 'richtext' ? { content } : { content: faqs }
    const token = getAccessToken()
    fetch(`${API_BASE}/api/content/${activeKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then(res => {
      if (!res.ok) throw new Error()
      toast.success('Content saved successfully')
      // Invalidate the React Query cache for this key so that the next
      // tab switch refetches fresh data instead of showing stale cache.
      queryClient.invalidateQueries({ queryKey: ['admin-content', activeKey] })
    }).catch(() => toast.error('Failed to save content'))
    .finally(() => setIsSaving(false))
  }

  const handleImportCurrent = () => {
    if (activeSection.type === 'faq') {
      const defaultFaqs = activeKey === 'help-driver' ? driverFaqs : customerFaqs
      setFaqs(defaultFaqs.map(f => ({ question: f.question, answer: f.answer })))
      toast.success('Loaded current FAQs')
    } else {
      setContent(activeSection.importHtml)
      toast.success('Loaded current content')
    }
  }

  const addFaq = () => {
    const newIndex = faqs.length
    setFaqs([...faqs, { question: '', answer: '' }])
    setNewFaqIndex(newIndex)
  }

  // When a new FAQ is added, scroll it into view and focus the question
  // input. This runs after the render so the new FAQ element exists.
  useEffect(() => {
    if (newFaqIndex === null) return
    const faqDiv = faqRefs.current[newFaqIndex]
    if (faqDiv) {
      // scrollIntoView with smooth behavior + 'nearest' block so it
      // doesn't jump to the very top of the page.
      faqDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      // Focus the question input inside this FAQ item.
      const questionInput = faqDiv.querySelector('input')
      if (questionInput) {
        // Small delay so scrollIntoView finishes first.
        setTimeout(() => questionInput.focus(), 300)
      }
    }
    // Clear so it doesn't re-trigger on re-renders.
    setNewFaqIndex(null)
  }, [newFaqIndex, faqs])

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs(faqs.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }
  const removeFaq = (index: number) => setFaqs(faqs.filter((_, i) => i !== index))

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />

      <main className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header — sticky below the navbar so Save Changes is always visible.
            top-16 lg:top-20 matches the navbar height (h-16 mobile, h-20 desktop).
            z-30 keeps it above the sidebar/editor content but below navbar (z-50). */}
        <div className="sticky top-16 lg:top-20 z-30 mx-6 px-6 py-2 mb-3 bg-background-light dark:bg-background-dark border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin-config" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <h1 className="text-xl font-black">Content Editor</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* "Import Current" button — commented out for now since the content
                has already been seeded. Uncomment to re-enable.
            <Button onClick={handleImportCurrent} disabled={isSaving || isLoading} variant="outline" className="rounded-xl font-bold gap-2 text-xs">
              <Download className="w-3.5 h-3.5" /> Import Current
            </Button>
            */}
            <Button onClick={handleSave} disabled={isSaving || isLoading} className="lime-btn rounded-xl font-extrabold gap-2">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Changes</>}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar — sticky so it stays visible while the editor scrolls.
              top-36 lg:top-40 leaves room for the navbar (h-16/h-20) + the
              sticky content header (~60px) above it. */}
          <div className="lg:sticky lg:top-36 lg:self-start space-y-2">
            {CONTENT_SECTIONS.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveKey(section.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition text-left',
                  activeKey === section.key
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                )}
              >
                <section.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            ))}
          </div>

          {/* Editor area */}
          <div>
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : activeSection.type === 'richtext' ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  {/* Section title — sticky so the title stays visible while
                      scrolling through long content. top-16 lg:top-20 = navbar
                      height. bg matches card so content scrolls under cleanly. */}
                  <div className="sticky top-16 lg:top-20 z-20 -mx-4 px-4 py-3 mb-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-black">{activeSection.label}</h2>
                    <p className="text-xs text-slate-500 mt-1">Edit the content below. Changes will appear on the public site after you click Save.</p>
                  </div>
                  {content ? (
                    <RichTextEditor key={activeKey} content={content} onChange={setContent} />
                  ) : (
                    <RichTextEditor key={activeKey} content={content} onChange={setContent} />
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  {/* FAQ header — sticky so the "Add FAQ" button is always
                      visible while scrolling through many FAQ items.
                      top-16 lg:top-20 = navbar height. bg-white/dark matches
                      the card background so content scrolls under it cleanly. */}
                  <div className="sticky top-36 lg:top-36 z-20 -mx-4 px-4 py-3 mb-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black">{activeSection.label}</h2>
                      <p className="text-xs text-slate-500 mt-1">Add, edit, or remove FAQ items.</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={addFaq}>
                      <Plus className="w-3.5 h-3.5" /> Add FAQ
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {faqs.length === 0 && (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        No FAQs saved yet. Click "Add FAQ" to create one, or ask an admin to seed the initial FAQs.
                      </div>
                    )}
                    {faqs.map((faq, index) => (
                      <div
                        key={index}
                        ref={(el) => { faqRefs.current[index] = el }}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 scroll-mt-44 lg:scroll-mt-48"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-400">FAQ #{index + 1}</span>
                          <button onClick={() => removeFaq(index)} className="text-red-400 hover:text-red-600 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Question</Label>
                          <Input value={faq.question} onChange={(e) => updateFaq(index, 'question', e.target.value)} placeholder="Enter the question..." className="h-9 text-sm rounded-xl" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Answer</Label>
                          <textarea value={faq.answer} onChange={(e) => updateFaq(index, 'answer', e.target.value)} placeholder="Enter the answer..." rows={3} className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
