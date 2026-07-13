//@ts-nocheck
import React, { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  FileText, HelpCircle, Save, Loader2, ArrowLeft, Plus, Trash2,
  Shield, Download,
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
import { useDataQuery, useCreate, getAccessToken } from '@/lib/tanstack/dataQuery'
import { driverFaqs, customerFaqs } from '@/components/pages/help'

// Pre-built HTML of the current content — extracted from the source files.
// This is used by the "Import Current Content" button to seed the DB.
const PRIVACY_HTML = `<h2>Agreement</h2>
<p>By using or accessing the 101 Drivers Platform, you acknowledge that you understand and accept all of the terms outlined in this Agreement. If you do not agree to be bound by these terms and conditions, you may not use or access the 101 Drivers Platform or any of the services provided through it.</p>
<p>The 101 Drivers Platform serves as a connection between drivers and Customers who require their services. Customers can create vehicle delivery requests on 101drivers.com, and Drivers can book these requests through the same website. All Users of the 101 Drivers Platform, including Drivers and Customers, are subject to the terms outlined in this Agreement. The act of driving vehicles for Customers is referred to as Vehicle Delivery Services.</p>
<p>As a Customer, you authorize Drivers to match and/or re-match your vehicle delivery request based on various factors, such as location, pickup and drop-off times, and regulatory requirements. The decision to list Vehicle Delivery Services is solely at the discretion of the Customer.</p>
<p>Additional agreements, known as Supplemental Agreements, may apply to specific services in certain markets. It is important to review these agreements carefully, as they may contain terms and conditions that differ from those outlined in this Agreement. If you do not agree to be bound by the terms of a Supplemental Agreement, you may not use 101 Drivers Services in that particular market.</p>
<p>In the event of any conflict between this Agreement and the terms of a Supplemental Agreement, the terms of this Agreement will prevail, unless the Supplemental Agreement explicitly states otherwise.</p>
<h3>Modification to the Agreement</h3>
<p>101 Drivers reserves the right to modify the terms and conditions of this Agreement. Any modifications will be binding on you only upon your acceptance of the modified Agreement. 101 Drivers also reserves the right to modify any information on pages referenced in the hyperlinks from this Agreement from time to time, and such modifications shall become effective upon posting. Your continued use of the 101 Drivers Platform after any such changes shall constitute your acceptance of such changes. Unless material changes are made to the arbitration provisions herein, you agree that modification of this Agreement does not create a renewed opportunity to opt out of arbitration (if applicable).</p>
<h3>Eligibility</h3>
<p>The 101 Drivers Platform is only available to companies and individuals who have the right and authority to enter into this Agreement and are fully able and competent to satisfy the terms, conditions, and obligations herein.</p>
<p>The 101 Drivers Platform is not available to Drivers who have had their User account temporarily or permanently deactivated. To use the 101 Drivers Platform, each User must create a User account. Each person may only create one User account, and 101 Drivers reserves the right to deactivate any additional or duplicate accounts.</p>
<p>Your eligibility to participate in certain 101 Drivers services may be subject to additional requirements as determined by 101 Drivers.</p>
<p>By becoming a Driver, you represent and warrant that you are at least 25 years old and meet the following criteria:</p>
<ul>
<li>No more than 1 distracted driving violation in the last 36 months</li>
<li>No more than 2 moving violations in the last 36 months</li>
<li>No more than 2 at-fault accidents in the last 60 months</li>
<li>No major moving violation in the last 36 months</li>
<li>No DUI or other drug-related driving violation in the last 84 months</li>
<li>No Auto Related Felonies of any kind</li>
</ul>
<h3>Charges</h3>
<p>As a Customer, you acknowledge that using the Vehicle Delivery Services or 101 Drivers Services may result in Charges to you or your organization, if applicable. These Charges include Prices and other fees, tolls, surcharges, and taxes, as set forth in the service region, plus any tips you choose to give to the Driver.</p>
<p>101 Drivers has the authority to determine and modify pricing by quoting you a price for a specific vehicle delivery at the time you create a vehicle delivery request. You are responsible for reviewing the price quote within the 101 Drivers Platform and will be responsible for all Charges incurred under your User account, regardless of your awareness of such Charges or the amounts thereof.</p>
<h4>Vehicle Delivery Service Price ("Prices")</h4>
<p>When you request a vehicle delivery using the 101 Drivers Platform, 101 Drivers will quote you a price at the time of your request. Quoted Prices may include the Vehicle Delivery Service Fees and Other Charges below, as applicable. Please note that we use Google Maps' data to calculate the distance and the price for the vehicle delivery request. We cannot guarantee the accuracy of Google Maps' data.</p>
<ul>
<li><strong>Setup Fee:</strong> 101 Drivers may charge a one-time "Setup Fee" to sign up. For now, this fee is waived.</li>
<li><strong>Cancellation Fee:</strong> If you cancel a vehicle delivery request through the 101 Drivers Platform, a cancellation fee may apply in certain cases. 101 Drivers may also charge a fee if you fail to have a vehicle ready after requesting a vehicle delivery.</li>
<li><strong>Tolls:</strong> In some instances, tolls, toll estimates, or return tolls may apply to your vehicle delivery (not in Wyoming).</li>
<li><strong>Other Charges:</strong> Other fees and surcharges may apply to your vehicle delivery, including but not limited to actual or anticipated airport fees, state fees, local fees, event fees, or fuel surcharges.</li>
<li>In addition, where required by law, 101 Drivers will collect applicable taxes.</li>
<li><strong>Tips:</strong> After a delivery, you may have the opportunity to tip your Driver in cash, Zelle, or through the 101 Drivers Platform. Any tips will be provided entirely to the applicable Driver.</li>
</ul>
<h4>Charges Generally</h4>
<ul>
<li><strong>Facilitation of Charges:</strong> All Charges are processed through a third-party payment processor (Stripe, Inc., Zelle, Banks, etc.). 101 Drivers may replace its third-party payment processor without notice to you.</li>
<li><strong>Cash Payments:</strong> With the exception of tips, cash payments are strictly prohibited unless expressly permitted by 101 Drivers.</li>
<li><strong>Billing:</strong> Certain Charges may be collectively billed as a single purchase transaction to your selected payment method based on the payment frequency indicated in your settings.</li>
<li><strong>No Refunds:</strong> All Charges are non-refundable except to the extent required by law.</li>
<li><strong>Payment Card Authorization:</strong> Upon addition of a new payment method or each request for 101 Drivers Services and Vehicle Delivery Services, 101 Drivers may seek authorization of your selected payment method to verify the payment method, ensure the Charges will be covered, and protect against unauthorized behavior.</li>
<li><strong>Fees:</strong> For clarity, 101 Drivers does not charge a fee for Users to access the 101 Drivers Platform, but retains the right to charge Users and/or organizations, if applicable, a fee or any other Charge for accessing or using 101 Drivers Services and Vehicle Delivery Services made available through the 101 Drivers Platform.</li>
</ul>
<h3>Driver Payments</h3>
<p>If you are a Driver, you will receive payment for your provision of Vehicle Delivery Services according to the terms of the Driver Agreement, which is part of this Agreement between you and 101 Drivers.</p>
<h3>101 Drivers Communications</h3>
<p>By entering into this Agreement or using the 101 Drivers Platform, you agree to receive communications from us, our affiliates, or our third-party partners, at any of the phone numbers provided to 101 Drivers by you or on your behalf, and also via email, text message, calls, and push notifications. You agree that texts, calls, or prerecorded messages may be generated by automatic telephone dialing systems. If you wish to opt-out of promotional emails, you can unsubscribe from our promotional email list by following the unsubscribe options in the promotional email itself.</p>
<h3>Restricted Activities</h3>
<p>You agree not to engage in any of the restricted activities listed above with respect to your use of the 101 Drivers Platform. If you suspect any breach of security or violation of this Agreement, you agree to notify us immediately.</p>
<p>Additionally, you agree not to discriminate against or harass anyone on the basis of race, national origin, religion, gender, gender identity or expression, physical or mental disability, medical condition, marital status, age, or sexual orientation.</p>
<h3>Driver Representations</h3>
<p>As a Driver providing Vehicle Delivery Services on the 101 Drivers Platform, you acknowledge and agree to the following disclaimers: You will not engage in reckless behavior while driving, drive unsafely, operate a vehicle that is unsafe to drive, permit an unauthorized third party to accompany you in the vehicle, provide Vehicle Delivery Services while under the influence of alcohol or drugs, or take action that harms or threatens to harm the safety of the 101 Drivers community or third parties.</p>
<h3>Disclaimers</h3>
<p>As a Driver, you acknowledge that: We have no control over the quality or safety of the transportation that occurs as a result of the Vehicle Delivery Services. Any safety-related feature, process, policy, standard, or other effort undertaken by 101 Drivers is not an indication of any employment or agency relationship with any User.</p>
<h3>Indemnification</h3>
<p>You will indemnify and hold harmless 101 Drivers from and against any claims, actions, suits, losses, costs, liabilities and expenses relating to or arising out of your use of the 101 Drivers Platform, your breach of this Agreement, your violation of any law or the rights of a third party, your ownership, use or operation of a motor vehicle, and any other activities in connection with the 101 Drivers Platform.</p>
<h3>Relationship of the Parties</h3>
<p>As a Driver utilizing the 101 Drivers Platform, you and 101 Drivers are in a direct business relationship, and both parties agree that this Agreement does not create an employment relationship. There is no joint venture, franchisor-franchisee, partnership, or agency relationship intended or created by this Agreement. You are not authorized to act as an employee, agent, or representative of 101 Drivers.</p>
<h2>Privacy Policy</h2>
<h3>Information We Collect</h3>
<ul>
<li><strong>Account Information:</strong> When you create a 101 Drivers account, we collect your name, email address, phone number, password, date of birth, driver's license information (for Drivers), and other information you provide.</li>
<li><strong>Log Information:</strong> We collect log information about your use of the 101 Drivers Platform, including the type of browser you use, access times, pages viewed, your IP address, and the page you visited before navigating to our website.</li>
<li><strong>Location, Usage, and Device Data:</strong> When you use the 101 Drivers Platform, we collect information about your location, usage, and device. For Customers, we collect your device's precise location from the time you request a vehicle delivery until it ends. For Drivers, we collect your device's precise location when you use the app.</li>
<li><strong>Communications Data:</strong> We facilitate phone calls and text messages between Customers and Drivers without sharing either party's actual phone number with the other.</li>
</ul>
<h3>How We Use Your Information</h3>
<ul>
<li>Provide, maintain, and improve the 101 Drivers Platform</li>
<li>Process and complete vehicle delivery requests</li>
<li>Communicate with you about your account and deliveries</li>
<li>Encourage safe driving behavior, find and prevent fraud</li>
<li>Comply with legal obligations</li>
</ul>
<h3>Sharing Your Information</h3>
<p>We may share your personal information with: Drivers and Customers (to facilitate deliveries), service providers (payment processing, analytics), law enforcement (when required by law), and affiliates. We may also share your personal information in response to a legal obligation or if we have determined that sharing is reasonably necessary to comply with any applicable law.</p>
<h3>Your Rights</h3>
<ul>
<li>You can access and update your account information through the app</li>
<li>You can unsubscribe from commercial or promotional emails by clicking unsubscribe</li>
<li>You can opt out of receiving commercial or promotional text messages and push notifications through your device settings</li>
<li>If you would like to delete your 101 Drivers account, you can visit our privacy homepage</li>
</ul>`

const TERMS_HTML = `<h2>Terms of Service</h2>
<p>Welcome to 101 Drivers. By using our platform, you agree to these Terms of Service. If you do not agree, you may not use the 101 Drivers Platform.</p>
<h3>1. Acceptance of Terms</h3>
<p>By accessing or using the 101 Drivers Platform, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you must not use our services.</p>
<h3>2. Use of the Platform</h3>
<p>You may use the 101 Drivers Platform only for lawful purposes and in accordance with these Terms. You are responsible for all activities that occur under your account.</p>
<h3>3. Vehicle Delivery Services</h3>
<p>The 101 Drivers Platform connects Customers who need vehicle delivery services with Drivers who provide them. 101 Drivers does not provide the vehicle delivery services itself and is not responsible for the acts or omissions of Drivers or Customers.</p>
<h3>4. Payment</h3>
<p>Customers are charged for vehicle delivery services through the platform. Drivers receive payment for their services through the platform, minus applicable fees. All charges are processed through third-party payment processors.</p>
<h3>5. Cancellation</h3>
<p>Customers may cancel a vehicle delivery request before it is picked up. Cancellation fees may apply in certain cases. Drivers cannot cancel deliveries directly — they must report issues through the app.</p>
<h3>6. Insurance</h3>
<p>All drivers are fully insured by 101 Drivers Inc. from the moment they start a delivery until it is completed. Customers' vehicles are covered during transit.</p>
<h3>7. Limitation of Liability</h3>
<p>101 Drivers shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform or vehicle delivery services.</p>
<h3>8. Changes to Terms</h3>
<p>We reserve the right to modify these Terms at any time. Changes are effective upon posting. Your continued use of the platform constitutes acceptance of the modified Terms.</p>
<h3>9. Contact</h3>
<p>If you have questions about these Terms, please contact us at ops@101drivers.techbee.et or call +1 (310) 962-8402.</p>`

const API_BASE = import.meta.env.VITE_API_URL

const CONTENT_SECTIONS = [
  { key: 'privacy', label: 'Privacy Policy & Agreement', icon: Shield, type: 'richtext' },
  { key: 'terms', label: 'Terms of Service', icon: FileText, type: 'richtext' },
  { key: 'help-driver', label: 'Driver Help FAQs', icon: HelpCircle, type: 'faq' },
  { key: 'help-customer', label: 'Customer Help FAQs', icon: HelpCircle, type: 'faq' },
]

export default function AdminContentPage() {
  const { actionItems, signOut } = useAdminActions()
  const [activeKey, setActiveKey] = useState('privacy')
  const [content, setContent] = useState<string>('')
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [isSaving, setIsSaving] = useState(false)

  const activeSection = CONTENT_SECTIONS.find(s => s.key === activeKey)!

  // Load content using built-in useDataQuery hook
  const { data: contentData, isLoading } = useDataQuery<{ key: string; content: any }>({
    apiEndPoint: `${API_BASE}/api/content/${activeKey}`,
    noFilter: true,
  })

  // When data loads or key changes, update state
  useEffect(() => {
    if (!isLoading && contentData) {
      if (activeSection.type === 'richtext') {
        setContent(typeof contentData.content === 'string' ? contentData.content : '')
      } else {
        setFaqs(Array.isArray(contentData.content) ? contentData.content : [])
      }
    } else if (!isLoading && !contentData) {
      if (activeSection.type === 'richtext') setContent('')
      else setFaqs([])
    }
  }, [contentData, isLoading, activeKey])

  // Save using built-in useCreate hook
  const saveMutation = useCreate<any, any>(
    `${API_BASE}/api/content/${activeKey}`,
    {
      onSuccess: () => {
        toast.success('Content saved successfully')
        setIsSaving(false)
      },
      onError: () => {
        toast.error('Failed to save content')
        setIsSaving(false)
      },
    }
  )

  const handleSave = () => {
    setIsSaving(true)
    const body = activeSection.type === 'richtext'
      ? { content }
      : { content: faqs }
    // useCreate sends POST by default — but our endpoint is PUT
    // Use fetch with token for PUT since useCreate doesn't support PUT method easily
    const token = getAccessToken()
    fetch(`${API_BASE}/api/content/${activeKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }).then(res => {
      if (!res.ok) throw new Error()
      toast.success('Content saved successfully')
    }).catch(() => {
      toast.error('Failed to save content')
    }).finally(() => setIsSaving(false))
  }

  const addFaq = () => {
    setFaqs([...faqs, { question: '', answer: '' }])
  }

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs(faqs.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index))
  }

  // Import current hardcoded content into the editor
  const handleImportCurrent = () => {
    if (activeSection.type === 'faq') {
      const defaultFaqs = activeKey === 'help-driver' ? driverFaqs : customerFaqs
      setFaqs(defaultFaqs.map(f => ({ question: f.question, answer: f.answer })))
      toast.success('Loaded current FAQs from code')
    } else {
      // Use pre-built HTML strings — no runtime rendering needed
      const html = activeKey === 'privacy' ? PRIVACY_HTML : TERMS_HTML
      setContent(html)
      toast.success('Loaded current content')
    }
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />

      <main className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin-config" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <h1 className="text-2xl font-black">Content Editor</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleImportCurrent} disabled={isSaving || isLoading} variant="outline" className="rounded-xl font-bold gap-2 text-xs">
              <Download className="w-3.5 h-3.5" /> Import Current Content
            </Button>
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
                    <p className="text-xs text-slate-500 mt-1">Edit the content below. Changes go live immediately after saving. Click "Import Current Content" to start from the existing page.</p>
                  </div>
                  {content ? (
                    <RichTextEditor content={content} onChange={setContent} />
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                      <p className="text-sm text-slate-500 mb-3">No content saved yet.</p>
                      <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleImportCurrent}>
                        <Download className="w-3.5 h-3.5" /> Import Current Content
                      </Button>
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
                      <p className="text-xs text-slate-500 mt-1">Add, edit, or remove FAQ items. Click "Import Current Content" to load existing FAQs.</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={addFaq}>
                      <Plus className="w-3.5 h-3.5" /> Add FAQ
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {faqs.length === 0 && (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        No FAQs yet. Click "Import Current Content" to load existing FAQs, or "Add FAQ" to create one.
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
                          <Input
                            value={faq.question}
                            onChange={(e) => updateFaq(index, 'question', e.target.value)}
                            placeholder="Enter the question..."
                            className="h-9 text-sm rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Answer</Label>
                          <textarea
                            value={faq.answer}
                            onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                            placeholder="Enter the answer..."
                            rows={3}
                            className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                          />
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
