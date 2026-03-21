import React, { useState } from "react";
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
import { CreditCard as Payments, Download, RefreshCw } from "lucide-react";

// Types
interface PaymentRecord {
  deliveryId: string;
  dealer: string;
  totalAmount: number;
  insuranceFee: number;
  transactionFee: number;
  driverPayout: number;
  paymentStatus: "invoiced" | "paid" | "failed";
  billingMode: "prepaid" | "postpaid";
}

// Mock data
const initialPayments: PaymentRecord[] = [
  {
    deliveryId: "DLV-1121",
    dealer: "Bay Auto Sales LLC",
    totalAmount: 823.0,
    insuranceFee: 8.0,
    transactionFee: 25.5,
    driverPayout: 511.0,
    paymentStatus: "invoiced",
    billingMode: "postpaid",
  },
  {
    deliveryId: "DLV-1122",
    dealer: "Bay Auto Sales LLC",
    totalAmount: 846.0,
    insuranceFee: 8.0,
    transactionFee: 26.5,
    driverPayout: 522.0,
    paymentStatus: "invoiced",
    billingMode: "postpaid",
  },
  {
    deliveryId: "DLV-1123",
    dealer: "Bay Auto Sales LLC",
    totalAmount: 869.0,
    insuranceFee: 8.0,
    transactionFee: 27.5,
    driverPayout: 533.0,
    paymentStatus: "invoiced",
    billingMode: "postpaid",
  },
  {
    deliveryId: "DLV-1124",
    dealer: "Bay Auto Sales LLC",
    totalAmount: 892.0,
    insuranceFee: 8.0,
    transactionFee: 28.5,
    driverPayout: 544.0,
    paymentStatus: "invoiced",
    billingMode: "postpaid",
  },
  {
    deliveryId: "DLV-1125",
    dealer: "Bay Auto Sales LLC",
    totalAmount: 915.0,
    insuranceFee: 8.0,
    transactionFee: 29.5,
    driverPayout: 555.0,
    paymentStatus: "invoiced",
    billingMode: "postpaid",
  },
  {
    deliveryId: "DLV-1126",
    dealer: "Bay Auto Sales LLC",
    totalAmount: 938.0,
    insuranceFee: 8.0,
    transactionFee: 30.5,
    driverPayout: 566.0,
    paymentStatus: "invoiced",
    billingMode: "postpaid",
  },
];

const AdminPayments: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // State
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [filteredPayments, setFilteredPayments] = useState<PaymentRecord[]>(initialPayments);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [billingModeFilter, setBillingModeFilter] = useState<string>("all");

  // Metrics
  const totalInvoiced = payments.reduce((sum, p) => sum + p.totalAmount, 0);
  const awaitingPayment = payments
    .filter((p) => p.paymentStatus === "invoiced")
    .reduce((sum, p) => sum + p.totalAmount, 0);
  const pendingPayouts = payments
    .filter((p) => p.paymentStatus === "invoiced")
    .reduce((sum, p) => sum + p.driverPayout, 0);
  const failedItems = payments.filter((p) => p.paymentStatus === "failed").length;

  // Filter logic
  const applyFilters = () => {
    let filtered = [...payments];
    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter((p) => p.paymentStatus === paymentStatusFilter);
    }
    if (billingModeFilter !== "all") {
      filtered = filtered.filter((p) => p.billingMode === billingModeFilter);
    }
    setFilteredPayments(filtered);
  };

  const resetFilters = () => {
    setPaymentStatusFilter("all");
    setBillingModeFilter("all");
    setFilteredPayments(payments);
  };

  const refreshFinance = () => {
    resetFilters();
    // In a real app, you'd refetch data here
    console.log("Finance refreshed");
  };

  const exportFinanceReport = () => {
    console.log("Export finance report");
    // Implement export logic
  };

  // Action handlers
  const handleViewDetail = (deliveryId: string) => {
    console.log(`View detail for delivery ${deliveryId}`);
    // Navigate to payment detail or open modal
  };

  const handleMarkPaid = (deliveryId: string) => {
    console.log(`Mark paid for delivery ${deliveryId}`);
    // Update payment status to "paid"
    const updatedPayments = payments.map((p) =>
      p.deliveryId === deliveryId ? { ...p, paymentStatus: "paid" as const } : p
    );
    setPayments(updatedPayments);
    setFilteredPayments(
      filteredPayments.map((p) =>
        p.deliveryId === deliveryId ? { ...p, paymentStatus: "paid" as const } : p
      )
    );
  };

  const handleMarkPayoutPaid = (deliveryId: string) => {
    console.log(`Mark payout paid for delivery ${deliveryId}`);
    // In a real app, you'd update the payout status
  };

  // Helper for status badge
  const getStatusBadge = (status: PaymentRecord["paymentStatus"]) => {
    switch (status) {
      case "invoiced":
        return (
          <Badge className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300">
            INVOICED
          </Badge>
        );
      case "paid":
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
            PAID
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300">
            FAILED
          </Badge>
        );
      default:
        return null;
    }
  };

  const getBillingModeBadge = (mode: PaymentRecord["billingMode"]) => {
    return (
      <Badge variant="outline" className="bg-white dark:bg-slate-900">
        {mode === "prepaid" ? "PREPAID" : "POSTPAID"}
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
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:border-sky-800">
                <Payments className="h-4 w-4" />
                Finance Ops
              </div>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black mt-4">Admin payments</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-4xl">
              Payment and payout oversight for prepaid, postpaid, invoicing, manual settlement, and payout completion.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={exportFinanceReport}
              className="rounded-2xl gap-2"
            >
              <Download className="h-4 w-4" />
              Export finance report
            </Button>
            <Button
              onClick={refreshFinance}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Finance
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
                <CardTitle className="text-xl font-black mt-1">Payment filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 sm:px-7 py-6 space-y-5">
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Payment status
                </label>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Billing mode
                </label>
                <Select value={billingModeFilter} onValueChange={setBillingModeFilter}>
                  <SelectTrigger className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="prepaid">Prepaid</SelectItem>
                    <SelectItem value="postpaid">Postpaid</SelectItem>
                  </SelectContent>
                </Select>
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
                  Total invoiced
                </div>
                <div className="text-2xl font-black mt-2">
                  ${(totalInvoiced / 1000).toFixed(1)}k
                </div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Awaiting payment
                </div>
                <div className="text-2xl font-black mt-2">
                  ${(awaitingPayment / 1000).toFixed(1)}k
                </div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Pending payouts
                </div>
                <div className="text-2xl font-black mt-2">
                  ${(pendingPayouts / 1000).toFixed(1)}k
                </div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Failed items
                </div>
                <div className="text-2xl font-black mt-2">{failedItems}</div>
              </Card>
            </div>

            {/* Payments List */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Queue
                  </div>
                  <CardTitle className="text-2xl font-black mt-1">
                    Payments and payouts
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 space-y-4">
                {filteredPayments.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No payments found</div>
                ) : (
                  filteredPayments.map((payment) => (
                    <Card
                      key={payment.deliveryId}
                      className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4"
                    >
                      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {payment.deliveryId}
                            </Badge>
                            {getStatusBadge(payment.paymentStatus)}
                            {getBillingModeBadge(payment.billingMode)}
                          </div>
                          <div className="mt-3 text-lg font-black">
                            {payment.dealer} • ${payment.totalAmount.toFixed(2)}
                          </div>
                          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Insurance: ${payment.insuranceFee.toFixed(2)} • Transaction fee: $
                            {payment.transactionFee.toFixed(2)} • Driver payout: $
                            {payment.driverPayout.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleViewDetail(payment.deliveryId)}
                            className="rounded-2xl"
                          >
                            View Detail
                          </Button>
                          {payment.paymentStatus === "invoiced" && (
                            <Button
                              variant="outline"
                              onClick={() => handleMarkPaid(payment.deliveryId)}
                              className="rounded-2xl"
                            >
                              Mark Paid
                            </Button>
                          )}
                          {payment.paymentStatus === "invoiced" && (
                            <Button
                              onClick={() => handleMarkPayoutPaid(payment.deliveryId)}
                              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl"
                            >
                              Mark Payout Paid
                            </Button>
                          )}
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

export default AdminPayments;