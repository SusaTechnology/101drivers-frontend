// components/pages/admin-dashboard.tsx
import React, { useState, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  Verified,
  RefreshCw,
  LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import type { DashboardQueryParams } from '@/types/dashboard';

// Dashboard Components
import { GlobalFilterBar } from '@/components/dashboard/GlobalFilterBar';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { AlertsStrip } from '@/components/dashboard/AlertsStrip';
import { LiveTrackingSection } from '@/components/dashboard/LiveTrackingSection';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { PipelineChart } from '@/components/dashboard/PipelineChart';
import { OperationsHealth } from '@/components/dashboard/OperationsHealth';
import { FinanceSnapshot } from '@/components/dashboard/FinanceSnapshot';
import { PricingSnapshot } from '@/components/dashboard/PricingSnapshot';
import { SchedulingPolicy } from '@/components/dashboard/SchedulingPolicy';
import { ActorSummary } from '@/components/dashboard/ActorSummary';
import { DealerActivity } from '@/components/dashboard/DealerActivity';
import { DriverOperations } from '@/components/dashboard/DriverOperations';
import { DeliveryBreakdowns } from '@/components/dashboard/DeliveryBreakdowns';
import { ReportsPreview } from '@/components/dashboard/ReportsPreview';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';

export default function AdminDashboardPage() {
  const { actionItems, signOut } = useAdminActions();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterParams, setFilterParams] = useState<DashboardQueryParams>({});

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading,
    isFetching,
    refetch,
  } = useAdminDashboard(filterParams, {
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  // Handle filter changes
  const handleFiltersChange = useCallback((params: DashboardQueryParams) => {
    setFilterParams(params);
  }, []);

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

      <main className="w-full max-w-[1600px] mx-auto px-4 lg:px-5 py-4 lg:py-5">
        {/* ========================================== */}
        {/* ROW 0: Page Header - Compact */}
        {/* ========================================== */}
        <section className="mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <LayoutDashboard className="w-3 h-3 text-primary mr-1" />
                  Operations Command Center
                </Badge>
                <Badge
                  variant="outline"
                  className="badge bg-primary/10 border-primary/25 text-primary-foreground"
                >
                  <Verified className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/admin-deliveries"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm bg-primary text-slate-950 hover:shadow-lg hover:shadow-primary/20 transition"
              >
                Open Deliveries
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* ROW 1: Global Filter Bar */}
        {/* ========================================== */}
        <section className="mb-4">
          <GlobalFilterBar
            filtersApplied={dashboardData?.filtersApplied}
            onFiltersChange={handleFiltersChange}
            onRefresh={handleRefresh}
            isLoading={isFetching}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 2: Hero Summary Cards */}
        {/* ========================================== */}
        <section className="mb-4">
          <SummaryCards
            data={dashboardData?.summaryCards}
            isLoading={isLoading}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 3: Alerts Strip (if present) */}
        {/* ========================================== */}
        {dashboardData?.alerts && dashboardData.alerts.items.length > 0 && (
          <section className="mb-4">
            <AlertsStrip
              data={dashboardData.alerts}
              isLoading={isLoading}
            />
          </section>
        )}

        {/* ========================================== */}
        {/* ROW 4: Live Operations & Needs Attention */}
        {/* ========================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <LiveTrackingSection
            liveTrackingOverview={dashboardData?.liveTrackingOverview}
            activeDeliveries={dashboardData?.activeDeliveries}
            isLoading={isLoading}
          />
          <NeedsAttention
            data={dashboardData?.needsAttention}
            isLoading={isLoading}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 5: Pipeline & Operations Health */}
        {/* ========================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <PipelineChart
            data={dashboardData?.pipeline}
            isLoading={isLoading}
          />
          <OperationsHealth
            data={dashboardData?.operations}
            isLoading={isLoading}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 6: Finance Snapshot */}
        {/* ========================================== */}
        <section className="mb-4">
          <FinanceSnapshot
            finance={dashboardData?.finance}
            financialSnapshot={dashboardData?.financialSnapshot}
            isLoading={isLoading}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 7: Actor Summary, Pricing, Scheduling - 3 columns */}
        {/* ========================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <ActorSummary
            data={dashboardData?.actorSummary}
            isLoading={isLoading}
          />
          <PricingSnapshot
            data={dashboardData?.pricingSnapshot}
            isLoading={isLoading}
          />
          <SchedulingPolicy
            data={dashboardData?.schedulingPolicy}
            isLoading={isLoading}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 8: Dealer Activity & Driver Operations */}
        {/* ========================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DealerActivity
            data={dashboardData?.dealerActivity}
            isLoading={isLoading}
          />
          <DriverOperations
            data={dashboardData?.driverOperations}
            isLoading={isLoading}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 9: Delivery Breakdowns & Reports - Side by Side */}
        {/* ========================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DeliveryBreakdowns
            data={dashboardData?.deliveryBreakdowns}
            isLoading={isLoading}
          />
          <ReportsPreview
            data={dashboardData?.reportsPreview}
            isLoading={isLoading}
          />
        </section>

        {/* ========================================== */}
        {/* ROW 10: Quick Actions & Recent Activity */}
        {/* ========================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <QuickActions
            data={dashboardData?.quickActions}
            isLoading={isLoading}
          />
          <RecentActivity
            data={dashboardData?.recent}
            isLoading={isLoading}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-8 pb-8">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Admin Console • California-only operations
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
