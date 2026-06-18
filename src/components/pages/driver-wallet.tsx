import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Verified,
  Mail,
  Clock as Schedule,
  Info,
  AlertCircle,
  CheckCircle,
  Check,
  ArrowRight as ArrowForward,
  Receipt as ReceiptLong,
  Car,
  Inbox,
  ShieldCheck,
  ExternalLink,
  Loader2,
  Star,
  User,
  Copy,
  Gift,
  Users,
  Share2,
  Zap,
  Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useDataQuery,
  useDataMutation,
  getUser,
} from '@/lib/tanstack/dataQuery'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Simplified payout type options
const payoutTypeOptions = [
  { value: 'ach', label: 'Bank transfer (ACH)' },
  { value: 'checking', label: 'Checking account' },
  { value: 'savings', label: 'Savings account' },
]

export default function DriverWalletPage() {
  const [mounted, setMounted] = useState(false)
  const [payoutType, setPayoutType] = useState('ach')
  const [accountHolder, setAccountHolder] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const API_URL = import.meta.env.VITE_API_URL

  // ── Driver Profile ─────────────────────────────────────────
  const { data: driverProfile } = useDataQuery<any>({
    apiEndPoint: `${API_URL}/api/referrals/driver-profile`,
    noFilter: true,
  })

  // ── Referral Code & Stats ──────────────────────────────────
  const { data: referralCodeData } = useDataQuery<any>({
    apiEndPoint: `${API_URL}/api/referrals/my-referral-code`,
    noFilter: true,
  })

  const { data: referralStats } = useDataQuery<any>({
    apiEndPoint: `${API_URL}/api/referrals/my-stats`,
    noFilter: true,
  })

  const referralCode = referralCodeData?.referralCode || ''

  // ── Referral History ───────────────────────────────────────
  const { data: referralHistory } = useDataQuery<any>({
    apiEndPoint: `${API_URL}/api/referrals/my-referrals`,
    noFilter: true,
  })

  const referrals = referralHistory?.referrals || []

  // ── Fetch real earnings data ───────────────────────────────
  const { data: earningsData, refetch: refetchEarnings } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/driverPayouts/my-earnings`,
    noFilter: true,
  })

  // Use real data when available, fall back to zeros
  const wallet = earningsData
    ? {
        availableBalance: earningsData.availableBalance || 0,
        pending: earningsData.pendingAmount || 0,
        thisWeek: earningsData.weeklyEarnings || 0,
        ytd: earningsData.yearlyEarnings || 0,
        monthlyEarnings: earningsData.monthlyEarnings || 0,
        totalEarnings: earningsData.totalEarnings || 0,
        totalTips: earningsData.totalTips || 0,
        payouts: (earningsData.payouts || []).map((p: any) => ({
          date: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          amount: p.netAmount,
          method: 'ACH',
          deliveryId: p.delivery?.id,
          pickup: p.delivery?.pickupAddress,
          dropoff: p.delivery?.dropoffAddress,
          status: {
            label: p.status === 'PAID' ? 'Paid' : p.status === 'ELIGIBLE' ? 'Available' : p.status === 'PENDING' ? 'Processing' : p.status,
            color: p.status === 'PAID' ? 'primary' : p.status === 'ELIGIBLE' ? 'green' : p.status === 'PENDING' ? 'slate' : 'amber',
            icon: p.status === 'PAID' ? CheckCircle : p.status === 'ELIGIBLE' ? CheckCircle : p.status === 'PENDING' ? Schedule : AlertCircle,
          },
        })),
      }
    : {
        availableBalance: 0,
        pending: 0,
        thisWeek: 0,
        ytd: 0,
        monthlyEarnings: 0,
        totalEarnings: 0,
        totalTips: 0,
        payouts: [],
      }

  // ── Fetch saved bank account ──────────────────────────────
  const { data: bankAccountData } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/driverPayouts/my-bank-account`,
    noFilter: true,
  })
  useEffect(() => {
    if (bankAccountData) {
      setAccountHolder(bankAccountData?.accountHolderName || '')
      setRoutingNumber(bankAccountData?.routingNumber || '')
      setAccountNumber(bankAccountData?.accountNumber || '')
      if (bankAccountData?.accountType) setPayoutType(bankAccountData?.accountType === 'checking' ? 'checking' : bankAccountData?.accountType === 'savings' ? 'savings' : 'ach')
    }
  }, [bankAccountData])

  // Save bank account
  const saveBankAccountMutation = useDataMutation<any, any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/driverPayouts/my-bank-account`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Payout method saved', {
        description: 'Your bank account information has been updated securely.',
      })
    },
    onError: (error) => {
      toast.error('Failed to save', { description: error?.message })
    },
  })

  // ── Stripe Connect onboarding ──────────────────────────────
  const { data: connectStatus, refetch: refetchConnectStatus } = useDataQuery<{
    setupComplete: boolean;
    needsOnboarding: boolean;
  }>({
    apiEndPoint: `${API_URL}/api/payments/stripe/connect/status/${user?.profileId}`,
    enabled: !!user?.profileId,
    noFilter: true,
    staleTime: 30 * 1000,
  })

  const connectOnboardingMutation = useDataMutation<{ url: string }, { driverId: string }>({
    apiEndPoint: `${API_URL}/api/payments/stripe/connect/onboarding`,
    method: 'POST',
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank')
      }
    },
    onError: (error: any) => {
      toast.error('Failed to start payout setup', { description: error?.message })
    },
  })

  const freeWithdrawalMutation = useDataMutation<any, void>({
    apiEndPoint: `${API_URL}/api/driverPayouts/request-withdrawal`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Withdrawal requested!', {
        description: 'Your funds will arrive in 1-2 business days.',
      })
      refetchEarnings()
    },
    onError: (error: any) => {
      toast.error('Withdrawal failed', { description: error?.message })
    },
  })

  const instantPayoutMutation = useDataMutation<any, void>({
    apiEndPoint: `${API_URL}/api/driverPayouts/request-instant-payout`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Instant payout sent!', {
        description: 'Your funds will arrive in minutes. $1.50 fee deducted.',
      })
      refetchEarnings()
    },
    onError: (error: any) => {
      toast.error('Instant payout failed', { description: error?.message })
    },
  })

  // ── Theme handling ─────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle return from Stripe Connect onboarding
  const search = useSearch({ strict: false }) as Record<string, string>
  useEffect(() => {
    if (search?.stripe === 'complete') {
      refetchConnectStatus()
      toast.success('Stripe account linked!', {
        description: 'Your payout setup is complete. Earnings will transfer automatically after deliveries.',
      })
    }
  }, [search])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/driver-signin' })
  }

  const handleFreeWithdrawal = () => {
    if (wallet.availableBalance < 50) {
      toast.error('Insufficient balance', {
        description: `You need at least $50.00 to withdraw. Current balance: $${wallet.availableBalance.toFixed(2)}`,
      })
      return
    }
    freeWithdrawalMutation.mutate()
  }

  const handleInstantPayout = () => {
    if (wallet.availableBalance < 5) {
      toast.error('Insufficient balance', {
        description: `You need at least $5.00 for an instant payout. Current balance: $${wallet.availableBalance.toFixed(2)}`,
      })
      return
    }
    const fee = 1.5
    const net = wallet.availableBalance - fee
    toast.info(`Instant payout: $${wallet.availableBalance.toFixed(2)} - $${fee.toFixed(2)} fee = $${net.toFixed(2)} to your bank`, {
      duration: 4000,
    })
    instantPayoutMutation.mutate()
  }

  const handleSavePayoutMethod = () => {
    if (!accountHolder || !routingNumber || !accountNumber) {
      toast.error('Please fill in all fields', {
        description: 'Account holder name, routing number, and account number are required.',
      })
      return
    }
    saveBankAccountMutation.mutate({
      accountHolderName: accountHolder,
      routingNumber,
      accountNumber,
      accountType: payoutType,
    })
  }

  // ── Referral share handler ────────────────────────────────
  const handleShareReferral = async () => {
    const shareUrl = `${window.location.origin}/driver-signin?ref=${referralCode}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join as a Driver',
          text: `Sign up as a driver using my referral link and we both earn rewards!`,
          url: shareUrl,
        })
      } catch {
        // User cancelled share — do nothing
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Referral link copied!', {
        description: 'Share it with friends to earn $50 per referral.',
      })
    }
  }

  // ── Status badge component ─────────────────────────────────
  const StatusBadge = ({
    status,
    color = 'slate',
    icon: Icon,
    className,
  }: {
    status: string;
    color?: string;
    icon?: any;
    className?: string;
  }) => {
    const colors: Record<string, string> = {
      primary: 'bg-primary/10 border-primary/25 text-primary-foreground',
      slate: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
      amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
      emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
      green: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
    }

    const StatusIcon = Icon || CheckCircle

    return (
      <Badge
        variant="outline"
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border',
          colors[color] || colors.slate,
          className,
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    )
  }

  // ── Referral status helper ─────────────────────────────────
  const getReferralStatusBadge = (ref: any) => {
    switch (ref.status) {
      case 'REGISTERED':
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border"
          >
            Signed up
          </Badge>
        )
      case 'TRIPPING':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border"
          >
            On trip {ref.tripsCompleted || 0} of {ref.tripsRequired || 5}
          </Badge>
        )
      case 'COMPLETED':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Completed
          </Badge>
        )
      case 'REWARD_PAID':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border"
          >
            <Gift className="w-3.5 h-3.5" />
            ${ref.rewardAmount || 50} earned
          </Badge>
        )
      default:
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border"
          >
            {ref.status}
          </Badge>
        )
    }
  }

  // ── Initials from name ─────────────────────────────────────
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver/menu"
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
                Wallet
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
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
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* ═══════════════════════════════════════════════════════
            1. Driver Profile Header
        ═══════════════════════════════════════════════════════ */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col items-center text-center gap-4">
              {/* Avatar */}
              {driverProfile?.profilePhotoUrl ? (
                <img
                  src={driverProfile.profilePhotoUrl}
                  alt={driverProfile.fullName || 'Driver'}
                  className="w-20 h-20 rounded-full object-cover border-4 border-primary/20 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center shadow-lg">
                  {driverProfile?.fullName ? (
                    <span className="text-2xl font-black text-primary">
                      {getInitials(driverProfile.fullName)}
                    </span>
                  ) : (
                    <User className="w-9 h-9 text-primary" />
                  )}
                </div>
              )}

              {/* Name */}
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {driverProfile?.fullName || 'Driver'}
                </h2>
                {driverProfile?.email && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {driverProfile.email}
                  </p>
                )}
              </div>

              {/* Rating & Trips badges */}
              <div className="flex items-center gap-3 flex-wrap justify-center">
                {driverProfile?.avgRating != null && (
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                      {Number(driverProfile.avgRating).toFixed(1)}
                    </span>
                    {driverProfile.totalRatings != null && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">
                        ({driverProfile.totalRatings})
                      </span>
                    )}
                  </div>
                )}
                {driverProfile?.completedTrips != null && (
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <Car className="w-4 h-4 text-primary" />
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {driverProfile.completedTrips} trips
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            2. Refer a Friend Section
        ═══════════════════════════════════════════════════════ */}
        <Card className="border-emerald-200 dark:border-emerald-800/40 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <CardHeader className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black">Refer a Friend & Earn $50</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    When your friend completes their first 5 trips
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            {/* Referral code display */}
            {referralCode && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Your referral code
                  </p>
                  <p className="text-lg font-black text-slate-900 dark:text-white tracking-wider">
                    {referralCode}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-2xl border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 font-extrabold transition inline-flex items-center gap-2"
                  onClick={handleShareReferral}
                >
                  {navigator.share ? (
                    <>
                      <Share2 className="w-4 h-4" />
                      Share
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/20">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Total earned
                </p>
                <p className="mt-2 text-lg font-black text-emerald-700 dark:text-emerald-300">
                  ${((referralStats?.totalEarned || 0) + (referralStats?.pendingReward || 0)).toFixed(2)}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/20">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Active referrals
                </p>
                <p className="mt-2 text-lg font-black text-emerald-700 dark:text-emerald-300">
                  {referralStats?.activeReferrals || 0}
                </p>
              </div>
            </div>

            {/* Primary share button */}
            <Button
              onClick={handleShareReferral}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl hover:shadow-emerald-600/20 transition inline-flex items-center justify-center gap-2 font-extrabold"
            >
              <Gift className="w-4 h-4" />
              Refer a Friend & Earn $50
              <ArrowForward className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            3. Referral History
        ═══════════════════════════════════════════════════════ */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black">Referral History</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Track who you&apos;ve referred and their progress
                  </CardDescription>
                </div>
              </div>
              {referrals.length > 0 && (
                <Badge
                  variant="outline"
                  className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 chip"
                >
                  {referrals.length} referral{referrals.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {referrals.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  No referrals yet. Share your code to start earning!
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-800">
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Name
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Status
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                        Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {referrals.map((ref: any) => (
                      <TableRow key={ref.id} className="hover:bg-primary/5 transition">
                        <TableCell className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            </div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                              {ref.referredDriver?.user?.fullName || ref.referredEmail || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 pr-4">
                          {getReferralStatusBadge(ref)}
                        </TableCell>
                        <TableCell className="py-4 pr-0 text-right text-sm text-slate-500 dark:text-slate-400">
                          {ref.createdAt
                            ? new Date(ref.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            4. Earnings / Balance
        ═══════════════════════════════════════════════════════ */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-primary/15 rounded-full blur-3xl"></div>
          <CardContent className="relative z-10 p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
                  <Verified className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Earnings • CA MVP
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-4">
                  Available balance
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Earnings from completed deliveries. Payout timing depends on Admin payment policy.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-4xl font-black text-primary">
                  ${wallet.availableBalance.toFixed(2)}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Ready for payout
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pending</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  ${wallet.pending.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Awaiting completion</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">This week</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  ${wallet.thisWeek.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Completed jobs</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">YTD</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  ${wallet.ytd.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Total earnings</p>
              </div>
            </div>

            <div className="relative z-10 mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleFreeWithdrawal}
                disabled={wallet.availableBalance < 50 || freeWithdrawalMutation.isPending}
                className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {freeWithdrawalMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Banknote className="w-4 h-4 mr-2" />
                )}
                Withdraw Free
                <span className="ml-2 text-[10px] font-medium opacity-75">1-2 business days</span>
              </Button>

              <Button
                onClick={handleInstantPayout}
                disabled={wallet.availableBalance < 5 || instantPayoutMutation.isPending}
                className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {instantPayoutMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Cash Out Instantly
                <span className="ml-2 text-[10px] font-medium opacity-75">$1.50 fee</span>
              </Button>
            </div>

            {wallet.availableBalance > 0 && wallet.availableBalance < 50 && (
              <div className="relative z-10 mt-3 flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Free withdrawal requires a minimum balance of $50.00. You can use <span className="font-bold">Cash Out Instantly</span> for any amount over $5.00.
                </p>
              </div>
            )}

            <div className="relative z-10 mt-4 flex items-center gap-2">
              <Link
                to="#payouts"
                className="py-3 px-5 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center gap-2 text-sm"
              >
                View payout history
                <ReceiptLong className="w-4 h-4 text-primary" />
              </Link>
            </div>

            <div className="relative z-10 mt-5 flex gap-2 flex-wrap">
              <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                <Mail className="w-3.5 h-3.5 text-primary mr-1" />
                Email-first updates
              </Badge>
              <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                <Schedule className="w-3.5 h-3.5 text-primary mr-1" />
                Policy-controlled timing
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            5. Payout Method
        ═══════════════════════════════════════════════════════ */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Payout method</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Add your preferred payout destination. This is verified and stored securely.
                </CardDescription>
              </div>
              <Badge variant="outline" className={cn(
                'chip',
                bankAccountData
                  ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
              )}>
                <Info className="w-3.5 h-3.5 mr-1" />
                {bankAccountData ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Payout Type
                </Label>
                <Select
                  value={payoutType}
                  onValueChange={setPayoutType}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {payoutTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Account holder name
                </Label>
                <Input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Your full name"
                  className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Routing number
                </Label>
                <Input
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  placeholder="•••••••••"
                  className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Account number
                </Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                />
              </div>
            </div>

            <Button
              onClick={handleSavePayoutMethod}
              className="w-full py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
            >
              Save payout method
              <Check className="w-4 h-4" />
            </Button>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              For security, banking details are tokenized and verified before use.
            </p>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            6. Stripe Connect — Fast Payouts
        ═══════════════════════════════════════════════════════ */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Fast payouts</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Connect your Stripe account for instant payouts after each delivery.
                </CardDescription>
              </div>
              {connectStatus?.setupComplete ? (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200 chip">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 chip">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Not connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {connectStatus?.setupComplete ? (
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <p className="font-bold text-emerald-700 dark:text-emerald-300">Payouts are active</p>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Your earnings are automatically transferred to your connected account after each delivery.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-amber-500" />
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Set up Stripe Connect to receive payouts
                    </p>
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    You&apos;ll be redirected to Stripe to verify your identity and link your bank account. This only takes a few minutes.
                  </p>
                </div>
                <Button
                  onClick={() => user?.profileId && connectOnboardingMutation.mutate({ driverId: user.profileId })}
                  disabled={connectOnboardingMutation.isPending || !user?.profileId}
                  className="w-full py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                >
                  {connectOnboardingMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {connectOnboardingMutation.isPending ? 'Loading...' : 'Set up payouts with Stripe'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            7. Payout History
        ═══════════════════════════════════════════════════════ */}
        <Card id="payouts" className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg font-black">Payout history</CardTitle>
            <CardDescription className="text-sm mt-1">
              Recent payouts and status.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 sm:p-7">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Date
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Amount
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Method
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {wallet.payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        No payouts yet. Complete deliveries to start earning.
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallet.payouts.map((item, index) => (
                      <TableRow key={index} className="hover:bg-primary/5 transition">
                        <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                          {item.date}
                        </TableCell>
                        <TableCell className="py-4 pr-4 font-extrabold text-slate-900 dark:text-white">
                          ${item.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                          {item.method}
                        </TableCell>
                        <TableCell className="py-4 pr-0">
                          <StatusBadge
                            status={item.status.label}
                            color={item.status.color}
                            icon={item.status.icon}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="mt-5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Payouts are linked to payment events, refunds/chargebacks, and dispute outcomes.
            </p>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            8. Help / Policy
        ═══════════════════════════════════════════════════════ */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
              <Info className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                Important
              </AlertTitle>
              <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                Payout timing and holds depend on Admin payment policy, dispute status, and compliance proof completion.
              </AlertDescription>
            </Alert>

            {/* <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link
                to="/driver-inbox"
                className="flex-1 py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
              >
                Go to inbox
                <Inbox className="w-4 h-4 text-primary" />
              </Link>
              <Link
                to="/driver/menu"
                className="flex-1 py-4 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition inline-flex items-center justify-center gap-2"
              >
                Back to menu
                <ArrowForward className="w-4 h-4" />
              </Link>
            </div> */}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}