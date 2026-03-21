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
interface DeliveryReportRecord {
  deliveryId: string;
  status: "COMPLETED" | "IN_PROGRESS" | "CANCELLED";
  dealer: string;
  driver: string;
  serviceType: string;
  date: string;
  miles: number;
}

// Mock data
const initialRecords: DeliveryReportRecord[] = [
  {
    deliveryId: "DLV-1311",
    status: "COMPLETED",
    dealer: "Bay Auto Sales LLC",
    driver: "Chris Driver",
    serviceType: "HOME_DELIVERY",
    date: "Mar 11, 2026",
    miles: 148.0,
  },
  {
    deliveryId: "DLV-1312",
    status: "COMPLETED",
    dealer: "Bay Auto Sales LLC",
    driver: "Chris Driver",
    serviceType: "HOME_DELIVERY",
    date: "Mar 12, 2026",
    miles: 156.0,
  },
  {
    deliveryId: "DLV-1313",
    status: "COMPLETED",
    dealer: "Bay Auto Sales LLC",
    driver: "Chris Driver",
    serviceType: "HOME_DELIVERY",
    date: "Mar 13, 2026",
    miles: 164.0,
  },
  {
    deliveryId: "DLV-1314",
    status: "COMPLETED",
    dealer: "Bay Auto Sales LLC",
    driver: "Chris Driver",
    serviceType: "HOME_DELIVERY",
    date: "Mar 14, 2026",
    miles: 172.0,
  },
  {
    deliveryId: "DLV-1315",
    status: "COMPLETED",
    dealer: "Bay Auto Sales LLC",
    driver: "Chris Driver",
    serviceType: "HOME_DELIVERY",
    date: "Mar 15, 2026",
    miles: 180.0,
  },
  {
    deliveryId: "DLV-1316",
    status: "COMPLETED",
    dealer: "Bay Auto Sales LLC",
    driver: "Chris Driver",
    serviceType: "HOME_DELIVERY",
    date: "Mar 16, 2026",
    miles: 188.0,
  },
  {
    deliveryId: "DLV-1317",
    status: "COMPLETED",
    dealer: "Bay Auto Sales LLC",
    driver: "Chris Driver",
    serviceType: "HOME_DELIVERY",
    date: "Mar 17, 2026",
    miles: 196.0,
  },
];

const AdminDeliveriesReport: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // State (could be expanded with filters in the future)
  const [records] = React.useState<DeliveryReportRecord[]>(initialRecords);

  // Helper for status badge styling
  const getStatusBadge = (status: DeliveryReportRecord["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">COMPLETED</span>;
      case "IN_PROGRESS":
        return <span className="text-amber-600 dark:text-amber-400 font-semibold">IN_PROGRESS</span>;
      case "CANCELLED":
        return <span className="text-red-600 dark:text-red-400 font-semibold">CANCELLED</span>;
      default:
        return <span>{status}</span>;
    }
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
          <h1 className="text-3xl lg:text-4xl font-black">Deliveries report</h1>
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
                  Deliveries report
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
                        Status
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Dealer
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Driver
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Service Type
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Date
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Miles
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
                          {getStatusBadge(record.status)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.dealer}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.driver}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.serviceType}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.date}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.miles.toFixed(1)} mi
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

export default AdminDeliveriesReport;