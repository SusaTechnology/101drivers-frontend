// app/pages/admin-delivery/$deliveryId.tsx
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
  Calendar,
  Clock,
  Truck,
  CheckCircle,
  Gavel,
  ArrowLeftRight as SwapHoriz,
  Ban as Block,
  Edit,
  Receipt,
  GitBranch as Timeline,
  PiggyBank as Savings,
  Download,
  QrCode,
  Verified,
  Camera,
  ImagePlus as AddPhotoAlternate,
  Mail,
  MessageCircle as Sms,
  ArrowLeftRight as SwapIcon,
  ShieldCheck as AdminPanelSettings,
  Star,
  Info,
  AlertCircle,
  MapPin,
  Ruler as Distance,
  Tag,
  CreditCard as Payments,
  Save,
  Search,
  Filter,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  User,
  Building2,
  Phone,
  Mail as MailIcon,
  Globe,
  FileText,
  History,
  CalendarCheck as EventAvailable,
  Bolt,
  Truck as LocalShipping,
  CheckCircle as CheckCircleIcon,
  FileText as Assignment,
  Receipt as ReceiptLong,
  QrCode as QrCodeScanner,
  Camera as PhotoCamera,
  Clock as Schedule,
  ArrowLeftRight as SwapHorizIcon,
  Star as StarIcon,
  Home,
  MapPin as LocationOn,
  DollarSign as AttachMoney,
  CreditCard,
  StickyNote as Notes,
  Save as SaveIcon,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";

// Mock delivery data
const MOCK_DELIVERY = {
  id: "DLV-10293",
  status: "Booked",
  statusColor: "slate",
  pricingClass: "A",
  lastUpdate: "2h ago",
  pickupDate: "Feb 14, 2026",
  pickupTime: "10:00 AM",
  timeline: [
    {
      status: "Quoted",
      timestamp: "Feb 11, 2026 • 09:12 AM",
      icon: Bolt,
      completed: true,
    },
    {
      status: "Booked",
      timestamp: "Feb 11, 2026 • 09:45 AM",
      icon: EventAvailable,
      completed: true,
    },
    {
      status: "Active",
      timestamp: "Pending (starts when driver taps Start)",
      icon: LocalShipping,
      completed: false,
    },
    {
      status: "Completed",
      timestamp: "Pending",
      icon: CheckCircleIcon,
      completed: false,
    },
  ],
  route: {
    pickup: {
      city: "San Jose, CA",
      address: "1234 Example St, San Jose, CA 95112",
    },
    dropoff: {
      city: "Sacramento, CA",
      address: "987 Main Ave, Sacramento, CA 95814",
    },
    miles: "142",
    class: "A",
  },
  estimate: {
    total: 230.0,
    base: 185.0,
    coordination: 45.0,
    paymentStatus: "Authorized",
  },
  participants: {
    customer: {
      name: "Sarah Lee",
      email: "sarah@example.com",
      href: "/admin-user/customer-123",
    },
    dealer: {
      name: "Bay City Toyota",
      email: "dealer@baycitytoyota.com",
      href: "/admin-dealer/dealer-456",
    },
    driver: {
      name: "A. Johnson",
      email: "driver@101drivers.com",
      rating: 4.8,
      verified: true,
      href: "/admin-driver/driver-789",
    },
  },
  vehicle: {
    vinLast4: "7X19",
    verified: true,
    odometerStart: "54,120",
    odometerEnd: null,
  },
  photos: {
    pickup: {
      status: "Pending",
      color: "amber",
    },
    dropoff: {
      status: "Pending",
      color: "slate",
    },
  },
  assignmentHistory: [
    {
      action: "Assigned driver",
      timestamp: "Feb 11, 2026 • 09:46 AM",
      actor: "Admin",
      actorIcon: AdminPanelSettings,
    },
  ],
  notifications: [
    {
      type: "Booked confirmation",
      recipient: "customer + dealer",
      channel: "Email",
      timestamp: "09:46",
      icon: Mail,
    },
    {
      type: "Driver assignment",
      recipient: "driver",
      channel: "Email",
      timestamp: "09:47",
      icon: Mail,
    },
    {
      type: "SMS (optional)",
      recipient: null,
      channel: "Disabled by admin policy",
      timestamp: "—",
      icon: Sms,
      disabled: true,
    },
  ],
  service: {
    type: "Home delivery",
    pickupWindow: "Feb 14, 2026 • 10:00 AM – 12:00 PM",
  },
  internalNotes: "",
};

// Navigation items
const navItems = [
  { href: "/admin-dashboard", label: "Dashboard" },
  { href: "/admin-users", label: "Users" },
  { href: "/admin-deliveries", label: "Deliveries", active: true },
  { href: "/admin-pricing", label: "Pricing" },
  { href: "/admin-scheduling-policy", label: "Scheduling" },
  { href: "/admin-dispute-details", label: "Disputes" },
  { href: "/admin-payments", label: "Payments" },
  { href: "/admin-insurance-reporting", label: "Insurance" },
];

