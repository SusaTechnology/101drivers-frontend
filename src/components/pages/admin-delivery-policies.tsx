// Admin → Config Hub → Delivery Policies
// ─────────────────────────────────────────────────────────────────────────────
// Global delivery policy settings, stored in the DELIVERY_SETTINGS AppSetting
// (single JSON row, read/written via /api/appSettings/delivery):
//
//   • Close/cancel penalty fee ($) — applied to the customer when a delivery
//     in BOOKED/ACTIVE status is closed/cancelled after a driver has already
//     committed (accepted the job / is on the way). The driver receives 100%
//     of this fee as a payout. The delivery close-penalty engine reads this
//     value live (fallback: $48) — no deploy needed to change it.
//   • Maximum delivery radius (miles) — max pickup↔drop-off distance the
//     driver job feed offers.
//   • Transit buffer (minutes) — scheduling buffer added to transit estimates.
//
// Note: these used to be editable on the (now-dead) admin-settings page —
// this page is their home now, reachable from the Config Hub.
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  MapPin,
  Save,
  Truck,
  Clock,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { navItems } from '@/lib/items/navItems'
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery'

const API_URL = import.meta.env.VITE_API_URL

interface DeliverySettings {
  maximumRadiusMiles: number
  transitBufferMinutes: number
  closePenaltyFeeDollars: number
}

export default function AdminDeliveryPoliciesPage() {
  const { actionItems, signOut } = useAdminActions()

  // Form state (strings so the inputs can be empty while editing)
  const [penaltyFee, setPenaltyFee] = useState('')
  const [maxRadius, setMaxRadius] = useState('')
  const [transitBuffer, setTransitBuffer] = useState('')
  const [dirty, setDirty] = useState(false)

  const settingsQuery = useDataQuery<DeliverySettings>({
    apiEndPoint: `${API_URL}/api/appSettings/delivery`,
    noFilter: true,
  })

  // Keep local fields in sync when the query refetches (e.g. after save).
  useEffect(() => {
    const d = settingsQuery.data
    if (!d) return
    setPenaltyFee(d.closePenaltyFeeDollars != null ? String(d.closePenaltyFeeDollars) : '48')
    setMaxRadius(d.maximumRadiusMiles != null ? String(d.maximumRadiusMiles) : '25')
    setTransitBuffer(d.transitBufferMinutes != null ? String(d.transitBufferMinutes) : '60')
    setDirty(false)
  }, [settingsQuery.data])

  const saveMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_URL}/api/appSettings/delivery`,
    method: 'PATCH',
    onSuccess: () => {
      toast.success('Delivery policies saved')
      settingsQuery.refetch()
    },
    onError: (error: Error) => {
      toast.error('Failed to save', { description: error.message })
    },
  })

  const handleSave = () => {
    const penalty = Number(penaltyFee)
    const radius = Number(maxRadius)
    const buffer = Number(transitBuffer)

    if (penaltyFee.trim() === '' || Number.isNaN(penalty) || penalty < 0) {
      toast.error('Invalid penalty fee', {
        description: 'The close/cancel penalty fee must be a number of 0 or more.',
      })
      return
    }
    if (Number.isNaN(radius) || radius < 1) {
      toast.error('Invalid radius', {
        description: 'Maximum delivery radius must be a positive number.',
      })
      return
    }
    if (Number.isNaN(buffer) || buffer < 1) {
      toast.error('Invalid buffer', {
        description: 'Transit buffer must be a positive number of minutes.',
      })
      return
    }

    // Round the fee to 2 decimals so the stored value is always clean dollars.
    saveMutation.mutate({
      closePenaltyFeeDollars: Math.round(penalty * 100) / 100,
      maximumRadiusMiles: radius,
      transitBufferMinutes: buffer,
    })
  }

  const markDirty = () => setDirty(true)
  const loading = settingsQuery.isLoading

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        {/* Page header */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <Link
              to="/admin-config"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-primary w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Config Hub
            </Link>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mt-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 w-fit">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Delivery Policies
                  </span>
                </div>
                <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                  Delivery Policies
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                  Global delivery behavior: the close/cancel penalty fee charged when a
                  driver has already committed to a job, plus job-feed radius and
                  scheduling buffer defaults.
                </CardDescription>
              </div>
              <Badge variant="outline" className="chip-gray w-fit">
                <Truck className="w-3.5 h-3.5 text-primary mr-1" />
                Applies platform-wide
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Close / cancel penalty */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              Close / Cancel Penalty Fee
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed mt-1">
              Charged to the customer when a delivery in <strong>BOOKED</strong> or{' '}
              <strong>ACTIVE</strong> status is closed/cancelled after a driver has
              committed (accepted the job, is on the way or at pickup). The driver
              receives <strong>100% of this fee</strong> as a payout. Deliveries closed
              while still <strong>LISTED</strong> (no driver accepted) are never
              penalized. Admin cancels always ask first — the fee is opt-in there.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <Label htmlFor="penalty-fee" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Penalty fee ($)
              </Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <Input
                  id="penalty-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={loading || saveMutation.isPending}
                  value={penaltyFee}
                  onChange={(e) => {
                    setPenaltyFee(e.target.value)
                    markDirty()
                  }}
                  className="pl-7"
                  placeholder="48"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Default $48. The delivery close-penalty engine reads this value live —
                new closings/cancellations use the saved amount immediately, no deploy
                needed. Set <strong>0</strong> to disable the penalty entirely.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Job feed + scheduling */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Job Feed &amp; Scheduling
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed mt-1">
              Defaults used by the driver job feed and the scheduling engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="max-radius" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Maximum delivery radius (miles)
              </Label>
              <Input
                id="max-radius"
                type="number"
                min="1"
                disabled={loading || saveMutation.isPending}
                value={maxRadius}
                onChange={(e) => {
                  setMaxRadius(e.target.value)
                  markDirty()
                }}
                className="mt-2"
                placeholder="25"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Max pickup↔drop-off distance offered to drivers.
              </p>
            </div>
            <div>
              <Label htmlFor="transit-buffer" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Transit buffer (minutes)
              </Label>
              <div className="relative mt-2">
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="transit-buffer"
                  type="number"
                  min="1"
                  disabled={loading || saveMutation.isPending}
                  value={transitBuffer}
                  onChange={(e) => {
                    setTransitBuffer(e.target.value)
                    markDirty()
                  }}
                  className="pr-9"
                  placeholder="60"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Buffer added to transit time estimates when scheduling.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3">
          {saveMutation.isPending && (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          )}
          <Button
            onClick={handleSave}
            disabled={loading || saveMutation.isPending || (!dirty && !settingsQuery.isLoading)}
            className="rounded-xl font-bold"
          >
            <Save className="w-4 h-4 mr-2" />
            Save changes
          </Button>
        </div>
      </main>
    </div>
  )
}
