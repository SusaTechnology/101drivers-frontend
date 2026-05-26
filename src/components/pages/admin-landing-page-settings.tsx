// Admin Landing Page Settings
import React, { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Save,
  Menu,
  X,
  Upload,
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  Building,
  Users,
  CreditCard,
  Settings,
  Info,
  CheckCircle,
  AlertCircle,
  Trash2,
  Eye,
  Mail,
  Phone,
  Clock,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDataQuery, useDataMutation, useFileUpload } from '@/lib/tanstack/dataQuery'
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { navItems } from '@/lib/items/navItems'

// Types
interface LandingPageSettings {
  fundraisingEnabled: boolean
  dealerLeadEnabled: boolean
  investorLeadEnabled: boolean
  investorDeckTitle: string | null
  investorDeckUrl: string | null
  investorDeckFilename: string | null
  investorDeckUploadedAt: string | null
  dealerLeadCtaTitle: string | null
  dealerLeadCtaDescription: string | null
  investorLeadCtaTitle: string | null
  investorLeadCtaDescription: string | null
}

interface DealerLeadDto {
  id: string
  businessName: string
  email: string
  phone: string | null
  message: string | null
  createdAt: string
  updatedAt: string
}

interface InvestorLeadDto {
  id: string
  name: string
  email: string
  message: string | null
  createdAt: string
  updatedAt: string
}

interface UploadResponse {
  ok: boolean
  url: string
  filename: string
  mimeType: string
  size: number
}

