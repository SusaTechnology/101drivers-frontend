/**
 * ReferralCodeCard — reusable "Refer & Earn" card with copy + QR + share URL.
 *
 * Used on the dealer dashboard (customer referrer) and driver dashboard
 * (driver referrer). Both sides hit different API endpoints — the
 * `referrerType` prop switches between them.
 *
 * Visual language: emerald accents (matching the existing driver-wallet
 * referral card), blurred corner glow, Gift icon, "Your referral code"
 * label in tiny uppercase tracking-widest, the code in big tracking-wider
 * font, Copy + Share buttons that open a Dialog with a QR code.
 *
 * The Dialog shows:
 *   - The share URL (e.g. https://101drivers.com/driver-onboarding?ref=ABCD2345)
 *   - A QR code rendered as an SVG (qrcode.react) so users can scan with
 *     their phone camera to share in person
 *   - A "Copy link" button + "Copied!" toast (sonner)
 *
 * The card adapts to program state:
 *   - isActive=true → shows the card + share button
 *   - isActive=false → shows a paused banner
 *   - referralCode missing → lazy-creates one on first render (the backend
 *     auto-generates a code on GET /my-customer-referral-code if the
 *     customer doesn't have one yet)
 */
import { useState, useCallback, useMemo } from "react";
import { Gift, Copy, Share2, X, Check, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDataQuery } from "@/lib/tanstack/dataQuery";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL;

type ReferrerType = "DRIVER" | "CUSTOMER";

type Props = {
  /** Which referral program this card represents — determines the API endpoints. */
  referrerType: ReferrerType;
  /** Optional className to override the outer wrapper. */
  className?: string;
};

/**
 * Build the share URL for the referral code.
 *
 * ALL referrer types (DRIVER + CUSTOMER) share the SAME URL format:
 *   /test-referral/CODE
 *
 * The /test-referral/:code page resolves the code, shows the referrer's
 * name (privacy-masked), displays a QR code for easy printing, and
 * provides 3 signup CTAs (Driver / Dealer / Customer) that deep-link
 * to the appropriate signup form with ?ref=CODE.
 *
 * This means a single share link works for everyone — the test-referral
 * page handles the routing to the correct signup form based on who
 * the user wants to become.
 */
function buildShareUrl(_referrerType: ReferrerType, code: string): string {
  const base = window.location.origin;
  return `${base}/test-referral/${encodeURIComponent(code)}`;
}

