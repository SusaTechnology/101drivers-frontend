// app/pages/driver/dropoff-checklist.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  CheckCircle,
  Camera,
  Upload,
  X,
  Check,
  AlertCircle,
  Info,
  Sun,
  Moon,
  Menu,
  Home,
  Car,
  Inbox,
  Settings,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

// Mock delivery data
const MOCK_DELIVERY = {
  id: 'DLV-20418',
  route: 'San Jose → Los Angeles',
  destination: 'Los Angeles',
}

// Photo slots (5 total)
const PHOTO_SLOTS = 5

export default function DriverDropoffChecklistPage() {
  const [mounted, setMounted] = useState(false)
  const [odometerEnd, setOdometerEnd] = useState('')
  const [odometerPhotoAdded, setOdometerPhotoAdded] = useState(false)
  const [photos, setPhotos] = useState<boolean[]>(Array(PHOTO_SLOTS).fill(false))
  const [checkboxes, setCheckboxes] = useState({
    delivered: false,
    noDamage: false,
    acknowledged: false,
  })
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
//   const params = useParams({ from: '/driver/dropoff-checklist/$deliveryId' })

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/dealer-signin?userType=driver' })
  }

  const handleAddPhoto = (index: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev]
      newPhotos[index] = true
      return newPhotos
    })
    toast.success(`Photo ${index + 1} added`, {
      description: 'Drop-off photo captured successfully.',
    })
  }

  const handleAddOdometerPhoto = () => {
    setOdometerPhotoAdded(true)
    toast.success('Odometer photo added', {
      description: 'Odometer photo captured successfully.',
    })
  }

  const handleOdometerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOdometerEnd(e.target.value)
  }

  const handleCheckboxChange = (key: keyof typeof checkboxes) => {
    setCheckboxes(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleCompleteDelivery = () => {
    // Validate all required items
    const allPhotosAdded = photos.every(p => p)
    const odometerValid = odometerEnd.length > 0 && odometerPhotoAdded
    const allCheckboxesChecked = Object.values(checkboxes).every(v => v)

    if (!allPhotosAdded) {
      toast.error('Missing photos', {
        description: 'Please capture all required drop-off photos.',
      })
      return
    }

    if (!odometerValid) {
      toast.error('Odometer required', {
        description: 'Please enter the final odometer reading and add photo.',
      })
      return
    }

    if (!allCheckboxesChecked) {
      toast.error('Confirmations required', {
        description: 'Please confirm all handoff conditions.',
      })
      return
    }

    toast.success('Delivery completed!', {
      description: 'Thank you for completing this delivery.',
    })
    navigate({ to: '/driver-dashboard' })
  }

  const handleCancel = () => {
    toast.info('Checklist cancelled', {
      description: 'Returning to active delivery.',
    })
    navigate({ to: '/driver-active' })
  }

  // Check if all required items are complete
  const isComplete = photos.every(p => p) && 
                     odometerEnd.length > 0 && 
                     odometerPhotoAdded &&
                     Object.values(checkboxes).every(v => v)

  const completedCount = photos.filter(Boolean).length

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-active"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Drop-off Checklist
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {MOCK_DELIVERY.id} • {MOCK_DELIVERY.destination}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle - visible on all screens */}
            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-36 space-y-6">
        {/* Summary */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 w-fit">
                  <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Completion Required
                  </span>
                </div>

                <h1 className="mt-4 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Finalize delivery
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Capture final evidence before marking the delivery complete. Required by compliance policy.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Delivery
                </p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  {MOCK_DELIVERY.id}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {MOCK_DELIVERY.route}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Drop-off photos */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">1. Capture drop-off photos</CardTitle>
            <CardDescription className="text-sm mt-1">
              Required set: front, rear, left, right, and any new damage (if present).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {photos.map((isAdded, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-16 rounded-2xl border-2 border-dashed flex items-center justify-center p-0 hover:bg-primary/5 transition",
                    isAdded 
                      ? "border-primary bg-primary/10 hover:bg-primary/20" 
                      : "border-slate-200 dark:border-slate-700"
                  )}
                  onClick={() => handleAddPhoto(index)}
                >
                  {isAdded ? (
                    <Check className="w-5 h-5 text-primary" />
                  ) : (
                    <Camera className="w-5 h-5 text-primary" />
                  )}
                </Button>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
              {completedCount} of {PHOTO_SLOTS} photos captured
            </p>
          </CardContent>
        </Card>

        {/* Step 2: Odometer end */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">2. Record odometer end</CardTitle>
            <CardDescription className="text-sm mt-1">
              Enter final miles and capture odometer photo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Odometer End
                </Label>
                <Input
                  type="number"
                  value={odometerEnd}
                  onChange={handleOdometerChange}
                  className="mt-2 h-12 w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                  placeholder="e.g., 54362"
                  inputMode="numeric"
                />
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Odometer Photo
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "mt-2 h-12 w-full rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 font-extrabold hover:bg-primary/5 transition",
                    odometerPhotoAdded
                      ? "border-primary bg-primary/10 hover:bg-primary/20"
                      : "border-slate-200 dark:border-slate-700"
                  )}
                  onClick={handleAddOdometerPhoto}
                >
                  {odometerPhotoAdded ? (
                    <>
                      <Check className="w-4 h-4 text-primary" />
                      Added
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-primary" />
                      Add photo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Confirmation */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">3. Confirm handoff</CardTitle>
            <CardDescription className="text-sm mt-1">
              Confirm vehicle handoff to dealer/individual representative.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="delivered"
                  checked={checkboxes.delivered}
                  onCheckedChange={() => handleCheckboxChange('delivered')}
                />
                <Label
                  htmlFor="delivered"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Vehicle delivered to authorized recipient
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="noDamage"
                  checked={checkboxes.noDamage}
                  onCheckedChange={() => handleCheckboxChange('noDamage')}
                />
                <Label
                  htmlFor="noDamage"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  No new damage observed
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="acknowledged"
                  checked={checkboxes.acknowledged}
                  onCheckedChange={() => handleCheckboxChange('acknowledged')}
                />
                <Label
                  htmlFor="acknowledged"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Recipient acknowledged condition
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress indicator */}
        <div className="flex items-center justify-between px-2 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              completedCount === PHOTO_SLOTS ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
            )} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Photos {completedCount}/{PHOTO_SLOTS}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              odometerEnd && odometerPhotoAdded ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
            )} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Odometer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              Object.values(checkboxes).every(v => v) ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
            )} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Confirmations
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </Button>

          <Button
            onClick={handleCompleteDelivery}
            disabled={!isComplete}
            className={cn(
              "rounded-2xl py-4 font-extrabold flex items-center justify-center gap-2 transition",
              isComplete
                ? "lime-btn hover:shadow-xl hover:shadow-primary/20"
                : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
            )}
          >
            <CheckCircle className="w-5 h-5" />
            Complete Delivery
          </Button>
        </div>
      </nav>
    </div>
  )
}