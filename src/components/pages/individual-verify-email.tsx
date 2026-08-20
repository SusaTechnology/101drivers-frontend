//@ts-nocheck
/**
 * IndividualVerifyEmailPage — separate page for entering the OTP code.
 *
 * Mirrors the driver-verify-email page pattern:
 *   1. User fills the signup form → clicks "Send Verification Code"
 *   2. IndividualSignupForm saves the pending payload to sessionStorage
 *      and navigates here
 *   3. This page shows the OTP entry UI (InputOTP component)
 *   4. User enters the 6-digit code (or clicks the email link which
 *      auto-fills it via ?otp=XXXX URL param)
 *   5. On verify, the backend creates the User+Customer, issues tokens,
 *      and redirects to /dealer-dashboard
 *
 * Reuses: InputOTP, Button, toast, useDataMutation — same UI primitives
 * as the driver verify page for visual consistency.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { ArrowRight, Mail, RefreshCw, Loader2 } from 'lucide-react';
import { useDataMutation, setUser } from '@/lib/tanstack/dataQuery';
import { cn } from '@/lib/utils';

const INDIVIDUAL_PENDING_PAYLOAD_KEY = 'individualPendingPayload';

interface IndividualSignupPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface IndividualSignupPayloadWithOtp extends IndividualSignupPayload {
  verificationToken: string;
}

export default function IndividualVerifyEmailPage() {
  const [otpValue, setOtpValue] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<IndividualSignupPayload | null>(null);
  const [email, setEmail] = useState('');
  const [countdown, setCountdown] = useState(0);

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

  // Load pending signup data from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(INDIVIDUAL_PENDING_PAYLOAD_KEY);
      if (stored) {
        const payload = JSON.parse(stored);
        setPendingPayload(payload);
        setEmail(payload.email);
      } else {
        // No pending data — redirect back to signup
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

  // Mutation for resending code (step 1 endpoint — sends a new OTP)
  const resendCodeMutation = useDataMutation<
    { message: string },
    IndividualSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private/`,
    onSuccess: () => {
      toast.success('Code resent successfully', {
        description: 'Check your email for the new verification code.',
      });
      setCountdown(60); // Start 60s cooldown
    },
    onError: (error) => {
      toast.error('Failed to resend code', {
        description: error.message || 'Please try again later.',
      });
    },
    fetchWithoutRefresh: true,
    publicEndpoint: true,
  });

  // Mutation for verifying OTP and completing registration (step 2)
  const verifyOtpMutation = useDataMutation<
    any,
    IndividualSignupPayloadWithOtp
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/customer/private`,
    onSuccess: (data, variables) => {
      toast.success('Account created successfully!', {
        description: 'Welcome to 101 Drivers!',
      });
      // Clear session data
      sessionStorage.removeItem(INDIVIDUAL_PENDING_PAYLOAD_KEY);

      // The backend issues tokens on success (auto-login).
      // Store user data and redirect to the dashboard.
      if (data && typeof data === 'object' && 'id' in data) {
        setUser({
          id: data.id,
          username: data.username,
          email: data.email,
          roles: data.roles || ['PRIVATE_CUSTOMER'],
          fullName: data.fullName || variables.fullName,
          profileId: data.profileId,
        });
        setTimeout(() => {
          navigate({ to: '/dealer-dashboard' });
        }, 1500);
      } else {
        setTimeout(() => {
          navigate({ to: '/auth/dealer-signin' });
        }, 2000);
      }
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
    if (!pendingPayload || countdown > 0) return;
    resendCodeMutation.mutate(pendingPayload);
  };

  const handleVerify = () => {
    if (!otpValue || otpValue.length !== 6 || !pendingPayload) return;
    const payloadWithOtp: IndividualSignupPayloadWithOtp = {
      ...pendingPayload,
      verificationToken: otpValue,
    };
    verifyOtpMutation.mutate(payloadWithOtp);
  };

  const isPending = resendCodeMutation.isPending || verifyOtpMutation.isPending;

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