export default function AdminDeliveryDetailsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  //   const params = useParams({ from: "/admin-delivery/" });

  // Form for internal notes
  const notesForm = useForm({
    defaultValues: {
      internalNotes: MOCK_DELIVERY.internalNotes,
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

  const handleAssignDriver = () => {
    toast.info("Assign/Reassign driver", {
      description: "This action will open driver selection.",
    });
  };

  const handleOpenDispute = () => {
    toast.warning("Open dispute", {
      description: "Start dispute resolution process.",
    });
  };

  const handleForceCancel = () => {
    toast.error("Force cancel delivery", {
      description: "This action cannot be undone.",
    });
  };

  const handleChangeStatus = () => {
    toast.info("Change delivery status", {
      description: "Select new status from available transitions.",
    });
  };

  const handleSaveNotes = (data: any) => {
    toast.success("Internal notes saved");
    console.log("Notes saved:", data.internalNotes);
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
      primary: "bg-primary/10 border-primary/25 text-primary-foreground",
      slate:
        "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300",
      amber:
        "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200",
      emerald:
        "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200",
      rose: "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-200",
    };

    const statusIcons: Record<string, any> = {
      Booked: Calendar,
      Active: Truck,
      Completed: CheckCircle,
      Disputed: Gavel,
      Quoted: Bolt,
    };

    const StatusIcon = Icon || statusIcons[status] || Tag;

    return (
      <Badge
        variant="outline"
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border",
          colors[color] || colors.slate,
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {status}
      </Badge>
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
                  //   to={`/admin-delivery/${params.deliveryId}`}
                  className="block px-4 py-3 rounded-2xl text-sm font-semibold bg-primary/15 text-slate-900 dark:text-white border border-primary/25"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Delivery Details
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
        {/* Top bar */}
        <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin-deliveries"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Deliveries
              </Link>

              <span className="text-slate-300 dark:text-slate-700">•</span>

              <Badge
                variant="outline"
                className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <Tag className="w-3.5 h-3.5 text-primary mr-1" />
                {MOCK_DELIVERY.id}
              </Badge>

              <StatusBadge
                status={MOCK_DELIVERY.status}
                color={MOCK_DELIVERY.statusColor}
              />

              <Badge
                variant="outline"
                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Tag className="w-3.5 h-3.5 text-primary mr-1" />
                Pricing Class {MOCK_DELIVERY.pricingClass}
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Delivery details
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              PRD-aligned admin view: lifecycle, participants, compliance proofs
              (VIN last-4, photos, odometer), assignment/reassignment audit,
              notifications, disputes, and payments.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleAssignDriver}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition font-extrabold"
            >
              Assign / Reassign Driver
              <SwapHoriz className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleOpenDispute}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition font-extrabold"
            >
              Open Dispute
              <Gavel className="w-4 h-4 text-primary" />
            </Button>
            <Button
              onClick={handleForceCancel}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition font-extrabold"
            >
              Force Cancel
              <Block className="w-4 h-4" />
            </Button>
          </div>
        </section>

        {/* Main grid */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Lifecycle */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Lifecycle
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Statuses and timestamps (audit-friendly).
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <History className="w-3.5 h-3.5 text-primary mr-1" />
                    Last update: {MOCK_DELIVERY.lastUpdate}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Current status */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Current
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-primary" />
                        <div>
                          <div className="text-lg font-black text-slate-900 dark:text-white">
                            {MOCK_DELIVERY.status}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Pickup scheduled: {MOCK_DELIVERY.pickupDate} •{" "}
                            {MOCK_DELIVERY.pickupTime}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleChangeStatus}
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-primary/5"
                      >
                        Change status
                        <Edit className="w-4 h-4 text-primary ml-2" />
                      </Button>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Timeline
                    </div>
                    <ul className="mt-3 space-y-3">
                      {MOCK_DELIVERY.timeline.map((item, index) => (
                        <li
                          key={index}
                          className={cn(
                            "flex items-start gap-3",
                            !item.completed && "opacity-60",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "w-4 h-4 mt-0.5",
                              item.completed
                                ? "text-primary"
                                : "text-slate-400",
                            )}
                          />
                          <div className="min-w-0">
                            <div
                              className={cn(
                                "font-extrabold",
                                item.completed
                                  ? "text-slate-900 dark:text-white"
                                  : "text-slate-600 dark:text-slate-400",
                              )}
                            >
                              {item.status}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              {item.timestamp}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Mail className="w-3.5 h-3.5 text-primary mr-1" />
                    Email-first notifications
                  </Badge>
                  <Badge
                    variant="outline"
                    className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Assignment className="w-3.5 h-3.5 text-primary mr-1" />
                    Audit trail enabled
                  </Badge>
                  <Badge
                    variant="outline"
                    className="chip bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
                  >
                    <Info className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    Proofs required at pickup & drop-off
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Route & estimate */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Route & estimate
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Quote-first details (PRD).
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    View quote breakdown
                    <ReceiptLong className="w-4 h-4 text-primary ml-2" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Route */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Pickup
                    </div>
                    <div className="mt-2 font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DELIVERY.route.pickup.city}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {MOCK_DELIVERY.route.pickup.address}
                    </div>

                    <div className="mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Drop-off
                    </div>
                    <div className="mt-2 font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DELIVERY.route.dropoff.city}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {MOCK_DELIVERY.route.dropoff.address}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        <MapPin className="w-3.5 h-3.5 text-primary mr-1" />
                        {MOCK_DELIVERY.route.miles} miles
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        <Tag className="w-3.5 h-3.5 text-primary mr-1" />
                        Class {MOCK_DELIVERY.route.class}
                      </Badge>
                    </div>
                  </div>

                  {/* Estimate */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Estimate
                        </div>
                        <div className="mt-2 text-4xl font-black text-primary">
                          ${MOCK_DELIVERY.estimate.total.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                          Total estimate (prototype)
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Payment
                        </div>
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <Payments className="w-4 h-4 text-primary" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                            {MOCK_DELIVERY.estimate.paymentStatus}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          Capture on completion (policy)
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          Base Transportation
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          ${MOCK_DELIVERY.estimate.base.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          Coordination Fee
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          ${MOCK_DELIVERY.estimate.coordination.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row gap-2">
                      <Button className="flex-1 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90">
                        Payment events
                        <Timeline className="w-4 h-4 ml-2" />
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                      >
                        Refund / Adjust
                        <Savings className="w-4 h-4 text-primary ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Alert className="mt-5 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                    PRD: quote-first → then collect service type, scheduling
                    preferences, and contact details.
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                    Admin can view final details and payment events here.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Compliance proofs */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Compliance proofs
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      VIN last-4 + pickup/drop-off photos + odometer (PRD).
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    Download report
                    <Download className="w-4 h-4 text-primary ml-2" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* VIN / Odometer */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Vehicle verification
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                          >
                            <QrCode className="w-3.5 h-3.5 text-primary mr-1" />
                            VIN last-4:{" "}
                            <span className="font-black">
                              {MOCK_DELIVERY.vehicle.vinLast4}
                            </span>
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-primary/10 border-primary/25 text-primary-foreground"
                          >
                            <Verified className="w-3.5 h-3.5 mr-1" />
                            Verified
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-primary/5"
                      >
                        Edit
                        <Edit className="w-4 h-4 text-primary ml-2" />
                      </Button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Odometer start
                        </div>
                        <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                          {MOCK_DELIVERY.vehicle.odometerStart}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Recorded at pickup
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Odometer end
                        </div>
                        <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                          {MOCK_DELIVERY.vehicle.odometerEnd || "—"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Pending (on drop-off)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Photo placeholders */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Photos
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                            Pickup set
                          </div>
                          <StatusBadge
                            status={MOCK_DELIVERY.photos.pickup.status}
                            color={MOCK_DELIVERY.photos.pickup.color}
                            icon={Camera}
                          />
                        </div>
                        <div className="mt-3 h-24 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                          <AddPhotoAlternate className="w-8 h-8" />
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                        >
                          Upload / View
                          <ArrowRight className="w-4 h-4 text-primary ml-2" />
                        </Button>
                      </div>

                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                            Drop-off set
                          </div>
                          <StatusBadge
                            status={MOCK_DELIVERY.photos.dropoff.status}
                            color={MOCK_DELIVERY.photos.dropoff.color}
                            icon={Schedule}
                          />
                        </div>
                        <div className="mt-3 h-24 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                          <AddPhotoAlternate className="w-8 h-8" />
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                        >
                          Upload / View
                          <ArrowRight className="w-4 h-4 text-primary ml-2" />
                        </Button>
                      </div>
                    </div>

                    <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      PRD: proofs include required photos (pickup + drop-off),
                      odometer start/end photos, and VIN last-4 verification
                      evidence.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit & notifications */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Audit & notifications
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Assignment changes, status events, and message log (PRD).
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    View full audit
                    <Search className="w-4 h-4 text-primary ml-2" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Assignment history */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Assignment history
                    </div>
                    <ul className="mt-3 space-y-3">
                      {MOCK_DELIVERY.assignmentHistory.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <item.actorIcon className="w-4 h-4 text-primary mt-0.5" />
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {item.action}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                {item.timestamp}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                          >
                            <AdminPanelSettings className="w-3.5 h-3.5 text-primary mr-1" />
                            {item.actor}
                          </Badge>
                        </li>
                      ))}
                      <li className="flex items-start justify-between gap-3 opacity-60">
                        <div className="flex items-start gap-3">
                          <SwapHorizIcon className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <div className="font-extrabold text-slate-600 dark:text-slate-400">
                              Reassigned
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              None
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                        >
                          —
                        </Badge>
                      </li>
                    </ul>
                  </div>

                  {/* Notifications log */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Notifications log
                    </div>
                    <ul className="mt-3 space-y-3">
                      {MOCK_DELIVERY.notifications.map((item, index) => (
                        <li
                          key={index}
                          className={cn(
                            "flex items-start gap-3",
                            item.disabled && "opacity-60",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "w-4 h-4 mt-0.5",
                              item.disabled ? "text-slate-400" : "text-primary",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "font-extrabold",
                                item.disabled
                                  ? "text-slate-600 dark:text-slate-400"
                                  : "text-slate-900 dark:text-white",
                              )}
                            >
                              {item.type}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                              {item.recipient
                                ? `Sent to ${item.recipient} • ${item.channel}`
                                : item.channel}
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                            {item.timestamp}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Participants */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">
                    Participants
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Customer, dealer, driver, and contacts.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                {/* Customer */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Customer
                      </div>
                      <div className="mt-2 font-extrabold text-slate-900 dark:text-white">
                        {MOCK_DELIVERY.participants.customer.name}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {MOCK_DELIVERY.participants.customer.email}
                      </div>
                    </div>
                    <Link
                      to={MOCK_DELIVERY.participants.customer.href}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-primary/5 transition"
                    >
                      View
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </Link>
                  </div>
                </div>

                {/* Dealer */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Dealer
                      </div>
                      <div className="mt-2 font-extrabold text-slate-900 dark:text-white">
                        {MOCK_DELIVERY.participants.dealer.name}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {MOCK_DELIVERY.participants.dealer.email}
                      </div>
                    </div>
                    <Link
                      to={MOCK_DELIVERY.participants.dealer.href}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                    >
                      View
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </Link>
                  </div>
                </div>

                {/* Driver */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Driver
                      </div>
                      <div className="mt-2 font-extrabold text-slate-900 dark:text-white">
                        {MOCK_DELIVERY.participants.driver.name}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {MOCK_DELIVERY.participants.driver.email}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="bg-primary/10 border-primary/25 text-primary-foreground"
                        >
                          <Verified className="w-3.5 h-3.5 mr-1" />
                          Verified
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                        >
                          <Star className="w-3.5 h-3.5 text-primary mr-1" />
                          {MOCK_DELIVERY.participants.driver.rating}
                        </Badge>
                      </div>
                    </div>
                    <Link
                      to={MOCK_DELIVERY.participants.driver.href}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                    >
                      View
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service & scheduling */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">
                    Service & scheduling
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Service type, scheduling policy, and notes.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                {/* Service type */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Service type
                  </div>
                  <div className="mt-2 font-extrabold text-slate-900 dark:text-white">
                    {MOCK_DELIVERY.service.type}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    PRD options: Home Delivery / Between Locations / Service
                    Pickup & Return.
                  </p>
                </div>

                {/* Scheduling */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Scheduling
                  </div>
                  <div className="mt-2 font-extrabold text-slate-900 dark:text-white">
                    Pickup window
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {MOCK_DELIVERY.service.pickupWindow}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Policy
                    </span>
                    <Link
                      to="/admin-scheduling-policy"
                      className="text-sm font-extrabold text-primary hover:underline"
                    >
                      View policy
                    </Link>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Admin policy controls: service area (CA only), lead time
                    rules, SLA windows, and cancellation rules.
                  </div>
                </div>

                {/* Internal notes */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Internal notes
                  </div>
                  <Textarea
                    {...notesForm.register("internalNotes")}
                    className="mt-2 w-full min-h-[110px] rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 p-4 text-sm"
                    placeholder="Ops notes visible to Admin only (prototype)"
                  />
                  <Button
                    onClick={notesForm.handleSubmit(handleSaveNotes)}
                    className="mt-3 w-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition font-extrabold"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save notes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Dispute summary */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Dispute
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Open/close, evidence, resolution.
                    </CardDescription>
                  </div>
                  <Link
                    to="/admin-disputes"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                  >
                    View
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal font-medium">
                    No dispute opened yet. If an issue arises, Admin can open a
                    dispute, collect evidence, and track actions & outcomes
                    (PRD).
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* PRD note */}
        <section className="mt-6">
          <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              Prototype Note
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              This page is PRD-covering UI for Admin. The real app will wire
              status transitions, proofs uploads, payment events
              (auth/capture/refund), and assignment actions to API + audit log.
            </AlertDescription>
          </Alert>
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
                Admin Console • Delivery Operations
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
