// SocialDriverApplication — the driver application form for users whose
// identity was created through a social provider (Better Auth session). It
// collects exactly the business fields the legacy signup form collects
// (name, DOB, home ZIP, city, referral) and posts them to
// POST /api/auth/ba/social-driver-signup, which runs the SAME gates as the
// legacy email path (California-only ZIP, age 25+) and creates the Driver
// row as WAITLISTED. Identity fields (email) come from the session and are
// never editable here.

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDataMutation, getUser, setUser } from "@/lib/tanstack/dataQuery";
import {
  refreshBetterAuthContext,
  type BaDriverContext,
} from "@/lib/betterAuth/ba-session";
import { baAuthHeaders } from "@/lib/betterAuth/auth-client";

const CA_ZIP_OK = /^9[0-6][0-9]{3}$/

export function SocialDriverApplication() {
  const navigate = useNavigate();
  const [context, setContext] = useState<BaDriverContext | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [homeArea, setHomeArea] = useState("");
  const [zipVerdict, setZipVerdict] = useState<"idle" | "checking" | "ok" | "out" | "invalid">("idle");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [city, setCity] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    refreshBetterAuthContext()
      .then((ctx) => {
        if (ctx.profileId) {
          // Already has a Driver profile — straight to the normal landing.
          toast.info("Your driver application already exists.");
          navigate({ to: "/driver-application-submitted" });
          return;
        }
        setContext(ctx);
        setFullName(ctx.fullName ?? "");
      })
      .catch((err: unknown) => {
        setBootError(err instanceof Error ? err.message : "Sign-in required");
      });
  }, [navigate]);

  // Live California ZIP verdict — the same public endpoint the legacy signup
  // form uses (GET /api/auth/public/validate-zip/:zip, no auth).
  useEffect(() => {
    const zip = homeArea.trim();
    if (!zip) {
      setZipVerdict("idle");
      return;
    }
    if (!/^\d{5}$/.test(zip)) {
      setZipVerdict("invalid");
      return;
    }
    setZipVerdict("checking");
    const t = setTimeout(() => {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/public/validate-zip/${zip}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => setZipVerdict(v?.valid ? "ok" : "out"))
        .catch(() => setZipVerdict(/^\d{5}$/.test(zip) && CA_ZIP_OK.test(zip) ? "ok" : "out"));
    }, 350);
    return () => clearTimeout(t);
  }, [homeArea]);

  const submitMutation = useDataMutation<
    BaDriverContext,
    {
      fullName: string;
      dateOfBirth: string;
      homeArea: string;
      phone?: string;
      city?: string;
      referralCode?: string;
    }
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/auth/ba/social-driver-signup`,
    method: "POST",
    onSuccess: (data) => {
      setUser({ ...getUser(), ...data });
      toast.success("Application received!");
      navigate({ to: "/driver-application-submitted" });
    },
    onError: (error) => {
      setFormError(
        (error as Error)?.message ||
          "Could not submit your application. Please check the fields and try again."
      );
      toast.error("Application failed");
    },
  });

  const handleSubmit = () => {
    setFormError(null);
    if (!context) return;
    if (!fullName.trim()) {
      setFormError("Your full name is required");
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateOfBirth)) {
      setFormError("Date of birth must be in MM/DD/YYYY format");
      return;
    }
    if (!/^\d{5}$/.test(homeArea.trim())) {
      setFormError("A valid 5-digit ZIP code is required");
      return;
    }
    submitMutation.mutate({
      fullName: fullName.trim(),
      dateOfBirth,
      homeArea: homeArea.trim(),
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      referralCode: referralCode.trim() || undefined,
    });
  };

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">{bootError}</p>
          <Button onClick={() => navigate({ to: "/driver-signin" })} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to driver sign-in
          </Button>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      <div className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-xl mx-auto px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/driver-signin" })}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black">Finish your driver application</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-4">
        <div className="rounded-2xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-4">
          <p className="text-sm leading-relaxed">
            You&apos;re signed in as <strong>{context.email}</strong>. A few
            details about you and your driving area, and your application joins
            the waitlist — same as every other applicant.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Chris Driver" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dob">Date of birth (MM/DD/YYYY)</Label>
          <Input id="dob" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder="01/15/1990" inputMode="numeric" />
          <p className="text-[11px] text-slate-400">Drivers must be at least 25 years old.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="zip">Home ZIP code</Label>
          <Input id="zip" value={homeArea} onChange={(e) => setHomeArea(e.target.value)} placeholder="90001" inputMode="numeric" maxLength={5} />
          <p
            className={`text-[11px] ${
              zipVerdict === "ok"
                ? "text-green-600 dark:text-green-400"
                : zipVerdict === "out" || zipVerdict === "invalid"
                ? "text-red-600 dark:text-red-400"
                : "text-slate-400"
            }`}
          >
            {zipVerdict === "ok" && "✓ Inside our California service region"}
            {zipVerdict === "checking" && "Checking…"}
            {zipVerdict === "out" && "We currently only operate in California."}
            {zipVerdict === "invalid" && "Enter a 5-digit ZIP code."}
            {zipVerdict === "idle" && "California only — 5-digit ZIP."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 408 555 0144" inputMode="tel" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">Preferred city (optional)</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Los Angeles" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="referral">Referral code (optional)</Label>
          <Input id="referral" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="From the driver who referred you" />
        </div>

        {formError && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            {formError}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending || zipVerdict === "checking"}
          className="w-full h-12 rounded-2xl text-base font-black lime-btn"
        >
          {submitMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Submit application
        </Button>
      </div>
    </div>
  );
}
