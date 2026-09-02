/**
 * TestReferralPage — public referral-code landing page.
 *
 * Route: /test-referral/:code
 *
 * Resolves the code via GET /api/referrals/public/resolve/:code and shows
 * the user whose code they're about to use (privacy-masked) BEFORE
 * redirecting to a signup form.
 *
 * Three signup CTAs (matching the 3 user types):
 *   - "Become a Driver"     → /driver-onboarding?ref=CODE
 *   - "Sign up as a Dealer"  → /auth/dealer-signup?ref=CODE
 *   - "Sign up as a Customer" → /auth/individual-signup?ref=CODE
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
import { useMemo } from "react";
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
  programActive: boolean;
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

  // Build the signup deep-link URLs with the ?ref= param
  const signupLinks = useMemo(
    () => ({
      driver: `/driver-onboarding?ref=${encodeURIComponent(upperCode)}`,
      dealer: `/auth/dealer-signup?ref=${encodeURIComponent(upperCode)}`,
      individual: `/auth/individual-signup?ref=${encodeURIComponent(upperCode)}`,
    }),
    [upperCode],
  );

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

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex items-center justify-center px-4 py-8">
      <SEOHead title={seoTitle} description={seoDescription} />

      <div className="w-full max-w-md">
        {/* ── Header — minimal logo + title ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight">101 Drivers</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Referral Program
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
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

            {/* ── Paused warning (code found but program paused) ── */}
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
                <div className="p-3 bg-white rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm">
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
                  className="rounded-xl h-8 text-xs"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print this page
                </Button>
              </div>
            )}

            {/* ── CTAs ── V2: only show signup buttons the referrer is allowed to refer.
                Role matrix:
                  Personal customer → personal customers ONLY
                  Business customer → personal customers OR drivers
                  Driver → personal customers OR drivers
                Business customers can NEVER be referred — they sign up directly. */}
            {data?.found ? (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center">
                  {(() => {
                    // Determine which options to show based on referrer type/subtype
                    const canReferDriver =
                      data.referrerType === "DRIVER" ||
                      (data.referrerType === "CUSTOMER" && data.referrerSubtype === "BUSINESS");
                    const canReferPersonal = true; // all referrer types can refer personal customers
                    if (canReferDriver && canReferPersonal) {
                      return "Choose how you want to sign up";
                    }
                    return "Sign up to get started";
                  })()}
                </p>

                {/* Driver signup — only shown if referrer can refer drivers
                    (Business customer or Driver referrer. NOT Personal customer.) */}
                {(() => {
                  const canReferDriver =
                    data.referrerType === "DRIVER" ||
                    (data.referrerType === "CUSTOMER" && data.referrerSubtype === "BUSINESS");
                  if (!canReferDriver) return null;
                  return (
                    <Link to={signupLinks.driver} className="block">
                      <Button className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center justify-center gap-2">
                        <Car className="w-5 h-5" />
                        Become a Driver
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  );
                })()}

                {/* Dealer (Business customer) signup — NEVER shown as a referral CTA.
                    Business customers sign up directly, they cannot be referred.
                    OLD CODE (commented out per spec):
                    <Link to={signupLinks.dealer} className="block">
                      <Button variant="outline" ...>Sign up as a Dealer</Button>
                    </Link>
                    */}

                {/* Private customer signup — shown for ALL referrer types
                    (personal, business, and driver can all refer personal customers) */}
                <Link to={signupLinks.individual} className="block">
                  <Button variant="outline" className="w-full py-4 rounded-2xl font-extrabold inline-flex items-center justify-center gap-2">
                    <User className="w-5 h-5" />
                    Sign up as a Customer
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>

                {(() => {
                  // Show a note explaining what's allowed if the referrer is a personal customer
                  if (data.referrerType === "CUSTOMER" && data.referrerSubtype === "PERSONAL") {
                    return (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center mt-2 leading-relaxed">
                        This referrer can only refer personal customers. To become a driver or dealer,
                        sign up directly without a referral code.
                      </p>
                    );
                  }
                  return null;
                })()}

                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-3 leading-relaxed">
                  The referral code <span className="font-mono font-bold">{upperCode}</span> will be
                  auto-filled in the signup form. You can edit or clear it before submitting.
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
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Don't have a code?{" "}
            <Link to="/test-referral" className="underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 inline-flex items-center gap-1">
              <Search className="w-3 h-3" />
              Search by name
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