export function ReferralCodeCard({ referrerType, className }: Props) {
  // ── Endpoints switch based on referrer type ──────────────────────
  const codeEndpoint =
    referrerType === "DRIVER"
      ? `${API_URL}/api/referrals/my-referral-code`
      : `${API_URL}/api/referrals/my-customer-referral-code`;
  const statsEndpoint =
    referrerType === "DRIVER"
      ? `${API_URL}/api/referrals/my-stats`
      : `${API_URL}/api/referrals/my-customer-referral-stats`;
  // program-config is global — same endpoint for both referrer types.
  const configEndpoint = `${API_URL}/api/referrals/program-config`;

  // ── Fetches (auth handled automatically by useDataQuery) ──────────
  const { data: codeData } = useDataQuery<{ referralCode: string } | null>({
    apiEndPoint: codeEndpoint,
    noFilter: true,
  });
  const { data: statsData } = useDataQuery<any>({
    apiEndPoint: statsEndpoint,
    noFilter: true,
  });
  const { data: configData } = useDataQuery<any>({
    apiEndPoint: configEndpoint,
    noFilter: true,
  });

  const referralCode = codeData?.referralCode ?? "";
  const isActive = configData?.isActive ?? false;

  // ── Share dialog state ────────────────────────────────────────────
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const shareUrl = useMemo(
    () => (referralCode ? buildShareUrl(referrerType, referralCode) : ""),
    [referrerType, referralCode],
  );

  // Copy CODE only (e.g. "ABCD2345") — for when the user wants to share
  // just the code verbally or in a context where a link isn't needed.
  const handleCopyCode = useCallback(async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      toast.success("Code copied", {
        description: `${referralCode} — paste it anywhere.`,
        duration: 3000,
      });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      toast.error("Couldn't copy automatically");
    }
  }, [referralCode]);

  // Copy LINK (e.g. "https://101drivers.com/test-referral/ABCD2345") —
  // for sharing via text/email/social.
  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast.success("Referral link copied", {
        description: "Paste it in a text or email to share with friends.",
        duration: 3000,
      });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Couldn't copy automatically");
    }
  }, [shareUrl]);

  const handleShare = useCallback(async () => {
    if (!shareUrl) return;
    setShareDialogOpen(true);
  }, [shareUrl]);

  // ── Stats display ─────────────────────────────────────────────────
  // V2: For DRIVER referrer: totalEarned ($ from $50 bonuses), successfulReferrals
  // For CUSTOMER referrer: totalCreditsEarnedCents, successfulReferrals
  const statsBlocks: Array<{ label: string; value: string }> = [];
  if (referrerType === "DRIVER" && statsData) {
    statsBlocks.push({
      label: "Total Earned",
      value: `$${(statsData.totalEarned ?? 0).toFixed(2)}`,
    });
    statsBlocks.push({
      label: "Successful",
      value: String(statsData.successfulReferrals ?? 0),
    });
  } else if (referrerType === "CUSTOMER" && statsData) {
    const totalCents = statsData.totalCreditsEarnedCents ?? 0;
    statsBlocks.push({
      label: "Credits Earned",
      value: `$${(totalCents / 100).toFixed(2)}`,
    });
    statsBlocks.push({
      label: "Successful",
      value: String(statsData.successfulReferrals ?? 0),
    });
  }

  // ── Reward description ────────────────────────────────────────────
  const rewardDescription = useMemo(() => {
    if (!configData) return "Loading referral program info…";
    if (!isActive) return "The referral program is currently paused.";
    if (referrerType === "DRIVER") {
      // V2 spec: Drivers referring drivers earn $50 when the referred
      // driver completes their 5th paid delivery. No per-delivery payout
      // for referred drivers — only the one-shot $50 bonus.
      const bonusAmount = configData.referredRewardAmount ?? 50;
      const triggerCount = configData.requiredDeliveries ?? 5;
      return `Earn $${bonusAmount} when a driver you refer completes ${triggerCount} paid deliveries. Refer as many as you want — codes never expire.`;
    }
    // CUSTOMER — V2 spec: per-delivery payouts vary by customer type.
    // Personal: $5/delivery. Business: $10/delivery.
    // Plus $50 when a referred driver completes their 5th delivery.
    const personalCents = configData.perDeliveryPersonalReferrerAmountCents ?? 500;
    const businessCents = configData.perDeliveryBusinessReferrerAmountCents ?? 1000;
    const bonusCents = configData.perDeliveryReferredBonusCents ?? 5000;
    const triggerCount = configData.perDeliveryBonusTriggerCount ?? 5;
    return `Earn $${(personalCents / 100).toFixed(2)} per paid delivery from personal customers you refer, $${(businessCents / 100).toFixed(2)} per paid delivery from business customers, plus $${(bonusCents / 100).toFixed(2)} when a driver you refer completes their ${triggerCount}th paid delivery.`;
  }, [configData, isActive, referrerType]);

  // ── Don't render if the program config isn't loaded yet ──────────
  // (avoids flash of "paused" before the config fetch resolves)
  if (!configData) {
    return null;
  }

  return (
    <>
      <Card
        className={cn(
          "border-emerald-200 dark:border-emerald-800/40 shadow-lg relative overflow-hidden",
          className,
        )}
      >
        {/* Blurred corner glow — matches driver-wallet visual language */}
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <CardHeader className="relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <CardTitle className="text-lg font-black">
                Refer a Friend &amp; Earn
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {rewardDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          {/* Referral code display + Copy CODE button (copies code only) */}
          {referralCode && isActive && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Your referral code
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white tracking-wider font-mono">
                  {referralCode}
                </p>
              </div>
              {/* Copy CODE button — copies just the code (e.g. "ABCD2345") */}
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-4 rounded-2xl border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 font-extrabold transition inline-flex items-center gap-2"
                onClick={handleCopyCode}
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Stats row (2-col grid) */}
          {statsBlocks.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {statsBlocks.map((block) => (
                <div
                  key={block.label}
                  className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30"
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">
                    {block.label}
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {block.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Primary "Share" button — opens the QR dialog */}
          {isActive ? (
            referralCode ? (
              <Button
                onClick={handleShare}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl hover:shadow-emerald-600/20 transition inline-flex items-center justify-center gap-2 font-extrabold"
              >
                <Share2 className="w-4 h-4" />
                Share my referral link
              </Button>
            ) : (
              // Code is being lazy-created on first GET — show a brief loading state
              <div className="w-full py-4 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-center font-extrabold animate-pulse">
                Generating your referral code…
              </div>
            )
          ) : (
            // Program paused banner
            <div className="w-full py-4 px-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-200 text-center text-sm font-medium">
              The referral program is currently paused. Check back later.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Share Dialog with QR code ─────────────────────────────── */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-emerald-200 dark:border-emerald-800/40">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-black text-center flex items-center justify-center gap-2">
              <Gift className="w-5 h-5 text-emerald-500" />
              Share your referral link
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 flex flex-col items-center text-center space-y-4">
            {/* QR code — scannable by phone camera */}
            {shareUrl && (
              <div className="p-4 bg-white rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                <QRCodeSVG
                  value={shareUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                  fgColor="#065f46"
                  bgColor="#ffffff"
                />
              </div>
            )}

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Have a friend scan this QR code with their phone camera, or
              copy the link below to share via text or email.
            </p>

            {/* Share URL in a code box */}
            {shareUrl && (
              <div className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                  {shareUrl}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 w-full">
              <Button
                onClick={handleCopyLink}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center justify-center gap-2"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShareDialogOpen(false)}
                className="py-3 px-4 rounded-2xl font-bold"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Open signup page in new tab — useful for desktop testing */}
            {shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Preview the signup page
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReferralCodeCard;
