import { Link } from "@tanstack/react-router";
import { Home, LifeBuoy, MapPin } from "lucide-react";
import { SEOHead } from "./SEOHead";
import { SiteFooter } from "./SiteFooter";

/**
 * NotFoundScreen — branded 404 for any URL that doesn't match a route.
 *
 * Rendered by TanStack Router as the root route's notFoundComponent (and
 * as the router's defaultNotFoundComponent, covering loaders that call
 * notFound()). This is an SPA: unknown paths resolve to index.html
 * server-side, so the not-found experience is handled client-side here.
 *
 * Design mirrors the public pages (same page background, pill badges,
 * lime-on-slate palette, rounded-3xl card, dark mode, SiteFooter) with a
 * delivery-flavored touch: a dashed route that dead-ends at a pin.
 */
export function NotFoundScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      <SEOHead
        title="Page not found | 101 Drivers"
        description="The page you are looking for doesn't exist or may have been moved."
      />

      {/* Minimal top bar — logo only, matching the public header height */}
      <header className="w-full">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center px-6 lg:px-8">
          <Link to="/" aria-label="101 Drivers — back to home">
            <img
              src="/assets/101drivers-logo.jpg"
              alt="101 Drivers"
              className="h-12 w-12 rounded-2xl border border-slate-200 object-cover shadow-md shadow-black/10 lg:h-14 lg:w-14 dark:border-slate-800"
            />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10 lg:px-8">
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-xl shadow-slate-200/60 sm:px-12 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            {/* Soft lime glow behind the content */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(163,230,53,0.14),transparent_60%)]" />

            <div className="relative">
              {/* Dashed route that dead-ends at a pin — delivery flavor */}
              <div
                className="mx-auto mb-8 flex w-full max-w-[220px] items-center"
                aria-hidden="true"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-lime-500" />
                <span className="h-0 flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-700" />
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="h-0 flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-700" />
                <MapPin
                  className="h-5 w-5 shrink-0 text-lime-600 dark:text-lime-400"
                  strokeWidth={2.5}
                />
              </div>

              <p className="bg-gradient-to-r from-lime-500 via-green-500 to-emerald-500 bg-clip-text text-7xl font-black leading-none tracking-tight text-transparent sm:text-8xl">
                404
              </p>

              <h1 className="mt-5 text-2xl font-black text-slate-900 sm:text-3xl dark:text-white">
                This stop doesn&rsquo;t exist
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                The page you&rsquo;re looking for was moved, removed, or never
                picked up. Let&rsquo;s get you back on the route.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-lime-500/20 transition-colors hover:bg-lime-600"
                >
                  <Home className="h-4 w-4" />
                  Back to Home
                </Link>
                <a
                  href="mailto:support@101drivers.com"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-700 transition-colors hover:border-lime-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Contact Support
                </a>
              </div>

              <p className="mt-8 text-xs text-slate-500 dark:text-slate-400">
                Service is available in California only.
              </p>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
