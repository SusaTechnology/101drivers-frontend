import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Shield, Download, FileText } from "lucide-react";

// Types
interface InsuranceRecord {
  period: string;
  driver: string;
  dealer: string;
  trips: number;
  drivenMiles: number;
  insuranceFees: number;
}

// Mock data
const initialRecords: InsuranceRecord[] = [
  {
    period: "WK-2026-11",
    driver: "Chris Driver",
    dealer: "Bay Auto Sales LLC",
    trips: 13,
    drivenMiles: 1334.0,
    insuranceFees: 104.0,
  },
  {
    period: "WK-2026-12",
    driver: "Chris Driver",
    dealer: "Bay Auto Sales LLC",
    trips: 14,
    drivenMiles: 1388.0,
    insuranceFees: 112.0,
  },
  {
    period: "WK-2026-13",
    driver: "Chris Driver",
    dealer: "Bay Auto Sales LLC",
    trips: 15,
    drivenMiles: 1442.0,
    insuranceFees: 120.0,
  },
  {
    period: "WK-2026-14",
    driver: "Chris Driver",
    dealer: "Bay Auto Sales LLC",
    trips: 16,
    drivenMiles: 1496.0,
    insuranceFees: 128.0,
  },
  {
    period: "WK-2026-15",
    driver: "Chris Driver",
    dealer: "Bay Auto Sales LLC",
    trips: 17,
    drivenMiles: 1550.0,
    insuranceFees: 136.0,
  },
];

const AdminInsuranceReporting: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // State
  const [records, setRecords] = useState<InsuranceRecord[]>(initialRecords);
  const [filteredRecords, setFilteredRecords] = useState<InsuranceRecord[]>(initialRecords);
  const [periodFilter, setPeriodFilter] = useState<string>("this_week");
  const [driverFilter, setDriverFilter] = useState<string>("");

  // Metrics
  const totalMiles = records.reduce((sum, r) => sum + r.drivenMiles, 0);
  const totalTrips = records.reduce((sum, r) => sum + r.trips, 0);
  const totalFees = records.reduce((sum, r) => sum + r.insuranceFees, 0);
  const flaggedIncidents = 3; // Mock value

  // Filter logic
  const applyFilters = () => {
    let filtered = [...records];
    // Period filter: In a real app, this would filter by date range
    if (periodFilter !== "all") {
      // For demo, just pass through
    }
    if (driverFilter.trim()) {
      filtered = filtered.filter((r) =>
        r.driver.toLowerCase().includes(driverFilter.toLowerCase())
      );
    }
    setFilteredRecords(filtered);
  };

  const resetFilters = () => {
    setPeriodFilter("this_week");
    setDriverFilter("");
    setFilteredRecords(records);
  };

  const exportCSV = () => {
    console.log("Export CSV");
    // Implement CSV export logic
    const csvContent = convertToCSV(filteredRecords);
    // Trigger download
  };

  const exportPDF = () => {
    console.log("Export PDF");
    // Implement PDF export logic
  };

  const exportRecord = (record: InsuranceRecord) => {
    console.log(`Export record for period ${record.period}`);
    // Export single record as CSV or JSON
  };

  // Helper to convert records to CSV
  const convertToCSV = (data: InsuranceRecord[]): string => {
    const headers = ["Period", "Driver", "Dealer", "Trips", "Driven Miles", "Insurance Fees"];
    const rows = data.map((r) => [
      r.period,
      r.driver,
      r.dealer,
      r.trips.toString(),
      `${r.drivenMiles.toFixed(1)} mi`,
      `$${r.insuranceFees.toFixed(2)}`,
    ]);
    return [headers, ...rows].map((row) => row.join(",")).join("\n");
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
                <Shield className="h-4 w-4" />
                Insurance Reporting
              </div>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black mt-4">
              Insurance mileage reporting
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-4xl">
              Weekly and monthly driven-mile totals, insurance-fee collection visibility, and export-ready views by driver and dealer.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={exportCSV}
              className="rounded-2xl gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={exportPDF}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl gap-2"
            >
              <FileText className="h-4 w-4" />
              Export PDF Summary
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
                <CardTitle className="text-xl font-black mt-1">Mileage filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 sm:px-7 py-6 space-y-5">
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Period
                </label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_week">This week</SelectItem>
                    <SelectItem value="last_week">Last week</SelectItem>
                    <SelectItem value="this_month">This month</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Driver
                </label>
                <Input
                  placeholder="Search driver"
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
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
                  Driven miles
                </div>
                <div className="text-2xl font-black mt-2">
                  {totalMiles.toFixed(1)}
                </div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Completed deliveries
                </div>
                <div className="text-2xl font-black mt-2">{totalTrips}</div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Insurance fees
                </div>
                <div className="text-2xl font-black mt-2">
                  ${totalFees.toFixed(2)}
                </div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Flagged incidents
                </div>
                <div className="text-2xl font-black mt-2">{flaggedIncidents}</div>
              </Card>
            </div>

            {/* Insurance Records Table */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Exportable table
                  </div>
                  <CardTitle className="text-2xl font-black mt-1">
                    Insurance mileage records
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6">
                <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                  <Table className="min-w-full">
                    <TableHeader className="bg-slate-50 dark:bg-slate-950">
                      <TableRow>
                        <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Period
                        </TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Driver
                        </TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Dealer
                        </TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Trips
                        </TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Driven miles
                        </TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Insurance fees
                        </TableHead>
                        <TableHead className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                            No records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRecords.map((record) => (
                          <TableRow key={record.period}>
                            <TableCell className="px-4 py-4 text-sm font-black">
                              {record.period}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                              {record.driver}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                              {record.dealer}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                              {record.trips}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                              {record.drivenMiles.toFixed(1)} mi
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                              ${record.insuranceFees.toFixed(2)}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-sm">
                              <Button
                                variant="outline"
                                onClick={() => exportRecord(record)}
                                className="rounded-2xl text-xs py-1.5 px-3"
                              >
                                Export
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminInsuranceReporting;