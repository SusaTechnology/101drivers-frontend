// app/pages/admin-dispute/$disputeId.tsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowLeft,
  Gavel,
  AlertCircle,
  Download,
  RefreshCw as Sync,
  Group,
  UserPlus as PersonAdd,
  MailCheck as MarkEmailRead,
  ImagePlus as AddPhotoAlternate,
  Hourglass as HourglassTop,
  BadgeCheck as FactCheck,
  Camera as PhotoCamera,
  Image,
  ExternalLink as OpenInNew,
  GitBranch as Timeline,
  History,
  ArrowRight as ArrowForward,
  Info,
  BadgeDollarSign as Paid,
  Undo,
  FilePlus as NoteAdd,
  CheckCircle,
  X as Cancel,
  Mail as ContactMail,
  ArrowUp as ArrowUpward,
  Save,
  Paperclip as AttachFile,
  ChevronDown as ExpandMore,
  Play as PlayArrow,
  Flag,
  Locate as MyLocation,
  AlertTriangle as CarCrash,
  AlertCircle as PriorityHigh,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  // ChevronRight,
  // FileText,
  // User,
  // Building2,
  // Mail,
  // Star,
  // Verified,
  // QrCode,
  // Camera,
  // Receipt,
  // CreditCard,
  // Timer,
  // Route,
  // MapPin,
  // Clock,
  // DollarSign,
  // Tag,
  // Shield,
  // FileSearch,
  // Scale,
  // AlertTriangle,
  // CheckCheck,
  // XCircle,
  // Send,
  // Upload,
  // Link as LinkIcon,
  // Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Form schema for admin notes
const adminNotesSchema = z.object({
  notes: z.string().optional(),
});

type AdminNotesFormData = z.infer<typeof adminNotesSchema>;

// Mock dispute data
const MOCK_DISPUTE = {
  id: "DSP-100238",
  status: "Open",
  statusColor: "rose",
  type: "Damage claim",
  typeColor: "slate",
  priority: "Medium",
  priorityColor: "amber",

  linkedDelivery: {
    id: "DEL-90211",
    href: "/admin-delivery/DEL-90211",
    route: "San Jose → Los Angeles",
  },

  amount: {
    value: 350.0,
    description: "Estimated repair",
  },

  evidenceCount: 9,
  evidenceDescription: "Photos + odometer + VIN + events",

  parties: {
    raisedBy: {
      role: "Customer",
      name: "Olivia R.",
      email: "olivia@example.com",
    },
    driver: {
      id: "D-00192",
      name: "Marcus T.",
      status: "Active",
      rating: 4.9,
    },
    dealer: {
      name: "Tesla SJ",
      status: "Approved",
      email: "operations@teslasj.example",
    },
    adminOwner: {
      id: "A-00012",
      name: "Admin Queue",
      assigned: "Feb 10, 2026 14:22",
    },
  },

  claim: {
    summary: "Scratch on rear bumper at drop-off",
    reportedAt: "Reported at completion",
    outcome: "Refund / reimbursement",
    amount: 350.0,
    statement:
      "At drop-off, we noticed a fresh scratch on the rear bumper that wasn't present at pickup. Photos are attached. Please review and advise on reimbursement.",
  },

  evidence: {
    vin: {
      value: "4F2A",
      status: "Verified by driver",
    },
    odometer: {
      start: "12,240",
      end: "12,386",
      delta: 146,
    },
    photos: {
      pickup: { count: 4, color: "primary" },
      dropoff: { count: 5, color: "primary" },
    },
    eventLog: { count: 18, color: "primary" },
  },

  payments: {
    captured: {
      amount: 230.0,
      id: "CAP-7A21",
    },
    deposit: {
      amount: 0.0,
      status: "none",
    },
  },

  timeline: [
    {
      icon: Gavel,
      title: "Dispute opened",
      timestamp: "Feb 10, 2026 14:22",
      actor: "by Customer",
      description: "Customer submitted claim with drop-off photos.",
      color: "rose",
    },
    {
      icon: Flag,
      title: "Delivery completed",
      timestamp: "Feb 10, 2026 12:58",
      actor: "Driver marked complete",
      description: "Drop-off photos + odometer end submitted.",
      color: "slate",
    },
    {
      icon: PlayArrow,
      title: "Trip started",
      timestamp: "Feb 10, 2026 07:12",
      actor: "Tracking started",
      description: "Driver started trip; location updates recorded.",
      color: "slate",
    },
    {
      icon: MyLocation,
      title: "Pickup verified",
      timestamp: "Feb 10, 2026 06:40",
      actor: "VIN last-4 verified",
      description: "Pickup photos + odometer start submitted.",
      color: "slate",
    },
  ],
};

// Navigation items
const navItems = [
  { href: "/admin-dashboard", label: "Dashboard" },
  { href: "/admin-users", label: "Users" },
  { href: "/admin-deliveries", label: "Deliveries" },
  { href: "/admin-pricing", label: "Pricing" },
  { href: "/admin-scheduling-policy", label: "Scheduling" },
  { href: "/admin-disputes", label: "Disputes", active: true },
  { href: "/admin-payments", label: "Payments" },
  { href: "/admin-insurance-reporting", label: "Insurance" },
];

export default function AdminDisputeDetailsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  //   const params = useParams({ from: "/admin-dispute/$disputeId" });

  // Form for admin notes
  const notesForm = useForm<AdminNotesFormData>({
    resolver: zodResolver(adminNotesSchema),
    defaultValues: {
      notes: "",
    },
  });

  // Theme handling
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mobile menu handling
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
    toast.success(`${theme === "dark" ? "Light" : "Dark"} mode activated`);
  };

  const handleSignOut = () => {
    toast.success("Signed out successfully");
    navigate({ to: "/auth/admin-signin" });
  };

  // Action handlers
  const handleDownloadPacket = () => {
    toast.success("Download started", {
      description: "Dispute packet is being generated.",
    });
  };

  const handleUpdateStatus = () => {
    toast.info("Update status", {
      description: "Select new status for this dispute.",
    });
  };

  const handleNotifyParties = () => {
    toast.success("Email sent", {
      description: "Notification sent to all parties.",
    });
  };

  const handleAssignOwner = () => {
    toast.info("Assign owner", {
      description: "Select admin to assign this dispute.",
    });
  };

  const handleRequestEvidence = () => {
    toast.info("Request evidence", {
      description: "Request additional evidence from parties.",
    });
  };

  const handleMarkInReview = () => {
    toast.success("Status updated", {
      description: "Dispute marked as in review.",
    });
  };

  const handlePartialRefund = () => {
    toast.info("Partial refund", {
      description: "Process partial refund for this dispute.",
    });
  };

  const handleFullRefund = () => {
    toast.info("Full refund", {
      description: "Process full refund for this dispute.",
    });
  };

  const handleAddCreditNote = () => {
    toast.info("Credit note", {
      description: "Add admin credit note.",
    });
  };

  const handleApproveClaim = () => {
    toast.success("Claim approved", {
      description: "Dispute resolved in favor of customer.",
    });
  };

  const handleDenyClaim = () => {
    toast.error("Claim denied", {
      description: "Dispute resolved in favor of driver.",
    });
  };

  const handleRequestDriverStatement = () => {
    toast.info("Request sent", {
      description: "Driver statement requested.",
    });
  };

  const handleEscalate = () => {
    toast.warning("Escalated", {
      description: "Dispute escalated to supervisor.",
    });
  };

  const handleSaveNote = (data: AdminNotesFormData) => {
    toast.success("Note saved", {
      description: "Admin note has been saved.",
    });
    console.log("Note saved:", data.notes);
  };

  const handleAddAttachment = () => {
    toast.info("Add attachment", {
      description: "Upload file attachment.",
    });
  };

  const handleLoadMoreEvents = () => {
    toast.info("Loading events", {
      description: "Fetching more timeline events.",
    });
  };

  // Status badge component
  const StatusBadge = ({
    status,
    color = "slate",
    icon: Icon,
  }: {
    status: string;
    color?: string;
    icon?: any;
  }) => {
    const colors: Record<string, string> = {
      rose: "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200",
      amber:
        "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200",
      slate:
        "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200",
      primary: "bg-primary/10 border-primary/25 text-primary-foreground",
      indigo:
        "bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200",
    };

    const StatusIcon = Icon || Gavel;

    return (
      <Badge
        variant="outline"
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border",
          colors[color] || colors.slate,
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  };

  // Timeline step component
  const TimelineStep = ({
    icon: Icon,
    title,
    timestamp,
    actor,
    description,
    color = "slate",
  }: any) => {
    const colors: Record<string, string> = {
      rose: "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-300",
      slate:
        "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300",
    };

    return (
      <div className="flex gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center border",
            colors[color] || colors.slate,
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {timestamp} • {actor}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-2">
            {description}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-7">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "text-sm font-semibold hover:text-primary transition-colors",
                    item.active
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <Button
              variant="outline"
              size="icon"
              className="w-11 h-11 rounded-2xl"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            <Button
              onClick={handleSignOut}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-11 h-11 rounded-2xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 z-50 md:hidden overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200">
                    <img
                      src="/assets/101drivers-logo.jpg"
                      alt="101 Drivers"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Admin
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 rounded-2xl"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "block px-4 py-3 rounded-2xl text-sm font-semibold transition-colors",
                      item.active
                        ? "bg-primary/15 text-slate-900 dark:text-white border border-primary/25"
                        : "text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  //   to={`/admin-dispute/${params.disputeId}`}
                  className="block px-4 py-3 rounded-2xl text-sm font-semibold bg-primary/15 text-slate-900 dark:text-white border border-primary/25"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dispute Details
                </Link>
              </div>

              <Separator className="my-6" />

              <Button
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Sign Out
                <LogOut className="w-4 h-4 text-primary" />
              </Button>
            </div>
          </>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Breadcrumb + Top actions */}
        <section className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin-disputes"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/5 transition"
              >
                <ArrowLeft className="w-4 h-4 text-primary" />
                Back to Disputes
              </Link>

              <Badge
                variant="outline"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200"
              >
                <Gavel className="w-4 h-4 text-rose-500" />
                {MOCK_DISPUTE.id}
              </Badge>

              <StatusBadge
                status={MOCK_DISPUTE.status}
                color={MOCK_DISPUTE.statusColor}
                icon={AlertCircle}
              />

              <StatusBadge
                status={MOCK_DISPUTE.type}
                color={MOCK_DISPUTE.typeColor}
                icon={CarCrash}
              />

              <StatusBadge
                status={`Priority: ${MOCK_DISPUTE.priority}`}
                color={MOCK_DISPUTE.priorityColor}
                icon={PriorityHigh}
              />
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Dispute Details
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Review parties, delivery evidence, payments, and event timeline.
              Resolve by approving/denying claim, requesting evidence, or
              applying adjustments.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleDownloadPacket}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <Download className="w-4 h-4 text-primary" />
              Download packet
            </Button>
            <Button
              onClick={handleUpdateStatus}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              <Sync className="w-4 h-4" />
              Update status
            </Button>
          </div>
        </section>

        {/* Summary KPIs */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <CardContent className="p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Linked delivery
              </div>
              <div className="mt-2 text-xl font-black">
                <Link
                  to={MOCK_DISPUTE.linkedDelivery.href}
                  className="text-slate-900 dark:text-white hover:text-primary transition-colors"
                >
                  {MOCK_DISPUTE.linkedDelivery.id}
                </Link>
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                {MOCK_DISPUTE.linkedDelivery.route}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <CardContent className="p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Amount in question
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                ${MOCK_DISPUTE.amount.value.toFixed(2)}
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                {MOCK_DISPUTE.amount.description}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <CardContent className="p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Evidence items
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                {MOCK_DISPUTE.evidenceCount}
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                {MOCK_DISPUTE.evidenceDescription}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Core details */}
          <div className="lg:col-span-7 space-y-6">
            {/* Parties */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Parties
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Who raised the dispute and who is involved.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="tag bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Group className="w-3.5 h-3.5 text-primary mr-1" />
                    Stakeholders
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Raised by
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DISPUTE.parties.raisedBy.role} •{" "}
                      {MOCK_DISPUTE.parties.raisedBy.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Email: {MOCK_DISPUTE.parties.raisedBy.email}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Driver
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DISPUTE.parties.driver.id} •{" "}
                      {MOCK_DISPUTE.parties.driver.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Status: {MOCK_DISPUTE.parties.driver.status} • Rating:{" "}
                      {MOCK_DISPUTE.parties.driver.rating}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Dealer
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DISPUTE.parties.dealer.name} (
                      {MOCK_DISPUTE.parties.dealer.status})
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Contact: {MOCK_DISPUTE.parties.dealer.email}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Admin owner
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DISPUTE.parties.adminOwner.id} •{" "}
                      {MOCK_DISPUTE.parties.adminOwner.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Assigned: {MOCK_DISPUTE.parties.adminOwner.assigned}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleNotifyParties}
                    variant="outline"
                    className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    <MarkEmailRead className="w-4 h-4 text-primary mr-2" />
                    Notify parties (email)
                  </Button>
                  <Button
                    onClick={handleAssignOwner}
                    className="flex-1 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                  >
                    <PersonAdd className="w-4 h-4 mr-2" />
                    Assign owner
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Claim details */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Claim</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Reason, narrative, and requested outcome.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="tag bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200"
                  >
                    <Gavel className="w-3.5 h-3.5 text-rose-500 mr-1" />
                    {MOCK_DISPUTE.type}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Summary
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DISPUTE.claim.summary}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {MOCK_DISPUTE.claim.reportedAt}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Requested outcome
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DISPUTE.claim.outcome}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Amount requested: ${MOCK_DISPUTE.claim.amount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Customer statement
                  </div>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    “{MOCK_DISPUTE.claim.statement}”
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleRequestEvidence}
                    className="flex-1 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                  >
                    <AddPhotoAlternate className="w-4 h-4 mr-2" />
                    Request additional evidence
                  </Button>
                  <Button
                    onClick={handleMarkInReview}
                    variant="outline"
                    className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    <HourglassTop className="w-4 h-4 text-primary mr-2" />
                    Mark as in review
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Evidence */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Evidence
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Delivery proofs supporting investigation (photos, VIN
                      last-4, odometer, tracking events).
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="tag bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <FactCheck className="w-3.5 h-3.5 text-primary mr-1" />
                    Proofs
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      VIN last-4 (pickup)
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      … {MOCK_DISPUTE.evidence.vin.value}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {MOCK_DISPUTE.evidence.vin.status}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Odometer
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      Start: {MOCK_DISPUTE.evidence.odometer.start} • End:{" "}
                      {MOCK_DISPUTE.evidence.odometer.end}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Delta: {MOCK_DISPUTE.evidence.odometer.delta} miles
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Pickup Photos */}
                  <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        Pickup Photos
                      </div>
                      <StatusBadge
                        status={MOCK_DISPUTE.evidence.photos.pickup.count.toString()}
                        color="slate"
                        icon={PhotoCamera}
                      />
                    </div>
                    <div className="mt-3 h-28 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-50 dark:from-slate-800 dark:to-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                      <Image className="w-8 h-8 text-slate-400" />
                    </div>
                    <Button
                      variant="outline"
                      className="mt-3 w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <OpenInNew className="w-4 h-4 text-primary mr-2" />
                      View
                    </Button>
                  </div>

                  {/* Drop-off Photos */}
                  <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        Drop-off Photos
                      </div>
                      <StatusBadge
                        status={MOCK_DISPUTE.evidence.photos.dropoff.count.toString()}
                        color="slate"
                        icon={PhotoCamera}
                      />
                    </div>
                    <div className="mt-3 h-28 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-50 dark:from-slate-800 dark:to-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                      <Image className="w-8 h-8 text-slate-400" />
                    </div>
                    <Button
                      variant="outline"
                      className="mt-3 w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <OpenInNew className="w-4 h-4 text-primary mr-2" />
                      View
                    </Button>
                  </div>

                  {/* Event Log */}
                  <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        Event Log
                      </div>
                      <StatusBadge
                        status={MOCK_DISPUTE.evidence.eventLog.count.toString()}
                        color="slate"
                        icon={Timeline}
                      />
                    </div>
                    <div className="mt-3 h-28 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-50 dark:from-slate-800 dark:to-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                      <History className="w-8 h-8 text-slate-400" />
                    </div>
                    <Button
                      variant="outline"
                      className="mt-3 w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <ArrowForward className="w-4 h-4 text-primary mr-2" />
                      Open timeline
                    </Button>
                  </div>
                </div>

                <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                    Evidence Requirements
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                    Delivery proofs are the default evidence set. Admin can
                    request more photos/docs and record audit notes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          {/* Right: Payments + Timeline + Resolution */}
          <div className="lg:col-span-5 space-y-6">
            {/* Payment + Refund controls */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Payments
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Authorization/capture and adjustments.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="tag bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200"
                  >
                    <Paid className="w-3.5 h-3.5 text-indigo-500 mr-1" />
                    Stripe
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Amount captured
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      ${MOCK_DISPUTE.payments.captured.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Capture ID: {MOCK_DISPUTE.payments.captured.id}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Deposit / hold
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      ${MOCK_DISPUTE.payments.deposit.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Auth: {MOCK_DISPUTE.payments.deposit.status}
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Adjustment actions
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={handlePartialRefund}
                      variant="outline"
                      className="py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <Undo className="w-4 h-4 text-primary mr-2" />
                      Partial refund
                    </Button>
                    <Button
                      onClick={handleFullRefund}
                      variant="outline"
                      className="py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <Undo className="w-4 h-4 text-primary mr-2" />
                      Full refund
                    </Button>
                  </div>

                  <Button
                    onClick={handleAddCreditNote}
                    className="w-full py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                  >
                    <NoteAdd className="w-4 h-4 mr-2" />
                    Add admin credit note
                  </Button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Payment events and adjustments are recorded as
                  immutable events with audit metadata.
                </p>
              </CardContent>
            </Card>

            {/* Resolution */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Resolution
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Record decisions and keep an audit trail.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="tag bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-primary mr-1" />
                    Admin actions
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={handleApproveClaim}
                    className="py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve claim
                  </Button>
                  <Button
                    onClick={handleDenyClaim}
                    variant="outline"
                    className="py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    <Cancel className="w-4 h-4 text-primary mr-2" />
                    Deny claim
                  </Button>
                </div>

                <Button
                  onClick={handleRequestDriverStatement}
                  variant="outline"
                  className="w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                >
                  <ContactMail className="w-4 h-4 text-primary mr-2" />
                  Request driver statement
                </Button>

                <Button
                  onClick={handleEscalate}
                  variant="outline"
                  className="w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                >
                  <ArrowUpward className="w-4 h-4 text-primary mr-2" />
                  Escalate to supervisor
                </Button>

                {/* Admin notes */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                    Admin notes
                  </Label>
                  <Textarea
                    {...notesForm.register("notes")}
                    className="w-full min-h-[110px] rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 p-4 text-sm"
                    placeholder="Write decision notes, policy references, and reasoning…"
                  />
                  <div className="mt-3 flex gap-3">
                    <Button
                      onClick={notesForm.handleSubmit(handleSaveNote)}
                      className="flex-1 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save note
                    </Button>
                    <Button
                      onClick={handleAddAttachment}
                      variant="outline"
                      className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <AttachFile className="w-4 h-4 text-primary mr-2" />
                      Add attachment
                    </Button>
                  </div>
                </div>

                <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                    Audit Requirements
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                    All dispute actions must be auditable (who, when, what
                    changed). Notifications are email-first; SMS optional
                    by policy.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Timeline
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Combined dispute + delivery events.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="tag bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Timeline className="w-3.5 h-3.5 text-primary mr-1" />
                    Events
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-5">
                {MOCK_DISPUTE.timeline.map((event, index) => (
                  <React.Fragment key={index}>
                    <TimelineStep {...event} />
                    {index < MOCK_DISPUTE.timeline.length - 1 && (
                      <Separator className="bg-slate-100 dark:bg-slate-800" />
                    )}
                  </React.Fragment>
                ))}

                <Button
                  onClick={handleLoadMoreEvents}
                  variant="outline"
                  className="w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                >
                  <ExpandMore className="w-4 h-4 text-primary mr-2" />
                  Load more events
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
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
                Admin Console • Dispute Details
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
