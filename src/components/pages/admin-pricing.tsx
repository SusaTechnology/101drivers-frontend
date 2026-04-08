// app/pages/admin-pricing.tsx
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
  Plus as Add,
  ArrowLeftRight as SwapVert,
  Rocket,
  Edit,
  Copy as ContentCopy,
  Archive,
  Bolt,
  Save,
  History,
  Info,
  Verified,
  Map,
  CreditCard as Payments,
  Ruler as Distance,
  Receipt as ReceiptLong,
  MapPin as PinDrop,
  //   Tag as Label,
  Clock as Schedule,
  FlaskConical as Experiment,
  TrendingUp,
  DollarSign,
  Percent,
  Tag,
  Calendar,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Star,
  Sparkles,
  RocketIcon,
  FlaskConical,
  Upload,
  Download,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAdminActions } from "@/hooks/useAdminActions";
import { navItems } from '@/lib/items/navItems'
import { Navbar } from "../shared/layout/testNavbar";
import { Brand } from "@/lib/items/brand";
// Filter form schema
const filterSchema = z.object({
  search: z.string().optional(),
  classFilter: z.string().optional(),
  statusFilter: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

// Global settings form schema
const globalSettingsSchema = z.object({
  coordinationFee: z.number().min(0, "Coordination fee must be 0 or greater"),
  minimumCharge: z.number().min(0, "Minimum charge must be 0 or greater"),
  surgeAdjustment: z
    .number()
    .min(-100, "Adjustment must be between -100 and 100")
    .max(100, "Adjustment must be between -100 and 100"),
});

type GlobalSettingsFormData = z.infer<typeof globalSettingsSchema>;

// Data
const MOCK_PRICING = {
  rules: [
    {
      id: "rule-1",
      name: "Standard Local (0–50 mi)",
      tags: "local, fast-turn",
      class: "A",
      rate: 2.25,
      coordinationFee: 45,
      effectiveDate: "Feb 01, 2026",
      endDate: null,
      status: "Active",
      statusColor: "primary",
    },
    {
      id: "rule-2",
      name: "Mid-range (51–200 mi)",
      tags: "standard",
      class: "B",
      rate: 1.95,
      coordinationFee: 45,
      effectiveDate: "Jan 15, 2026",
      endDate: null,
      status: "Active",
      statusColor: "primary",
    },
    {
      id: "rule-3",
      name: "Long Haul (200+ mi)",
      tags: "long-haul",
      class: "C",
      rate: 1.65,
      coordinationFee: 45,
      effectiveDate: "Dec 01, 2025",
      endDate: null,
      status: "Draft",
      statusColor: "slate",
    },
  ],

  globalSettings: {
    coordinationFee: 45,
    minimumCharge: 120,
    surgeAdjustment: 0,
  },

  activeVersion: {
    version: "v1.8",
    publishedDate: "Feb 01, 2026 • 08:10 AM",
    status: "Active",
  },

  formulaPreview: {
    components: [
      {
        icon: Distance,
        title: "Mileage",
        description: "Distance from route engine (CA only).",
      },
      {
        icon: DollarSign,
        title: "Rate / class",
        description: "A/B/C band selection and per-mile rate.",
      },
      {
        icon: ReceiptLong,
        title: "Fees",
        description: "Coordination fee + adjustments.",
      },
    ],
    formula: "Total = (miles × rate_per_mile) + coordination_fee + adjustments",
  },
};


export default function AdminPricingPage() {
  const { actionItems, signOut } = useAdminActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [publishHistoryOpen, setPublishHistoryOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: "",
      classFilter: "All Classes",
      statusFilter: "All Status",
    },
  });

  const globalSettingsForm = useForm<GlobalSettingsFormData>({
    resolver: zodResolver(globalSettingsSchema),
    defaultValues: {
      coordinationFee: MOCK_PRICING.globalSettings.coordinationFee,
      minimumCharge: MOCK_PRICING.globalSettings.minimumCharge,
      surgeAdjustment: MOCK_PRICING.globalSettings.surgeAdjustment,
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

  const handleCreateRule = () => {
    toast.info("Create new pricing rule", {
      description: "Opening rule editor...",
    });
    // navigate({ to: "/admin-pricing/rule/new" });
  };

  const handleImportExport = () => {
    setImportExportOpen(true);
  };

  const handlePublishChanges = () => {
    toast.success("Changes published", {
      description: "Pricing rules have been published successfully.",
    });
  };

  const handleEditRule = (ruleId: string) => {
    navigate({ to: `/admin-pricing/rule/${ruleId}` });
  };

  const handleDuplicateRule = (ruleId: string) => {
    toast.success(`Rule duplicated`, {
      description: `A copy of rule ${ruleId} has been created.`,
    });
  };

  const handleArchiveRule = (ruleId: string) => {
    toast.warning(`Rule archived`, {
      description: `Rule ${ruleId} has been archived.`,
    });
  };

  const handleActivateRule = (ruleId: string) => {
    toast.success(`Rule activated`, {
      description: `Rule ${ruleId} is now active.`,
    });
  };

  const handleApplyFilters = (data: FilterFormData) => {
    toast.success("Filters applied", {
      description: "Showing filtered pricing rules.",
    });
    console.log("Filters:", data);
  };

  const handleSaveGlobalSettings = (data: GlobalSettingsFormData) => {
    toast.success("Global settings saved", {
      description: "Pricing settings have been updated.",
    });
    console.log("Global settings:", data);
  };

  const handleTestQuote = () => {
    toast.info("Test quote", {
      description: "Quote calculator opened.",
    });
  };

  const handleViewPublishHistory = () => {
    setPublishHistoryOpen(true);
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
        "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200",
    };

    const StatusIcon = Icon || Verified;

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

  // Class badge component
  const ClassBadge = ({ classLabel }: { classLabel: string }) => (
    <Badge
      variant="outline"
      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
    >
      <Tag className="w-3.5 h-3.5 text-primary mr-1" />
      {classLabel}
    </Badge>
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
        {/* Top header */}
        <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Payments className="w-4 h-4 text-primary mr-1" />
                Pricing Engine
              </Badge>
              <Badge
                variant="outline"
                className="badge bg-primary/10 border-primary/25 text-primary-foreground"
              >
                <Verified className="w-3.5 h-3.5 mr-1" />
                Admin only
              </Badge>
              <Badge
                variant="outline"
                className="badge bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Map className="w-3.5 h-3.5 text-primary mr-1" />
                CA-only operations
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Pricing
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Maintain A/B/C pricing classes, base & coordination
              fees, mileage logic, and operational adjustments. Quote pages pull
              from these rules.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleCreateRule}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition"
            >
              <Add className="w-4 h-4" />
              Create Price Rule
            </Button>
            <Button
              onClick={handleImportExport}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <SwapVert className="w-4 h-4 text-primary" />
              Import / Export
            </Button>
            <Button
              onClick={handlePublishChanges}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              <Rocket className="w-4 h-4" />
              Publish Changes
            </Button>
          </div>
        </section>

        {/* Content grid */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Rules table */}
          <div className="lg:col-span-8 space-y-6">
            {/* Filters */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Rules</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Search, filter, and manage versioned pricing rules.
                    </CardDescription>
                  </div>

                  <form
                    onSubmit={filterForm.handleSubmit(handleApplyFilters)}
                    className="flex flex-col sm:flex-row gap-2 sm:items-center"
                  >
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        {...filterForm.register("search")}
                        className="w-full sm:w-full h-11 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                        placeholder="Search rules (name, class, tags)"
                      />
                    </div>

                    <div className="flex gap-2">
                    <Select
                      onValueChange={(value) =>
                        filterForm.setValue("classFilter", value)
                      }
                      defaultValue="All Classes"
                    >
                      <SelectTrigger className="h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm px-4 min-w-[120px]">
                        <SelectValue placeholder="All Classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Classes">All Classes</SelectItem>
                        <SelectItem value="Class A">Class A</SelectItem>
                        <SelectItem value="Class B">Class B</SelectItem>
                        <SelectItem value="Class C">Class C</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      onValueChange={(value) =>
                        filterForm.setValue("statusFilter", value)
                      }
                      defaultValue="All Status"
                    >
                      <SelectTrigger className="h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm px-4 min-w-[120px]">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Status">All Status</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button type="submit" size="sm" className="h-11 px-4">
                      Apply
                    </Button>
                    </div>
                  </form>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200 dark:border-slate-800">
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Rule
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Class
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Pricing
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Effective
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Status
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_PRICING.rules.map((rule) => (
                        <TableRow
                          key={rule.id}
                          className="border-slate-100 dark:border-slate-800 hover:bg-primary/5 transition"
                        >
                          <TableCell className="py-4">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {rule.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Tags: {rule.tags}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <ClassBadge classLabel={rule.class} />
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="font-black text-slate-900 dark:text-white">
                              ${rule.rate.toFixed(2)} / mi
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              + ${rule.coordinationFee} coordination
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">
                              {rule.effectiveDate}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {rule.endDate || "No end date"}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <StatusBadge
                              status={rule.status}
                              color={rule.statusColor}
                              icon={
                                rule.status === "Active" ? Verified : Schedule
                              }
                            />
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => handleEditRule(rule.id)}
                                variant="outline"
                                size="sm"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                              >
                                <Edit className="w-4 h-4 text-primary" />
                                Edit
                              </Button>
                              {rule.status === "Active" ? (
                                <Button
                                  onClick={() => handleDuplicateRule(rule.id)}
                                  size="sm"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                                >
                                  <ContentCopy className="w-4 h-4" />
                                  Duplicate
                                </Button>
                              ) : rule.status === "Draft" ? (
                                <>
                                  <Button
                                    onClick={() => handleArchiveRule(rule.id)}
                                    variant="outline"
                                    size="sm"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                                  >
                                    <Archive className="w-4 h-4 text-primary" />
                                    Archive
                                  </Button>
                                  <Button
                                    onClick={() => handleActivateRule(rule.id)}
                                    size="sm"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                                  >
                                    <Bolt className="w-4 h-4" />
                                    Activate
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  onClick={() => handleActivateRule(rule.id)}
                                  size="sm"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                                >
                                  <Rocket className="w-4 h-4" />
                                  Reactivate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Showing{" "}
                    <span className="font-extrabold">
                      {MOCK_PRICING.rules.length}
                    </span>{" "}
                    rules.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <ChevronLeft className="w-4 h-4 text-primary" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formula preview */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Quote formula preview
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      How the engine computes the estimate.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleTestQuote}
                    variant="outline"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    <FlaskConical className="w-4 h-4 text-primary" />
                    Test quote
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MOCK_PRICING.formulaPreview.components.map(
                    (component, index) => (
                      <div
                        key={index}
                        className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 hover-lift"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
                          <component.icon className="w-5 h-5 text-primary font-bold" />
                        </div>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {component.title}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {component.description}
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Example
                  </div>
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    <span className="font-black text-slate-900 dark:text-white">
                      Total
                    </span>{" "}
                    = (
                    <span className="font-black text-slate-900 dark:text-white">
                      miles
                    </span>{" "}
                    ×{" "}
                    <span className="font-black text-slate-900 dark:text-white">
                      rate_per_mile
                    </span>
                    ) +
                    <span className="font-black text-slate-900 dark:text-white">
                      {" "}
                      coordination_fee
                    </span>{" "}
                    +
                    <span className="font-black text-slate-900 dark:text-white">
                      {" "}
                      adjustments
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="chip bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <PinDrop className="w-3.5 h-3.5 text-primary mr-1" />
                      CA-only address validation
                    </Badge>
                    <Badge
                      variant="outline"
                      className="chip bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
                    >
                      <Info className="w-3.5 h-3.5 text-amber-500 mr-1" />
                      Final scheduling depends on availability & policy
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Quick settings */}
          <div className="lg:col-span-4 space-y-6">
            {/* Global settings */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">
                    Global pricing settings
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Applies to all quotes unless overridden.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <form
                  onSubmit={globalSettingsForm.handleSubmit(
                    handleSaveGlobalSettings,
                  )}
                  className="space-y-4"
                >
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label
                      htmlFor="coordinationFee"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2"
                    >
                      Coordination Fee ($)
                    </Label>
                    <Input
                      id="coordinationFee"
                      type="number"
                      step="0.01"
                      {...globalSettingsForm.register("coordinationFee", {
                        valueAsNumber: true,
                      })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      Shown as a line item in estimates.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label
                      htmlFor="minimumCharge"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2"
                    >
                      Minimum Charge ($)
                    </Label>
                    <Input
                      id="minimumCharge"
                      type="number"
                      step="0.01"
                      {...globalSettingsForm.register("minimumCharge", {
                        valueAsNumber: true,
                      })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      Prevents tiny routes from underpricing.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label
                      htmlFor="surgeAdjustment"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2"
                    >
                      Surge / Adjustment (%)
                    </Label>
                    <Input
                      id="surgeAdjustment"
                      type="number"
                      step="0.1"
                      {...globalSettingsForm.register("surgeAdjustment", {
                        valueAsNumber: true,
                      })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      Optional operational adjustment (admin controlled).
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save global settings
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Publish info */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">
                    Publish & versioning
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Control when changes affect new quotes.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    Rule edits create a new draft version. Publishing makes it active for new quotes only
                    (existing bookings remain unchanged).
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Current active version
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {MOCK_PRICING.activeVersion.version}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Published: {MOCK_PRICING.activeVersion.publishedDate}
                      </div>
                    </div>
                    <StatusBadge
                      status={MOCK_PRICING.activeVersion.status}
                      color="primary"
                      icon={Verified}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleViewPublishHistory}
                  className="w-full py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition inline-flex items-center justify-center gap-2"
                >
                  <History className="w-4 h-4" />
                  View publish history
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pricing info */}
        <section className="mt-6">
          <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              Pricing Coverage
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              A/B/C pricing, admin-managed rules, version/publish flow, and
              quote engine preview.
            </AlertDescription>
          </Alert>
        </section>
      </main>

      {/* Import/Export Modal */}
      <Dialog open={importExportOpen} onOpenChange={setImportExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              Import / Export Rules
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
              Export pricing rules to CSV or import from file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="font-extrabold text-slate-900 dark:text-white mb-2">
                Export Rules
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Download all pricing rules as CSV file for backup or analysis.
              </p>
              <Button className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="font-extrabold text-slate-900 dark:text-white mb-2">
                Import Rules
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Upload CSV file to bulk import pricing rules.
              </p>
              <Button
                variant="outline"
                className="w-full border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
              >
                <Upload className="w-4 h-4 text-primary mr-2" />
                Choose File
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportExportOpen(false)}
              className="px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish History Modal */}
      <Dialog open={publishHistoryOpen} onOpenChange={setPublishHistoryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              Publish History
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
              Version history of pricing rule publications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    v1.8
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Published: Feb 01, 2026 • 08:10 AM
                  </div>
                </div>
                <StatusBadge status="Active" color="primary" icon={Verified} />
              </div>
              <div className="p-4 flex items-center justify-between opacity-75">
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    v1.7
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Published: Jan 15, 2026 • 09:22 AM
                  </div>
                </div>
                <StatusBadge status="Archived" color="slate" icon={Archive} />
              </div>
              <div className="p-4 flex items-center justify-between opacity-75">
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    v1.6
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Published: Dec 01, 2025 • 11:05 AM
                  </div>
                </div>
                <StatusBadge status="Archived" color="slate" icon={Archive} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishHistoryOpen(false)}
              className="px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                Admin Console • Pricing
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
