import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/landing',
      replace: true,
    })
  },
})

function IndexPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased">
      {/* Simple homepage that matches your styling */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-black text-slate-900 dark:text-white">101 Drivers</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="/landing"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Landing
            </a>
            <a
              href="/auth/dealer-signin"
              className="text-sm font-semibold text-primary hover:opacity-90 transition-colors"
            >
              Dealer Sign In
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome to
            <span className="block text-primary mt-2">101 Drivers</span>
          </h1>
          
          <p className="mt-8 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            California's premier vehicle delivery service for dealers
          </p>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/landing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-black bg-primary text-slate-950 hover:opacity-95 transition"
            >
              Get Started
            </a>
            <a
              href="/auth/dealer-signin"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-black border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Dealer Sign In
            </a>
          </div>

          {/* Feature Cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover-lift">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Fast Delivery</h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Quick and reliable vehicle transport across California
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover-lift">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Secure & Insured</h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Fully insured operations with real-time tracking
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover-lift">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Dealer Focused</h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Tools and dashboard designed specifically for automotive dealers
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-16 p-8 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              Ready to streamline your deliveries?
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Join hundreds of California dealers already using 101 Drivers
            </p>
            <div className="mt-8 flex gap-4 justify-center">
              <a
                href="/auth/dealer-signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-black bg-primary text-slate-950 hover:opacity-95 transition"
              >
                Create Dealer Account
              </a>
              <a
                href="/landing"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-black border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                California-only operations • Email-first notifications
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}