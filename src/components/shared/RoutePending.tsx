// Full-screen loading fallback shown while a lazy route chunk downloads
// (typically the first visit to a page on a phone).
//
// This is the fix for "I tap something and nothing happens, then suddenly
// it navigates": navigating to a not-yet-loaded page now ALWAYS shows
// visible progress instead of a frozen old screen. Route files wrap their
// (now React.lazy) page component in <Suspense fallback={<RoutePending />}>.
//
// Visual: EXACTLY the same branded screen as the index.html boot shell
// (logo → loading circle → "Loading...") on the same background color.
// That way the PWA-open handoff (static shell → React) reads as ONE
// continuous loading screen instead of two different ones back-to-back.
export default function RoutePending({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      className="min-h-screen w-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <img
        src="/assets/101drivers-logo.jpg"
        alt="101 Drivers"
        className="w-[88px] h-[88px] object-cover rounded-[22px] shadow-[0_4px_16px_rgba(15,23,42,0.14)]"
      />
      <div
        aria-hidden="true"
        className="w-9 h-9 rounded-full border-4 border-lime-200 border-t-lime-600 dark:border-lime-900 dark:border-t-lime-400 animate-spin"
      />
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{label}</p>
    </div>
  )
}
