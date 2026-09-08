/**
 * TestReferralPage — public referral-code landing page.
 *
 * Route: /test-referral/:code
 *
 * Resolves the code via GET /api/referrals/public/resolve/:code and shows
 * the user whose code they're about to use (privacy-masked) BEFORE
 * redirecting to a signup form.
 *
 * Three signup CTAs (matching the 3 user types) — WHICH buttons render
 * is decided by the backend's who-refers-whom matrix
 * (referralRoleMatrix — single source of truth, admin-tunable),
 * delivered pre-computed in the resolve response as `allows`:
 *   - "Become a Driver"      → /driver-onboarding?ref=CODE       (needs allows.DRIVER)
 *   - "Sign up as a Dealer"   → /auth/dealer-signup?ref=CODE    (needs allows.BUSINESS)
 *   - "Sign up as a Customer" → /auth/individual-signup?ref=CODE (needs allows.PERSONAL)
 * The apply endpoints enforce the same matrix server-side, so the
 * hidden doors can never be bypassed with a hand-typed ?ref= URL.
 *
 * The page-level paused warning comes from `programActive` — which
 * mirrors the admin master switch (isActive) ONLY. Nothing else pauses
 * this page.
 *
 * The referral code is passed via the ?ref= query parameter, which the
 * ReferralCodeInput component auto-fills on mount in each signup form.
 *
 * The page handles:
 *   - loading state (resolving the code)
 *   - not-found state (invalid code, code belongs to no one)
 *   - program-paused state (code is valid but program is paused — show
 *     a notice but still let the user sign up if they want)
 *   - found state (show the referrer's name + the 3 CTAs)
 *
 * No auth required — this is a public page.
 */
import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, ArrowRight, Car, Building, User, AlertTriangle, CheckCircle2, X, Printer, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { SEOHead } from "@/components/shared/SEOHead";
import { useDataQuery } from "@/lib/tanstack/dataQuery";

const API_URL = import.meta.env.VITE_API_URL;

type ResolveResponse = {
  found: boolean;
  referrerName: string | null;
  referrerType: "DRIVER" | "CUSTOMER" | null;
  referrerSubtype: "PERSONAL" | "BUSINESS" | null;
  /** Mirrors the admin master switch (isActive) — the only paused source. */
  programActive: boolean;
  /** V3.1: who-refers-whom matrix row — decides which signup buttons render. */
  allows: { DRIVER: boolean; PERSONAL: boolean; BUSINESS: boolean } | null;
};

type Props = {
  /** The referral code from the URL (e.g. /test-referral/ABCD2345 → code = "ABCD2345"). */
  code: string;
};

