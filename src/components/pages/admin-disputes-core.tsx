import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navbar } from "../shared/layout/testNavbar";
import { navItems } from "@/lib/items/navItems";
import { Brand } from "@/lib/items/brand";
import { useAdminActions } from "@/hooks/useAdminActions";
import { Gavel, Download, RefreshCw } from "lucide-react";

// Types
interface Dispute {
  id: string;
  deliveryId: string;
  dealer: string;
  reason: string;
  openedAt: string;
  status: "open" | "under_review" | "legal_hold" | "resolved";
  statusLabel: string;
  statusColor: string;
}

// Data
const initialDisputes: Dispute[] = [
  {
    id: "DSP-2041",
    deliveryId: "DLV-10311",
    dealer: "Bay Auto Sales LLC",
    reason: "Damage reported at drop-off",
    openedAt: "Mar 19, 2:11 PM",
    status: "open",
    statusLabel: "OPEN",
    statusColor: "rose",
  },
  {
    id: "DSP-2042",
    deliveryId: "DLV-10312",
    dealer: "Bay Auto Sales LLC",
    reason: "Damage reported at drop-off",
    openedAt: "Mar 19, 2:12 PM",
    status: "open",
    statusLabel: "OPEN",
    statusColor: "rose",
  },
  {
    id: "DSP-2043",
    deliveryId: "DLV-10313",
    dealer: "Bay Auto Sales LLC",
    reason: "Damage reported at drop-off",
    openedAt: "Mar 19, 2:13 PM",
    status: "open",
    statusLabel: "OPEN",
    statusColor: "rose",
  },
  {
    id: "DSP-2044",
    deliveryId: "DLV-10314",
    dealer: "Bay Auto Sales LLC",
    reason: "Damage reported at drop-off",
    openedAt: "Mar 19, 2:14 PM",
    status: "open",
    statusLabel: "OPEN",
    statusColor: "rose",
  },
  {
    id: "DSP-2045",
    deliveryId: "DLV-10315",
    dealer: "Bay Auto Sales LLC",
    reason: "Damage reported at drop-off",
    openedAt: "Mar 19, 2:15 PM",
    status: "open",
    statusLabel: "OPEN",
    statusColor: "rose",
  },
  // Additional status data
  {
    id: "DSP-2046",
    deliveryId: "DLV-10316",
    dealer: "Elite Motors",
    reason: "Missing item in delivery",
    openedAt: "Mar 18, 10:30 AM",
    status: "under_review",
    statusLabel: "UNDER REVIEW",
    statusColor: "amber",
  },
  {
    id: "DSP-2047",
    deliveryId: "DLV-10317",
    dealer: "City Cars",
    reason: "Dispute: incorrect odometer",
    openedAt: "Mar 17, 3:45 PM",
    status: "legal_hold",
    statusLabel: "LEGAL HOLD",
    statusColor: "purple",
  },
];

const AdminDisputes: React.FC = () => {
  const navigate = useNavigate();
  const { actionItems, signOut } = useAdminActions();

  // State
  const [disputes, setDisputes] = useState<Dispute[]>(initialDisputes);
  const [filteredDisputes, setFilteredDisputes] = useState<Dispute[]>(initialDisputes);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dealerFilter, setDealerFilter] = useState<string>("");

  // Metrics
  const openCount = disputes.filter((d) => d.status === "open").length;
  const underReviewCount = disputes.filter((d) => d.status === "under_review").length;
  const legalHoldCount = disputes.filter((d) => d.status === "legal_hold").length;
  // Mock average resolution time
  const avgResolutionDays = "2.3d";

  // Filter logic
  const applyFilters = () => {
    let filtered = [...disputes];
    if (statusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }
    if (dealerFilter.trim()) {
      filtered = filtered.filter((d) =>
        d.dealer.toLowerCase().includes(dealerFilter.toLowerCase())
      );
    }
    setFilteredDisputes(filtered);
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setDealerFilter("");
    setFilteredDisputes(disputes);
  };

  const refreshQueue = () => {
    resetFilters();
    // In a real app, you'd refetch data here
    console.log("Queue refreshed");
  };

  const exportDisputeReport = () => {
    console.log("Export dispute report");
    // Implement export logic
  };

  // Action handlers
  const handleOpenDispute = (disputeId: string) => {
    // navigate(`/admin/disputes/${disputeId}`);
  };

  const handleApplyHold = (disputeId: string) => {
    console.log(`Apply hold to dispute ${disputeId}`);
    // Open modal or call API
  };

  const handleExportPackage = (disputeId: string) => {
    console.log(`Export evidence package for dispute ${disputeId}`);
    // Implement export
  };

  // Status badge helper
  const getStatusBadge = (status: Dispute["status"], label: string, color: string) => {
    const colorMap: Record<string, string> = {
      rose: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
      amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
      purple: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300",
    };
    return (
      <Badge className={`${colorMap[color]} hover:${colorMap[color]}`}>
        {label}
      </Badge>
    );
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
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:border-rose-800">
                <Gavel className="h-4 w-4" />
                Dispute Operations
              </div>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black mt-4">Admin disputes</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-4xl">
              Central queue for dispute review, legal hold, evidence package export, and resolution workflows.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={exportDisputeReport}
              className="rounded-2xl gap-2"
            >
              <Download className="h-4 w-4" />
              Export dispute report
            </Button>
            <Button
              onClick={refreshQueue}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Queue
            </Button>
          </div>
        </section>

        {/* Main Grid */}
        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          {/* Filters Sidebar */}
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
            <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Filters
                </div>
                <CardTitle className="text-xl font-black mt-1">Dispute filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 sm:px-7 py-6 space-y-5">
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="legal_hold">Legal Hold</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Dealer
                </label>
                <Input
                  placeholder="Search dealer"
                  value={dealerFilter}
                  onChange={(e) => setDealerFilter(e.target.value)}
                  className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={applyFilters}
                  className="bg-primary text-slate-950 hover:bg-primary/90 flex-1 rounded-2xl"
                >
                  Apply
                </Button>
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  className="flex-1 rounded-2xl"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Open
                </div>
                <div className="text-2xl font-black mt-2">{openCount}</div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Under review
                </div>
                <div className="text-2xl font-black mt-2">{underReviewCount}</div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Legal hold
                </div>
                <div className="text-2xl font-black mt-2">{legalHoldCount}</div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Avg resolution
                </div>
                <div className="text-2xl font-black mt-2">{avgResolutionDays}</div>
              </Card>
            </div>

            {/* Disputes List */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Queue
                  </div>
                  <CardTitle className="text-2xl font-black mt-1">Dispute cases</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 space-y-4">
                {filteredDisputes.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No disputes found</div>
                ) : (
                  filteredDisputes.map((dispute) => (
                    <Card
                      key={dispute.id}
                      className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4"
                    >
                      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {dispute.id}
                            </Badge>
                            {getStatusBadge(dispute.status, dispute.statusLabel, dispute.statusColor)}
                          </div>
                          <div className="mt-3 text-lg font-black">
                            {dispute.deliveryId} • {dispute.dealer}
                          </div>
                          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Reason: {dispute.reason} • Opened {dispute.openedAt}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleOpenDispute(dispute.id)}
                            className="rounded-2xl"
                          >
                            Open
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleApplyHold(dispute.id)}
                            className="rounded-2xl"
                          >
                            Apply hold
                          </Button>
                          <Button
                            onClick={() => handleExportPackage(dispute.id)}
                            className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl"
                          >
                            Export package
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDisputes;