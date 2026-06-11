// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react'

interface PostTripCompletionProps {
  /** The payout amount shown to the driver for this trip */
  payout: number
  /** ISO timestamp of when the driver picked up / started the trip */
  tripStartTime: string | null | undefined
  /** Called after the display window to continue navigation */
  onDismiss: () => void
}

/**
 * Full-screen overlay shown after a driver completes a trip.
 * Clean, minimal design inspired by Uber/Lyft driver earnings screens.
 * Celebratory but professional — white card, rich green earnings, subtle gold confetti.
 *
 * Uses a ref for onDismiss to prevent timer resets from parent re-renders.
 * Driver can also tap the backdrop or the "Continue" button to dismiss manually.
 */
export default function PostTripCompletion({
  payout,
  tripStartTime,
  onDismiss,
}: PostTripCompletionProps) {
  const [visible, setVisible] = useState(false)
  const dismissedRef = useRef(false)

  // Store onDismiss in a ref so the timer doesn't reset when parent re-renders
  // (e.g. GPS watchPosition updates, query refetches, etc.)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      if (!dismissedRef.current) {
        dismissedRef.current = true
        onDismissRef.current()
      }
    }, 3000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, []) // empty deps — runs once, timer never resets

  const handleDismiss = () => {
    if (!dismissedRef.current) {
      dismissedRef.current = true
      onDismissRef.current()
    }
  }

  // Format the completed timestamp
  const formattedTimestamp = (() => {
    const now = new Date()
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return `Completed \u2022 Today, ${timeStr}`
  })()

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-6
        transition-opacity duration-600 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.25)' }}
      onClick={handleDismiss}
    >
      {/* ── Subtle gold confetti (top-right) ── */}
      <div className="fixed top-0 right-0 w-48 h-48 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-60">
          <circle cx="160" cy="24" r="4" fill="#D4A843" />
          <circle cx="130" cy="18" r="3" fill="#E8C95A" />
          <circle cx="180" cy="50" r="3.5" fill="#D4A843" />
          <circle cx="145" cy="55" r="2.5" fill="#F5D76E" />
          <circle cx="190" cy="80" r="3" fill="#E8C95A" />
          <circle cx="110" cy="35" r="2" fill="#D4A843" />
          <rect x="168" y="36" width="5" height="5" rx="1" fill="#F5D76E" transform="rotate(15 170 38)" />
          <rect x="140" y="70" width="4" height="4" rx="1" fill="#D4A843" transform="rotate(-20 142 72)" />
          <rect x="185" y="65" width="4" height="4" rx="1" fill="#E8C95A" transform="rotate(40 187 67)" />
        </svg>
      </div>

      {/* ── Main Card ── */}
      <div
        className={`
          relative w-full max-w-sm rounded-3xl overflow-hidden
          shadow-xl shadow-black/10
          transition-all duration-600 ease-out
          ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
        `}
        onClick={(e) => e.stopPropagation()} // prevent backdrop click from firing when clicking card
      >
        {/* White card body */}
        <div className="relative bg-white dark:bg-slate-900 px-8 pt-12 pb-10">
          {/* ── Checkmark circle ── */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 11.5L9 15.5L17 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* ── Earnings (focal point) ── */}
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">
              You earned
            </p>
            <p
              className="text-5xl font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tight"
              style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
            >
              ${payout.toFixed(2)}
            </p>
          </div>

          {/* ── Messages ── */}
          <div className="text-center mt-8">
            <p className="text-xl font-black text-slate-900 dark:text-white">
              Well done!
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Thanks for your delivery.
            </p>
          </div>

          {/* ── Timestamp ── */}
          <p className="text-center mt-6 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {formattedTimestamp}
          </p>

          {/* ── Continue Button (manual dismiss) ── */}
          <button
            onClick={handleDismiss}
            className="mt-6 w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-bold transition active:scale-[0.98]"
          >
            Continue
          </button>
        </div>

        {/* Subtle green gradient at bottom of card */}
        <div
          className="h-2 w-full"
          style={{
            background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)',
          }}
        />
      </div>
    </div>
  )
}
