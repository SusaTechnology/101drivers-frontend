// app/pages/driver/repositioning.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Verified,
  MapPin,
  DollarSign,
  Mail,
  MessageSquare as Sms,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Check,
  X,
  Save,
  ArrowRight as ArrowForward,
  ToggleLeft,
  ToggleRight,
  Building as LocationCity,
  BadgeDollarSign as Paid,
  Bolt,
  SlidersHorizontal as Tune,
  PauseCircle,
  Home,
  Car,
  Inbox,
  Menu as MenuIcon,
  Clock,
  Calendar,
  CalendarDays,
  Timer,
  Hourglass,
  Radius,
  Route,
  Navigation,
  Compass,
  Gauge,
  Fuel,
  Map,
  MapPin as MapPinIcon,
  MapPinned,
  MapPlus,
  MapMinus,
  LandPlot,
  Mountain,
  Trees,
  Building,
  Building2,
  Store,
  Warehouse,
  Factory,
  TrainTrack,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MoreVertical,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Zone data
const HOT_ZONES = [
  {
    id: 'la-west',
    name: 'Los Angeles (West)',
    description: 'High demand • next 3 hours',
    icon: LocationCity,
    bonus: '+$20 bonus',
    radius: '10mi',
    buttonVariant: 'primary',
  },
  {
    id: 'sd-north',
    name: 'San Diego (North)',
    description: 'Medium demand • next 4 hours',
    icon: MapPin,
    bonus: 'Priority offers',
    radius: '12mi',
    buttonVariant: 'outline',
  },
]

// Window options
const windowOptions = [
  { value: '1', label: 'Next 1 hour' },
  { value: '2', label: 'Next 2 hours' },
  { value: '3', label: 'Next 3 hours' },
  { value: 'custom', label: 'Custom (policy)' },
]

// Radius options
const radiusOptions = [
  { value: '5', label: '5 miles' },
  { value: '10', label: '10 miles' },
  { value: '12', label: '12 miles' },
  { value: '15', label: '15 miles' },
]

// Offer options
const offerOptions = [
  { value: 'email-first', label: 'In-app + Email-first' },
  { value: 'inapp-only', label: 'In-app only' },
  { value: 'sms', label: 'In-app + SMS (if enabled)' },
]

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: MenuIcon },
]

