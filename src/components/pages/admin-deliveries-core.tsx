import React, { useState, useEffect } from "react";
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
import {
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
  Download,
  User,
  Truck,
  Store,
  AlertCircle,
  Clock,
} from "lucide-react";

// Types
interface Delivery {
  id: string;
  status: "active" | "booked" | "disputed" | "completed";
  paymentMethod: "prepaid" | "postpaid";
  fromDealer: string;
  toAddress: string;
  pickupLocation: string;
  driverName: string;
  updatedAgo: string;
  isPayoutPending: boolean;
}

// Data
const initialDeliveries: Delivery[] = [
  {
    id: "DLV-10291",
    status: "active",
    paymentMethod: "postpaid",
    fromDealer: "Bay Auto Sales LLC",
    toAddress: "Los Robles Ave, Pasadena",
    pickupLocation: "Los Santos, Lakeside, CA",
    driverName: "Chris Driver",
    updatedAgo: "12m ago",
    isPayoutPending: false,
  },
  {
    id: "DLV-10292",
    status: "active",
    paymentMethod: "postpaid",
    fromDealer: "Bay Auto Sales LLC",
    toAddress: "Los Robles Ave, Pasadena",
    pickupLocation: "Los Santos, Lakeside, CA",
    driverName: "Chris Driver",
    updatedAgo: "12m ago",
    isPayoutPending: false,
  },
  {
    id: "DLV-10293",
    status: "booked",
    paymentMethod: "prepaid",
    fromDealer: "Elite Motors",
    toAddress: "Sunset Blvd, Hollywood",
    pickupLocation: "Downtown LA",
    driverName: "Sarah Chen",
    updatedAgo: "2h ago",
    isPayoutPending: true,
  },
  {
    id: "DLV-10294",
    status: "active",
    paymentMethod: "postpaid",
    fromDealer: "Bay Auto Sales LLC",
    toAddress: "Los Robles Ave, Pasadena",
    pickupLocation: "Los Santos, Lakeside, CA",
    driverName: "Chris Driver",
    updatedAgo: "12m ago",
    isPayoutPending: false,
  },
  {
    id: "DLV-10295",
    status: "disputed",
    paymentMethod: "postpaid",
    fromDealer: "Premium Auto Group",
    toAddress: "Rodeo Dr, Beverly Hills",
    pickupLocation: "Santa Monica",
    driverName: "Mike Johnson",
    updatedAgo: "45m ago",
    isPayoutPending: true,
  },
  {
    id: "DLV-10296",
    status: "active",
    paymentMethod: "postpaid",
    fromDealer: "Bay Auto Sales LLC",
    toAddress: "Los Robles Ave, Pasadena",
    pickupLocation: "Los Santos, Lakeside, CA",
    driverName: "Chris Driver",
    updatedAgo: "12m ago",
    isPayoutPending: false,
  },
  {
    id: "DLV-10297",
    status: "booked",
    paymentMethod: "prepaid",
    fromDealer: "City Cars",
    toAddress: "Market St, San Francisco",
    pickupLocation: "Oakland",
    driverName: "Emma Wilson",
    updatedAgo: "1h ago",
    isPayoutPending: false,
  },
  {
    id: "DLV-10298",
    status: "disputed",
    paymentMethod: "postpaid",
    fromDealer: "Luxury Motors",
    toAddress: "Main St, Irvine",
    pickupLocation: "Newport Beach",
    driverName: "David Kim",
    updatedAgo: "3h ago",
    isPayoutPending: true,
  },
  {
    id: "DLV-10299",
    status: "active",
    paymentMethod: "prepaid",
    fromDealer: "Auto World",
    toAddress: "Broadway, San Diego",
    pickupLocation: "La Jolla",
    driverName: "Lisa Park",
    updatedAgo: "25m ago",
    isPayoutPending: false,
  },
  {
    id: "DLV-10300",
    status: "booked",
    paymentMethod: "postpaid",
    fromDealer: "Coast Auto",
    toAddress: "Coast Hwy, Laguna Beach",
    pickupLocation: "Costa Mesa",
    driverName: "James Lee",
    updatedAgo: "4h ago",
    isPayoutPending: false,
  },
];

