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
interface OpsSummaryRecord {
  day: string;
  completed: number;
  active: number;
  disputes: number;
  collections: number;
  miles: number;
}

// Mock data from HTML
const initialRecords: OpsSummaryRecord[] = [
  {
    day: "Mar 11, 2026",
    completed: 41,
    active: 13,
    disputes: 4,
    collections: 4410.0,
    miles: 1267.0,
  },
  {
    day: "Mar 12, 2026",
    completed: 42,
    active: 14,
    disputes: 5,
    collections: 4620.0,
    miles: 1334.0,
  },
  {
    day: "Mar 13, 2026",
    completed: 43,
    active: 15,
    disputes: 3,
    collections: 4830.0,
    miles: 1401.0,
  },
  {
    day: "Mar 14, 2026",
    completed: 44,
    active: 16,
    disputes: 4,
    collections: 5040.0,
    miles: 1468.0,
  },
  {
    day: "Mar 15, 2026",
    completed: 45,
    active: 12,
    disputes: 5,
    collections: 5250.0,
    miles: 1535.0,
  },
  {
    day: "Mar 16, 2026",
    completed: 46,
    active: 13,
    disputes: 3,
    collections: 5460.0,
    miles: 1602.0,
  },
  {
    day: "Mar 17, 2026",
    completed: 47,
    active: 14,
    disputes: 4,
    collections: 5670.0,
    miles: 1669.0,
  },
];

const AdminOpsSummaryReport: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // State (could be expanded with filters in the future)
  const [records] = React.useState<OpsSummaryRecord[]>(initialRecords);

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
          <h1 className="text-3xl lg:text-4xl font-black">Ops summary report</h1>
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
                  Ops summary report
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 sm:px-7 py-6">
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                <Table className="min-w-full">
                  <TableHeader className="bg-slate-50 dark:bg-slate-950">
                    <TableRow>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Day
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Completed
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Active
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Disputes
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Collections
                      </TableHead>
                      <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Miles
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.day}>
                        <TableCell className="px-4 py-4 text-sm font-black">
                          {record.day}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.completed}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.active}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {record.disputes}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                          ${record.collections.toFixed(2)}
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

export default AdminOpsSummaryReport;