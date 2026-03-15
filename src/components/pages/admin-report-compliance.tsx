// app/pages/admin-reports/compliance.tsx
import React, { useState, useEffect, useMemo } from "react";
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
  FileSpreadsheet,
  SlidersHorizontal as Tune,
  Info,
  Verified,
  MapPin,
  QrCode,
  Camera,
  Gauge as Speed,
  Route,
  Check as Checklist,
  AlertCircle,
  AlertTriangle,
  AlertTriangle as Warning,
  Eye,
  ExternalLink as OpenInNew,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Shield,
  Gavel,
  CreditCard,
  Truck,
  //   Users,
  //   DollarSign,
  //   Receipt,
  //   Clock,
  //   CheckCircle,
  //   XCircle,
  //   ExternalLink,
  //   Sparkles,
  //   Activity,
  //   PieChart,
  //   LineChart,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

// Filter form schema
const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  exceptionType: z.string().optional(),
  severity: z.string().optional(),
  search: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

// Mock data
const MOCK_COMPLIANCE = {
  metrics: [
    {
      name: "VIN last-4 verification",
      value: 96,
      description: "Missing VIN is a critical exception for most policy sets.",
    },
    { name: "Pickup photos", value: 92, description: "" },
    { name: "Drop-off photos", value: 90, description: "" },
    { name: "Odometer start/end (photo)", value: 88, description: "" },
    { name: "Start/Stop tracking", value: 94, description: "" },
    { name: "Checklist completion", value: 91, description: "" },
  ],

  exceptions: [
    {
      title: "Tracking gap",
      severity: "High",
      severityColor: "amber",
      count: 18,
      description:
        "Start/stop missing or discontinuous GPS event stream (policy-driven threshold).",
    },
    {
      title: "Missing odometer end photo",
      severity: "Medium",
      severityColor: "amber",
      count: 12,
      description: "",
    },
    {
      title: "Missing VIN last-4",
      severity: "Critical",
      severityColor: "rose",
      count: 6,
      description:
        "Requires immediate remediation or escalation depending on dealer policy.",
    },
  ],

  exceptionsList: [
    {
      deliveryId: "DLV-10477",
      route: "Los Angeles → San Diego",
      dealer: "Sunset Motors",
      driver: "A. Ramirez",
      issue: "Tracking gap",
      issueIcon: Route,
      severity: "High",
      severityColor: "amber",
      lastUpdated: "Today 08:02",
    },
    {
      deliveryId: "DLV-10431",
      route: "Sacramento → Oakland",
      dealer: "Pacific Auto Group",
      driver: "K. Nguyen",
      issue: "Missing odometer end photo",
      issueIcon: Speed,
      severity: "Medium",
      severityColor: "amber",
      lastUpdated: "Yesterday 17:40",
    },
    {
      deliveryId: "DLV-10305",
      route: "Fresno → San Jose",
      dealer: "Bayline Imports",
      driver: "J. Patel",
      issue: "Missing VIN last-4",
      issueIcon: QrCode,
      severity: "Critical",
      severityColor: "rose",
      lastUpdated: "2 days ago",
    },
  ],
};

// Sidebar navigation items
const sidebarItems = [
  { href: "/admin-report-deliveries", label: "Deliveries", icon: Truck },
  { href: "/admin-report-payments", label: "Payments", icon: CreditCard },
  {
    href: "/admin-report-compliance",
    label: "Compliance",
    icon: Verified,
    active: true,
  },
  { href: "/admin-disputes", label: "Disputes", icon: Gavel },
  { href: "/admin-insurance", label: "Insurance & Risk", icon: Shield },
  { href: "/admin-reports-ops-summary", label: "Ops Summary", icon: BarChart3 },
];

