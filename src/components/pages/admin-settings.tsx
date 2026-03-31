// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Info,
  MapPin,
  Users,
  Truck,
  CreditCard,
  Gavel,
  BarChart3,
  Settings,
  Sliders,
  DollarSign,
  Calendar,
  Bell,
  Shield,
  Mail,
  MessageCircle as Sms,
  Route,
  CheckSquare as Rule,
  Percent,
  ArrowLeftRight as SwapHoriz,
  CalendarCheck as EventAvailable,
  Clock as Schedule,
  Ban as Block,
  Verified,
  FileText as Assignment,
  Download,
  ArrowRight,
  SlidersHorizontal as Tune,
  TrendingUp as PriceChange,
  Calendar as CalendarMonth,
  Bell as Notifications,
  MapPin as LocationOn,
  BadgeCheck as FactCheck,
  Shield as AdminPanelSettings,
  Check,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Mock config data
const MOCK_CONFIG = {
  quickChecks: [
    {
      label: "Region",
      value: "California-only",
    },
    {
      label: "Default Channel",
      value: "Email-first",
    },
    {
      label: "Pricing Mode",
      value: "Rules enabled",
    },
    {
      label: "Scheduling",
      value: "Policy enabled",
    },
  ],

  configCards: [
    {
      href: "/admin-pricing",
      icon: PriceChange,
      title: "Pricing",
      description:
        "Configure pricing structure (A/B/C), rate rules, overrides, and min/max constraints used to generate quotes.",
      chips: [
        { icon: Rule, label: "Rules" },
        { icon: Percent, label: "Fees" },
        { icon: SwapHoriz, label: "Overrides" },
      ],
    },
    {
      href: "/admin-scheduling-policy",
      icon: CalendarMonth,
      title: "Scheduling Policy",
      description:
        "Define when deliveries can be scheduled, lead times, blackout windows, and assignment constraints.",
      chips: [
        { icon: EventAvailable, label: "Rules" },
        { icon: Schedule, label: "Lead time" },
        { icon: Block, label: "Blackouts" },
      ],
    },
    {
      href: "/admin-notification-policy",
      icon: Notifications,
      title: "Notification Policy",
      description:
        "Email-first configuration, optional SMS settings, quiet hours, rate limits, and event routing.",
      chips: [
        { icon: Mail, label: "Email" },
        { icon: Sms, label: "SMS" },
        { icon: Route, label: "Routing" },
      ],
    },
    {
      href: "/admin-insurance-reporting",
      icon: Shield,
      title: "Insurance & Reporting",
      description:
        "Configure insurance requirements, compliance proofs, and admin reporting exports.",
      chips: [
        { icon: Verified, label: "Proofs" },
        { icon: Assignment, label: "Requirements" },
        { icon: Download, label: "Exports" },
      ],
    },
  ],

  guardrails: [
    {
      icon: Mail,
      title: "Email-first",
      description:
        "All key lifecycle events should notify stakeholders via email.",
    },
    {
      icon: Sms,
      title: "SMS optional",
      description:
        "Use SMS only when enabled by policy + consent; reserve for high priority.",
    },
    {
      icon: LocationOn,
      title: "CA only",
      description:
        "Ensure address validation and operations remain limited to California.",
    },
  ],
};

// Sidebar navigation items
const sidebarItems = [
  { href: "/admin-users", label: "Users", icon: Users },
  { href: "/admin-deliveries", label: "Deliveries", icon: Truck },
  { href: "/admin-payments", label: "Payments", icon: CreditCard },
  { href: "/admin-disputes", label: "Disputes", icon: Gavel },
  { href: "/admin-reports", label: "Reports", icon: BarChart3 },

  {
    section: "Config",
    items: [
      { href: "/admin-config", label: "Config Hub", icon: Tune, active: true },
      { href: "/admin-pricing", label: "Pricing", icon: PriceChange },
      {
        href: "/admin-scheduling-policy",
        label: "Scheduling Policy",
        icon: CalendarMonth,
      },
      {
        href: "/admin-notification-policy",
        label: "Notification Policy",
        icon: Notifications,
      },
      {
        href: "/admin-insurance-reporting",
        label: "Insurance & Reporting",
        icon: Shield,
      },
    ],
  },
];

export default function AdminSettingsHubPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

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
          Admin
        </div>
        <Badge variant="outline" className="chip-gray">
          <AdminPanelSettings className="w-3.5 h-3.5 text-primary mr-1" />
          SYS
        </Badge>
      </div>

      <nav className="mt-4 space-y-1.5">
        {/* Regular nav items */}
        {sidebarItems.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition",
              item?.active
                ? "bg-primary/15 text-slate-950 dark:text-white border border-primary/25"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800",
            )}
            onClick={() => isMobile && setMobileMenuOpen(false)}
          >
            <item.icon className="w-5 h-5 text-primary" />
            {item.label}
          </Link>
        ))}

        {/* Config section */}
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 mb-2">
            Config
          </div>
          {sidebarItems[5].items.map((item) => (
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
        </div>
      </nav>

      <div className="mt-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            Config pages control global platform behavior: pricing, scheduling
            rules, notifications, and compliance/insurance settings.
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
              to="/admin-users"
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
                  Configuration
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
            Admin
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
            {/* Page header */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 dark:text-white border border-primary/25 w-fit">
                      <Tune className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Config Hub
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Admin Configuration
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Manage global policies that control pricing, scheduling,
                      notifications, and compliance/insurance behavior.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <PriceChange className="w-3.5 h-3.5 text-primary mr-1" />
                        Pricing
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <CalendarMonth className="w-3.5 h-3.5 text-primary mr-1" />
                        Scheduling
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Notifications className="w-3.5 h-3.5 text-primary mr-1" />
                        Notifications
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Shield className="w-3.5 h-3.5 text-primary mr-1" />
                        Compliance
                      </Badge>
                    </div>
                  </div>

                  <div className="xl:w-[520px]">
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Quick Checks
                        </div>
                        <Badge variant="outline" className="chip-emerald">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Active
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {MOCK_CONFIG.quickChecks.map((check) => (
                          <div
                            key={check.label}
                            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                          >
                            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                              {check.label}
                            </div>
                            <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                              {check.value}
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Values are pulled from Admin policy config.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Config cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MOCK_CONFIG.configCards.map((card) => (
                <Link
                  key={card.href}
                  to={card.href}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 hover-lift"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <card.icon className="w-5 h-5 text-primary font-bold" />
                    </div>
                    <Badge
                      variant="outline"
                      className="chip-gray group-hover:border-primary/40 group-hover:bg-primary/10 transition"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-primary mr-1" />
                      Open
                    </Badge>
                  </div>

                  <h2 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">
                    {card.title}
                  </h2>

                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.description}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.chips.map((chip) => (
                      <Badge
                        key={chip.label}
                        variant="outline"
                        className="chip-gray"
                      >
                        <chip.icon className="w-3.5 h-3.5 text-primary mr-1" />
                        {chip.label}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </section>

            {/* Guardrails */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                      Guardrails
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Recommended defaults for platform configuration.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="chip-gray">
                    <FactCheck className="w-3.5 h-3.5 text-primary mr-1" />
                    Defaults
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MOCK_CONFIG.guardrails.map((guardrail) => (
                    <div
                      key={guardrail.title}
                      className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <guardrail.icon className="w-4 h-4 text-primary" />
                        {guardrail.title}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-2">
                        {guardrail.description}
                      </p>
                    </div>
                  ))}
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
                Admin • Config Hub
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
