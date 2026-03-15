// app/pages/admin-report-index.tsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Search,
  Filter,
  Download,
  FileText,
  SlidersHorizontal as Tune,
  Info,
  MapPin,
  Truck,
  CreditCard,
  Shield,
  Gavel,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  ExternalLink as OpenInNew,
  Sparkles,
  Activity,
  PieChart,
  LineChart,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  CalendarDays,
  Timer,
  Hourglass,
  DollarSign,
  Percent,
  Receipt,
  Tag,
  Hash,
  Building2,
  Phone,
  Mail,
  Home,
  Map,
  Globe,
  Layers,
  Target,
  Award,
  Zap,
  Flame,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  RefreshCw,
  Settings,
  Sliders,
  Scale,
  Flag,
  Ban,
  CheckCheck,
  FileSearch,
  FileText as FileTextIcon,
  MessageSquare,
  StickyNote as Note,
  History,
  CalendarX as EventBusy,
  BadgeCheck as FactCheck,
  BarChart3 as Insights,
  Receipt as ReceiptLong,
  Verified,
  Timer as TimerIcon,
  FileText as Summarize,
  Table as TableChart,
  ArrowRight,
  Download as DownloadIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Navbar } from "../shared/layout/testNavbar";
import { Brand } from "@/lib/items/brand";
import { navItems } from "@/lib/items/navItems";
import { useAdminActions } from "@/hooks/useAdminActions";

// Filter form schema
const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  dealer: z.string().optional(),
  serviceType: z.string().optional(),
  status: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

// Mock data
const MOCK_REPORTS_HUB = {
  kpis: [
    {
      title: "Deliveries",
      value: "1,248",
      subtitle: "Last 30 days",
      icon: Truck,
      trend: { value: "+6.2%", color: "green" },
      trendLabel: "vs previous 30 days",
    },
    {
      title: "Revenue",
      value: "$312,540",
      subtitle: "Captured (est.)",
      icon: DollarSign,
      note: "Includes base + coordination fee (prototype).",
    },
    {
      title: "Proof Completion",
      value: "96.1%",
      subtitle: "Compliance proofs",
      icon: FactCheck,
      note: "VIN last-4, photos, odometer start/end.",
    },
    {
      title: "Disputes",
      value: "14",
      subtitle: "Open",
      icon: Gavel,
      note: "Track reasons, SLA, and outcomes (PRD).",
    },
  ],

  reports: [
    {
      href: "/admin-report-deliveries",
      icon: Truck,
      title: "Deliveries",
      description:
        "Volume, completion rate, cancellations, avg miles & price, breakdown by dealer and region.",
      actionIcon: TableChart,
      actionLabel: "Drill-down table",
    },
    {
      href: "/admin-report-payments",
      icon: CreditCard,
      title: "Payments",
      description:
        "Captures, refunds, payouts, failed payments, fees and net revenue (PRD auditability).",
      actionIcon: ReceiptLong,
      actionLabel: "Payment events",
    },
    {
      href: "/admin-report-compliance",
      icon: FactCheck,
      title: "Compliance",
      description:
        "Proof completion %, missing proofs, late uploads, by driver/dealer/service type.",
      actionIcon: Verified,
      actionLabel: "Proof tracking",
    },
    {
      href: "/admin-report-disputes",
      icon: Gavel,
      title: "Disputes",
      description:
        "Open/closed counts, resolution time, reasons, outcomes, and financial impact.",
      actionIcon: TimerIcon,
      actionLabel: "SLA visibility",
    },
    {
      href: "/admin-insurance",
      icon: Shield,
      title: "Insurance & Risk",
      description:
        "Coverage status, incident counts, claim/report tracking and compliance correlation.",
      actionIcon: Summarize,
      actionLabel: "Oversight",
    },
    {
      href: "/admin-report-ops-summary",
      icon: Insights,
      title: "Operations Summary",
      description:
        "Scheduling performance, reassignment counts, no-shows, and policy exceptions (prototype).",
      actionIcon: EventBusy,
      actionLabel: "Exceptions",
    },
  ],

  recentActivity: [
    {
      time: "Today 09:12",
      action: "Export Payments Report",
      filters: "Last 30 days • All dealers",
      format: "CSV",
      formatIcon: Download,
      by: "admin@101drivers.com",
    },
    {
      time: "Yesterday 16:44",
      action: "Open Compliance Report",
      filters: "This month • Home Delivery",
      format: "View",
      formatIcon: OpenInNew,
      by: "ops@101drivers.com",
    },
    {
      time: "Yesterday 10:05",
      action: "Export Deliveries Report",
      filters: "Custom • Dealer: Sunset Motors",
      format: "PDF",
      formatIcon: FileText,
      by: "admin@101drivers.com",
    },
  ],

  dealers: [
    { value: "all", label: "All dealers" },
    { value: "Sunset Motors", label: "Sunset Motors" },
    { value: "Pacific Auto Group", label: "Pacific Auto Group" },
    { value: "Bayline Imports", label: "Bayline Imports" },
  ],

  serviceTypes: [
    { value: "all", label: "All" },
    { value: "Home Delivery", label: "Home Delivery" },
    { value: "Between Locations", label: "Between Locations" },
    { value: "Pickup & Return", label: "Pickup & Return" },
  ],

  statuses: [
    { value: "all", label: "All" },
    { value: "Draft", label: "Draft" },
    { value: "Quoted", label: "Quoted" },
    { value: "Listed", label: "Listed" },
    { value: "Booked", label: "Booked" },
    { value: "Active", label: "Active" },
    { value: "Completed", label: "Completed" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "Disputed", label: "Disputed" },
    { value: "Expired", label: "Expired" },
  ],
};

