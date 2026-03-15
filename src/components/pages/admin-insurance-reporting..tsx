// app/pages/admin-insurance-reporting.tsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Shield,
  FileText,
  Download,
  Package,
  QrCode,
  Gauge as Speed,
  Camera,
  Route,
  Signature,
  FileText as Summarize,
  Search,
  Filter,
  Bookmark,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ExternalLink as OpenInNew,
  CheckCircle,
  AlertCircle,
  Info,
  Package as Inventory,
  Images as PhotoLibrary,
  FileWarning as Report,
  Mail,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Calendar,
  Tag,
  Truck,
  MapPin,
  Clock,
  Verified,
  AlertTriangle,
  Image,
  FileCheck,
  FileWarning,
  Flag,
  ArrowRight,
  Save,
  Settings,
  FileSpreadsheet,
  FileBox,
  FileImage,
  FileSignature,
  FileClock,
  FileSearch,
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
import { useAdminActions } from "@/hooks/useAdminActions";
import { Navbar } from "../shared/layout/testNavbar";
import { Brand } from "@/lib/items/brand";
import { navItems } from "@/lib/items/navItems";

// Filter form schema
const filterSchema = z.object({
  search: z.string().optional(),
  complianceStatus: z.string().optional(),
  proofPackage: z.string().optional(),
  dateRange: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

// Mock data
const MOCK_INSURANCE = {
  kpis: [
    {
      label: "Proof packages",
      value: "64",
      subtitle: "Last 30 days",
      icon: Package,
    },
    {
      label: "Missing photos",
      value: "7",
      subtitle: "Need follow-up",
      icon: Camera,
      color: "amber",
    },
    {
      label: "VIN checks",
      value: "98%",
      subtitle: "Last-4 verified",
      icon: QrCode,
      color: "emerald",
    },
    {
      label: "Open incidents",
      value: "2",
      subtitle: "Insurance review",
      icon: AlertTriangle,
      color: "rose",
    },
  ],

  workflowSteps: [
    {
      title: "VIN last-4 verification",
      description:
        "Driver confirms the vehicle identity at pickup and records last-4 with timestamp.",
      icon: QrCode,
    },
    {
      title: "Odometer start / end",
      description:
        "Photo evidence plus values captured at pickup and drop-off.",
      icon: Speed,
    },
    {
      title: "Required photo set",
      description:
        "Pickup + drop-off images (angles per policy), stored with immutable metadata.",
      icon: Camera,
    },
    {
      title: "Start/stop tracking",
      description:
        "Trip events from Start → Completed for insurer narrative and audit.",
      icon: Route,
    },
    {
      title: "Signatures & acknowledgements",
      description:
        "Pickup/drop-off signatures (or policy exceptions) included in final report.",
      icon: Signature,
    },
    {
      title: "Post-trip report",
      description:
        "A single packaged record for dealer/customer/admin, exportable for insurance.",
      icon: Summarize,
    },
  ],

  deliveries: [
    {
      id: "DEL-90211",
      dealer: "Bay Auto Group",
      date: "Feb 11, 2026",
      route: {
        from: "San Jose",
        to: "Los Angeles",
        miles: "142",
      },
      vin: {
        value: "7K2A",
        status: "verified",
        color: "emerald",
      },
      odometer: {
        start: "54,110",
        end: "54,252",
        status: "Photos attached",
        color: "emerald",
      },
      photos: {
        status: "Complete",
        color: "emerald",
      },
      proofPackage: {
        status: "Generated",
        color: "slate",
      },
      incident: null,
    },
    {
      id: "DEL-90177",
      dealer: "Coastal Motors",
      date: "Feb 10, 2026",
      route: {
        from: "San Diego",
        to: "Irvine",
        miles: "86",
      },
      vin: {
        value: "1B9Q",
        status: "verified",
        color: "emerald",
      },
      odometer: {
        start: "18,904",
        end: "18,990",
        status: "End photo missing",
        color: "amber",
      },
      photos: {
        status: "Missing",
        color: "amber",
      },
      proofPackage: {
        status: "Not generated",
        color: "slate",
      },
      incident: null,
    },
    {
      id: "DEL-90120",
      dealer: "Valley Auto",
      date: "Feb 09, 2026",
      route: {
        from: "Fresno",
        to: "Bakersfield",
        miles: "109",
      },
      vin: {
        value: "9X4M",
        status: "verified",
        color: "emerald",
      },
      odometer: {
        start: "61,203",
        end: "61,325",
        status: "Verified",
        color: "emerald",
      },
      photos: {
        status: "Complete",
        color: "emerald",
      },
      proofPackage: {
        status: "Generated",
        color: "slate",
      },
      incident: {
        status: "Flagged",
        color: "rose",
      },
    },
  ],

  totalDeliveries: 18,
  showingDeliveries: 3,
};


export default function AdminInsuranceReportingPage() {
  const { actionItems, signOut } = useAdminActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: "",
      complianceStatus: "All",
      proofPackage: "All",
      dateRange: "Last 30 days",
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

  const handleExportReport = () => {
    toast.success("Export started", {
      description: "Your insurance report is being generated.",
    });
  };

  const handleGenerateProofPackage = () => {
    toast.success("Proof package generated", {
      description: "Delivery proof package created successfully.",
    });
  };

  const handleTemplate = () => {
    toast.info("Proof package template", {
      description: "View proof package template configuration.",
    });
  };

  const handlePolicy = () => {
    toast.info("Insurance policy", {
      description: "View insurance compliance policy.",
    });
  };

  const handleSavedViews = () => {
    toast.info("Saved views", {
      description: "Manage your saved filter views.",
    });
  };

  const handleReset = () => {
    filterForm.reset({
      search: "",
      complianceStatus: "All",
      proofPackage: "All",
      dateRange: "Last 30 days",
    });
    toast.info("Filters reset");
  };

  const handleApplyFilters = (data: FilterFormData) => {
    toast.success("Filters applied", {
      description: `Showing filtered results.`,
    });
    console.log("Filters:", data);
  };

  const handleExportDelivery = (deliveryId: string) => {
    toast.success(`Exporting delivery ${deliveryId}`, {
      description: "Insurance report is being generated.",
    });
  };

  const handleRequestMissingProof = (deliveryId: string) => {
    toast.info(`Request sent for ${deliveryId}`, {
      description: "Missing proof request emailed to driver.",
    });
  };

  const handleReviewIncident = (deliveryId: string) => {
    navigate({ to: `/admin-dispute/${deliveryId}` });
  };

  // Status badge component
  const StatusBadge = ({
    status,
    color = "slate",
    icon: Icon,
    className,
  }: {
    status: string;
    color?: string;
    icon?: any;
    className?: string;
  }) => {
    const colors: Record<string, string> = {
      emerald:
        "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200",
      amber:
        "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200",
      rose: "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200",
      slate:
        "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200",
      indigo:
        "bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200",
      primary: "bg-primary/10 border-primary/25 text-primary-foreground",
    };

    const StatusIcon = Icon || CheckCircle;

    return (
      <Badge
        variant="outline"
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border",
          colors[color] || colors.slate,
          className,
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  };

  // Workflow step component
  const WorkflowStep = ({ icon: Icon, title, description }: any) => (
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center flex-none">
        <Icon className="w-5 h-5 text-primary font-bold" />
      </div>
      <div>
        <h4 className="font-extrabold text-slate-900 dark:text-white">
          {title}
        </h4>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
          <Navbar
            brand={<Brand />}
            items={navItems}
            actions={actionItems}
            onSignOut={signOut}
            title="Admin"
            />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Header */}
        <section className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Shield className="w-4 h-4 text-primary mr-1" />
                Insurance & Reporting
              </Badge>
              <Badge
                variant="outline"
                className="pill bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500 mr-1" />
                Compliance Reports (PRD)
              </Badge>
              <Badge
                variant="outline"
                className="pill bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
              >
                <Info className="w-3.5 h-3.5 text-amber-500 mr-1" />
                Prototype data
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Insurance, Certificates & Proof Packages
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Generate delivery proof packages (VIN last-4, odometer start/end,
              photos, signatures) and export insurer-ready reports.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleExportReport}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <Download className="w-4 h-4 text-primary" />
              Export report
            </Button>
            <Button
              onClick={handleGenerateProofPackage}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              <Package className="w-4 h-4 mr-2" />
              Generate proof package
            </Button>
          </div>
        </section>

        {/* KPIs */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          {MOCK_INSURANCE.kpis.map((kpi) => (
            <Card
              key={kpi.label}
              className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            >
              <CardContent className="p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {kpi.label}
                </div>
                <div className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
                  {kpi.value}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  {kpi.subtitle}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Proof workflow */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">
                    What's included in a proof package
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Matches the PRD compliance checkpoints used across
                    deliveries.
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleTemplate}
                    variant="outline"
                    size="sm"
                    className="btn-soft"
                  >
                    <FileText className="w-4 h-4 text-primary mr-2" />
                    Template
                  </Button>
                  <Button
                    onClick={handlePolicy}
                    variant="outline"
                    size="sm"
                    className="btn-ghost"
                  >
                    <Settings className="w-4 h-4 text-primary mr-2" />
                    Policy
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-7">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1 */}
                <div className="space-y-5">
                  <WorkflowStep
                    icon={QrCode}
                    title="VIN last-4 verification"
                    description="Driver confirms the vehicle identity at pickup and records last-4 with timestamp."
                  />
                  <WorkflowStep
                    icon={Speed}
                    title="Odometer start / end"
                    description="Photo evidence plus values captured at pickup and drop-off."
                  />
                </div>

                {/* Column 2 */}
                <div className="space-y-5">
                  <WorkflowStep
                    icon={Camera}
                    title="Required photo set"
                    description="Pickup + drop-off images (angles per policy), stored with immutable metadata."
                  />
                  <WorkflowStep
                    icon={Route}
                    title="Start/stop tracking"
                    description="Trip events from Start → Completed for insurer narrative and audit."
                  />
                </div>

                {/* Column 3 */}
                <div className="space-y-5">
                  <WorkflowStep
                    icon={Signature}
                    title="Signatures & acknowledgements"
                    description="Pickup/drop-off signatures (or policy exceptions) included in final report."
                  />
                  <WorkflowStep
                    icon={Summarize}
                    title="Post-trip report"
                    description="A single packaged record for dealer/customer/admin, exportable for insurance."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Filters */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">
                    Search deliveries for proof & insurer exports
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Filter by delivery, dealer, customer, driver, compliance
                    status, or date range.
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleSavedViews}
                    variant="outline"
                    size="sm"
                    className="btn-soft"
                  >
                    <Bookmark className="w-4 h-4 text-primary mr-2" />
                    Saved views
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                    className="btn-ghost"
                  >
                    <RotateCcw className="w-4 h-4 text-primary mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-7">
              <form onSubmit={filterForm.handleSubmit(handleApplyFilters)}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Search
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        {...filterForm.register("search")}
                        className="w-full h-12 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                        placeholder="Delivery ID, VIN last-4, customer email, driver ID…"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Compliance status
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        filterForm.setValue("complianceStatus", value)
                      }
                      defaultValue="All"
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                        <SelectItem value="Missing photos">
                          Missing photos
                        </SelectItem>
                        <SelectItem value="Missing odometer">
                          Missing odometer
                        </SelectItem>
                        <SelectItem value="VIN not verified">
                          VIN not verified
                        </SelectItem>
                        <SelectItem value="Incident flagged">
                          Incident flagged
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Proof package
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        filterForm.setValue("proofPackage", value)
                      }
                      defaultValue="All"
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Generated">Generated</SelectItem>
                        <SelectItem value="Not generated">
                          Not generated
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Date range
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        filterForm.setValue("dateRange", value)
                      }
                      defaultValue="Last 30 days"
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Last 30 days">
                          Last 30 days
                        </SelectItem>
                        <SelectItem value="Last 7 days">Last 7 days</SelectItem>
                        <SelectItem value="Today">Today</SelectItem>
                        <SelectItem value="Custom…">Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="pill bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Filter className="w-3.5 h-3.5 text-primary mr-1" />
                    All compliance
                  </Badge>
                  <Badge
                    variant="outline"
                    className="pill bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Calendar className="w-3.5 h-3.5 text-primary mr-1" />
                    Last 30 days
                  </Badge>
                  <Badge
                    variant="outline"
                    className="pill bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    Showing: {MOCK_INSURANCE.showingDeliveries}
                  </Badge>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit" className="btn-primary px-6 py-2.5">
                    Apply Filters
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Table */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">
                    Deliveries for insurance reporting
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Generate proof packages and export insurer-ready summaries.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="badge bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                    Complete
                  </Badge>
                  <Badge
                    variant="outline"
                    className="badge bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    Missing photos
                  </Badge>
                  <Badge
                    variant="outline"
                    className="badge bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200"
                  >
                    <Flag className="w-3.5 h-3.5 text-rose-500 mr-1" />
                    Incident
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-800">
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Delivery
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Date
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Route
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        VIN last-4
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Odometer
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Photos
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Proof package
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Incident
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_INSURANCE.deliveries.map((delivery) => (
                      <TableRow
                        key={delivery.id}
                        className="border-slate-100 dark:border-slate-800 hover:bg-primary/5"
                      >
                        <TableCell className="py-4">
                          <Link
                            to={`/admin-delivery/${delivery.id}`}
                            className="font-extrabold text-slate-900 dark:text-white hover:text-primary transition-colors"
                          >
                            {delivery.id}
                          </Link>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            Dealer: {delivery.dealer}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                          {delivery.date}
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {delivery.route.from} → {delivery.route.to}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {delivery.route.miles} miles (est.)
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <StatusBadge
                            status={delivery.vin.value}
                            color={delivery.vin.color}
                            icon={Verified}
                          />
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="font-extrabold text-slate-900 dark:text-white font-mono">
                            {delivery.odometer.start} → {delivery.odometer.end}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {delivery.odometer.status}
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <StatusBadge
                            status={delivery.photos.status}
                            color={delivery.photos.color}
                            icon={
                              delivery.photos.color === "emerald"
                                ? PhotoLibrary
                                : Camera
                            }
                          />
                        </TableCell>

                        <TableCell className="py-4">
                          <StatusBadge
                            status={delivery.proofPackage.status}
                            color={delivery.proofPackage.color}
                            icon={Package}
                          />
                        </TableCell>

                        <TableCell className="py-4">
                          {delivery.incident ? (
                            <StatusBadge
                              status={delivery.incident.status}
                              color={delivery.incident.color}
                              icon={AlertTriangle}
                            />
                          ) : (
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              —
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="py-4 text-right">
                          <div className="inline-flex gap-2">
                            {delivery.photos.status === "Missing" ? (
                              <Button
                                onClick={() =>
                                  handleRequestMissingProof(delivery.id)
                                }
                                variant="outline"
                                size="sm"
                                className="btn-ghost py-2 px-3"
                              >
                                <Mail className="w-4 h-4 text-primary mr-2" />
                                Request missing proof
                              </Button>
                            ) : delivery.incident?.status === "Flagged" ? (
                              <Button
                                onClick={() =>
                                  handleReviewIncident(delivery.id)
                                }
                                size="sm"
                                className="btn-primary py-2 px-3"
                              >
                                Review incident
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            ) : (
                              <Button
                                onClick={() =>
                                  handleExportDelivery(delivery.id)
                                }
                                size="sm"
                                className="btn-primary py-2 px-3"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                              </Button>
                            )}
                            <Link
                              to={`/admin-delivery/${delivery.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                            >
                              <OpenInNew className="w-4 h-4 text-primary" />
                              View
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="px-6 sm:px-7 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-black text-slate-900 dark:text-white">
                    {MOCK_INSURANCE.showingDeliveries}
                  </span>{" "}
                  of{" "}
                  <span className="font-black text-slate-900 dark:text-white">
                    {MOCK_INSURANCE.totalDeliveries}
                  </span>{" "}
                  deliveries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-ghost px-4 py-2.5"
                  >
                    <ChevronLeft className="w-4 h-4 text-primary mr-1" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-ghost px-4 py-2.5"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 text-primary ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* PRD note */}
        <section className="mt-6">
          <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              PRD Coverage
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              Compliance proofs (VIN last-4, photos, odometer, tracking events),
              post-trip reporting, and insurer exports. Prototype UI only — the
              real system will pull assets from delivery event logs + media
              storage.
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
                Admin Console • Insurance & Reporting
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