export default function DriverRepositioningPage() {
  const [mounted, setMounted] = useState(false)
  const [selectedZone, setSelectedZone] = useState('Los Angeles (West)')
  const [availabilityWindow, setAvailabilityWindow] = useState('2')
  const [radius, setRadius] = useState('10')
  const [offerMethod, setOfferMethod] = useState('email-first')
  const [emailFirst, setEmailFirst] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

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
    navigate({ to: '/driver-signin' })
  }

  const handleZoneOptIn = (zoneName: string) => {
    setSelectedZone(zoneName)
    setIsActive(true)
    setShowToast(true)
    toast.success(`Opted in to ${zoneName}`, {
      description: 'You are now repositioning to this zone.',
    })
  }

  const handleActivate = () => {
    setIsActive(true)
    setShowToast(true)
    toast.success('Repositioning activated', {
      description: `You're now available in ${selectedZone}.`,
    })
  }

  const handleStop = () => {
    setIsActive(false)
    setShowToast(false)
    toast.info('Repositioning stopped', {
      description: 'You are no longer repositioning.',
    })
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-menu"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Driver
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Repositioning
              </div>
            </div>
          </div>

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
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* Intro */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-primary/15 rounded-full blur-3xl"></div>
          
          <CardContent className="relative z-10 p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
                  <Verified className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Optional MVP • Policy-Controlled
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-4">
                  Move closer to demand
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Repositioning is a <span className="font-extrabold">non-delivery</span> action to help coverage in high-demand areas.
                  If you opt in, you may receive priority job offers or bonuses (depends on Admin policy).
                </p>

                <div className="mt-4 flex gap-2 flex-wrap">
                  <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-primary mr-1" />
                    Hot zones
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <DollarSign className="w-3.5 h-3.5 text-primary mr-1" />
                    Bonus (optional)
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Mail className="w-3.5 h-3.5 text-primary mr-1" />
                    Email-first updates
                  </Badge>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your status</div>
                <div className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  {isActive ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Active in {selectedZone}</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Not repositioning</span>
                    </>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 max-w-[260px]">
                  When active, you'll appear as "available in zone" during the selected window.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggested zones */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Suggested hot zones</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Admin-configured zones based on demand. Choose one to opt in.
                </p>
              </div>
              <Link
                to="/driver-preferences"
                className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
              >
                Preferences
                <Tune className="w-4 h-4 text-primary" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HOT_ZONES.map((zone) => (
                <div
                  key={zone.id}
                  className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover-lift"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">{zone.name}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{zone.description}</p>
                    </div>
                    <zone.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="outline" className="chip bg-primary/10 border-primary/25 text-slate-800 dark:text-slate-200">
                      <DollarSign className="w-3.5 h-3.5 text-primary mr-1" />
                      {zone.bonus}
                    </Badge>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Radius {zone.radius}
                    </span>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => handleZoneOptIn(zone.name)}
                      className={cn(
                        "w-full py-4 rounded-2xl transition inline-flex items-center justify-center gap-2",
                        zone.buttonVariant === 'primary'
                          ? "lime-btn hover:shadow-xl hover:shadow-primary/20"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                      )}
                    >
                      Opt in to this zone
                      <ArrowForward className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
              <Info className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                Zone availability
              </AlertTitle>
              <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                Zone suggestions are driven by Admin scheduling policy and operating hours, and are logged when you opt in/out.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Opt-in controls */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Opt-in settings</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Confirm your window, radius, and notification preference. Admin policy may override some options.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Selected zone
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="h-12 w-full pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Availability window
                </Label>
                <Select
                  value={availabilityWindow}
                  onValueChange={setAvailabilityWindow}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                    <SelectValue placeholder="Select window" />
                  </SelectTrigger>
                  <SelectContent>
                    {windowOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Radius
                </Label>
                <Select
                  value={radius}
                  onValueChange={setRadius}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                    <SelectValue placeholder="Select radius" />
                  </SelectTrigger>
                  <SelectContent>
                    {radiusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  How you'll get offers
                </Label>
                <Select
                  value={offerMethod}
                  onValueChange={setOfferMethod}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {offerOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">Email-first updates</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">Default notification mode</div>
                  </div>
                </div>
                <Checkbox
                  checked={emailFirst}
                  onCheckedChange={(checked) => setEmailFirst(checked as boolean)}
                  className="h-5 w-5"
                />
              </Label>

              <Label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                <div className="flex items-center gap-3">
                  <Sms className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">SMS alerts</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">Optional if policy allows</div>
                  </div>
                </div>
                <Checkbox
                  checked={smsAlerts}
                  onCheckedChange={(checked) => setSmsAlerts(checked as boolean)}
                  className="h-5 w-5"
                />
              </Label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleActivate}
                className="flex-1 py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
              >
                Activate repositioning
                <ArrowForward className="w-4 h-4" />
              </Button>

              <Button
                onClick={handleStop}
                variant="outline"
                className="flex-1 py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
              >
                <PauseCircle className="w-4 h-4 text-primary" />
                Stop repositioning
              </Button>
            </div>

            {/* Status Toast */}
            {showToast && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Repositioning activated
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        You're now available in <span className="font-extrabold">{selectedZone}</span>. Offers will appear in your inbox.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/driver-inbox"
                    className="text-sm font-extrabold text-primary hover:opacity-90 transition inline-flex items-center gap-1 shrink-0"
                  >
                    Inbox
                    <ArrowForward className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              The system may prioritize you for nearby jobs during your window and apply bonuses based on Admin pricing/payment policy.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                <div className="w-10 h-10 mx-auto rounded-2xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {item.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}