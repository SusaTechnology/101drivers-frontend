// @ts-nocheck
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
  Save,
  Rocket,
  FlaskConical,
  Info,
  Gavel,
  History,
  Edit,
  Tag,
  Calendar,
  DollarSign,
  Route,
  TrendingUp,
  Calculator,
  CheckCircle,
  AlertCircle,
  Clock,
  Verified,
  Layers,
  Percent,
  Minus,
  Plus,
  Settings,
  FileText,
  Shield,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
//   ChevronRight,
//   ChevronLeft,
//   Download,
//   Upload,
//   Copy,
//   Trash2,
//   Eye,
//   EyeOff,
//   Lock,
//   Unlock,
//   Star,
//   Sparkles,
//   RocketIcon,
//   FlaskConicalIcon,
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Form schema for pricing rule
const pricingRuleSchema = z.object({
  // Rule details
  ruleName: z.string().min(1, "Rule name is required"),
  status: z.enum(["Active", "Draft", "Archived"]),
  pricingClass: z.enum(["Class A", "Class B", "Class C"]),
  tags: z.string().optional(),
  effectiveStart: z.string().min(1, "Effective start date is required"),
  effectiveEnd: z.string().optional(),

  // Rate & thresholds
  minMiles: z.number().min(0, "Min miles must be 0 or greater"),
  maxMiles: z.number().optional(),
  ratePerMile: z.number().min(0, "Rate per mile must be 0 or greater"),
  coordinationFee: z.number().min(0, "Coordination fee must be 0 or greater"),

  // Minimum charge override
  enableMinCharge: z.boolean().default(false),
  minCharge: z.number().optional(),
  adjustmentPercent: z.number().optional(),
});

type PricingRuleFormData = z.infer<typeof pricingRuleSchema>;

// Mock data
const MOCK_PRICING_RULE = {
  id: "rule-2",
  ruleName: "Mid-range (51–200 mi)",
  status: "Active" as const,
  pricingClass: "Class B" as const,
  tags: "standard, mid-range",
  effectiveStart: "2026-01-15",
  effectiveEnd: "",

  minMiles: 51,
  maxMiles: 200,
  ratePerMile: 1.95,
  coordinationFee: 45,

  enableMinCharge: false,
  minCharge: undefined,
  adjustmentPercent: undefined,

  audit: [
    {
      action: "Published v1.8",
      timestamp: "Feb 01, 2026 • 08:10 AM",
      user: "Admin",
      icon: History,
    },
    {
      action: "Updated rate",
      timestamp: "Jan 28, 2026 • 06:42 PM",
      user: "Admin",
      icon: Edit,
    },
  ],

  preview: {
    band: "51–200 miles",
    baseExample: 390.0,
    totalExample: 435.0,
  },
};

// Navigation items
const navItems = [
  { href: "/admin-dashboard", label: "Dashboard" },
  { href: "/admin-users", label: "Users" },
  { href: "/admin-deliveries", label: "Deliveries" },
  { href: "/admin-pricing", label: "Pricing", active: true },
  { href: "/admin-scheduling-policy", label: "Scheduling" },
  { href: "/admin-disputes", label: "Disputes" },
  { href: "/admin-payments", label: "Payments" },
  { href: "/admin-insurance-reporting", label: "Insurance" },
];