export default function AdminComplianceReportPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      fromDate: "",
      toDate: "",
      exceptionType: "",
      severity: "",
      search: "",
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
      description: "Compliance report filtered.",
    });
    console.log("Filters:", data);
  };

  const handleResetFilters = () => {
    filterForm.reset({
      fromDate: "",
      toDate: "",
      exceptionType: "",
      severity: "",
      search: "",
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
      description: "PDF report will be generated.",
    });
  };

  // Filtered exceptions based on search
  const filteredExceptions = useMemo(() => {
    const searchTerm = filterForm.watch("search")?.toLowerCase() || "";
    if (!searchTerm) return MOCK_COMPLIANCE.exceptionsList;

    return MOCK_COMPLIANCE.exceptionsList.filter(
      (item) =>
        item.deliveryId.toLowerCase().includes(searchTerm) ||
        item.dealer.toLowerCase().includes(searchTerm) ||
        item.driver.toLowerCase().includes(searchTerm) ||
        item.issue.toLowerCase().includes(searchTerm),
    );
  }, [filterForm.watch("search")]);

  // Severity badge component
  const SeverityBadge = ({
    severity,
    color,
  }: {
    severity: string;
    color: string;
  }) => {
    const colors: Record<string, string> = {
      amber: "chip-amber",
      rose: "chip-rose",
      gray: "chip-gray",
    };

    const icons: Record<string, any> = {
      High: AlertTriangle,
      Medium: AlertCircle,
      Low: Info,
      Critical: AlertCircle,
    };

    const Icon = icons[severity] || AlertCircle;

    return (
      <Badge variant="outline" className={colors[color] || "chip-gray"}>
        <Icon className="w-3.5 h-3.5 mr-1" />
        {severity}
      </Badge>
    );
  };

  // Issue badge component
  const IssueBadge = ({ issue, icon: Icon }: { issue: string; icon: any }) => (
    <Badge variant="outline" className="chip-gray">
      <Icon className="w-3.5 h-3.5 text-primary mr-1" />
      {issue}
    </Badge>
  );

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
          Reports
        </div>
        <Link
          to="/admin-reports"
          className="text-xs font-extrabold text-primary hover:opacity-90 transition"
        >
          All
        </Link>
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

        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <Link
            to="/admin-reports"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
          >
            <BarChart3 className="w-5 h-5 text-primary" />
            Reporting Hub
          </Link>
        </div>
      </nav>

      <div className="mt-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            PRD: compliance includes VIN last-4, pickup/drop photos, odometer
            start/end (with photos), start/stop tracking, and checklists.
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden w-11 h-11 rounded-2xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <Link
              to="/admin-reports"
              className="flex items-center gap-3"
              aria-label="101 Drivers Admin"
            >
              <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Admin
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Compliance Report
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                California Only
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
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

            <Link
              to="/admin-reports"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-extrabold text-slate-700 dark:text-slate-200"
            >
              <ChevronLeft className="w-4 h-4 text-primary" />
              Back to Reports
            </Link>

            <Button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

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
            Reports
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
          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:col-span-3">
            <Sidebar />
          </div>

          {/* Main content */}
          <main className="lg:col-span-9 space-y-6">
            {/* Header + Filters */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 dark:text-white border border-primary/25 w-fit">
                      <Verified className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Compliance Report
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Evidence completeness & exceptions
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Monitor required proofs: VIN last-4 verification,
                      pickup/drop photos, odometer start/end photos, start/stop
                      tracking, and checklist completion.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <QrCode className="w-3.5 h-3.5 text-primary mr-1" />
                        VIN last-4
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Camera className="w-3.5 h-3.5 text-primary mr-1" />
                        Photos
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Speed className="w-3.5 h-3.5 text-primary mr-1" />
                        Odometer
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Route className="w-3.5 h-3.5 text-primary mr-1" />
                        Start/Stop tracking
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Checklist className="w-3.5 h-3.5 text-primary mr-1" />
                        Checklist
                      </Badge>
                    </div>
                  </div>

                  <div className="xl:w-[560px]">
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

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Exception Type
                            </Label>
                            <Select
                              onValueChange={(value) =>
                                filterForm.setValue("exceptionType", value)
                              }
                              defaultValue=""
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Missing VIN last-4">
                                  Missing VIN last-4
                                </SelectItem>
                                <SelectItem value="Missing pickup photos">
                                  Missing pickup photos
                                </SelectItem>
                                <SelectItem value="Missing drop-off photos">
                                  Missing drop-off photos
                                </SelectItem>
                                <SelectItem value="Missing odometer start photo">
                                  Missing odometer start photo
                                </SelectItem>
                                <SelectItem value="Missing odometer end photo">
                                  Missing odometer end photo
                                </SelectItem>
                                <SelectItem value="Tracking gap">
                                  Tracking gap
                                </SelectItem>
                                <SelectItem value="Checklist incomplete">
                                  Checklist incomplete
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Severity
                            </Label>
                            <Select
                              onValueChange={(value) =>
                                filterForm.setValue("severity", value)
                              }
                              defaultValue=""
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Critical">
                                  Critical
                                </SelectItem>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Search
                            </Label>
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input
                                {...filterForm.register("search")}
                                className="h-12 w-full pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                                placeholder="Delivery ID, Driver, Dealer..."
                              />
                            </div>
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
                        Compliance reports are placeholders. Production shows
                        the exact proof set per service type and policy.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* KPI / Completion */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <Card className="xl:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">
                        Evidence completion
                      </CardTitle>
                      <CardDescription className="text-sm mt-2">
                        How often required items are fully captured.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <Shield className="w-3.5 h-3.5 text-primary mr-1" />
                      Policy-driven
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {MOCK_COMPLIANCE.metrics.map((metric) => (
                      <div key={metric.name}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {metric.name}
                          </div>
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            {metric.value}%
                          </div>
                        </div>
                        <div className="mt-2 w-full">
                          <Progress
                            value={metric.value}
                            className="h-2.5 bg-slate-100 dark:bg-slate-800"
                          />
                        </div>
                        {metric.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                            {metric.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                        PRD: compliance requirements depend on service type and
                        Admin-configured policy (e.g., VIN required, required
                        photo sets, odometer, etc.).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Exceptions snapshot */}
              <Card className="xl:col-span-5 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">
                        Exceptions snapshot
                      </CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Top issues requiring follow-up.
                      </CardDescription>
                    </div>
                    <Link
                      to="/admin-deliveries"
                      className="text-xs font-extrabold text-primary hover:opacity-90 transition inline-flex items-center gap-1"
                    >
                      Open Deliveries
                      <OpenInNew className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {MOCK_COMPLIANCE.exceptions.map((exception, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover-lift"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {exception.title}
                          </div>
                          <SeverityBadge
                            severity={exception.severity}
                            color={exception.severityColor}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Open cases
                          </div>
                          <div className="text-lg font-black text-slate-900 dark:text-white">
                            {exception.count}
                          </div>
                        </div>
                        {exception.description && (
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {exception.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    In production: each exception links to delivery details
                    evidence gallery + timeline.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Exceptions table */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black">
                      Exception list
                    </CardTitle>
                    <CardDescription className="text-sm mt-2">
                      Deliveries with incomplete proof sets or policy
                      violations.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="chip-gray">
                      <Filter className="w-3.5 h-3.5 text-primary mr-1" />
                      Filterable
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950">
                      <TableRow>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Delivery
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Dealer
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Driver
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Issue
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Severity
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Last Updated
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredExceptions.map((item) => (
                        <TableRow
                          key={item.deliveryId}
                          className="hover:bg-primary/5 transition"
                        >
                          <TableCell className="px-5 py-4">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {item.deliveryId}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {item.route}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {item.dealer}
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {item.driver}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <IssueBadge
                              issue={item.issue}
                              icon={item.issueIcon}
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <SeverityBadge
                              severity={item.severity}
                              color={item.severityColor}
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                            {item.lastUpdated}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <Link
                              to={`/admin-delivery/${item.deliveryId}`}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition text-xs font-extrabold text-slate-700 dark:text-slate-200"
                            >
                              <OpenInNew className="w-4 h-4 text-primary" />
                              View Delivery
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tip: Use <span className="font-bold">Delivery Details</span>{" "}
                    to review evidence galleries (photos), VIN verification,
                    odometer snapshots, and the full event timeline.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                    >
                      Next
                    </Button>
                  </div>
                </div>
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
                Admin • Compliance Report • California-only operations
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