// Sidebar navigation items
const sidebarItems = [
  { href: "/admin-users", label: "Users", icon: Users },
  { href: "/admin-deliveries", label: "Deliveries", icon: Truck },
  { href: "/admin-pricing", label: "Pricing", icon: DollarSign },
  { href: "/admin-scheduling-policy", label: "Scheduling Policy", icon: Calendar },
  { href: "/admin-disputes", label: "Disputes", icon: Gavel },
  { href: "/admin-payments", label: "Payments", icon: CreditCard },
  { href: "/admin-insurance-reporting", label: "Insurance", icon: Shield },
  { href: "/admin-reports", label: "Reports", icon: BarChart3, active: true },
  { href: "/admin-config", label: "Config", icon: Settings },
];

export default function AdminReportsHubPage() {
  const { actionItems, signOut } = useAdminActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      fromDate: "",
      toDate: "",
      dealer: "all",
      serviceType: "all",
      status: "all",
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

  const handleApplyFilters = (data: FilterFormData) => {
    toast.success("Filters applied", {
      description: "Reports hub filtered.",
    });
    console.log("Filters:", data);
  };

  const handleResetFilters = () => {
    filterForm.reset({
      fromDate: "",
      toDate: "",
      dealer: "all",
      serviceType: "all",
      status: "all",
    });
    toast.info("Filters reset");
  };

  const handleExportCSV = () => {
    toast.success("Export started", {
      description: "CSV export will be downloaded.",
    });
  };

  const handleExportPDF = () => {
    toast.success("Export started", {
      description: "PDF export will be downloaded.",
    });
  };

  const handleRefresh = () => {
    toast.success("Refreshed", {
      description: "Recent activity updated.",
    });
  };

  // Sidebar component (shared)
  const Sidebar = ({ isMobile = false }) => (
    <aside
      className={cn(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 lg:p-5 h-fit",
        isMobile && "h-full overflow-y-auto pb-20",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          Navigation
        </div>
      </div>

      <nav className="mt-4 space-y-1.5">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition",
              item.active
                ? "bg-primary/15 text-slate-950 dark:text-white border border-primary/25"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800",
            )}
            onClick={() => isMobile && setMobileMenuOpen(false)}
          >
            <item.icon className="w-5 h-5 text-primary" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            PRD-aligned reporting hub. Export actions are placeholders for the
            production app.
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Top Bar */}
          <Navbar
            brand={<Brand />}
            items={navItems}
            actions={actionItems}
            onSignOut={signOut}
            title="Admin"
            />

      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "lg:hidden fixed z-50 top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto transition-transform duration-300",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">
            Admin Menu
          </div>
          <Button
            variant="outline"
            size="icon"
            className="w-11 h-11 rounded-2xl"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <Sidebar isMobile />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">


          {/* Main content */}
          <main className="lg:col-span-9 space-y-6">
            {/* Page Header */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 dark:text-white border border-primary/25 w-fit">
                      <BarChart3 className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Admin Reports
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Reporting Hub
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed max-w-2xl">
                      View delivery, payment, compliance and dispute analytics.
                      Exports are provided for operational review and
                      PRD-required oversight.
                    </CardDescription>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold"
                      >
                        <Mail className="w-3.5 h-3.5 text-primary mr-1" />
                        Email-first notifications
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold"
                      >
                        <FactCheck className="w-3.5 h-3.5 text-primary mr-1" />
                        Compliance proofs
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-primary mr-1" />
                        Payment auditability
                      </Badge>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="lg:w-[420px]">
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Filters
                        </div>
                        <Button
                          onClick={handleResetFilters}
                          variant="link"
                          className="text-xs font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                        >
                          Reset
                        </Button>
                      </div>

                      <form
                        onSubmit={filterForm.handleSubmit(handleApplyFilters)}
                      >
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              From
                            </Label>
                            <Input
                              type="date"
                              {...filterForm.register("fromDate")}
                              className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              To
                            </Label>
                            <Input
                              type="date"
                              {...filterForm.register("toDate")}
                              className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Dealer
                            </Label>
                            <Select
                              onValueChange={(value) =>
                                filterForm.setValue("dealer", value)
                              }
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All dealers" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_REPORTS_HUB.dealers.map((dealer) => (
                                  <SelectItem
                                    key={dealer.value}
                                    value={dealer.value}
                                  >
                                    {dealer.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Service
                            </Label>
                            <Select
                              onValueChange={(value) =>
                                filterForm.setValue("serviceType", value)
                              }
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_REPORTS_HUB.serviceTypes.map(
                                  (service) => (
                                    <SelectItem
                                      key={service.value}
                                      value={service.value}
                                    >
                                      {service.label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Status
                            </Label>
                            <Select
                              onValueChange={(value) =>
                                filterForm.setValue("status", value)
                              }
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_REPORTS_HUB.statuses.map((status) => (
                                  <SelectItem
                                    key={status.value}
                                    value={status.value}
                                  >
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                          <Button
                            type="submit"
                            className="flex-1 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-lg hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                          >
                            <Tune className="w-4 h-4" />
                            Apply
                          </Button>
                          <Button
                            type="button"
                            onClick={handleExportCSV}
                            variant="outline"
                            className="flex-1 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4 text-primary" />
                            Export CSV
                          </Button>
                          <Button
                            type="button"
                            onClick={handleExportPDF}
                            variant="outline"
                            className="flex-1 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-2"
                          >
                            <FileText className="w-4 h-4 text-primary" />
                            Export PDF
                          </Button>
                        </div>
                      </form>

                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Exports are prototypes here. In production, Admin
                        exports include audit metadata and filters used.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* KPI Row */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {MOCK_REPORTS_HUB.kpis.map((kpi, index) => (
                <Card
                  key={index}
                  className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          {kpi.title}
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                          {kpi.value}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                          {kpi.subtitle}
                        </div>
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                        <kpi.icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>

                    {kpi.trend && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-extrabold">
                        <Badge
                          variant="outline"
                          className={
                            kpi.trend.color === "green"
                              ? "chip-green"
                              : "chip-amber"
                          }
                        >
                          {kpi.trend.value === "+6.2%" ? (
                            <TrendingUp className="w-3.5 h-3.5 mr-1" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 mr-1" />
                          )}
                          {kpi.trend.value}
                        </Badge>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">
                          {kpi.trendLabel}
                        </span>
                      </div>
                    )}

                    {kpi.note && (
                      <div className="mt-4 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        {kpi.note}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>

            {/* Reports Grid */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black">
                      Reports
                    </CardTitle>
                    <CardDescription className="text-sm mt-2">
                      Open a report to explore trends, drill-down tables, and
                      export. (Prototype screens.)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        Filters apply globally
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {MOCK_REPORTS_HUB.reports.map((report) => (
                    <Link
                      key={report.href}
                      to={report.href}
                      className="group bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover-lift"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Report
                          </div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                            {report.title}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                            {report.description}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                          <report.icon className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">
                          <report.actionIcon className="w-4 h-4 text-primary" />
                          {report.actionLabel}
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Exports / Activity */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Recent Reporting Activity
                    </CardTitle>
                    <CardDescription className="text-sm mt-2">
                      Audit-friendly history (prototype table).
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm font-extrabold text-slate-700 dark:text-slate-200"
                  >
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950">
                      <TableRow>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Time
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Action
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Filters
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Format
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          By
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {MOCK_REPORTS_HUB.recentActivity.map(
                        (activity, index) => (
                          <TableRow
                            key={index}
                            className="hover:bg-primary/5 transition"
                          >
                            <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                              {activity.time}
                            </TableCell>
                            <TableCell className="px-5 py-4 font-extrabold text-slate-900 dark:text-white">
                              {activity.action}
                            </TableCell>
                            <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400">
                              {activity.filters}
                            </TableCell>
                            <TableCell className="px-5 py-4">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold",
                                  activity.format === "View"
                                    ? "bg-primary/10 border border-primary/25 text-slate-900 dark:text-white"
                                    : "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200",
                                )}
                              >
                                <activity.formatIcon
                                  className={cn(
                                    "w-3.5 h-3.5",
                                    activity.format === "View"
                                      ? "text-primary"
                                      : "text-primary",
                                  )}
                                />
                                {activity.format}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400">
                              {activity.by}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>

                <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  In production, this table is generated from audit logs and
                  includes export file IDs and retention policy.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Admin • Reporting • California-only operations
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
