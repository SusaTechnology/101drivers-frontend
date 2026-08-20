//@ts-nocheck
/**
 * IndividualVerifyEmailPage — separate page for entering the OTP code.
 *
 * SERVER-SIDE STORAGE: this page sends ONLY {email, verificationToken}
 * to the backend. The backend reads the password hash and contact info
 * from the User row created in step 1 — no sensitive data in the
 * browser's sessionStorage.
 *
 * The sessionStorage stores ONLY the email (not the password or payload).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { ArrowRight, Mail, RefreshCw, Loader2, CheckCircle, Clock } from 'lucide-react';
import { useDataMutation } from '@/lib/tanstack/dataQuery';
import { cn } from '@/lib/utils';

const INDIVIDUAL_PENDING_PAYLOAD_KEY = 'individualPendingPayload';

// Step 2 payload — ONLY email + OTP. No password, no contact info.
// The backend reads everything else from the stored User row.
interface VerifyOtpPayload {
  email: string;
  verificationToken: string;
}

export default function IndividualVerifyEmailPage() {
  const [otpValue, setOtpValue] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [email, setEmail] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const navigate = useNavigate();

  // Check for OTP in URL (email link resume)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlOtp = urlParams.get('otp');

    if (urlOtp) {
      setOtpValue(urlOtp);
      if (urlOtp.length === 6) {
        setIsComplete(true);
      }
    }
  }, []);

  // Load pending email from sessionStorage.
  // Only the email is stored — NOT the password or contact info.
  // The backend has the User row from step 1 and reads everything from there.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(INDIVIDUAL_PENDING_PAYLOAD_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // The stored data may be the full payload (legacy) or just {email}
        const email = data.email || data.contactEmail;
        if (email) {
          setEmail(email);
        } else {
          toast.error('No pending registration found', {
            description: 'Please start a new registration.',
          });
          navigate({ to: '/auth/individual-signup' });
        }
      } else {
        toast.error('No pending registration found', {
          description: 'Please start a new registration.',
        });
        navigate({ to: '/auth/individual-signup' });
      }
    } catch {
      navigate({ to: '/auth/individual-signup' });
    }
  }, [navigate]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Mutation for resending code — calls the resend endpoint which sends
  // a new OTP to the email. The User row already exists from step 1.
  const resendCodeMutation = useDataMutation<
    { message: string; email: string },
    { email: string }
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private/resend-otp`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Code resent successfully', {
        description: 'Check your email for the new verification code.',
      });
      setCountdown(60);
    },
    onError: (error) => {
      toast.error('Failed to resend code', {
        description: error.message || 'Please try again later.',
      });
    },
    fetchWithoutRefresh: true,
    publicEndpoint: true,
  });

  // Mutation for verifying OTP and completing registration.
  // Sends ONLY {email, verificationToken} — no password, no payload.
  // The backend reads the User data from the stored row (created in step 1).
  //
  // After verification, the account is PENDING admin approval (same as
  // business customers). The user sees a success page — NOT auto-login.
  // They can log in only after the admin approves their account.
  const verifyOtpMutation = useDataMutation<
    any,
    VerifyOtpPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Sign-up submitted successfully!', {
        description: 'Your account is pending admin approval.',
      });
      sessionStorage.removeItem(INDIVIDUAL_PENDING_PAYLOAD_KEY);
      // Show the success page (pending approval) — same as business signup.
      // Do NOT auto-login. The user must wait for admin approval.
      setRegistrationComplete(true);
    },
    onError: (error) => {
      const errorMessage = error.message || 'Invalid code or server error.';
      if (errorMessage.toLowerCase().includes('already')) {
        toast.error('Email already registered', {
          description: 'This email is already associated with an account. Please sign in instead.',
          action: {
            label: 'Log In',
            onClick: () => { window.location.href = '/auth/dealer-signin'; },
          },
          duration: 8000,
        });
      } else {
        toast.error('Verification failed', {
          description: errorMessage,
        });
      }
    },
    fetchWithoutRefresh: true,
    publicEndpoint: true,
  });

  const handleOtpChange = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '');
    setOtpValue(digits);
    setIsComplete(digits.length === 6);
  }, []);

  const handleResend = () => {
    if (!email || countdown > 0) return;
    resendCodeMutation.mutate({ email });
  };

  const handleVerify = () => {
    if (!otpValue || otpValue.length !== 6 || !email) return;
    const payload: VerifyOtpPayload = {
      email,
      verificationToken: otpValue,
    };
    verifyOtpMutation.mutate(payload);
  };

  const isPending = resendCodeMutation.isPending || verifyOtpMutation.isPending;

  // ── Success page (pending admin approval) ────────────────────────────
  // Same as the dealer signup success page — the user sees this after
  // verifying their email. They cannot log in until the admin approves.
  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[480px] mx-auto px-6 h-16 flex items-center">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md text-center space-y-6">
            {/* Success icon */}
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-green-400/30 animate-pulse" />
            </div>

            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              Sign-up Submitted!
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md">
              Thank you. Our team has received your sign-up request. We will
              review your details and contact you within 1-2 business days to
              schedule an onboarding call.
            </p>

            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                Under Review
              </span>
            </div>

            {/* What happens next */}
            <div className="text-left space-y-3 pt-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-primary" />
                What Happens Next?
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">1</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Sign-up Review</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Our team will carefully review your submitted information.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-purple-600 dark:text-purple-400">2</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Onboarding Call</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We will contact you directly to schedule a call and walk you through the platform.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-green-600 dark:text-green-400">3</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Account Activation</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Once approved, you can log in and start requesting deliveries.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Back to home */}
            <div className="pt-4">
              <Link
                to="/home"
                className="inline-flex items-center gap-2 text-sm font-bold text-lime-600 dark:text-lime-400 hover:text-lime-700 dark:hover:text-lime-300 transition"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── OTP entry page ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header with logo */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[480px] mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="flex items-center" aria-label="101 Drivers">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Title section */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center">
              <Mail className="w-8 h-8 text-lime-600 dark:text-lime-400" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Enter Verification Code
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter the 6-digit code sent to your email.
              {email && (
                <span className="block mt-1 font-semibold text-slate-700 dark:text-slate-300">
                  {email}
                </span>
              )}
            </p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP
              value={otpValue}
              onChange={handleOtpChange}
              maxLength={6}
              disabled={isPending}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Resend code */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCodeMutation.isPending || countdown > 0}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-lime-600 dark:text-lime-400 hover:text-lime-700 dark:hover:text-lime-300 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition"
            >
              {resendCodeMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                <>Resend Code ({countdown}s)</>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Resend Code
                </>
              )}
            </button>
          </div>

          {/* Continue button */}
          <Button
            onClick={handleVerify}
            disabled={!isComplete || verifyOtpMutation.isPending}
            className={cn(
              'w-full py-6 rounded-2xl transition flex items-center justify-center gap-2 text-lg font-extrabold',
              isComplete
                ? 'bg-lime-500 hover:bg-lime-600 text-slate-950 hover:shadow-xl hover:shadow-lime-500/20'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
            )}
          >
            {verifyOtpMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-1 h-5 w-5" />
              </>
            )}
          </Button>

          {/* Back to signup link */}
          <div className="text-center">
            <Link
              to="/auth/individual-signup"
              className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-lime-600 dark:hover:text-lime-400 transition"
            >
              ← Back to registration
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
