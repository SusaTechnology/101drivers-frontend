// components/pages/admin-dashboard.tsx
import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  Verified,
  RefreshCw,
  Calendar,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { ActiveDeliveries } from '@/components/dashboard/ActiveDeliveries';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { PricingSnapshot } from '@/components/dashboard/PricingSnapshot';
import { SchedulingPolicy } from '@/components/dashboard/SchedulingPolicy';
import { PipelineChart } from '@/components/dashboard/PipelineChart';
import { ActorSummary } from '@/components/dashboard/ActorSummary';
import { FinanceSummary } from '@/components/dashboard/FinanceSummary';
import { OperationsSummary } from '@/components/dashboard/OperationsSummary';
import { QuickTools, AdminHubs } from '@/components/dashboard/QuickTools';
import type { DashboardAction } from '@/types/dashboard';

export default function AdminDashboardPage() {
  const { actionItems, signOut } = useAdminActions();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: dashboardData,
    isLoading,
    refetch,
    isFetching,
  } = useAdminDashboard(undefined, {
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleActionClick = (action: DashboardAction) => {
    // Navigation is handled by the Link components
    console.log('Action clicked:', action);
  };

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
        {/* Top row */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
              <Verified className="w-3.5 h-3.5 text-primary font-bold" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                Admin Ops • CA MVP
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mt-4">
              Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg max-w-2xl leading-relaxed">
              Monitor deliveries, approvals, disputes, pricing, and policy. Use filters and deep links to resolve issues fast.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing || isFetching}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing || isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link
              to="/admin-users"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Review Approvals
              <Verified className="w-4 h-4 text-primary" />
            </Link>
            <Link
              to="/admin-deliveries"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition"
            >
              Open Deliveries
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* KPI cards */}
        <section className="mt-10">
          <SummaryCards
            data={dashboardData?.summaryCards}
            isLoading={isLoading}
            onActionClick={handleActionClick}
          />
        </section>

        {/* Delivery Pipeline */}
        <section className="mt-10">
          <PipelineChart data={dashboardData?.pipeline} isLoading={isLoading} />
        </section>

        {/* Main grid */}
        <section className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active deliveries */}
            <ActiveDeliveries
              data={dashboardData?.activeDeliveries}
              isLoading={isLoading}
              onActionClick={handleActionClick}
            />

            {/* Needs attention */}
            <NeedsAttention
              data={dashboardData?.needsAttention}
              isLoading={isLoading}
              onActionClick={handleActionClick}
            />

            {/* Operations Health */}
            <OperationsSummary data={dashboardData?.operations} isLoading={isLoading} />

            {/* Finance Overview */}
            <FinanceSummary data={dashboardData?.finance} isLoading={isLoading} />
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Pricing snapshot */}
            <PricingSnapshot data={dashboardData?.pricingSnapshot} isLoading={isLoading} />

            {/* Scheduling policy */}
            <SchedulingPolicy data={dashboardData?.schedulingPolicy} isLoading={isLoading} />

            {/* Actor Summary */}
            <ActorSummary data={dashboardData?.actorSummary} isLoading={isLoading} />

            {/* Quick tools */}
            <QuickTools />

            {/* Admin hubs callout */}
            <AdminHubs />
          </div>
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
