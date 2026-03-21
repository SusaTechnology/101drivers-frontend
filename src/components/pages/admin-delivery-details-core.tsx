import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "../shared/layout/testNavbar";
import { navItems } from "@/lib/items/navItems";
import { Brand } from "@/lib/items/brand";
import { useAdminActions } from "@/hooks/useAdminActions"; // adjust path as needed
import {
  LayoutDashboard,
  Hash as Numbers,
  MapPin,
  Route,
  FileText,
  DollarSign,
  CreditCard,
  ShieldAlert,
  Truck,
  AlertTriangle,
  Download,
  XCircle,
} from "lucide-react";

// Mock data for delivery details
const deliveryData = {
  id: "DLV-10293",
  status: "active",
  complianceStatus: "Compliance In Progress",
  pickup: "Los Santos, Lakeside, CA 92040",
  dropoff: "Los Robles Ave, Pasadena, CA",
  vin: "1234",
  odometerStart: "48,910 mi",
  odometerEnd: "—",
  adminVerification: "Not completed",
  trackingStatus: "STARTED",
  startedAt: "Mar 20, 8:03 AM",
  stoppedAt: "—",
  drivenMiles: "18.4 mi",
  timeline: "QUOTED → LISTED → BOOKED → ACTIVE",
  timelineNote: "Driver started trip and notifications were sent.",
  customerPrice: "$871.07",
  insuranceFee: "$8.00",
  transactionFee: "$27.46",
  driverPayout: "$502.64",
  platformRemainder: "$332.97",
  billingMode: "POSTPAID",
  paymentState: "INVOICED",
};

const AdminDeliveryDetails: React.FC = () => {
  const { actionItems, signOut } = useAdminActions();

  // Handler functions (replace with actual logic)
  const handleAssignDriver = () => {
    console.log("Assign driver");
  };

  const handleOpenDispute = () => {
    console.log("Open dispute");
  };

  const handleExportEvidence = () => {
    console.log("Export evidence");
  };

  const handleForceCancel = () => {
    console.log("Force cancel");
  };

  const handleApproveCompliance = () => {
    console.log("Approve compliance");
  };

  const handleApplyLegalHold = () => {
    console.log("Apply legal hold");
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
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-slate-800 dark:text-slate-200">
                <Numbers className="h-4 w-4" />
                {deliveryData.id}
              </div>
              <Badge
                className={`${
                  deliveryData.status === "active"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : ""
                }`}
              >
                ACTIVE
              </Badge>
              <Badge
                variant="outline"
                className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
              >
                {deliveryData.complianceStatus}
              </Badge>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black mt-4">
              Admin delivery details
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-4xl">
              Operations-grade detail view for delivery lifecycle, compliance
              evidence, tracking summary, payment and payout oversight, and
              dispute handling.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleAssignDriver}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-2xl"
            >
              Assign / Reassign Driver
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenDispute}
              className="rounded-2xl"
            >
              Open Dispute
            </Button>
            <Button
              variant="outline"
              onClick={handleExportEvidence}
              className="rounded-2xl"
            >
              Export Evidence
            </Button>
            <Button
              variant="destructive"
              onClick={handleForceCancel}
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 rounded-2xl"
            >
              Force Cancel
            </Button>
          </div>
        </section>

        {/* Main Grid */}
        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Delivery Overview */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Delivery overview
                  </div>
                  <CardTitle className="text-2xl font-black mt-1">
                    Route, schedule, and participants
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Pickup
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.pickup}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Drop-off
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.dropoff}
                  </div>
                </Card>
              </CardContent>
            </Card>

            {/* Compliance Audit */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Compliance audit
                  </div>
                  <CardTitle className="text-2xl font-black mt-1">
                    VIN, odometer, and delivery evidence
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    VIN verification
                  </div>
                  <div className="text-base font-black mt-2">
                    {deliveryData.vin}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Odometer start
                  </div>
                  <div className="text-base font-black mt-2">
                    {deliveryData.odometerStart}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Odometer end
                  </div>
                  <div className="text-base font-black mt-2">
                    {deliveryData.odometerEnd}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Admin verification
                  </div>
                  <div className="text-base font-black mt-2">
                    {deliveryData.adminVerification}
                  </div>
                </Card>
              </CardContent>
            </Card>

            {/* Tracking Summary */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Tracking summary
                  </div>
                  <CardTitle className="text-2xl font-black mt-1">
                    Trip status, driven miles, and live route
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Tracking status
                    </div>
                    <div className="text-base font-black mt-2">
                      {deliveryData.trackingStatus}
                    </div>
                  </Card>
                  <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Started at
                    </div>
                    <div className="text-base font-black mt-2">
                      {deliveryData.startedAt}
                    </div>
                  </Card>
                  <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Stopped at
                    </div>
                    <div className="text-base font-black mt-2">
                      {deliveryData.stoppedAt}
                    </div>
                  </Card>
                  <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Driven miles
                    </div>
                    <div className="text-base font-black mt-2">
                      {deliveryData.drivenMiles}
                    </div>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Status Timeline */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Status timeline
                  </div>
                  <CardTitle className="text-2xl font-black mt-1">
                    Lifecycle and operational history
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6">
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="font-black">{deliveryData.timeline}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {deliveryData.timelineNote}
                  </div>
                </Card>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Sidebar) */}
          <aside className="space-y-6">
            {/* Financial Summary */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Financial summary
                  </div>
                  <CardTitle className="text-xl font-black mt-1">
                    Customer price, payout, and margin
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 grid grid-cols-2 gap-4">
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4 col-span-2">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Customer price
                  </div>
                  <div className="text-xl font-black mt-2">
                    {deliveryData.customerPrice}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Insurance fee
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.insuranceFee}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Transaction fee
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.transactionFee}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Driver payout
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.driverPayout}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Platform remainder
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.platformRemainder}
                  </div>
                </Card>
              </CardContent>
            </Card>

            {/* Payment Status */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Payment status
                  </div>
                  <CardTitle className="text-xl font-black mt-1">
                    Prepaid / postpaid oversight
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 space-y-4">
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Billing mode
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.billingMode}
                  </div>
                </Card>
                <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Payment state
                  </div>
                  <div className="text-lg font-black mt-2">
                    {deliveryData.paymentState}
                  </div>
                </Card>
              </CardContent>
            </Card>

            {/* Admin Actions */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader className="px-6 sm:px-7 py-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Admin actions
                  </div>
                  <CardTitle className="text-xl font-black mt-1">
                    Override controls
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-7 py-6 space-y-3">
                <Button
                  onClick={handleAssignDriver}
                  className="bg-primary text-slate-950 hover:bg-primary/90 w-full rounded-2xl"
                >
                  Assign / Reassign Driver
                </Button>
                <Button
                  variant="outline"
                  onClick={handleApproveCompliance}
                  className="w-full rounded-2xl"
                >
                  Approve compliance
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenDispute}
                  className="w-full rounded-2xl"
                >
                  Open dispute
                </Button>
                <Button
                  variant="outline"
                  onClick={handleApplyLegalHold}
                  className="w-full rounded-2xl"
                >
                  Apply legal hold
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleForceCancel}
                  className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 w-full rounded-2xl"
                >
                  Force cancel
                </Button>
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default AdminDeliveryDetails;