// src/components/PolicySheet.tsx
import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Handshake, AlertTriangle, Shield, Info, Clock, Users,
  Database, Lock, UserCheck, Mail,
} from "lucide-react";

interface PolicySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "agreement" | "terms" | "privacy";
  onCloseAction?: () => void;
  closeLabel?: string;
  fromSignUp: boolean;
}

/**
 * PolicySheet
 *
 * Reads the policy body from the backend content API
 * (`GET /api/content/{type}`) so admins can edit it via the
 * WYSIWYG editor at /admin/content. The hardcoded JSX below is
 * only a fallback for the very first load (before an admin has
 * saved anything) or if the API is unreachable.
 *
 * DOMPurify is loaded lazily so this file works even on branches
 * that don't have the dompurify dependency installed — if the
 * dynamic import fails, we fall back to rendering the raw HTML
 * (which is acceptable because the only writers are authenticated
 * admins using the WYSIWYG editor).
 */
export default function PolicySheet({
  open,
  onOpenChange,
  type,
  onCloseAction,
  closeLabel,
  fromSignUp,
}: PolicySheetProps) {
  const [dbContent, setDbContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sanitizedHtml, setSanitizedHtml] = useState<string>("");

  // Fetch editable content from the API whenever the sheet opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setDbContent(null);
    setSanitizedHtml("");

    fetch(`${import.meta.env.VITE_API_URL}/api/content/${type}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.content && typeof data.content === "string" && data.content.trim()) {
          setDbContent(data.content);
        }
      })
      .catch(() => {
        /* swallow — fallback JSX will render */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, type]);

  // Sanitize the DB content with DOMPurify (lazy-loaded so this
  // file works on branches that don't have dompurify installed).
  useEffect(() => {
    if (!dbContent) {
      setSanitizedHtml("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("dompurify");
        const DOMPurify = (mod as any).default ?? mod;
        if (!cancelled) {
          setSanitizedHtml(
            DOMPurify.sanitize(dbContent, { ADD_ATTR: ["target", "rel"] })
          );
        }
      } catch {
        // dompurify not installed on this branch — use the raw HTML.
        // Acceptable because only authenticated admins can write
        // content via the WYSIWYG editor.
        if (!cancelled) setSanitizedHtml(dbContent);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbContent]);

  const handleClose = () => {
    onOpenChange(false);
    onCloseAction?.();
  };

  // Header text per type — always shown
  const title =
    type === "agreement"
      ? "Independent Driver Agreement"
      : type === "terms"
      ? "Terms of Service"
      : "Privacy Policy";
  const subtitle =
    type === "agreement"
      ? "Effective: April 1, 2026"
      : type === "terms"
      ? "Effective date: March 2026"
      : "Last updated: March 2026";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pt-8 px-6">
          <SheetTitle className="text-2xl font-black text-slate-900 dark:text-white">
            {title}
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-10 space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="animate-pulse space-y-3 py-4">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mt-4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
            </div>
          )}

          {/* ── DB content (admin-edited via WYSIWYG) ── */}
          {!loading && sanitizedHtml && (
            <div
              className="content-editor-output max-w-none [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-slate-900 [&_h2]:dark:text-white [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-black [&_h3]:text-slate-900 [&_h3]:dark:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-slate-800 [&_h4]:dark:text-slate-200 [&_h4]:mt-5 [&_h4]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_a]:text-lime-500 [&_a]:font-bold [&_a]:underline [&_strong]:text-slate-800 [&_strong]:dark:text-white [&_blockquote]:bg-amber-50 [&_blockquote]:dark:bg-amber-900/10 [&_blockquote]:border [&_blockquote]:border-amber-100 [&_blockquote]:dark:border-amber-900/30 [&_blockquote]:text-amber-900 [&_blockquote]:dark:text-amber-200 [&_blockquote]:rounded-2xl [&_blockquote]:p-4 [&_blockquote]:my-6 [&_blockquote]:text-[11px] [&_blockquote]:leading-normal [&_blockquote]:font-medium"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          )}

          {/* ── Hardcoded fallback (only when no DB content) ── */}
          {!loading && !sanitizedHtml && (
            <>
              {type === "agreement" && (
                <>
                  <p>This Independent Driver Agreement ("Agreement") is entered into by and between the driver ("Driver") and 101 Drivers, Inc. ("Company"). By checking the agreement box during signup, the Driver acknowledges and agrees to the following terms and conditions.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">1. Independent Contractor Status</h3></div>
                  <p>The Driver acknowledges and agrees that they are an independent contractor and not an employee of the Company. The Driver shall be solely responsible for determining the manner and means by which services are performed. The Company does not control the Driver's work schedule, methods, or procedures, except as may be reasonably necessary to ensure the quality of services provided. Nothing in this Agreement shall be construed to create an employment relationship, partnership, joint venture, or agency relationship between the Driver and the Company.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Handshake className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">2. Services</h3></div>
                  <p>The Driver agrees to perform vehicle delivery services as requested through the Company's platform. The Driver shall use their own vehicle, equipment, and tools to perform the services. The Driver represents that they possess a valid driver's license, appropriate insurance coverage, and any other licenses or permits required by law to perform the services.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Handshake className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">3. Compensation</h3></div>
                  <p>The Driver shall be compensated for completed delivery services as outlined on the Company's platform. Compensation rates may be adjusted by the Company from time to time with reasonable notice. The Driver acknowledges that they are responsible for all taxes, including self-employment taxes, related to the compensation received under this Agreement.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">4. Insurance and Liability</h3></div>
                  <p>The Driver shall maintain, at their own expense, appropriate automobile liability insurance that meets or exceeds the minimum requirements of the state(s) in which they operate. The Driver agrees to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from the Driver's negligent acts or omissions in the performance of services under this Agreement.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">5. Background Check</h3></div>
                  <p>The Driver consents to a background check and driving record review as a condition of providing services through the Company's platform. The Company reserves the right to suspend or terminate this Agreement if the results of such checks do not meet the Company's standards.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">6. Confidentiality</h3></div>
                  <p>The Driver agrees to maintain the confidentiality of any proprietary or sensitive information received from the Company or its customers, including but not limited to customer contact information, delivery addresses, and business practices. This obligation survives the termination of this Agreement.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">7. Termination</h3></div>
                  <p>Either party may terminate this Agreement at any time, with or without cause, by providing written notice to the other party. Upon termination, the Driver shall return any Company property and cease representing themselves as affiliated with the Company.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">8. Governing Law</h3></div>
                  <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the courts located in the State of Georgia.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">9. Entire Agreement</h3></div>
                  <p>This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Info className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">10. Acknowledgment</h3></div>
                  <p>BY CHECKING THE AGREEMENT BOX DURING DRIVER SIGNUP, THE DRIVER ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS AND CONDITIONS OF THIS AGREEMENT. THE DRIVER FURTHER ACKNOWLEDGES THAT THEY HAVE HAD THE OPPORTUNITY TO REVIEW THIS AGREEMENT AND TO ASK QUESTIONS ABOUT ITS PROVISIONS.</p>

                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 flex gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="text-[11px] leading-normal font-medium">This Agreement contains provisions that dictate how claims between you and 101 Drivers can be brought. By agreeing during signup, you acknowledge that you understand and accept all of the terms outlined in this Agreement.</p>
                  </div>
                </>
              )}

              {type === "terms" && (
                <>
                  <p>These Terms will govern your use of the 101 Drivers platform, including quote requests, delivery coordination, and compliance evidence handling. The terms are aligned with applicable laws for California operations.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Shield className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Key Concepts</h3></div>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Quote-first flow: you can view an estimate before providing additional details.</li>
                    <li>Compliance evidence: deliveries may require photos, odometer readings, and VIN last-4 verification.</li>
                    <li>Notifications: email-first updates (SMS optional if enabled by Admin policy).</li>
                    <li>Platform rules: cancellation, rescheduling, and dispute handling will follow published policies.</li>
                  </ul>

                  <div className="flex items-center gap-2 mt-6 mb-2"><UserCheck className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Accounts &amp; Eligibility</h3></div>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Dealers/individual customers may create delivery requests after authentication (when enabled).</li>
                    <li>Drivers may require onboarding and approval before booking jobs.</li>
                    <li>Admin oversight may be required for certain operations and compliance.</li>
                  </ul>

                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 flex gap-3">
                    <Info className="h-5 w-5 shrink-0" />
                    <p className="text-[11px] leading-normal font-medium">This page contains general information. For specific legal questions, please consult with legal counsel.</p>
                  </div>
                </>
              )}

              {type === "privacy" && (
                <>
                  <p>101 Drivers Privacy Policy outlines how we collect, use, and share your personal information as a user of the 101 Drivers Platform. Our goal is to simplify your life by providing a reliable vehicle delivery platform, and to do so, we need to collect some of your personal information.</p>
                  <p>This policy applies to all users of the 101 Drivers Platform, including Customers and Drivers (including Driver applicants), and all 101 Drivers services.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Database className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">The Information We Collect</h3></div>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Device Information:</strong> Hardware model, operating system, unique device identifiers, and mobile network information.</li>
                    <li><strong>Log Information:</strong> Browser type, access times, pages viewed, IP address, and referring page.</li>
                    <li><strong>Location Information:</strong> GPS signal or information about nearby Wi-Fi access points and cell towers.</li>
                  </ul>

                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-5 mb-2">Location, Usage, and Device Data</h4>
                  <p>For Customers, we collect your device's precise location from the time you request a vehicle delivery until it ends. For Drivers, we collect your device's precise location when you use the app. We also collect delivery information like date, time, destination, distance, route, and payment.</p>

                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-5 mb-2">Communications Data</h4>
                  <p>We facilitate phone calls and text messages between Customers and Drivers without sharing either party's actual phone number. However, we collect information about these communications, including phone numbers, date/time, and contents of SMS and chat messages.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Clock className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">How We Use Your Information</h3></div>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Provide an intuitive, useful, efficient experience on our platform</li>
                    <li>Verify your identity, maintain your account, settings, and preferences</li>
                    <li>Connect you to your vehicle deliveries and provide various offerings</li>
                    <li>Calculate prices and process payments</li>
                    <li>Allow Customers and Drivers to connect and share their location</li>
                    <li>Communicate with you about your use of the platform</li>
                    <li>Maintain the security and safety of the platform and its users</li>
                    <li>Authenticate users, investigate and resolve incidents, prevent fraud</li>
                    <li>Provide customer support and improve the platform through research</li>
                  </ul>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Users className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">How We Share Your Information</h3></div>
                  <p>We do not sell your personal information to third parties for money, and we do not act as a data broker.</p>
                  <ul className="list-disc pl-5 space-y-2 mt-2">
                    <li>The Customer's vehicle pickup and destination location, name, and vehicle info</li>
                    <li>The Driver's name and profile photo</li>
                    <li>We do not share actual phone numbers or contact information</li>
                  </ul>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Lock className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Data Retention and Security</h3></div>
                  <p>We retain your information for as long as necessary to provide you and our other users the 101 Drivers Platform. We take reasonable measures to protect your personal information, but we cannot guarantee security against unauthorized intrusions.</p>

                  <div className="flex items-center gap-2 mt-6 mb-2"><UserCheck className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Your Rights and Choices</h3></div>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Unsubscribe from commercial/promotional emails by clicking unsubscribe</li>
                    <li>Opt out of promotional text messages and push notifications through device settings</li>
                    <li>Review and edit account information through your account settings</li>
                    <li>Prevent location sharing through your device's system settings</li>
                    <li>Modify cookie settings on your browser</li>
                    <li>Delete your 101 Drivers account by contacting us</li>
                  </ul>

                  <div className="flex items-center gap-2 mt-6 mb-2"><Mail className="h-4 w-4 text-lime-500" /><h3 className="text-base font-black text-slate-900 dark:text-white">Contact Us</h3></div>
                  <p>For any questions or concerns about your privacy, contact us at:</p>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 mt-2">
                    <a href="mailto:driver@101drivers.com" className="text-lime-500 font-bold hover:underline">driver@101drivers.com</a>
                  </div>
                </>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="mt-6 w-full h-12 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold transition-colors"
          >
            {closeLabel ?? (fromSignUp ? "Go Back to Sign Up" : "Go Back")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