export default function TestReferralPage({ code }: Props) {
  // Uppercase the code before hitting the resolve endpoint — the backend
  // stores codes case-insensitively but resolves match by uppercase compare.
  const upperCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const resolveQuery = useDataQuery<ResolveResponse | null>({
    apiEndPoint: `${API_URL}/api/referrals/public/resolve/${encodeURIComponent(upperCode)}`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    enabled: !!upperCode,
    queryKey: ["referral-resolve-public", upperCode],
    staleTime: 60_000,
  });

  const data = resolveQuery.data;
  const isLoading = resolveQuery.isLoading;
  const isError = resolveQuery.isError;

  // ── Print handling: force the light palette onto PAPER only ──
  // darkMode is class-based (tailwind darkMode:"class"), so during print
  // we temporarily drop the .dark class from <html> and restore it right
  // after. The on-screen UI is untouched — this only affects the printout
  // and avoids a toner-black page with unreadable text.
  useEffect(() => {
    const html = document.documentElement;
    const beforePrint = () => {
      html.dataset.printDarkWas = html.classList.contains("dark") ? "1" : "0";
      html.classList.remove("dark");
    };
    const afterPrint = () => {
      if (html.dataset.printDarkWas === "1") {
        html.classList.add("dark");
      }
      delete html.dataset.printDarkWas;
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      afterPrint(); // safety net if unmounted mid-print
    };
  }, []);

  // Build the signup deep-link URLs with the ?ref= param
  const signupLinks = useMemo(
    () => ({
      driver: `/driver-onboarding?ref=${encodeURIComponent(upperCode)}`,
      dealer: `/auth/dealer-signup?ref=${encodeURIComponent(upperCode)}`,
      individual: `/auth/individual-signup?ref=${encodeURIComponent(upperCode)}`,
    }),
    [upperCode],
  );

  // ── V3.1: which signup doors this referrer's role may open — comes
  // pre-computed from the backend's who-refers-whom matrix
  // (referralRoleMatrix). Missing allows (old cache) → show all doors.
  // The page-level warning is separate: programActive mirrors the
  // admin master switch only.
  const allows = data?.found ? data.allows : null;
  const canReferDriver = allows ? allows.DRIVER : true;
  const canReferDealer = allows ? allows.BUSINESS : true;
  const canReferIndividual = allows ? allows.PERSONAL : true;
  const doorCount = [canReferDriver, canReferDealer, canReferIndividual].filter(Boolean).length;

  // ── SEO meta — these public referral pages are shareable but
  // individually not very useful for search engines, so the root route
  // adds `noindex, nofollow` via NOINDEX_PREFIXES (we added '/test-referral/'
  // there). Page title + description are still useful for social previews.
  const seoTitle = data?.found
    ? `You're invited by ${data.referrerName ?? "a 101drivers referrer"} — 101 Drivers`
    : "Referral Code — 101 Drivers";
  const seoDescription = data?.found
    ? "Sign up with a friend's referral code and earn rewards when you complete paid deliveries."
    : "Resolve a 101drivers referral code to see whose code it is and where to sign up.";

  // Full absolute signup URLs — used ONLY by the print-only URL lines
  // (paper can't click buttons, so the typed link is the fallback).
  const fullSignupUrls = useMemo(
    () => ({
      driver: `${window.location.origin}${signupLinks.driver}`,
      dealer: `${window.location.origin}${signupLinks.dealer}`,
      individual: `${window.location.origin}${signupLinks.individual}`,
    }),
    [signupLinks],
  );

  return (
    <div className="print-referral-root min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex items-center justify-center px-4 py-8">
      {/* ── Print stylesheet — scoped to this page, screen UI untouched ──
          Everything below lives inside @media print / the .print-referral-root
          subtree: one-page Letter layout, compacted spacing, smaller QR,
          bordered buttons readable without background graphics, and
          print-only URL lines (paper can't click). */}
      <style>{`
        .print-only { display: none; }
        .print-url {
          font: 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #475569;
          word-break: break-all;
          text-align: center;
          margin-top: 3px;
        }
        @media print {
          @page { size: letter portrait; margin: 12mm; }
          html, body { background: #ffffff !important; }
          .print-referral-root {
            background: #ffffff !important;
            color: #0f172a !important;
            min-height: 0 !important;
            padding: 0 !important;
            /* Center the WHOLE wrapper — symmetric side margins on paper
               (screen uses flex centering; print re-applies it here) */
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
          }
          /* Safety net: even if the layout flips back to block, the
             content column still centers with equal left/right margins */
          .print-referral-root > div {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .print-referral-root * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            box-shadow: none !important;
          }
          .print-hide { display: none !important; }
          .print-only { display: block !important; }
          /* Card: visible border, never split across pages */
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #cbd5e1 !important;
          }
          /* Compact vertical rhythm so everything fits ONE page */
          .print-referral-root .py-8 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print-referral-root .mb-6 { margin-bottom: 10px !important; }
          .print-referral-root .mt-6 { margin-top: 10px !important; }
          .print-referral-root .mb-3 { margin-bottom: 6px !important; }
          .print-referral-root .space-y-4 > * + * { margin-top: 8px !important; }
          .print-referral-root .space-y-3 > * + * { margin-top: 6px !important; }
          .print-referral-root .p-4 { padding: 8px !important; }
          .print-referral-root .pt-2 { padding-top: 4px !important; }
          .print-referral-root .mt-3 { margin-top: 4px !important; }
          .print-referral-root .mt-1 { margin-top: 2px !important; }
          .print-referral-root .gap-3 { gap: 6px !important; }
          /* QR: slightly smaller on paper */
          .print-qr { padding: 6px !important; }
          .print-qr svg { width: 140px !important; height: 140px !important; }
          /* Buttons → bordered boxes, readable even with background
             graphics turned off in the print dialog */
          .print-referral-root button {
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1.5px solid #0f172a !important;
            box-shadow: none !important;
          }
          /* Brand mark stays recognizable even without background graphics */
          .print-logo { border: 1.5px solid #10b981 !important; }
          /* Small helper text a touch darker for paper legibility */
          .print-referral-root .text-slate-400,
          .print-referral-root .text-slate-500 { color: #475569 !important; }
        }
      `}</style>

      <SEOHead title={seoTitle} description={seoDescription} />

      <div className="w-full max-w-md">
        {/* ── Header — minimal logo + title ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="print-logo w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight">101 Drivers</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Referral Program
          </p>
        </div>

        <Card className="print-card border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-black text-center flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <Spinner className="size-5 text-slate-400" />
                  Resolving your code…
                </>
              ) : isError ? (
                <>
                  <X className="w-5 h-5 text-red-500" />
                  Could not resolve
                </>
              ) : data?.found ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  You're invited!
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-red-500" />
                  Code not found
                </>
              )}
            </CardTitle>
            <CardDescription className="text-center text-sm text-slate-600 dark:text-slate-400 mt-1">
              {isLoading
                ? "Checking the referral code you were given…"
                : isError
                  ? "We couldn't reach the server. Please check your internet connection and try again."
                  : data?.found
                    ? "You're about to sign up with a friend's referral code."
                    : "We couldn't find anyone with that referral code. Please check the link or ask the person who shared it with you."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* ── The referral code itself ── */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Referral Code
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-wider font-mono">
                {upperCode}
              </p>
            </div>

            {/* ── Resolved state — show the referrer ── */}
            {data?.found && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 text-center">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-2">
                  <Gift className="w-4 h-4" />
                  Referred by {data.referrerName ?? "a 101drivers referrer"}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Referrer type: {data.referrerType === "DRIVER" ? "Driver" : "Customer"}
                </p>
              </div>
            )}

            {/* ── Paused warning (code found but program paused) ──
                programActive mirrors the admin MASTER switch only —
                nothing else pauses this page. */}
            {data?.found && !data.programActive && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  The referral program is currently paused. You can still sign up,
                  but the referral code won't be applied to your account.
                  Check back later or contact the person who shared this code with you.
                </p>
              </div>
            )}

            {/* ── QR code (for easy printing + in-person sharing) ── */}
            {data?.found && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Scan to share
                </p>
                <div className="print-qr p-3 bg-white rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                  <QRCodeSVG
                    value={`${window.location.origin}/test-referral/${upperCode}`}
                    size={180}
                    level="M"
                    fgColor="#065f46"
                    bgColor="#ffffff"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                  Scan with your phone camera or print this page to share in person.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="print-hide rounded-xl h-8 text-xs"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print this page
                </Button>
              </div>
            )}

            {/* ── CTAs ── V3.1: the doors this referrer's role may open.
                Which buttons render comes straight from the backend's
                who-refers-whom matrix (`allows` on the resolve
                response) — buttons ARE the matrix, visually. */}
            {data?.found ? (
              <div className="space-y-3 pt-2">
                {doorCount > 0 ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center">
                      {doorCount > 1
                        ? "Choose how you want to sign up"
                        : "Sign up to get started"}
                    </p>

                    {/* Driver signup — $50 to the referrer on this driver's 5th
                        paid delivery (within 30 days of signup). */}
                    {canReferDriver && (
                      <Link to={signupLinks.driver} className="block">
                        <Button className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center justify-center gap-2">
                          <Car className="w-5 h-5" />
                          Become a Driver
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                        <span className="print-only print-url">or visit: {fullSignupUrls.driver}</span>
                      </Link>
                    )}

                    {/* Dealer (Business customer) signup — $10 to the referrer on
                        this business's first paid delivery (rolling 30-day cap). */}
                    {canReferDealer && (
                      <Link to={signupLinks.dealer} className="block">
                        <Button variant="outline" className="w-full py-4 rounded-2xl font-extrabold inline-flex items-center justify-center gap-2">
                          <Building className="w-5 h-5" />
                          Sign up as a Dealer
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                        <span className="print-only print-url">or visit: {fullSignupUrls.dealer}</span>
                      </Link>
                    )}

                    {/* Private (personal) customer signup — $5 to the referrer on
                        this customer's first paid delivery (no cap). */}
                    {canReferIndividual && (
                      <Link to={signupLinks.individual} className="block">
                        <Button variant="outline" className="w-full py-4 rounded-2xl font-extrabold inline-flex items-center justify-center gap-2">
                          <User className="w-5 h-5" />
                          Sign up as a Customer
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                        <span className="print-only print-url">or visit: {fullSignupUrls.individual}</span>
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed py-2">
                    This referrer's role can't refer new sign-ups under the
                    current program rules.
                  </p>
                )}

                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-3 leading-relaxed">
                  The referral code <span className="font-mono font-bold">{upperCode}</span> will be
                  applied automatically on the signup form — no need to type it in.
                </p>
              </div>
            ) : !isLoading && !isError ? (
              // Code not found — show a generic "go to homepage" CTA
              <div className="space-y-3 pt-2">
                <Link to="/" className="block">
                  <Button className="w-full py-4 rounded-2xl font-extrabold inline-flex items-center justify-center gap-2">
                    Go to homepage
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <p className="text-[11px] text-slate-400 text-center">
                  If you think this is a mistake, contact the person who shared
                  this link and ask them to double-check their code.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Footer ── */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            101 Drivers · Referral Program ·{" "}
            <Link to="/about" className="underline hover:text-slate-600 dark:hover:text-slate-300">
              Learn more
            </Link>
          </p>
          <p className="print-hide text-[11px] text-slate-400 dark:text-slate-500">
            Don't have a code?{" "}
            <Link to="/test-referral" className="underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 inline-flex items-center gap-1">
              <Search className="w-3 h-3" />
              Search by name
            </Link>
          </p>
          <p className="print-only print-url">
            Referral link: {window.location.origin}/test-referral/{upperCode}
          </p>
        </div>
      </div>
    </div>
  );
}
