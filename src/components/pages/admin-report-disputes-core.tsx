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
interface DisputeReportRecord {
  disputeId: string;
  deliveryId: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  reason: string;
  legalHold: "Yes" | "No";
  notes: number;
  opened: string;
}

// Mock data
const initialRecords: DisputeReportRecord[] = [
  {
    disputeId: "DSP-3011",
    deliveryId: "DLV-1421",
    status: "OPEN",
    reason: "Damage",
    legalHold: "No",
    notes: 3,
    opened: "Mar 10, 2026",
  },
  {
    disputeId: "DSP-3012",
    deliveryId: "DLV-1422",
    status: "OPEN",
    reason: "Damage",
    legalHold: "No",
    notes: 4,
    opened: "Mar 11, 2026",
  },
  {
    disputeId: "DSP-3013",
    deliveryId: "DLV-1423",
    status: "OPEN",
    reason: "Damage",
    legalHold: "No",
    notes: 5,
    opened: "Mar 12, 2026",
  },
  {
    disputeId: "DSP-3014",
    deliveryId: "DLV-1424",
    status: "OPEN",
    reason: "Damage",
    legalHold: "No",
    notes: 6,
    opened: "Mar 13, 2026",
  },
  {
    disputeId: "DSP-3015",
    deliveryId: "DLV-1425",
    status: "OPEN",
    reason: "Damage",
    legalHold: "No",
    notes: 7,
    opened: "Mar 14, 2026",
  },
  {
    disputeId: "DSP-3016",
    deliveryId: "DLV-1426",
    status: "OPEN",
    reason: "Damage",
    legalHold: "No",
    notes: 8,
    opened: "Mar 15, 2026",
  },
  {
    disputeId: "DSP-3017",
    deliveryId: "DLV-1427",
    status: "OPEN",
    reason: "Damage",
    legalHold: "No",
    notes: 9,
    opened: "Mar 16, 2026",
  },
];

const AdminDisputesReport: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // State (could be expanded with filters in the future)
  const [records] = React.useState<DisputeReportRecord[]>(initialRecords);

  // Helper for status badge styling
  const getStatusBadge = (status: DisputeReportRecord["status"]) => {
    switch (status) {
      case "OPEN":
        return <span className="text-rose-600 dark:text-rose-400 font-semibold">OPEN</span>;
      case "UNDER_REVIEW":
        return <span className="text-amber-600 dark:text-amber-400 font-semibold">UNDER REVIEW</span>;
      case "RESOLVED":
        return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">RESOLVED</span>;
      default:
        return <span>{status}</span>;
    }
  };

  // Helper for legal hold badge
  const getLegalHoldBadge = (legalHold: DisputeReportRecord["legalHold"]) => {
    if (legalHold === "Yes") {
      return <span className="text-purple-600 dark:text-purple-400 font-semibold">Yes</span>;
    }
    return <span className="text-slate-500">No</span>;
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
          <h1 className="text-3xl lg:text-4xl font-black">Disputes report</h1>
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
                  Disputes report
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 sm:px-7 py-6">
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                <Table className="min-w-full">
                  <TableHeader className="bg-slate-50 dark:bg-slate-950">
                    <TableRow>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Dispute
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Delivery
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Status
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Reason
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Legal Hold
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Notes
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Opened
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.disputeId}>
                        <TableCell className="px-4 py-4 text-sm font-black">
                          {record.disputeId}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.deliveryId}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm">
                          {getStatusBadge(record.status)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.reason}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm">
                          {getLegalHoldBadge(record.legalHold)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.notes}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.opened}
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

export default AdminDisputesReport;