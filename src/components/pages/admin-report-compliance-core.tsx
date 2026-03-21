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
interface ComplianceRecord {
  deliveryId: string;
  driver: string;
  complianceState: "Complete" | "Pending" | "Missing";
  vin: "Yes" | "No";
  pickupPhotos: "Yes" | "No";
  dropoffPhotos: "Yes" | "No";
  date: string;
}

// Mock data
const initialRecords: ComplianceRecord[] = [
  {
    deliveryId: "DLV-1411",
    driver: "Chris Driver",
    complianceState: "Complete",
    vin: "Yes",
    pickupPhotos: "Yes",
    dropoffPhotos: "Yes",
    date: "Mar 13, 2026",
  },
  {
    deliveryId: "DLV-1412",
    driver: "Chris Driver",
    complianceState: "Complete",
    vin: "Yes",
    pickupPhotos: "Yes",
    dropoffPhotos: "Yes",
    date: "Mar 14, 2026",
  },
  {
    deliveryId: "DLV-1413",
    driver: "Chris Driver",
    complianceState: "Complete",
    vin: "Yes",
    pickupPhotos: "Yes",
    dropoffPhotos: "Yes",
    date: "Mar 15, 2026",
  },
  {
    deliveryId: "DLV-1414",
    driver: "Chris Driver",
    complianceState: "Complete",
    vin: "Yes",
    pickupPhotos: "Yes",
    dropoffPhotos: "Yes",
    date: "Mar 16, 2026",
  },
  {
    deliveryId: "DLV-1415",
    driver: "Chris Driver",
    complianceState: "Complete",
    vin: "Yes",
    pickupPhotos: "Yes",
    dropoffPhotos: "Yes",
    date: "Mar 17, 2026",
  },
  {
    deliveryId: "DLV-1416",
    driver: "Chris Driver",
    complianceState: "Complete",
    vin: "Yes",
    pickupPhotos: "Yes",
    dropoffPhotos: "Yes",
    date: "Mar 18, 2026",
  },
  {
    deliveryId: "DLV-1417",
    driver: "Chris Driver",
    complianceState: "Complete",
    vin: "Yes",
    pickupPhotos: "Yes",
    dropoffPhotos: "Yes",
    date: "Mar 19, 2026",
  },
];

const AdminComplianceReport: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // State (could be expanded with filters in the future)
  const [records] = React.useState<ComplianceRecord[]>(initialRecords);

  // Helper for badge style (though not used in original)
  const getComplianceBadge = (state: ComplianceRecord["complianceState"]) => {
    switch (state) {
      case "Complete":
        return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Complete</span>;
      case "Pending":
        return <span className="text-amber-600 dark:text-amber-400 font-semibold">Pending</span>;
      case "Missing":
        return <span className="text-red-600 dark:text-red-400 font-semibold">Missing</span>;
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
          <h1 className="text-3xl lg:text-4xl font-black">Compliance report</h1>
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
                  Compliance report
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
                        Driver
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Compliance State
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        VIN
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Pickup Photos
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Drop-off Photos
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.deliveryId}>
                        <TableCell className="px-4 py-4 text-sm font-black">
                          {record.deliveryId}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.driver}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm">
                          {getComplianceBadge(record.complianceState)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.vin}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.pickupPhotos}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.dropoffPhotos}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.date}
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

export default AdminComplianceReport;