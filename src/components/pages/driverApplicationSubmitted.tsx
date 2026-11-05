import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle,
  ArrowRight,
  Clock,
  Home,
  PauseCircle,
  AlertTriangle,
  User,
  FileCheck,
  ShieldCheck,
  LifeBuoy,
  Pencil,
} from "lucide-react";
import { getUser } from "@/lib/tanstack/dataQuery";
import {
  useWhatsAppSupportUrl,
  WhatsAppIcon,
} from "@/components/shared/WhatsAppSupportButton";

// ─── Driver status board (post-login home for EVERY driver status) ────
// Owner decision: all driver statuses land here after sign-in instead of
// the dashboard. The card is status-aware — it reads driverStatus (and
// the onboarding token) from the login payload persisted in localStorage.
// Anonymous visitors (the signup flow's "application submitted" step) get
// the original static screen, exactly as before.
type DriverBoardStatus =
  | "WAITLISTED"
  | "INVITED"
  | "PENDING"
  | "PENDING_APPROVAL"
  | "MEETING_REQUESTED"
  | "APPROVED"
  | "SUSPENDED"
  | "REJECTED"
  | "ON_HOLD"
  | null;

export function DriverApplicationSubmitted() {
  // Admin-configurable WhatsApp chat-support URL (falls back to a
  // constant while loading) — the suspended / rejected cards render it
  // as a second way to reach support.
  const whatsappSupportUrl = useWhatsAppSupportUrl();
  // One synchronous read per mount — the login payload is already in
  // localStorage; no API call on this page.
  const user = React.useMemo(() => getUser(), []);
  const driverStatus: DriverBoardStatus =
    (user?.driverStatus as DriverBoardStatus) ?? null;

  // ── Anonymous (or unknown status): original static screen, unchanged ──
  if (!driverStatus) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-2xl mx-auto pt-10">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg">
            <div className="relative bg-gradient-to-br from-lime-500/20 via-lime-500/10 to-transparent py-12 px-6 sm:px-10">
              <div className="relative flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime-400 to-lime-500 flex items-center justify-center shadow-lg shadow-lime-500/30">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  Thank You!
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 mt-3 max-w-md">
                  We have received your basic information and we'll contact you
                  when we need more drivers in your area. Thank you for your
                  interest.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Waitlisted
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 sm:p-10">
               <Link to="/" className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-2xl font-bold"
                  >
                    <Home className="w-5 h-5 mr-2" />
                    Back to Home
                  </Button>
                </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Logged-in driver: the real status board ───────────────────────────
  // One visual shell, per-status icon / title / copy / chip / action.
  const board: Record<
    Exclude<DriverBoardStatus, null>,
    {
      icon: React.ReactNode;
      iconWrap: string;
      title: string;
      copy: string;
      chip: string;
      chipWrap: string;
      chipIconColor: string;
      action?: { label: string; to: string; search?: { token: string } };
      whatsapp?: boolean;
    }
  > = {
    WAITLISTED: {
      icon: <Clock className="w-8 h-8 text-slate-500 dark:text-slate-400" />,
      iconWrap: "bg-slate-100 dark:bg-slate-800/50",
      title: "You're on the Waitlist",
      copy: "Your account has been created and is on the waitlist. An administrator will review your profile and invite you to complete your application when a spot opens up.",
      chip: "Waitlisted",
      chipWrap: "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
      chipIconColor: "text-slate-600 dark:text-slate-400",
    },
    INVITED: {
      icon: <CheckCircle className="w-8 h-8 text-sky-600 dark:text-sky-400" />,
      iconWrap: "bg-sky-100 dark:bg-sky-900/30",
      title: "You've Been Invited!",
      copy: "Congratulations! An administrator has invited you to complete your driver application. Continue where you left off — your license, photos and ID verification are the next steps.",
      chip: "Invited",
      chipWrap: "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800",
      chipIconColor: "text-sky-600 dark:text-sky-400",
      action: user?.onboardingToken
        ? {
            label: "Complete Your Application",
            // The TOP-LEVEL onboarding route: /driver/onboarding-complete
            // sits under the /driver layout whose DriverRouteGuard blocks
            // INVITED drivers with a dead-end "invited" card before the
            // page ever renders. This route is unguarded and renders the
            // form for the token directly.
            to: "/driver-onboarding-complete",
            search: { token: user.onboardingToken },
          }
        : undefined,
    },
    PENDING: {
      icon: <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
      iconWrap: "bg-amber-100 dark:bg-amber-900/30",
      title: "Application Under Review",
      copy: "Your application is complete and under review. We'll notify you by email once an administrator approves your application.",
      chip: "Under Review",
      chipWrap: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
      chipIconColor: "text-amber-600 dark:text-amber-400",
    },
    PENDING_APPROVAL: {
      icon: <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
      iconWrap: "bg-amber-100 dark:bg-amber-900/30",
      title: "Application Under Review",
      copy: "Your application is complete and under review. We'll notify you by email once an administrator approves your application.",
      chip: "Under Review",
      chipWrap: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
      chipIconColor: "text-amber-600 dark:text-amber-400",
    },
    MEETING_REQUESTED: {
      icon: <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
      iconWrap: "bg-amber-100 dark:bg-amber-900/30",
      title: "Application Under Review",
      copy: "Your application is in its final review and our team has reached out about scheduling a meeting. We'll notify you by email with the decision.",
      chip: "Under Review",
      chipWrap: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
      chipIconColor: "text-amber-600 dark:text-amber-400",
    },
    APPROVED: {
      icon: (
        <CheckCircle className="w-8 h-8 text-lime-600 dark:text-lime-400" />
      ),
      iconWrap: "bg-lime-100 dark:bg-lime-900/30",
      title: "You're Approved!",
      copy: "Your driver application has been approved. You're ready to pick up delivery requests — open your dashboard to get started.",
      chip: "Approved",
      chipWrap: "bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800",
      chipIconColor: "text-lime-600 dark:text-lime-400",
      action: { label: "Open Driver Dashboard", to: "/driver" },
    },
    ON_HOLD: {
      icon: (
        <PauseCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      ),
      iconWrap: "bg-amber-100 dark:bg-amber-900/30",
      title: "Application On Hold",
      copy: "Your application has been received and is complete — we've simply paused new activations in your area for now. Our team will reach out when we're ready to move forward; no action is needed from you in the meantime.",
      chip: "On Hold",
      chipWrap: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
      chipIconColor: "text-amber-600 dark:text-amber-400",
    },
    SUSPENDED: {
      icon: (
        <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
      ),
      iconWrap: "bg-rose-100 dark:bg-rose-900/30",
      title: "Account Suspended",
      copy: "Your driver account has been suspended. Please contact support for assistance.",
      chip: "Suspended",
      chipWrap: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
      chipIconColor: "text-rose-600 dark:text-rose-400",
      action: { label: "Contact Support", to: "/driver-issue-report" },
      whatsapp: true,
    },
    REJECTED: {
      icon: (
        <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
      ),
      iconWrap: "bg-rose-100 dark:bg-rose-900/30",
      title: "Application Not Approved",
      copy: "Your driver application was not approved. Please contact support for more information.",
      chip: "Not Approved",
      chipWrap: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
      chipIconColor: "text-rose-600 dark:text-rose-400",
      action: { label: "Contact Support", to: "/driver-issue-report" },
      whatsapp: true,
    },
  };

  const view = board[driverStatus];

  // ── Application checklist (dev instructions: "Checklist only for …") ──
  // Three honest rows derived from data that actually exists today:
  //   • Personal info  — collected at signup (name/email/phone/ZIP), so a
  //     signed-in driver always has it.
  //   • Driver's license — "uploaded" once onboarding is completed
  //     (user.onboardingCompleted from the login payload); before that it
  //     is waiting on the application form.
  //   • Background check — the backend has no background-check fields yet,
  //     so the only truthful state is "Not started"; it begins after
  //     approval (the onboarding-complete screen says the same).
  const onboardingCompleted = !!user?.onboardingCompleted;
  const checklist = [
    {
      Icon: User,
      label: "Personal info",
      state: "Submitted",
      done: true,
    },
    {
      Icon: FileCheck,
      label: "Driver's license",
      state: onboardingCompleted
        ? "Uploaded"
        : driverStatus === "INVITED"
          ? "Not uploaded yet"
          : "Not started yet",
      done: onboardingCompleted,
    },
    {
      Icon: ShieldCheck,
      label: "Background check",
      state: "Not started",
      done: false,
    },
  ];

  // Statuses whose driver may edit the submitted onboarding data (mirrors
  // the backend's ONBOARDING_EDITABLE_STATUSES — the edit page re-checks
  // server-side, this only decides whether to show the button).
  const EDITABLE_STATUSES = [
    "PENDING_APPROVAL",
    "MEETING_REQUESTED",
    "ON_HOLD",
    "REJECTED",
  ];
  const canEditApplication =
    onboardingCompleted && EDITABLE_STATUSES.includes(driverStatus);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto pt-10">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg">
          <div className="relative bg-gradient-to-br from-lime-500/20 via-lime-500/10 to-transparent py-12 px-6 sm:px-10">
            <div className="relative flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div
                  className={`w-24 h-24 rounded-full ${view.iconWrap} flex items-center justify-center shadow-lg`}
                >
                  {view.icon}
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                {view.title}
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mt-3 max-w-md">
                {view.copy}
              </p>
              <div
                className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border ${view.chipWrap}`}
              >
                <Clock className={`w-4 h-4 ${view.chipIconColor}`} />
                <span
                  className={`text-sm font-bold ${view.chipIconColor}`}
                >
                  {view.chip}
                </span>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10 space-y-3">
            {view.action && (
              <Link
                to={view.action.to}
                search={view.action.search as never}
                className="block"
              >
                <Button className="w-full h-12 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                  {view.action.label}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            )}
            {canEditApplication && (
              <Link to="/driver-onboarding-edit" className="block">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  <Pencil className="w-5 h-5 mr-2 text-slate-500 dark:text-slate-400" />
                  Edit Application Info
                </Button>
              </Link>
            )}
            {view.whatsapp && (
              <a
                href={whatsappSupportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  <WhatsAppIcon className="w-5 h-5 mr-2 text-[#25D366]" />
                  Chat on WhatsApp
                </Button>
              </a>
            )}
            {/* Support access on every status card (suspended / rejected
                already get the WhatsApp route above; this is the standard
                issue-report page for everything else). */}
            {!view.whatsapp && (
              <Link to="/driver-issue-report" className="block">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  <LifeBuoy className="w-5 h-5 mr-2 text-slate-500 dark:text-slate-400" />
                  Contact Support
                </Button>
              </Link>
            )}
            <Link to="/" className="flex-1">
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl font-bold"
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Application checklist card ────────────────────────────────
            Only for signed-in, non-approved drivers — APPROVED never
            renders this page (its beforeLoad redirects to the dashboard),
            so the guard is belt-and-braces. The checklist is informational:
            it never gates anything, and the license row says "Uploaded" only
            when the backend confirms onboardingCompleted. */}
        {driverStatus && driverStatus !== "APPROVED" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg mt-4">
            <div className="px-6 sm:px-10 pt-6 pb-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Application Checklist
              </p>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                Where your application stands
              </h3>
            </div>
            <div className="px-6 sm:px-10 pb-6 pt-2 space-y-1">
              {checklist.map(({ Icon, label, state, done }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 py-3 px-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                      done
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-slate-100 dark:bg-slate-800/60"
                    }`}
                  >
                    {done ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {label === "Background check" && !done
                        ? "Begins after your application is approved"
                        : `Status: ${state}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full border ${
                      done
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                        : "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
