// @ts-nocheck
import React, { useEffect, useState } from 'react'

interface PostTripCompletionProps {
  /** The payout amount shown to the driver for this trip */
  payout: number
  /** ISO timestamp of when the driver picked up / started the trip */
  tripStartTime: string | null | undefined
  /** Called after the 2.5s display window to continue navigation */
  onDismiss: () => void
}

/**
 * Full-screen overlay shown for ~2.5s after a driver completes a trip.
 * Displays: logo, glowing payout + duration, motivational text, then auto-advances.
 */
export default function PostTripCompletion({
  payout,
  tripStartTime,
  onDismiss,
}: PostTripCompletionProps) {
  // Calculate duration in whole minutes (picked-up → now)
  const durationMinutes = (() => {
    if (!tripStartTime) return null
    const start = new Date(tripStartTime).getTime()
    const end = Date.now()
    const diffMs = Math.max(0, end - start)
    return Math.round(diffMs / 60000) // whole minutes
  })()

  // Fade-in on mount, auto-dismiss after 2.5s
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    // Trigger entrance animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      onDismiss()
    }, 2500)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [onDismiss])

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center
        bg-white dark:bg-slate-950
        transition-opacity duration-500 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {/* ── Logo (top-left, exact brand asset) ── */}
      <div className="absolute top-6 left-6">
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
          <img
            src="/assets/101drivers-logo.jpg"
            alt="101 Drivers"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* ── Main content: payout + duration ── */}
      <div className="flex flex-col items-center text-center px-6">
        {/* Large glowing neon-green text */}
        <div
          className="text-5xl sm:text-6xl font-black leading-tight select-none"
          style={{
            color: 'hsl(var(--brand-lime))',
            // Neon glow effect using text-shadow with the brand lime color (#A3E635)
            textShadow:
              '0 0 10px hsl(var(--brand-lime) / 0.6), 0 0 30px hsl(var(--brand-lime) / 0.35), 0 0 60px hsl(var(--brand-lime) / 0.15)',
          }}
        >
          ${payout.toFixed(2)}
          {durationMinutes !== null && (
            <span className="ml-3">{durationMinutes} min</span>
          )}
        </div>

        {/* "Well done!" */}
        <p className="mt-6 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          Well done!
        </p>

        {/* "Keep up the good work" */}
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
          Keep up the good work
        </p>
      </div>
    </div>
  )
}
