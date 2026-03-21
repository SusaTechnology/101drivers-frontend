import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Navbar } from "../shared/layout/testNavbar";
import { navItems } from "@/lib/items/navItems";
import { Brand } from "@/lib/items/brand";
import { useAdminActions } from "@/hooks/useAdminActions";

// Types
interface PaymentReportRecord {
  deliveryId: string;
  billingMode: "PREPAID" | "POSTPAID";
  paymentStatus: "INVOICED" | "PAID" | "FAILED";
  customerTotal: number;
  insuranceFee: number;
  transactionFee: number;
  driverPayout: number;
}

// Mock data from HTML
const initialRecords: PaymentReportRecord[] = [
  {
    deliveryId: "DLV-1511",
    billingMode: "POSTPAID",
    paymentStatus: "INVOICED",
    customerTotal: 837.0,
    insuranceFee: 8.0,
    transactionFee: 27.0,
    driverPayout: 509.0,
  },
  {
    deliveryId: "DLV-1512",
    billingMode: "POSTPAID",
    paymentStatus: "INVOICED",
    customerTotal: 854.0,
    insuranceFee: 8.0,
    transactionFee: 28.0,
    driverPayout: 518.0,
  },
  {
    deliveryId: "DLV-1513",
    billingMode: "POSTPAID",
    paymentStatus: "INVOICED",
    customerTotal: 871.0,
    insuranceFee: 8.0,
    transactionFee: 29.0,
    driverPayout: 527.0,
  },
  {
    deliveryId: "DLV-1514",
    billingMode: "POSTPAID",
    paymentStatus: "INVOICED",
    customerTotal: 888.0,
    insuranceFee: 8.0,
    transactionFee: 30.0,
    driverPayout: 536.0,
  },
  {
    deliveryId: "DLV-1515",
    billingMode: "POSTPAID",
    paymentStatus: "INVOICED",
    customerTotal: 905.0,
    insuranceFee: 8.0,
    transactionFee: 31.0,
    driverPayout: 545.0,
  },
  {
    deliveryId: "DLV-1516",
    billingMode: "POSTPAID",
    paymentStatus: "INVOICED",
    customerTotal: 922.0,
    insuranceFee: 8.0,
    transactionFee: 32.0,
    driverPayout: 554.0,
  },
  {
    deliveryId: "DLV-1517",
    billingMode: "POSTPAID",
    paymentStatus: "INVOICED",
    customerTotal: 939.0,
    insuranceFee: 8.0,
    transactionFee: 33.0,
    driverPayout: 563.0,
  },
];

const AdminPaymentsReport: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // State (could be expanded with filters in the future)
  const [records] = React.useState<PaymentReportRecord[]>(initialRecords);

  // Helper for status badge styling
  const getStatusBadge = (status: PaymentReportRecord["paymentStatus"]) => {
    switch (status) {
      case "INVOICED":
        return <span className="text-sky-600 dark:text-sky-400 font-semibold">INVOICED</span>;
      case "PAID":
        return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">PAID</span>;
      case "FAILED":
        return <span className="text-red-600 dark:text-red-400 font-semibold">FAILED</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const getBillingModeBadge = (mode: PaymentReportRecord["billingMode"]) => {
    if (mode === "PREPAID") {
      return <span className="text-amber-600 dark:text-amber-400 font-semibold">PREPAID</span>;
    }
    return <span className="text-slate-600 dark:text-slate-400">POSTPAID</span>;
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
        {/* Header */}
        <section>
          <h1 className="text-3xl lg:text-4xl font-black">Payments report</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-4xl">
            Export-ready admin report.
          </p>
        </section>

        {/* Report Table */}
        <section className="mt-8">
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
            <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Report table
                </div>
                <CardTitle className="text-2xl font-black mt-1">
                  Payments report
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 sm:px-7 py-6">
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                <Table className="min-w-full">
                  <TableHeader className="bg-slate-50 dark:bg-slate-950">
                    <TableRow>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Delivery
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Billing
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Payment Status
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Customer Total
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Insurance Fee
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Transaction Fee
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Driver Payout
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.deliveryId}>
                        <TableCell className="px-4 py-4 text-sm font-black">
                          {record.deliveryId}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm">
                          {getBillingModeBadge(record.billingMode)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm">
                          {getStatusBadge(record.paymentStatus)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          ${record.customerTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          ${record.insuranceFee.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          ${record.transactionFee.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          ${record.driverPayout.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AdminPaymentsReport;