export default function AdminLandingPageSettings() {
  const { actionItems, signOut } = useAdminActions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formData, setFormData] = useState<LandingPageSettings>({
    fundraisingEnabled: false,
    dealerLeadEnabled: false,
    investorLeadEnabled: false,
    investorDeckTitle: null,
    investorDeckUrl: null,
    investorDeckFilename: null,
    investorDeckUploadedAt: null,
    dealerLeadCtaTitle: null,
    dealerLeadCtaDescription: null,
    investorLeadCtaTitle: null,
    investorLeadCtaDescription: null,
  })

  // Fetch current settings
  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<LandingPageSettings>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/appSettings/landing-page`,
    noFilter: true,
  })

  // Update settings mutation
  const updateSettings = useDataMutation({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/appSettings/landing-page`,
    method: 'PATCH',
    onSuccess: (data: LandingPageSettings) => {
      setFormData(data)
      toast.success('Settings saved successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save settings')
    },
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/appSettings/landing-page`]],
  })

  // File upload mutation
  const uploadFile = useFileUpload<UploadResponse>(
    `${import.meta.env.VITE_API_URL}/api/uploads/app-setting-file`,
    {
      onSuccess: (data) => {
        if (data.ok) {
          // Update form with uploaded file info
          setFormData(prev => ({
            ...prev,
            investorDeckUrl: data.url,
            investorDeckFilename: data.filename,
          }))
          toast.success('File uploaded successfully. Click "Save Changes" to persist.')
        }
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to upload file')
      },
    }
  )

  // Fetch dealer leads
  const {
    data: dealerLeads,
    isLoading: dealerLeadsLoading,
    refetch: refetchDealerLeads,
  } = useDataQuery<DealerLeadDto[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/dealerLeads/admin`,
    noFilter: true,
  })

  // Fetch investor leads
  const {
    data: investorLeads,
    isLoading: investorLeadsLoading,
    refetch: refetchInvestorLeads,
  } = useDataQuery<InvestorLeadDto[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/investorLeads/admin`,
    noFilter: true,
  })

  // Sync form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed for investor deck')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setIsUploading(true)
    const formDataObj = new FormData()
    formDataObj.append('file', file)
    formDataObj.append('scope', 'investor-deck')
    formDataObj.append('kind', 'PDF')
    formDataObj.append('filenameHint', 'investor-deck')

    try {
      await uploadFile.mutateAsync(formDataObj)
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle save
  const handleSave = () => {
    updateSettings.mutate(formData)
  }

  // Handle toggle change
  const handleToggle = (key: keyof LandingPageSettings, value: boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  // Handle text change
  const handleTextChange = (key: keyof LandingPageSettings, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value || null }))
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load settings</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
          <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950">Retry</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 h-fit sticky top-28">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Admin
                </div>
                <Badge variant="outline" className="chip-gray">
                  <Settings className="w-3.5 h-3.5 text-primary mr-1" />
                  CONFIG
                </Badge>
              </div>

              <nav className="mt-4 space-y-1.5">
                <Link
                  to="/admin-config"
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="w-5 h-5 text-primary" />
                  Back to Config Hub
                </Link>
              </nav>

              <div className="mt-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    Landing page settings control what visitors see on the public homepage. Changes are applied immediately after saving.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-9 space-y-6">
            {/* Page header */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 dark:text-white border border-primary/25 w-fit">
                      <Settings className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        App Settings
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Landing Page Settings
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Configure visibility toggles, CTA text, and manage the investor pitch deck for the public landing page.
                    </CardDescription>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={updateSettings.isPending}
                    className="xl:w-auto bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Visibility Toggles */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">Visibility Controls</CardTitle>
                <CardDescription>Toggle which sections appear on the public landing page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dealer Lead Toggle */}
                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-lime-500/15 flex items-center justify-center">
                      <Building className="w-5 h-5 text-lime-500" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">Dealer Lead Section</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Show dealership onboarding form and CTA on landing page
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={formData.dealerLeadEnabled}
                    onCheckedChange={(checked) => handleToggle('dealerLeadEnabled', checked)}
                  />
                </div>

                {/* Fundraising Toggle */}
                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-lime-500/15 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-lime-500" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">Fundraising Section</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Enable investor/sponsor/donor interest collection
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={formData.fundraisingEnabled}
                    onCheckedChange={(checked) => handleToggle('fundraisingEnabled', checked)}
                  />
                </div>

                {/* Investor Lead Toggle */}
                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-lime-500/15 flex items-center justify-center">
                      <Users className="w-5 h-5 text-lime-500" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">Investor Lead Form</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Show investor lead form within fundraising section
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={formData.investorLeadEnabled}
                    onCheckedChange={(checked) => handleToggle('investorLeadEnabled', checked)}
                    disabled={!formData.fundraisingEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Investor Deck */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">Investor Pitch Deck</CardTitle>
                <CardDescription>Upload and manage the investor pitch deck PDF for download.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Deck Title */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Deck Title</Label>
                  <Input
                    value={formData.investorDeckTitle || ''}
                    onChange={(e) => handleTextChange('investorDeckTitle', e.target.value)}
                    placeholder="e.g., 101 Drivers Investor Deck"
                    className="h-12 rounded-2xl"
                  />
                </div>

                {/* Current Deck */}
                {formData.investorDeckUrl && (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {formData.investorDeckFilename || 'Current Deck'}
                          </div>
                          {formData.investorDeckUploadedAt && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Uploaded: {formatDate(formData.investorDeckUploadedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-full"
                          onClick={() => window.open(formData.investorDeckUrl!, '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-full"
                          onClick={() => {
                            const link = document.createElement('a')
                            link.href = formData.investorDeckUrl!
                            link.download = formData.investorDeckFilename || 'investor-deck.pdf'
                            link.click()
                          }}
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload New Deck */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Upload New Deck</Label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="gap-2 rounded-full"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Choose PDF File
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Max 10MB • PDF only
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                      After uploading, click "Save Changes" to persist the new deck URL. The deck will be available for download on the landing page.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA Configuration */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">CTA Configuration</CardTitle>
                <CardDescription>Customize call-to-action text for each lead section.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Dealer Lead CTA */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-lime-500" />
                    <span className="font-extrabold text-slate-900 dark:text-white">Dealer Lead CTA</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">CTA Title</Label>
                      <Input
                        value={formData.dealerLeadCtaTitle || ''}
                        onChange={(e) => handleTextChange('dealerLeadCtaTitle', e.target.value)}
                        placeholder="e.g., Onboard My Dealership"
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">CTA Description</Label>
                      <Input
                        value={formData.dealerLeadCtaDescription || ''}
                        onChange={(e) => handleTextChange('dealerLeadCtaDescription', e.target.value)}
                        placeholder="e.g., Request a call and get your dealership onboarded."
                        className="h-12 rounded-2xl"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Investor Lead CTA */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-lime-500" />
                    <span className="font-extrabold text-slate-900 dark:text-white">Investor Lead CTA</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">CTA Title</Label>
                      <Input
                        value={formData.investorLeadCtaTitle || ''}
                        onChange={(e) => handleTextChange('investorLeadCtaTitle', e.target.value)}
                        placeholder="e.g., Request Investor Deck"
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">CTA Description</Label>
                      <Input
                        value={formData.investorLeadCtaDescription || ''}
                        onChange={(e) => handleTextChange('investorLeadCtaDescription', e.target.value)}
                        placeholder="e.g., Support, sponsor, donate, or request the investor deck."
                        className="h-12 rounded-2xl"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview Section */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-black">Preview Summary</CardTitle>
                <CardDescription>Quick overview of current landing page configuration.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                    <Building className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Dealer Lead</div>
                    <Badge variant={formData.dealerLeadEnabled ? "default" : "secondary"} className="text-xs">
                      {formData.dealerLeadEnabled ? 'Visible' : 'Hidden'}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                    <CreditCard className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Fundraising</div>
                    <Badge variant={formData.fundraisingEnabled ? "default" : "secondary"} className="text-xs">
                      {formData.fundraisingEnabled ? 'Visible' : 'Hidden'}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                    <Users className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Investor Form</div>
                    <Badge variant={formData.investorLeadEnabled ? "default" : "secondary"} className="text-xs">
                      {formData.investorLeadEnabled ? 'Visible' : 'Hidden'}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                    <FileText className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Deck</div>
                    <Badge variant={formData.investorDeckUrl ? "default" : "secondary"} className="text-xs">
                      {formData.investorDeckUrl ? 'Uploaded' : 'No Deck'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Link
                    to="/"
                    target="_blank"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-extrabold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Preview Landing Page
                  </Link>
                  <Button
                    onClick={handleSave}
                    disabled={updateSettings.isPending}
                    className="bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Dealer Leads Section */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                      <Building className="w-5 h-5 text-lime-500" />
                      Dealer Leads
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Dealership onboarding requests submitted via the landing page.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchDealerLeads()}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dealerLeadsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500 mx-auto"></div>
                    <p className="mt-3 text-sm text-slate-500">Loading dealer leads...</p>
                  </div>
                ) : dealerLeads && dealerLeads.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Business</th>
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Contact</th>
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Message</th>
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dealerLeads.map((lead) => (
                          <tr key={lead.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-4 px-4">
                              <div className="font-extrabold text-slate-900 dark:text-white">{lead.businessName}</div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col gap-1">
                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-sm text-lime-600 dark:text-lime-400 hover:underline">
                                  <Mail className="w-3.5 h-3.5" />
                                  {lead.email}
                                </a>
                                {lead.phone && (
                                  <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-sm text-slate-500">
                                    <Phone className="w-3.5 h-3.5" />
                                    {lead.phone}
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                {lead.message || '—'}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDate(lead.createdAt)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                    <Building className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="mt-3 text-sm text-slate-500">No dealer leads yet</p>
                    <p className="text-xs text-slate-400 mt-1">Leads will appear here when submitted via the landing page</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Investor Leads Section */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                      <Users className="w-5 h-5 text-lime-500" />
                      Investor Leads
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Investor/sponsor interest submissions from the fundraising section.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchInvestorLeads()}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {investorLeadsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500 mx-auto"></div>
                    <p className="mt-3 text-sm text-slate-500">Loading investor leads...</p>
                  </div>
                ) : investorLeads && investorLeads.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Name</th>
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Email</th>
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Message</th>
                          <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-slate-500">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investorLeads.map((lead) => (
                          <tr key={lead.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-4 px-4">
                              <div className="font-extrabold text-slate-900 dark:text-white">{lead.name}</div>
                            </td>
                            <td className="py-4 px-4">
                              <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-sm text-lime-600 dark:text-lime-400 hover:underline">
                                <Mail className="w-3.5 h-3.5" />
                                {lead.email}
                              </a>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                {lead.message || '—'}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDate(lead.createdAt)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                    <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="mt-3 text-sm text-slate-500">No investor leads yet</p>
                    <p className="text-xs text-slate-400 mt-1">Leads will appear here when submitted via the landing page</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Admin • Landing Page Settings
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © {new Date().getFullYear()} 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