const AdminDeliveries: React.FC = () => {
  // State
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dealerFilter, setDealerFilter] = useState<string>("");
  const [driverFilter, setDriverFilter] = useState<string>("");
  const [isDark, setIsDark] = useState<boolean>(false);

  // Metrics
  const activeCount = deliveries.filter((d) => d.status === "active").length;
  const bookedCount = deliveries.filter((d) => d.status === "booked").length;
  const disputedCount = deliveries.filter((d) => d.status === "disputed").length;
  const pendingPayoutCount = deliveries.filter((d) => d.isPayoutPending).length;

  // Filter logic
  const applyFilters = () => {
    let filtered = [...deliveries];
    if (statusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }
    if (dealerFilter.trim()) {
      filtered = filtered.filter((d) =>
        d.fromDealer.toLowerCase().includes(dealerFilter.toLowerCase())
      );
    }
    if (driverFilter.trim()) {
      filtered = filtered.filter((d) =>
        d.driverName.toLowerCase().includes(driverFilter.toLowerCase())
      );
    }
    setFilteredDeliveries(filtered);
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setDealerFilter("");
    setDriverFilter("");
    setFilteredDeliveries(deliveries);
  };

  const refreshQueue = () => {
    resetFilters();
    // In a real app, you'd refetch data here
    console.log("Queue refreshed");
  };

  // Theme handling
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDarkMode = savedTheme === "dark";
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Get status badge color
  const getStatusBadge = (status: Delivery["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">ACTIVE</Badge>;
      case "booked":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300">BOOKED</Badge>;
      case "disputed":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300">DISPUTED</Badge>;
      default:
        return <Badge variant="outline">COMPLETED</Badge>;
    }
  };

  const getPaymentBadge = (method: Delivery["paymentMethod"]) => {
    return (
      <Badge variant="outline" className="bg-white dark:bg-slate-900">
        {method === "prepaid" ? "PREPAID" : "POSTPAID"}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <a className="flex items-center" href="#" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200 dark:border-slate-700">
                <img
                  src="assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </a>
            <nav className="hidden md:flex items-center gap-7">
              <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                Dashboard
              </a>
              <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                Users
              </a>
              <a className="text-sm font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors" href="#">
                Deliveries
              </a>
              <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                Disputes
              </a>
              <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                Payments
              </a>
              <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                Insurance
              </a>
              <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                Reports
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="rounded-2xl w-11 h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              className="hidden sm:inline-flex gap-2 rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
        {/* Hero Section */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-slate-800 dark:text-slate-200">
                <LayoutDashboard className="h-4 w-4" />
                Admin Ops Queue
              </div>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black mt-4">Admin deliveries</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-4xl">
              Operational work queue for all deliveries with filters, quick actions, compliance flags, dispute status, and payment summaries.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2 rounded-2xl">
              <Download className="h-4 w-4" />
              Export Results
            </Button>
            <Button onClick={refreshQueue} className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl gap-2">
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
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Filters</div>
                <CardTitle className="text-xl font-black mt-1">Delivery filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 sm:px-7 py-6 space-y-5">
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="disputed">Disputed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dealer / Customer</label>
                <Input
                  placeholder="Search dealer"
                  value={dealerFilter}
                  onChange={(e) => setDealerFilter(e.target.value)}
                  className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Driver</label>
                <Input
                  placeholder="Search driver"
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  className="mt-2 rounded-2xl border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={applyFilters} className="bg-primary text-slate-950 hover:bg-primary/90 flex-1 rounded-2xl">
                  Apply
                </Button>
                <Button onClick={resetFilters} variant="outline" className="flex-1 rounded-2xl">
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
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Active</div>
                <div className="text-2xl font-black mt-2">{activeCount}</div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Booked</div>
                <div className="text-2xl font-black mt-2">{bookedCount}</div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Disputed</div>
                <div className="text-2xl font-black mt-2">{disputedCount}</div>
              </Card>
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pending payout</div>
                <div className="text-2xl font-black mt-2">{pendingPayoutCount}</div>
              </Card>
            </div>

            {/* Deliveries List */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Queue</div>
                  <CardTitle className="text-2xl font-black mt-1">Delivery worklist</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 space-y-4">
                {filteredDeliveries.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No deliveries found</div>
                ) : (
                  filteredDeliveries.map((delivery) => (
                    <Card
                      key={delivery.id}
                      className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4"
                    >
                      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {delivery.id}
                            </Badge>
                            {getStatusBadge(delivery.status)}
                            {getPaymentBadge(delivery.paymentMethod)}
                          </div>
                          <div className="mt-3 text-lg font-black">
                            {delivery.fromDealer} → {delivery.toAddress}
                          </div>
                          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Pickup: {delivery.pickupLocation} • Driver: {delivery.driverName} • Updated {delivery.updatedAgo}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="rounded-2xl">
                            Open
                          </Button>
                          <Button variant="outline" className="rounded-2xl">
                            Reassign
                          </Button>
                          <Button variant="default" className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl">
                            Cancel
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

export default AdminDeliveries;