// components/pages/admin-reports.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import {
  LayoutDashboard as Analytics,
  RefreshCw,
  Download,
  ArrowRight,
  Truck,
  ShieldCheck,
  Scale,
  CreditCard,
  Wallet,
  Car,
  FileBarChart,
} from 'lucide-react';

// Report cards configuration - matching backend API endpoints
const reportCards = [
  {
    title: 'Deliveries Report',
    description: 'Delivery volume, lifecycle outcomes, service type distribution, and dealer/driver activity.',
    link: '/admin-report-deliveries',
    icon: Truck,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    title: 'Compliance Report',
    description: 'VIN, odometer, photo completeness, and missing-evidence breakdowns.',
    link: '/admin-report-compliance',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    title: 'Disputes Report',
    description: 'Open/resolved disputes, legal holds, reasons, and resolution trends.',
    link: '/admin-report-disputes',
    icon: Scale,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
  },
  {
    title: 'Payments Report',
    description: 'Prepaid/postpaid performance, failures, invoice state, and payment status.',
    link: '/admin-report-payments',
    icon: CreditCard,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
  },
  {
    title: 'Payouts Report',
    description: 'Driver payout breakdown, gross/net amounts, platform fees, and payout status.',
    link: '/admin-report-payouts',
    icon: Wallet,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    title: 'Insurance & Mileage',
    description: 'Miles driven, insurance fees, and period aggregations for insurer review.',
    link: '/admin-insurance-reporting',
    icon: Car,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
];

const AdminReportsHubPage: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Navbar */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 border-primary/25 text-primary-foreground">
                <Analytics className="w-3.5 h-3.5 mr-1" />
                Analytics
              </Badge>
              <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                Reporting Hub
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Reports</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Operational reports for deliveries, compliance, disputes, payments, payouts, and insurance mileage.
            </p>
          </div>
        </section>

        {/* Report Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.link}
                className="block group focus:outline-none"
              >
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/30 hover:shadow-md transition-all h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${card.bgColor}`}>
                        <Icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-black text-slate-900 dark:text-white">
                          {card.title}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {card.description}
                        </div>
                        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                          Open report
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>

        {/* Info Note */}
        <section className="mt-8">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-4 flex items-start gap-3">
              <FileBarChart className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Export Options
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  All reports support CSV, Excel (XLSX), and PDF export formats for download.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AdminReportsHubPage;
