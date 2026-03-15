// components/dashboard/QuickTools.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  Settings,
  Bell,
  FileText,
  ArrowRight,
  Network,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface QuickTool {
  href: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
}

const QUICK_TOOLS: QuickTool[] = [
  {
    href: '/admin-reports',
    icon: BarChart3,
    title: 'Reports hub',
    subtitle: 'Exports & KPIs',
  },
  {
    href: '/admin-config',
    icon: Settings,
    title: 'Config hub',
    subtitle: 'Policies & rules',
  },
  {
    href: '/admin-notification-policy',
    icon: Bell,
    title: 'Notification policy',
    subtitle: 'Email-first',
  },
  {
    href: '/admin-insurance-reporting',
    icon: FileText,
    title: 'Insurance report',
    subtitle: 'Miles & exports',
  },
];

export function QuickTools() {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
      <CardHeader className="p-6 sm:p-7">
        <CardTitle className="text-xl font-black">Quick tools</CardTitle>
        <CardDescription className="text-sm mt-1">
          Shortcuts to PRD-required admin actions and reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              to={tool.href}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <tool.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {tool.title}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {tool.subtitle}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-primary shrink-0" />
            </Link>
          ))}
        </div>

        <Alert className="mt-6 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm">
            Prototype UI
          </AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs">
            In the production app, these tools are permission-gated and all actions are logged (who/when/what/why).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export function AdminHubs() {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Admin hubs</CardTitle>
            <CardDescription className="text-sm mt-1">
              Central access to all configuration policies and reporting exports (PRD-aligned).
            </CardDescription>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Network className="w-6 h-6 text-primary font-bold" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/admin-reports"
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
          >
            Open Reports
            <BarChart3 className="w-4 h-4" />
          </Link>
          <Link
            to="/admin-config"
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
          >
            Open Config
            <Settings className="w-4 h-4 text-primary" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
