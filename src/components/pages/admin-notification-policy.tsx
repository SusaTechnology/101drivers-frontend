// @ts-nocheck
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
  LogOut,
  Sun,
  Moon,
  Save,
  Mail,
  MessageCircle as Sms,
  Bell,
  BellRing as NotificationsActive,
  UserCog as ManageAccounts,
  SlidersHorizontal as Tune,
  Clock as Schedule,
  Info,
  Settings,
  Filter as FilterAlt,
  AlertCircle as PriorityHigh,
  Plus as Add,
  FileText as Description,
  Edit,
  Check,
  Ban as Block,
  CircleAlert as Error,
  Download,
  MailCheck as MarkEmailRead,
  Eye as Visibility,
  X as Close,
  MapPin as LocationOn,
  Bell as Notifications,
  Shield,
  Group,
  Truck as LocalShipping,
  CreditCard,
  Gavel,
  TrendingUp as PriceChange,
  Calendar as CalendarMonth,
  ArrowLeft as ArrowBack,
  BellOff as NotificationsOff,
  BellMinus as NotificationsPaused,
  Gauge as Speed,
  Timer,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  AlertTriangle as Warning,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

// Form schemas
const quietHoursSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
});

const rateLimitSchema = z.object({
  limit: z.number().min(1).max(50),
});

const dedupeWindowSchema = z.object({
  window: z.string(),
});

const eventRuleSchema = z.object({
  eventCode: z.string(),
  eventName: z.string(),
  priority: z.enum(["Normal", "High", "Critical"]),
  recipients: z.object({
    customer: z.boolean(),
    dealer: z.boolean(),
    driver: z.boolean(),
    admin: z.boolean(),
  }),
  channels: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    inApp: z.boolean(),
  }),
});

// type QuietHoursFormData = z.infer<typeof quietHoursSchema>;
// type RateLimitFormData = z.infer<typeof rateLimitSchema>;
// type DedupeWindowFormData = z.infer<typeof dedupeWindowSchema>;
type EventRuleFormData = z.infer<typeof eventRuleSchema>;

// Mock data
const MOCK_NOTIFICATION_POLICY = {
  channels: [
    {
      id: "email",
      name: "Email notifications",
      description: "Required in PRD (email-first). Used for all stakeholders.",
      icon: Mail,
      enabled: true,
      required: true,
    },
    {
      id: "sms",
      name: "SMS notifications",
      description:
        "Optional. Only used if enabled by policy and the user has a valid phone + consent.",
      icon: Sms,
      enabled: false,
      required: false,
    },
    {
      id: "inApp",
      name: "In-app notifications",
      description:
        "Optional. Keeps an internal activity feed in Admin/Dealer/Driver portals.",
      icon: Bell,
      enabled: true,
      required: false,
    },
  ],

  quietHours: {
    enabled: true,
    startTime: "21:00",
    endTime: "07:00",
  },

  rateLimit: {
    limit: 10,
    unit: "per hour",
    default: 10,
  },

  dedupeWindow: {
    options: ["5 minutes", "15 minutes", "30 minutes", "60 minutes"],
    default: "15 minutes",
  },

  eventRules: [
    {
      eventCode: "DELIVERY.BOOKED",
      eventName: "Delivery booked",
      recipients: ["Customer", "Dealer", "Assigned Driver"],
      channels: {
        email: true,
        sms: false,
        inApp: true,
      },
      priority: "Normal",
      priorityColor: "gray",
    },
    {
      eventCode: "DELIVERY.ASSIGNMENT_UPDATED",
      eventName: "Driver assigned / changed",
      recipients: ["Customer", "Dealer", "Driver"],
      channels: {
        email: true,
        sms: false,
        inApp: true,
      },
      priority: "High",
      priorityColor: "amber",
    },
    {
      eventCode: "PAYMENT.FAILED",
      eventName: "Payment failed",
      recipients: ["Customer", "Admin"],
      channels: {
        email: true,
        sms: true,
        inApp: true,
      },
      priority: "Critical",
      priorityColor: "rose",
    },
    {
      eventCode: "DISPUTE.OPENED",
      eventName: "Dispute opened",
      recipients: ["Customer", "Dealer", "Admin", "Driver"],
      channels: {
        email: true,
        sms: false,
        inApp: true,
      },
      priority: "High",
      priorityColor: "amber",
    },
    {
      eventCode: "DELIVERY.COMPLETED",
      eventName: "Delivery completed",
      recipients: ["Customer", "Dealer", "Driver"],
      channels: {
        email: true,
        sms: false,
        inApp: true,
      },
      priority: "Normal",
      priorityColor: "gray",
    },
  ],
};

