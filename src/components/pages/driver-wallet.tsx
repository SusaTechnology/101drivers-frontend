// app/pages/driver/wallet.tsx
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
  Mail,
  Clock as Schedule,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Check,
  X,
  Save,
  ArrowRight as ArrowForward,
  DollarSign,
  CreditCard,
  Banknote,
  Landmark,
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Receipt,
  ReceiptText,
  Receipt as ReceiptLong,
  History,
  Clock,
  Calendar,
  CalendarDays,
  Timer,
  Hourglass,
  Plus,
  Minus,
  Home,
  Car,
  Inbox,
  Menu as MenuIcon,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Verified as VerifiedIcon,
  AlertTriangle,
  HelpCircle,
  Phone,
  Mail as MailIcon,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useDataQuery,
  useDataMutation,
} from '@/lib/tanstack/dataQuery'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Wallet data
const MOCK_WALLET = {
  availableBalance: 1245.50,
  pending: 320.00,
  thisWeek: 610.00,
  ytd: 8420.00,

  payoutMethods: [
    { value: 'ach', label: 'Bank transfer (ACH)' },
    { value: 'debit', label: 'Debit card (Instant)' },
    { value: 'check', label: 'Check (Mail)' },
  ],

  earningsBreakdown: [
    { label: 'Base delivery payout', amount: 180.00, highlight: false },
    { label: 'Distance payout', amount: 64.00, highlight: false },
    { label: 'Bonus (urgent / SLA)', amount: 25.00, highlight: true },
    { total: true, label: 'Driver total', amount: 269.00 },
  ],

  payoutHistory: [
    {
      date: 'Jan 29, 2026',
      amount: 420.00,
      method: 'ACH',
      status: { label: 'Paid', color: 'primary', icon: CheckCircle },
    },
    {
      date: 'Jan 20, 2026',
      amount: 310.50,
      method: 'ACH',
      status: { label: 'Processing', color: 'slate', icon: Schedule },
    },
    {
      date: 'Jan 12, 2026',
      amount: 198.00,
      method: 'ACH',
      status: { label: 'On hold', color: 'amber', icon: AlertCircle },
    },
  ],
}

// Payout type options
const payoutTypeOptions = [
  { value: 'ach', label: 'Bank transfer (ACH)' },
  { value: 'debit', label: 'Debit card (Instant)' },
  { value: 'check', label: 'Check (Mail)' },
]

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: MenuIcon },
]

export default function DriverWalletPage() {
  const [mounted, setMounted] = useState(false)
  const [payoutType, setPayoutType] = useState('ach')
  const [accountHolder, setAccountHolder] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  // Fetch saved bank account
  const bankAccountQuery = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/driverPayouts/my-bank-account`,
    noFilter: true,
    onSuccess: (data) => {
      if (data) {
        setAccountHolder(data.accountHolderName || '')
        setRoutingNumber(data.routingNumber || '')
        setAccountNumber(data.accountNumber || '')
        if (data.accountType) setPayoutType(data.accountType === 'debit' ? 'debit' : data.accountType === 'check' ? 'check' : 'ach')
      }
    },
  })

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
      toast.error('Failed to save', { description: error.message })
    },
  })

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

  const handleRequestPayout = () => {
    toast.success('Payout requested', {
      description: `$${MOCK_WALLET.availableBalance.toFixed(2)} will be sent to your account.`,
    })
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

  const handleVerify = () => {
    toast.info('Verification initiated', {
      description: 'We\'ve sent test deposits to verify your account.',
    })
  }

  const handleViewPayoutDetails = (index: number) => {
    toast.info(`Viewing payout details`, {
      description: `Payout from ${MOCK_WALLET.payoutHistory[index].date}`,
    })
  }

  // Status badge component
  const StatusBadge = ({ 
    status, 
    color = 'slate', 
    icon: Icon,
    className 
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
    }

    const StatusIcon = Icon || CheckCircle

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border",
          colors[color] || colors.slate,
          className
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    )
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
                Wallet
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
        {/* Balance */}
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
                  ${MOCK_WALLET.availableBalance.toFixed(2)}
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
                  ${MOCK_WALLET.pending.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Awaiting completion</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">This week</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  ${MOCK_WALLET.thisWeek.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Completed jobs</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">YTD</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  ${MOCK_WALLET.ytd.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Total earnings</p>
              </div>
            </div>

            <div className="relative z-10 mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleRequestPayout}
                className="flex-1 py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
              >
                Request payout
                <ArrowForward className="w-4 h-4" />
              </Button>

              <Link
                to="#payouts"
                className="flex-1 py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
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

        {/* Payout method */}
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
                "chip",
                bankAccountQuery.data
                  ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200"
                  : "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
              )}>
                <Info className="w-3.5 h-3.5 mr-1" />
                {bankAccountQuery.data ? 'Connected' : 'Not connected'}
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
                    {payoutTypeOptions.map(option => (
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

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleSavePayoutMethod}
                className="flex-1 py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
              >
                Save payout method
                <Check className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleVerify}
                variant="outline"
                className="flex-1 py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
              >
                Verify
                <ShieldCheck className="w-4 h-4 text-primary" />
              </Button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              For security, banking details are tokenized and verified before use.
            </p>
          </CardContent>
        </Card>

        {/* Earnings breakdown */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Earnings breakdown</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Summary of how earnings are computed (pricing + fees). Values are illustrative.
                </CardDescription>
              </div>
              <Link
                to="/driver-job-details/"
                className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
              >
                View job example
                <ArrowForward className="w-4 h-4 text-primary" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_WALLET.earningsBreakdown.map((item, index) => {
                if (item.total) {
                  return (
                    <div key={index} className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {item.label}
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          ${item.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      {item.label}
                    </span>
                    <span className={cn(
                      "text-sm font-black",
                      item.highlight ? "text-primary" : "text-slate-900 dark:text-white"
                    )}>
                      ${item.amount.toFixed(2)}
                    </span>
                  </div>
                )
              })}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Notes: pricing rules and payout formulas are controlled by Admin (pricing + payment policy).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payout history */}
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
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {MOCK_WALLET.payoutHistory.map((item, index) => (
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
                      <TableCell className="py-4 pr-4">
                        <StatusBadge 
                          status={item.status.label} 
                          color={item.status.color}
                          icon={item.status.icon}
                        />
                      </TableCell>
                      <TableCell className="py-4 pr-0 text-right">
                        <Button
                          onClick={() => handleViewPayoutDetails(index)}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-extrabold transition",
                            item.status.color === 'amber'
                              ? "bg-amber-600 text-white hover:opacity-90"
                              : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                          )}
                        >
                          {item.status.color === 'amber' ? 'Review' : 'View'}
                          <ArrowForward className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="mt-5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Payouts are linked to payment events, refunds/chargebacks, and dispute outcomes.
            </p>
          </CardContent>
        </Card>

        {/* Help / policy */}
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

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link
                to="/driver-inbox"
                className="flex-1 py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
              >
                Go to inbox
                <Inbox className="w-4 h-4 text-primary" />
              </Link>
              <Link
                to="/driver-menu"
                className="flex-1 py-4 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition inline-flex items-center justify-center gap-2"
              >
                Back to menu
                <ArrowForward className="w-4 h-4" />
              </Link>
            </div>
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