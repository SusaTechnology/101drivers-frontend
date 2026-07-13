//@ts-nocheck
import React, { useState, useEffect } from 'react'
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

const CONTENT_SECTIONS = [
  { key: 'agreement', label: 'Independent Driver Agreement', icon: Handshake, type: 'richtext', importHtml: AGREEMENT_HTML },
  { key: 'terms', label: 'Terms of Service', icon: FileText, type: 'richtext', importHtml: TERMS_HTML },
  { key: 'privacy', label: 'Privacy Policy', icon: Shield, type: 'richtext', importHtml: PRIVACY_HTML },
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

  const addFaq = () => setFaqs([...faqs, { question: '', answer: '' }])
  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs(faqs.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }
  const removeFaq = (index: number) => setFaqs(faqs.filter((_, i) => i !== index))

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />

      <main className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header — Import and Save always visible side by side */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin-config" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <h1 className="text-2xl font-black">Content Editor</h1>
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
          {/* Sidebar */}
          <div className="space-y-2">
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
                  <div className="mb-3">
                    <h2 className="text-lg font-black">{activeSection.label}</h2>
                    <p className="text-xs text-slate-500 mt-1">Edit the content below. Changes will appear on the public site after you click Save.</p>
                  </div>
                  {content ? (
                    <RichTextEditor key={activeKey} content={content} onChange={setContent} />
                  ) : (
                    <div
                      className="min-h-[400px] p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center text-slate-400 text-sm"
                      // onClick={handleImportCurrent}
                      role="button"
                    >
                      No saved content yet. Start typing below, or ask an admin to seed the initial content.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
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
                      <div key={index} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
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