export default function AdminPricingRulePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sampleMiles, setSampleMiles] = useState(142);
  const [quotePreview, setQuotePreview] = useState({
    base: 276.9,
    fee: 45.0,
    total: 321.9,
  });
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  //   const params = useParams({ from: '/admin-pricing/rule/$ruleId' })

  const form = useForm<PricingRuleFormData>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: {
      ruleName: MOCK_PRICING_RULE.ruleName,
      status: MOCK_PRICING_RULE.status,
      pricingClass: MOCK_PRICING_RULE.pricingClass,
      tags: MOCK_PRICING_RULE.tags,
      effectiveStart: MOCK_PRICING_RULE.effectiveStart,
      effectiveEnd: MOCK_PRICING_RULE.effectiveEnd,
      minMiles: MOCK_PRICING_RULE.minMiles,
      maxMiles: MOCK_PRICING_RULE.maxMiles,
      ratePerMile: MOCK_PRICING_RULE.ratePerMile,
      coordinationFee: MOCK_PRICING_RULE.coordinationFee,
      enableMinCharge: MOCK_PRICING_RULE.enableMinCharge,
      minCharge: MOCK_PRICING_RULE.minCharge,
      adjustmentPercent: MOCK_PRICING_RULE.adjustmentPercent,
    },
  });

  // Watch form values for quote preview
  const ratePerMile = form.watch("ratePerMile");
  const coordinationFee = form.watch("coordinationFee");

  // Update quote preview when sample miles or rates change
  useEffect(() => {
    const base = sampleMiles * (ratePerMile || 0);
    const total = base + (coordinationFee || 0);
    setQuotePreview({
      base,
      fee: coordinationFee || 0,
      total,
    });
  }, [sampleMiles, ratePerMile, coordinationFee]);

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

  const handleSaveDraft = () => {
    toast.success("Draft saved", {
      description: "Your changes have been saved as draft.",
    });
  };

  const handlePublish = () => {
    toast.success("Rule published", {
      description: "Pricing rule has been published and is now active.",
    });
  };

  const handleTestQuote = () => {
    toast.info("Test quote generated", {
      description: `Quote for ${sampleMiles} miles: $${quotePreview.total.toFixed(2)}`,
    });
  };

  const handleSubmit = (data: PricingRuleFormData) => {
    console.log("Form data:", data);
    toast.success("Pricing rule updated", {
      description: "Your changes have been saved successfully.",
    });
  };

  const handleRecalculate = () => {
    toast.info("Quote recalculated", {
      description: `Updated estimate for ${sampleMiles} miles.`,
    });
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
        {/* Top */}
        <section className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin-pricing"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/5 transition"
              >
                <ArrowLeft className="w-4 h-4 text-primary" />
                Back to Pricing
              </Link>

              <Badge
                variant="outline"
                className="chip bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Tag className="w-3.5 h-3.5 text-primary mr-1" />
                {MOCK_PRICING_RULE.pricingClass}
              </Badge>

              <Badge
                variant="outline"
                className="badge bg-primary/10 border-primary/25 text-primary-foreground"
              >
                <Verified className="w-3.5 h-3.5 mr-1" />
                Active (Prototype)
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Pricing Rule
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Edit a rule that powers quote estimates. PRD-aligned: A/B/C
              classes, effective dates, draft/publish behavior, and quote
              preview.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSaveDraft}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <Save className="w-4 h-4 text-primary" />
              Save Draft
            </Button>
            <Button
              onClick={handlePublish}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              <Rocket className="w-4 h-4" />
              Publish
            </Button>
            <Button
              onClick={handleTestQuote}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition"
            >
              <FlaskConical className="w-4 h-4" />
              Test Quote
            </Button>
          </div>
        </section>

        {/* Grid */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Editor */}
          <div className="lg:col-span-8 space-y-6">
            {/* Rule details */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Rule details
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Define scope, class, and when the rule applies.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="chip bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200"
                  >
                    <Info className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    Prototype form (no backend)
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <form
                  id="pricingRuleForm"
                  onSubmit={form.handleSubmit(handleSubmit)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="ruleName"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                      >
                        Rule Name
                      </Label>
                      <Input
                        id="ruleName"
                        {...form.register("ruleName")}
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="status"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                      >
                        Status
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          form.setValue("status", value as any)
                        }
                        defaultValue={MOCK_PRICING_RULE.status}
                      >
                        <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Draft">Draft</SelectItem>
                          <SelectItem value="Archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label
                        htmlFor="pricingClass"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                      >
                        Pricing Class
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          form.setValue("pricingClass", value as any)
                        }
                        defaultValue={MOCK_PRICING_RULE.pricingClass}
                      >
                        <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Class A">Class A</SelectItem>
                          <SelectItem value="Class B">Class B</SelectItem>
                          <SelectItem value="Class C">Class C</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        PRD: A/B/C pricing tiers.
                      </p>
                    </div>

                    <div>
                      <Label
                        htmlFor="tags"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                      >
                        Tags
                      </Label>
                      <Input
                        id="tags"
                        {...form.register("tags")}
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        Comma-separated (searchable).
                      </p>
                    </div>

                    <div>
                      <Label
                        htmlFor="effectiveStart"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                      >
                        Effective Start
                      </Label>
                      <Input
                        id="effectiveStart"
                        {...form.register("effectiveStart")}
                        type="date"
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="effectiveEnd"
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                      >
                        Effective End (optional)
                      </Label>
                      <Input
                        id="effectiveEnd"
                        {...form.register("effectiveEnd")}
                        type="date"
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        Leave empty for no end date.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-start gap-3">
                      <Gavel className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          Scope rules
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          Quotes are California-only. In production,
                          pickup/drop-off must be within CA; otherwise quoting
                          is blocked.
                        </p>
                      </div>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Rate & thresholds */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">
                    Rate & thresholds
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Define mileage band and price components.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Min Miles */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label
                      htmlFor="minMiles"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                    >
                      Min Miles
                    </Label>
                    <Input
                      id="minMiles"
                      type="number"
                      {...form.register("minMiles", { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Inclusive lower bound.
                    </p>
                  </div>

                  {/* Max Miles */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label
                      htmlFor="maxMiles"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                    >
                      Max Miles
                    </Label>
                    <Input
                      id="maxMiles"
                      type="number"
                      {...form.register("maxMiles", { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Inclusive upper bound (empty = no limit).
                    </p>
                  </div>

                  {/* Rate per Mile */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label
                      htmlFor="ratePerMile"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                    >
                      Rate per Mile ($)
                    </Label>
                    <Input
                      id="ratePerMile"
                      type="number"
                      step="0.01"
                      {...form.register("ratePerMile", { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Core driver of estimate.
                    </p>
                  </div>

                  {/* Coordination Fee */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label
                      htmlFor="coordinationFee"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                    >
                      Coordination Fee ($)
                    </Label>
                    <Input
                      id="coordinationFee"
                      type="number"
                      step="0.01"
                      {...form.register("coordinationFee", {
                        valueAsNumber: true,
                      })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Shown as a separate line item.
                    </p>
                  </div>

                  {/* Minimum Charge Override */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 md:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          Minimum Charge Override
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Optional rule-level minimum (defaults to global
                          setting).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="enableMinCharge"
                          checked={form.watch("enableMinCharge")}
                          onCheckedChange={(checked) =>
                            form.setValue("enableMinCharge", checked)
                          }
                        />
                        <Label
                          htmlFor="enableMinCharge"
                          className="text-sm font-bold text-slate-700 dark:text-slate-200"
                        >
                          Enable
                        </Label>
                      </div>
                    </div>

                    {form.watch("enableMinCharge") && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="minCharge"
                            className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                          >
                            Minimum Charge ($)
                          </Label>
                          <Input
                            id="minCharge"
                            type="number"
                            step="0.01"
                            {...form.register("minCharge", {
                              valueAsNumber: true,
                            })}
                            className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                            placeholder="e.g. 150"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="adjustmentPercent"
                            className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                          >
                            Adjustment (%)
                          </Label>
                          <Input
                            id="adjustmentPercent"
                            type="number"
                            step="0.1"
                            {...form.register("adjustmentPercent", {
                              valueAsNumber: true,
                            })}
                            className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                            placeholder="e.g. 5"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    PRD note: quote-first UX shows estimate before service type
                    & contact details. These rules should stay stable and
                    auditable.
                  </p>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    type="submit"
                    form="pricingRuleForm"
                    className="lime-btn px-6 py-3 rounded-2xl"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview & audit */}
          <div className="lg:col-span-4 space-y-6">
            {/* At-a-glance */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">
                    At-a-glance
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    What this rule implies.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Band
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                      {MOCK_PRICING_RULE.preview.band}
                    </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      Applies to mid-range routes.
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Base example
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                      ${MOCK_PRICING_RULE.preview.baseExample.toFixed(2)}
                    </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      200 mi × ${MOCK_PRICING_RULE.ratePerMile.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Total example
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                      ${MOCK_PRICING_RULE.preview.totalExample.toFixed(2)}
                    </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      Base + ${MOCK_PRICING_RULE.coordinationFee.toFixed(2)}{" "}
                      coordination
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quote preview */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">
                    Quote preview
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Test pricing with sample distance.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <Label
                    htmlFor="sampleMiles"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                  >
                    Sample miles
                  </Label>
                  <Input
                    id="sampleMiles"
                    type="number"
                    value={sampleMiles}
                    onChange={(e) =>
                      setSampleMiles(parseFloat(e.target.value) || 0)
                    }
                    className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Prototype calculator runs in the browser.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      Base Transportation
                    </span>
                    <span className="font-black text-slate-900 dark:text-white">
                      ${quotePreview.base.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      Coordination Fee
                    </span>
                    <span className="font-black text-slate-900 dark:text-white">
                      ${quotePreview.fee.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                      Total Estimate
                    </span>
                    <span className="text-2xl font-black text-primary">
                      ${quotePreview.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    handleRecalculate();
                    handleTestQuote();
                  }}
                  className="w-full py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  Recalculate
                </Button>

                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    Preview is for admin validation only. Real quotes will
                    validate CA-only addresses and use the route engine
                    distance.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Audit */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">Audit</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Who changed what, and when (prototype).
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="space-y-3">
                  {MOCK_PRICING_RULE.audit.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800"
                    >
                      <entry.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {entry.action}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {entry.timestamp} • by {entry.user}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* PRD note */}
        <section className="mt-6">
          <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              PRD Coverage
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              Admin rule editor + effective dates + A/B/C tiering + quote
              preview. Next suggested page: admin-scheduling-policy.html
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
                Admin Console • Pricing Rule
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
