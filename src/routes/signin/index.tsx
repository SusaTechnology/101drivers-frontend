import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Store, 
  MapPin, 
  MailCheck, 
  Lock, 
  Info, 
  Menu, 
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'


// Create card component if not installed
export function CustomCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-3xl border bg-card p-6 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
}

const signInSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
  rememberMe: z.boolean().optional(),
})

type SignInFormData = z.infer<typeof signInSchema>

export function DealerSignIn() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      rememberMe: false,
    },
  })

  const onSubmit = async (data: SignInFormData) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Sign in data:', data)
    // Navigate to dashboard in real app
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200 dark:border-slate-800">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Link
                to="/landing"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Landing
              </Link>
              <Link
                to="/about"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                About
              </Link>
              <Link
                to="/privacy"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Terms
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              asChild
            >
              <Link to="/landing#quote">
                <ArrowLeft className="w-4 h-4" />
                Back to Quote
              </Link>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top">
            <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
              <Link
                to="/landing"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Landing
              </Link>
              <Link
                to="/about"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/privacy"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Terms
              </Link>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <Button
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-primary text-primary-foreground hover:opacity-95 transition"
                  asChild
                >
                  <Link to="/landing#quote" onClick={() => setMobileMenuOpen(false)}>
                    Back to Quote
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Intro Section */}
          <div className="lg:col-span-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Store className="text-primary w-6 h-6 font-bold" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white">Dealer Sign In</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg leading-relaxed max-w-xl">
                  Manage deliveries, track status, and review compliance proofs.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-slate-800 dark:text-slate-200 text-xs font-extrabold">
                    <MapPin className="text-primary w-4 h-4" />
                    California-only operations
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold">
                    <MailCheck className="text-primary w-4 h-4" />
                    Email-first notifications
                  </div>
                </div>
              </div>
            </div>

            <CustomCard className="mt-10 bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">What you can do as a Dealer</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                  Create delivery requests for customers or inventory moves
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                  Track status updates and receive email notifications (SMS optional if enabled)
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5 shrink-0" />
                  Review VIN last-4 verification, photos, odometer start/end, and trip report proofs
                </li>
              </ul>
            </CustomCard>
          </div>

          {/* Right: Sign-in Form */}
          <div className="lg:col-span-6">
            <CustomCard className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 sm:p-10 hover-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">DLR</p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">Welcome back</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Sign in to access your dealer dashboard.
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <Lock className="text-primary w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">Secure</span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Business Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="dealer@business.com"
                    className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 input-focus-ring text-sm"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rememberMe"
                      className="rounded border-slate-300 text-primary focus:ring-primary/20"
                      {...register('rememberMe')}
                    />
                    <Label
                      htmlFor="rememberMe"
                      className="text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Remember me
                    </Label>
                  </div>

                  <Button
                    variant="link"
                    className="text-sm font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                    asChild
                  >
                    <Link to="/forgot-password">Forgot password?</Link>
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2 h-14 text-base"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                  <ArrowRight className="w-5 h-5 font-bold" />
                </Button>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Don't have an account?{' '}
                    <Button
                      variant="link"
                      className="font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                      asChild
                    >
                      <Link to="/auth/dealer-signup">Create dealer account</Link>
                    </Button>
                  </p>

                  <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Notifications are <span className="font-bold">email-first</span>. SMS is optional and depends on Admin policy (PRD).
                  </p>
                </div>
              </form>
            </CustomCard>

            <CustomCard className="mt-6 p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <Info className="text-primary w-5 h-5 shrink-0" />
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Prototype screen only. Authentication will be implemented in the production app.
                </p>
              </div>
            </CustomCard>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold border-slate-200 dark:border-slate-800 h-12"
                asChild
              >
                <Link to="/">
                  <ArrowLeft className="w-5 h-5 text-primary" />
                  Back to Index
                </Link>
              </Button>
              <Button
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition h-12"
                asChild
              >
                <Link to="/landing">
                  Go to Landing
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
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
            <p className="text-xs text-slate-500 font-medium">© 2024 101 Drivers Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}