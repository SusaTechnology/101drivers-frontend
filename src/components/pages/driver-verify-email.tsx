import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { ArrowRight, Mail, RefreshCw, Loader2 } from 'lucide-react';
import { useDataMutation } from '@/lib/tanstack/dataQuery';

const DRIVER_SIGNUP_DRAFT_KEY = 'driverSignupDraft';
const DRIVER_PENDING_PAYLOAD_KEY = 'driverPendingPayload';

interface DriverSignupPayload {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  homeArea?: string;
  preferredRadius?: string;
  districts?: string[];
  emailAlerts?: boolean;
  agreementAcceptedAt?: string;
  referralCode?: string;
}

interface DriverSignupPayloadWithOtp extends DriverSignupPayload {
  verificationToken: string;
}

export default function DriverVerifyEmailPage() {
  const [otpValue, setOtpValue] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<DriverSignupPayload | null>(null);
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
      const stored = sessionStorage.getItem(DRIVER_PENDING_PAYLOAD_KEY);
      if (stored) {
        const payload = JSON.parse(stored);
        setPendingPayload(payload);
        setEmail(payload.email);
      } else {
        // No pending data — redirect back to signup
        toast.error('No pending registration found', {
          description: 'Please start a new registration.',
        });
        navigate({ to: '/driver-onboarding' });
      }
    } catch {
      navigate({ to: '/driver-onboarding' });
    }
  }, [navigate]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Mutation for resending code
  const resendCodeMutation = useDataMutation<
    { message: string },
    DriverSignupPayload
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/driver/`,
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
  });

  // Mutation for verifying OTP and completing registration
  const verifyOtpMutation = useDataMutation<
    { message: string },
    DriverSignupPayloadWithOtp
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/signup/driver`,
    onSuccess: (_data, variables) => {
      toast.success('Application submitted!', {
        description: "We'll contact you when we need more drivers in your area.",
      });
      // Clear session data
      sessionStorage.removeItem(DRIVER_PENDING_PAYLOAD_KEY);
      localStorage.removeItem(DRIVER_SIGNUP_DRAFT_KEY);
      // Store non-sensitive data
      const { password, ...safeData } = variables;
      localStorage.setItem('driverSignupData', JSON.stringify(safeData));
      // Navigate to success page
      navigate({ to: '/driver-application-submitted' });
    },
    onError: (error) => {
      toast.error('Verification failed', {
        description: error.message || 'Invalid code or server error.',
      });
    },
    fetchWithoutRefresh: true,
  });

  const handleOtpChange = useCallback((value: string) => {
    // Only allow digits
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
    const payloadWithOtp: DriverSignupPayloadWithOtp = {
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
              to="/driver-onboarding"
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