// Sidebar navigation items
const sidebarItems = [
  {
    section: "Config",
    items: [
      { href: "/admin-pricing", label: "Pricing", icon: PriceChange },
      {
        href: "/admin-scheduling-policy",
        label: "Scheduling Policy",
        icon: CalendarMonth,
      },
      {
        href: "/admin-notifications-policy",
        label: "Notification Policy",
        icon: Bell,
        active: true,
      },
      {
        href: "/admin-insurance-reporting",
        label: "Insurance & Reporting",
        icon: Shield,
      },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/admin-users", label: "Users", icon: Group },
      { href: "/admin-deliveries", label: "Deliveries", icon: LocalShipping },
      { href: "/admin-payments", label: "Payments", icon: CreditCard },
      { href: "/admin-disputes", label: "Disputes", icon: Gavel },
    ],
  },
];

export default function AdminNotificationPolicyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Form states
  const [quietHours, setQuietHours] = useState(
    MOCK_NOTIFICATION_POLICY.quietHours,
  );
  const [rateLimit, setRateLimit] = useState(
    MOCK_NOTIFICATION_POLICY.rateLimit.limit,
  );
  const [dedupeWindow, setDedupeWindow] = useState(
    MOCK_NOTIFICATION_POLICY.dedupeWindow.default,
  );
  const [channels, setChannels] = useState(MOCK_NOTIFICATION_POLICY.channels);
  const [eventRules, setEventRules] = useState(
    MOCK_NOTIFICATION_POLICY.eventRules,
  );

  // Form for editing event rule
  const eventRuleForm = useForm<EventRuleFormData>({
    resolver: zodResolver(eventRuleSchema),
    defaultValues: {
      eventCode: "",
      eventName: "",
      priority: "Normal",
      recipients: {
        customer: true,
        dealer: true,
        driver: true,
        admin: false,
      },
      channels: {
        email: true,
        sms: false,
        inApp: true,
      },
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

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSavePolicy();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
    toast.success(`${theme === "dark" ? "Light" : "Dark"} mode activated`);
  };

  const handleSignOut = () => {
    toast.success("Signed out successfully");
    navigate({ to: "/auth/admin-signin" });
  };

  const handleSavePolicy = () => {
    toast.success("Policy saved", {
      description: "Notification policy has been updated.",
    });
  };

  const handleTestPolicy = () => {
    toast.info("Test notification", {
      description: "Test notification queued and sent to admin email.",
    });
  };

  const handleExportPolicy = () => {
    const policy = {
      channels,
      quietHours,
      rateLimit,
      dedupeWindow,
      eventRules,
    };
    const blob = new Blob([JSON.stringify(policy, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notification-policy.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Policy exported", {
      description: "Notification policy exported as JSON.",
    });
  };

  const handlePreviewPolicy = () => {
    toast.info("Preview mode", {
      description: "Preview of notification policy changes.",
    });
  };

  const handleChannelToggle = (channelId: string, enabled: boolean) => {
    setChannels(
      channels.map((ch) => (ch.id === channelId ? { ...ch, enabled } : ch)),
    );

    toast.info(
      `${channelId.toUpperCase()} ${enabled ? "enabled" : "disabled"}`,
      {
        description: enabled
          ? `${channelId.toUpperCase()} notifications are now active.`
          : `${channelId.toUpperCase()} notifications have been turned off.`,
      },
    );
  };

  const handleQuietHoursToggle = (enabled: boolean) => {
    setQuietHours({ ...quietHours, enabled });
    toast.info(`Quiet hours ${enabled ? "enabled" : "disabled"}`, {
      description: enabled
        ? "Non-critical notifications will be held during quiet hours."
        : "All notifications will be sent immediately.",
    });
  };

  const handleOpenModal = (rule?: any) => {
    if (rule) {
      setEditingRule(rule);
      eventRuleForm.reset({
        eventCode: rule.eventCode,
        eventName: rule.eventName,
        priority: rule.priority as any,
        recipients: {
          customer: rule.recipients.includes("Customer"),
          dealer: rule.recipients.includes("Dealer"),
          driver:
            rule.recipients.includes("Driver") ||
            rule.recipients.includes("Assigned Driver"),
          admin: rule.recipients.includes("Admin"),
        },
        channels: rule.channels,
      });
    } else {
      setEditingRule(null);
      eventRuleForm.reset({
        eventCode: "",
        eventName: "",
        priority: "Normal",
        recipients: {
          customer: true,
          dealer: true,
          driver: true,
          admin: false,
        },
        channels: {
          email: true,
          sms: false,
          inApp: true,
        },
      });
    }
    setModalOpen(true);
  };

  const handleSaveRule = (data: EventRuleFormData) => {
    const recipients = [];
    if (data.recipients.customer) recipients.push("Customer");
    if (data.recipients.dealer) recipients.push("Dealer");
    if (data.recipients.driver)
      recipients.push(
        data.eventCode.includes("ASSIGNMENT") ? "Driver" : "Assigned Driver",
      );
    if (data.recipients.admin) recipients.push("Admin");

    const priorityColor =
      data.priority === "Critical"
        ? "rose"
        : data.priority === "High"
          ? "amber"
          : "gray";

    const newRule = {
      eventCode: data.eventCode,
      eventName: data.eventName,
      recipients,
      channels: data.channels,
      priority: data.priority,
      priorityColor,
    };

    if (editingRule) {
      setEventRules(
        eventRules.map((r) =>
          r.eventCode === editingRule.eventCode ? newRule : r,
        ),
      );
      toast.success("Rule updated", {
        description: `Event rule for ${data.eventName} has been updated.`,
      });
    } else {
      setEventRules([...eventRules, newRule]);
      toast.success("Rule added", {
        description: `New event rule for ${data.eventName} has been created.`,
      });
    }

    setModalOpen(false);
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
          Config
        </div>
        <Badge variant="outline" className="chip-gray">
          <Tune className="w-3.5 h-3.5 text-primary mr-1" />
          Admin
        </Badge>
      </div>

      <nav className="mt-4 space-y-1.5">
        {sidebarItems.map((section) => (
          <div key={section.section}>
            {section.items.map((item) => (
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
            {section.section !==
              sidebarItems[sidebarItems.length - 1].section && (
              <Separator className="my-4" />
            )}
          </div>
        ))}
      </nav>

      <div className="mt-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            PRD: Notifications are{" "}
            <span className="font-black">email-first</span>. SMS is optional and
            only used when enabled by Admin policy and supported by user
            consent.
          </p>
        </div>
      </div>
    </aside>
  );

  // Channel toggle component
  const ChannelToggle = ({ channel }: { channel: any }) => (
    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-6">
      <div className="flex items-start gap-3">
        <channel.icon className="w-5 h-5 text-primary mt-0.5" />
        <div>
          <div className="font-extrabold text-slate-900 dark:text-white">
            {channel.name}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
            {channel.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={channel.enabled}
          onCheckedChange={(checked) =>
            handleChannelToggle(channel.id, checked)
          }
          disabled={channel.required}
        />
        <span
          className={cn(
            "text-xs font-black min-w-[60px]",
            channel.enabled
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-500 dark:text-slate-400",
          )}
        >
          {channel.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
    </div>
  );

  // Status badge component for channels
  const ChannelBadge = ({
    channel,
    enabled,
    isSms = false,
  }: {
    channel: string;
    enabled: boolean;
    isSms?: boolean;
  }) => {
    if (enabled) {
      return (
        <Badge variant="outline" className="chip-emerald">
          <Check className="w-3.5 h-3.5 mr-1" />
          On
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="chip-gray">
        <Block className="w-3.5 h-3.5 mr-1" />
        Off
      </Badge>
    );
  };

  // Priority badge component
  const PriorityBadge = ({
    priority,
    color,
  }: {
    priority: string;
    color: string;
  }) => {
    const colors: Record<string, string> = {
      gray: "chip-gray",
      amber: "chip-amber",
      rose: "chip-rose",
    };

    const icons: Record<string, any> = {
      Normal: PriorityHigh,
      High: AlertCircle,
      Critical: AlertTriangle,
    };

    const Icon = icons[priority] || PriorityHigh;

    return (
      <Badge variant="outline" className={colors[color] || "chip-gray"}>
        <Icon className="w-3.5 h-3.5 mr-1" />
        {priority}
      </Badge>
    );
  };

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
              to="/admin-pricing"
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
                  Admin • Config
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Notification Policy
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <LocationOn className="w-4 h-4 text-primary" />
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
              to="/admin-config"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-extrabold text-slate-700 dark:text-slate-200"
            >
              <ArrowBack className="w-4 h-4 text-primary" />
              Back
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
            Config
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
                      <Bell className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Policy
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Notification Policy
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Control who receives updates and which channels are
                      allowed. PRD default is{" "}
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        email-first
                      </span>
                      ; SMS is optional.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <Mail className="w-3.5 h-3.5 text-primary mr-1" />
                        Email
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Sms className="w-3.5 h-3.5 text-primary mr-1" />
                        SMS (optional)
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <NotificationsActive className="w-3.5 h-3.5 text-primary mr-1" />
                        Event routing
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <ManageAccounts className="w-3.5 h-3.5 text-primary mr-1" />
                        Role-based recipients
                      </Badge>
                    </div>
                  </div>

                  <div className="xl:w-[520px]">
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Quick Actions
                        </div>
                        <div className="flex gap-1">
                          <Kbd className="kbd">⌘</Kbd>
                          <Kbd className="kbd">S</Kbd>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button
                          onClick={handleSavePolicy}
                          className="lime-btn px-6 py-3 rounded-2xl hover:shadow-lg hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Save Policy
                        </Button>
                        <Button
                          onClick={handleTestPolicy}
                          variant="outline"
                          className="px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-2"
                        >
                          <MarkEmailRead className="w-4 h-4 text-primary" />
                          Send Test
                        </Button>
                        <Button
                          onClick={handleExportPolicy}
                          variant="outline"
                          className="sm:col-span-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4 text-primary" />
                          Export Policy (JSON)
                        </Button>
                      </div>

                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Prototype: Save/Test/Export are UI-only right now.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Global toggles */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <Card className="xl:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">
                        Channels
                      </CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Enable/disable notification channels globally.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <Tune className="w-3.5 h-3.5 text-primary mr-1" />
                      Global
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {channels.map((channel) => (
                    <ChannelToggle key={channel.id} channel={channel} />
                  ))}

                  <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                    <Info className="h-4 w-4 text-amber-500" />
                    <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                      SMS Compliance
                    </AlertTitle>
                    <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                      If SMS is enabled, ensure opt-in/consent flow exists and
                      delivery updates are compliant with carrier rules.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Throttling + quiet hours */}
              <Card className="xl:col-span-5 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">
                        Controls
                      </CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Reduce spam and enforce quiet hours.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <Schedule className="w-3.5 h-3.5 text-primary mr-1" />
                      Guardrails
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quiet Hours */}
                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          Quiet Hours
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                          Hold non-critical notifications during quiet hours
                          (local time).
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={quietHours.enabled}
                          onCheckedChange={handleQuietHoursToggle}
                        />
                        <span
                          className={cn(
                            "text-xs font-black min-w-[40px]",
                            quietHours.enabled
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-500 dark:text-slate-400",
                          )}
                        >
                          {quietHours.enabled ? "On" : "Off"}
                        </span>
                      </div>
                    </div>

                    {quietHours.enabled && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Start
                          </Label>
                          <Input
                            type="time"
                            value={quietHours.startTime}
                            onChange={(e) =>
                              setQuietHours({
                                ...quietHours,
                                startTime: e.target.value,
                              })
                            }
                            className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            End
                          </Label>
                          <Input
                            type="time"
                            value={quietHours.endTime}
                            onChange={(e) =>
                              setQuietHours({
                                ...quietHours,
                                endTime: e.target.value,
                              })
                            }
                            className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-start gap-3">
                      <PriorityHigh className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Critical events (security, payment failures, disputes
                        escalation) can bypass quiet hours.
                      </p>
                    </div>
                  </div>

                  {/* Rate limiting */}
                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      Rate limiting
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                      Maximum notifications per recipient per hour
                      (non-critical).
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={rateLimit}
                        onChange={(e) => setRateLimit(parseInt(e.target.value))}
                        className="h-12 w-28 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm font-extrabold"
                      />
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                        per hour
                      </span>
                      <Badge variant="outline" className="chip-gray ml-auto">
                        <Settings className="w-3.5 h-3.5 text-primary mr-1" />
                        Default 10
                      </Badge>
                    </div>
                  </div>

                  {/* Deduplication window */}
                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      Deduplicate window
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                      Avoid sending the same message repeatedly.
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <Select
                        value={dedupeWindow}
                        onValueChange={setDedupeWindow}
                      >
                        <SelectTrigger className="h-12 flex-1 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                          <SelectValue placeholder="Select window" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_NOTIFICATION_POLICY.dedupeWindow.options.map(
                            (option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className="chip-gray">
                        <FilterAlt className="w-3.5 h-3.5 text-primary mr-1" />
                        Dedupe
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Event routing table */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black">
                      Event Routing
                    </CardTitle>
                    <CardDescription className="text-sm mt-2">
                      Configure recipients and channels by event. Email is
                      always available; SMS depends on policy.
                    </CardDescription>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleOpenModal()}
                      variant="outline"
                      className="px-5 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition inline-flex items-center gap-2"
                    >
                      <Add className="w-4 h-4 text-primary" />
                      Add Event Rule
                    </Button>
                    <Link
                      to="/admin-notification-templates"
                      className="hidden sm:inline-flex px-5 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition items-center gap-2"
                    >
                      <Description className="w-4 h-4 text-primary" />
                      Templates
                    </Link>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950">
                      <TableRow>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Event
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Recipients
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Email
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          SMS
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          In-app
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Priority
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {eventRules.map((rule, index) => (
                        <TableRow key={index}>
                          <TableCell className="px-5 py-4">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {rule.eventName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {rule.eventCode}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                            {rule.recipients.join(", ")}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <ChannelBadge
                              channel="Email"
                              enabled={rule.channels.email}
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <ChannelBadge
                              channel="SMS"
                              enabled={rule.channels.sms}
                              isSms
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <ChannelBadge
                              channel="In-app"
                              enabled={rule.channels.inApp}
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <PriorityBadge
                              priority={rule.priority}
                              color={rule.priorityColor}
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <Button
                              onClick={() => handleOpenModal(rule)}
                              variant="outline"
                              size="sm"
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition text-xs font-extrabold text-slate-700 dark:text-slate-200"
                            >
                              <Edit className="w-4 h-4 text-primary" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tip: Keep SMS reserved for high-priority events to reduce
                    cost and noise.
                  </p>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSavePolicy}
                      className="lime-btn px-6 py-3 rounded-2xl hover:shadow-lg hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </Button>
                    <Button
                      onClick={handlePreviewPolicy}
                      variant="outline"
                      className="px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition inline-flex items-center justify-center gap-2"
                    >
                      <Visibility className="w-4 h-4 text-primary" />
                      Preview
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {/* Edit Rule Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogDescription className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              {editingRule ? "Edit Rule" : "Create Rule"}
            </DialogDescription>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white mt-1">
              Event Notification
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={eventRuleForm.handleSubmit(handleSaveRule)}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Event Code
                </Label>
                <Input
                  {...eventRuleForm.register("eventCode")}
                  className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm font-extrabold"
                  placeholder="EVENT.CODE"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Event Name
                </Label>
                <Input
                  {...eventRuleForm.register("eventName")}
                  className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm font-extrabold"
                  placeholder="Event display name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Priority
                </Label>
                <Select
                  onValueChange={(value) =>
                    eventRuleForm.setValue("priority", value as any)
                  }
                  defaultValue={eventRuleForm.getValues("priority")}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Recipients
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {["customer", "dealer", "driver", "admin"].map((role) => (
                  <Label
                    key={role}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                  >
                    <Checkbox
                      {...eventRuleForm.register(`recipients.${role}`)}
                      defaultChecked={eventRuleForm.getValues(
                        `recipients.${role}`,
                      )}
                    />
                    <span className="font-extrabold text-slate-900 dark:text-white capitalize">
                      {role === "driver" &&
                      eventRuleForm.watch("eventCode").includes("ASSIGNMENT")
                        ? "Driver"
                        : role === "driver"
                          ? "Assigned Driver"
                          : role}
                    </span>
                  </Label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Channels
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {["email", "sms", "inApp"].map((channel) => (
                  <Label
                    key={channel}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                  >
                    <span className="font-extrabold text-slate-900 dark:text-white capitalize">
                      {channel === "inApp" ? "In-app" : channel}
                    </span>
                    <Switch
                      {...eventRuleForm.register(`channels.${channel}`)}
                      checked={eventRuleForm.watch(`channels.${channel}`)}
                      onCheckedChange={(checked) =>
                        eventRuleForm.setValue(`channels.${channel}`, checked)
                      }
                    />
                  </Label>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                SMS respects global SMS enablement + recipient consent.
              </p>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="lime-btn px-6 py-3 rounded-2xl hover:shadow-lg hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                Admin • Notification Policy • Email-first
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
