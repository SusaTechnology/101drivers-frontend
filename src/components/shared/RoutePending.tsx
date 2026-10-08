// Full-screen loading fallback shown while a lazy route chunk downloads
// (typically the first visit to a page on a phone).
//
// This is the fix for "I tap something and nothing happens, then suddenly
// it navigates": navigating to a not-yet-loaded page now ALWAYS shows
// visible progress instead of a frozen old screen. Route files wrap their
// (now React.lazy) page component in <Suspense fallback={<RoutePending />}>.
export default function RoutePending({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-500" />
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
