import React from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navbar } from "../shared/layout/testNavbar";
import { navItems } from "@/lib/items/navItems";
import { Brand } from "@/lib/items/brand";
import { useAdminActions } from "@/hooks/useAdminActions";
import { LayoutDashboard as Analytics, RefreshCw, Download, ArrowRight } from "lucide-react";

// Mock data for metrics (could come from API)
const metrics = {
  deliveriesThisMonth: 482,
  openDisputes: 12,
  pendingPayouts: "$8.7k",
};

// Report cards configuration
const reportCards = [
  {
    title: "Deliveries report",
    description:
      "Delivery volume, lifecycle outcomes, service type distribution, and dealer/driver activity.",
    link: "/admin/reports/deliveries",
    color: "primary",
  },
  {
    title: "Compliance report",
    description:
      "VIN, odometer, photo completeness, and missing-evidence breakdowns.",
    link: "/admin/reports/compliance",
    color: "primary",
  },
  {
    title: "Disputes report",
    description:
      "Open/resolved disputes, legal holds, reasons, and resolution trends.",
    link: "/admin/reports/disputes",
    color: "primary",
  },
  {
    title: "Payments report",
    description:
      "Prepaid/postpaid performance, failures, invoice state, and payouts.",
    link: "/admin/reports/payments",
    color: "primary",
  },
  {
    title: "Ops summary",
    description:
      "Executive snapshot for active jobs, issues, payouts, and mileage.",
    link: "/admin/reports/ops-summary",
    color: "primary",
  },
  {
    title: "Insurance reporting",
    description:
      "Miles, fees, and exports for insurer and operations review.",
    link: "/admin/insurance-reporting", // matches original href
    color: "primary",
  },
];

const AdminReports: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  const handleScheduleExport = () => {
    console.log("Schedule export clicked");
    // Implement export scheduling logic
  };

  const handleRefreshKPIs = () => {
    console.log("Refresh KPIs clicked");
    // Implement KPI refresh logic
  };

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
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
        {/* Hero Section */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-slate-800 dark:text-slate-200">
                <Analytics className="h-4 w-4" />
                Reporting Hub
              </div>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black mt-4">Admin reports</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-4xl">
              Entry point to deliveries, compliance, disputes, payments, insurance, and executive operations reporting.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleScheduleExport}
              className="rounded-2xl gap-2"
            >
              <Download className="h-4 w-4" />
              Schedule export
            </Button>
            <Button
              onClick={handleRefreshKPIs}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh KPIs
            </Button>
          </div>
        </section>

        {/* Metric Cards */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Deliveries this month
            </div>
            <div className="text-2xl font-black mt-2">{metrics.deliveriesThisMonth}</div>
          </Card>
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Open disputes
            </div>
            <div className="text-2xl font-black mt-2">{metrics.openDisputes}</div>
          </Card>
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Pending payouts
            </div>
            <div className="text-2xl font-black mt-2">{metrics.pendingPayouts}</div>
          </Card>
        </section>

        {/* Report Cards Grid */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {reportCards.map((card) => (
            <Link
              key={card.title}
              to={card.link}
              className="block group focus:outline-none"
            >
              <Card className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow duration-200 h-full">
                <CardContent className="p-6">
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {card.title}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {card.description}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-primary group-hover:gap-3 transition-all">
                    Open report
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
};

export default AdminReports;