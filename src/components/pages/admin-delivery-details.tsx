// components/pages/admin-delivery-details.tsx
import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import { useAdminDeliveryDetail, useDeliveryActions, useDriverLookup } from '@/hooks/useAdminDeliveries';
import {
  getStatusColor,
  getServiceTypeLabel,
  getTrackingStatusLabel,
  formatMiles,
  formatCurrency,
  formatDeliveryDate,
  formatRelativeTime,
} from '@/hooks/useAdminDeliveries';
import type { AdminDeliveryDetail, Evidence, StatusHistory, AssignDriverRequest, ApproveComplianceRequest, ForceCancelRequest, LegalHoldRequest, OpenDisputeRequest } from '@/types/delivery';
import {
  Hash as Numbers,
  MapPin,
  Route,
  DollarSign,
  CreditCard,
  ShieldAlert,
  Truck,
  AlertTriangle,
  Download,
  XCircle,
  User,
  Building2,
  Clock,
  Navigation,
  CheckCircle,
  XCircle as XIcon,
  Eye,
  FileText,
  Camera,
  Mail,
  MessageSquare,
  Calendar,
  Car,
  ArrowLeft,
  ArrowRight,
  Activity,
  AlertCircle,
  Ban,
  Scale,
  ExternalLink,
  Loader2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getUser } from '@/lib/tanstack/dataQuery';

export default function AdminDeliveryDetailsPage({ deliveryId }: { deliveryId: string }) {
  const { actionItems, signOut } = useAdminActions();
  
  // Fetch delivery details
  const { data: delivery, isLoading, isError, error, refetch } = useAdminDeliveryDetail(deliveryId);
  
  // Fetch driver lookup list
  const { data: drivers, isLoading: isLoadingDrivers } = useDriverLookup();
  
  // Action mutations
  const deliveryActions = useDeliveryActions(deliveryId);
  
  // Dialog states
  const [assignDriverOpen, setAssignDriverOpen] = useState(false);
  const [approveComplianceOpen, setApproveComplianceOpen] = useState(false);
  const [forceCancelOpen, setForceCancelOpen] = useState(false);
  const [legalHoldOpen, setLegalHoldOpen] = useState(false);
  const [openDisputeOpen, setOpenDisputeOpen] = useState(false);
  const [evidencePreviewOpen, setEvidencePreviewOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  
  // Form states
  const [assignDriverForm, setAssignDriverForm] = useState({
    driverId: '',
    reason: 'Ops manually assigned nearest approved driver',
  });
  const [approveComplianceNote, setApproveComplianceNote] = useState('VIN and evidence reviewed by operations');
  const [forceCancelReason, setForceCancelReason] = useState('');
  const [legalHoldForm, setLegalHoldForm] = useState({
    legalHold: true,
    note: 'Preserve delivery evidence pending formal review',
  });
  const [openDisputeForm, setOpenDisputeForm] = useState({
    reason: '',
    note: 'Ops opened dispute after customer escalation',
    legalHold: true,
  });
  
  // Get current user for actorUserId
  const currentUser = getUser();
  const actorUserId = currentUser?.id || 'cmadmin001'; // Fallback for testing
  
  // Handlers for actions
  const handleAssignDriver = () => {
    setAssignDriverOpen(true);
  };

  const handleOpenDispute = () => {
    setOpenDisputeOpen(true);
  };

  const handleExportEvidence = () => {
    toast.info('Export Evidence', { description: 'Preparing evidence export...' });
  };

  const handleForceCancel = () => {
    setForceCancelOpen(true);
  };

  const handleApproveCompliance = () => {
    setApproveComplianceOpen(true);
  };

  const handleApplyLegalHold = () => {
    setLegalHoldOpen(true);
  };
  
  // Submit handlers
  const submitAssignDriver = () => {
    if (!assignDriverForm.driverId.trim()) {
      toast.error('Driver ID is required');
      return;
    }
    
    const payload: AssignDriverRequest = {
      driverId: assignDriverForm.driverId,
      actorUserId,
      reason: assignDriverForm.reason,
    };
    
    deliveryActions.assignDriver.mutate(payload, {
      onSuccess: () => {
        toast.success('Driver assigned successfully');
        setAssignDriverOpen(false);
        setAssignDriverForm({ driverId: '', reason: 'Ops manually assigned nearest approved driver' });
        refetch();
      },
      onError: (err) => {
        toast.error('Failed to assign driver', { description: err.message });
      },
    });
  };
  
  const submitApproveCompliance = () => {
    const payload: ApproveComplianceRequest = {
      actorUserId,
      note: approveComplianceNote,
    };
    
    deliveryActions.approveCompliance.mutate(payload, {
      onSuccess: () => {
        toast.success('Compliance approved successfully');
        setApproveComplianceOpen(false);
        refetch();
      },
      onError: (err) => {
        toast.error('Failed to approve compliance', { description: err.message });
      },
    });
  };
  
  const submitForceCancel = () => {
    if (!forceCancelReason.trim()) {
      toast.error('Cancellation reason is required');
      return;
    }
    
    const payload: ForceCancelRequest = {
      actorUserId,
      reason: forceCancelReason,
    };
    
    deliveryActions.forceCancel.mutate(payload, {
      onSuccess: () => {
        toast.success('Delivery cancelled successfully');
        setForceCancelOpen(false);
        setForceCancelReason('');
        refetch();
      },
      onError: (err) => {
        toast.error('Failed to cancel delivery', { description: err.message });
      },
    });
  };
  
  const submitLegalHold = () => {
    const payload: LegalHoldRequest = {
      actorUserId,
      legalHold: legalHoldForm.legalHold,
      note: legalHoldForm.note,
    };
    
    deliveryActions.legalHold.mutate(payload, {
      onSuccess: () => {
        toast.success(`Legal hold ${legalHoldForm.legalHold ? 'applied' : 'removed'} successfully`);
        setLegalHoldOpen(false);
        refetch();
      },
      onError: (err) => {
        toast.error('Failed to update legal hold', { description: err.message });
      },
    });
  };
  
  const submitOpenDispute = () => {
    if (!openDisputeForm.reason.trim()) {
      toast.error('Dispute reason is required');
      return;
    }
    
    const payload: OpenDisputeRequest = {
      actorUserId,
      reason: openDisputeForm.reason,
      note: openDisputeForm.note,
      legalHold: openDisputeForm.legalHold,
    };
    
    deliveryActions.openDispute.mutate(payload, {
      onSuccess: () => {
        toast.success('Dispute opened successfully');
        setOpenDisputeOpen(false);
        setOpenDisputeForm({
          reason: '',
          note: 'Ops opened dispute after customer escalation',
          legalHold: true,
        });
        refetch();
      },
      onError: (err) => {
        toast.error('Failed to open dispute', { description: err.message });
      },
    });
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = getStatusColor(status);
    return (
      <Badge className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border',
        colors.bg,
        colors.text,
        colors.border
      )}>
        {status}
      </Badge>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <Navbar
          brand={<Brand />}
          items={navItems}
          actions={actionItems}
          onSignOut={signOut}
          title="Admin"
        />
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-10 w-64 mb-4" />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (isError || !delivery) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <Navbar
          brand={<Brand />}
          items={navItems}
          actions={actionItems}
          onSignOut={signOut}
          title="Admin"
        />
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <Card className="rounded-2xl border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <p className="text-rose-700 dark:text-rose-300 font-bold text-lg">Failed to load delivery</p>
              <p className="text-rose-600 dark:text-rose-400 text-sm mt-2">{error?.message || 'Unknown error'}</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
                  Try Again
                </Button>
                <Link to="/admin-deliveries">
                  <Button className="rounded-xl bg-primary text-slate-950">
                    Back to List
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Derived data
  const customerName = delivery.customer.customerType === 'BUSINESS'
    ? delivery.customer.businessName || delivery.customer.contactName || 'Unknown Business'
    : delivery.customer.user?.fullName || delivery.customer.contactName || 'Unknown';

  const driverName = delivery.activeAssignment?.driver?.user?.fullName || null;
  const driverPhoto = delivery.activeAssignment?.driver?.profilePhotoUrl || null;
  const vehicleInfo = [delivery.vehicleMake, delivery.vehicleModel, delivery.vehicleColor]
    .filter(Boolean)
    .join(' ') || 'Not specified';

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
        {/* Back button */}
        <Link to="/admin-deliveries" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Deliveries
        </Link>

        {/* Page Header */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-slate-800 dark:text-slate-200">
                <Numbers className="h-4 w-4" />
                {delivery.id.slice(-8).toUpperCase()}
              </div>
              <StatusBadge status={delivery.status} />
              {delivery.scheduling?.isUrgent && (
                <Badge className="bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  URGENT
                </Badge>
              )}
              {delivery.dispute && (
                <Badge className="bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                  <Scale className="w-3 h-3 mr-1" />
                  DISPUTED
                </Badge>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Delivery Details</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-4xl">
              Complete operational view for delivery lifecycle, compliance evidence, tracking, and financial summary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleAssignDriver}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl"
            >
              <User className="w-4 h-4 mr-1" />
              Assign Driver
            </Button>
            <Button variant="outline" onClick={handleExportEvidence} className="rounded-xl">
              <Download className="w-4 h-4 mr-1" />
              Export Evidence
            </Button>
            {delivery.dispute ? (
              <Link to="/admin-dispute-details" params={{ disputeId: delivery.dispute.id }}>
                <Button variant="outline" className="rounded-xl">
                  <Eye className="w-4 h-4 mr-1" />
                  View Dispute
                </Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={handleOpenDispute} className="rounded-xl">
                <AlertCircle className="w-4 h-4 mr-1" />
                Open Dispute
              </Button>
            )}
            <Button variant="destructive" onClick={handleForceCancel} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
              <Ban className="w-4 h-4 mr-1" />
              Force Cancel
            </Button>
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column - Main Content */}
          <div className="xl:col-span-8 space-y-6">
            {/* Route Overview */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Route className="w-4 h-4 text-primary" />
                  Route Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pickup */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pickup</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{delivery.pickupAddress}</p>
                    {delivery.pickupWindowStart && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDeliveryDate(delivery.pickupWindowStart)} - {delivery.pickupWindowEnd ? formatDeliveryDate(delivery.pickupWindowEnd, true) : ''}
                      </p>
                    )}
                  </div>
                  
                  {/* Dropoff */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dropoff</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{delivery.dropoffAddress}</p>
                    {delivery.dropoffWindowStart && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDeliveryDate(delivery.dropoffWindowStart)} - {delivery.dropoffWindowEnd ? formatDeliveryDate(delivery.dropoffWindowEnd, true) : ''}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Quote info */}
                {delivery.quote && (
                  <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Route className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Distance: {delivery.quote.distanceMiles?.toFixed(1) || '—'} miles
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Pricing Mode: {delivery.quote.pricingMode || '—'}
                            {delivery.quote.mileageCategory && ` • Category ${delivery.quote.mileageCategory}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                          {formatCurrency(delivery.quote.estimatedPrice)}
                        </p>
                        <p className="text-[10px] text-slate-500">Estimated Price</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vehicle & Customer Info */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" />
                  Vehicle & Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vehicle */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400">Make/Model</p>
                        <p className="text-sm font-semibold">{vehicleInfo || '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400">License Plate</p>
                        <p className="text-sm font-semibold">{delivery.licensePlate || '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400">VIN Code</p>
                        <p className="text-sm font-semibold font-mono">{delivery.vinVerificationCode || '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400">VIN Confirmed</p>
                        <p className="text-sm font-semibold">
                          {delivery.compliance?.vinConfirmed ? (
                            <span className="text-emerald-600">Yes</span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Customer */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer</h4>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          {delivery.customer.customerType === 'BUSINESS' ? (
                            <Building2 className="w-5 h-5 text-primary" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{customerName}</p>
                          <p className="text-[10px] text-slate-500">
                            {delivery.customer.customerType === 'BUSINESS' ? 'Business' : 'Private'}
                            {delivery.customer.postpaidEnabled && ' • Postpaid'}
                          </p>
                        </div>
                      </div>
                      {delivery.customer.contactEmail && (
                        <p className="text-xs text-slate-500 mt-2">{delivery.customer.contactEmail}</p>
                      )}
                      {delivery.customer.contactPhone && (
                        <p className="text-xs text-slate-500">{delivery.customer.contactPhone}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compliance & Tracking */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Compliance & Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Tracking Status</p>
                    <p className="text-sm font-bold">{getTrackingStatusLabel(delivery.tracking?.status || 'NOT_STARTED')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Driven Miles</p>
                    <p className="text-sm font-bold">{formatMiles(delivery.tracking?.drivenMiles)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Odometer Start</p>
                    <p className="text-sm font-bold">{delivery.compliance?.odometerStart?.toLocaleString() || '—'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Odometer End</p>
                    <p className="text-sm font-bold">{delivery.compliance?.odometerEnd?.toLocaleString() || '—'}</p>
                  </div>
                </div>
                
                {/* Compliance status items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Pickup Completed</span>
                    {delivery.compliance?.pickupCompletedAt ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XIcon className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Dropoff Completed</span>
                    {delivery.compliance?.dropoffCompletedAt ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XIcon className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Admin Verified</span>
                    {delivery.compliance?.verifiedByAdminAt ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XIcon className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Evidence Photos */}
            {delivery.evidence && delivery.evidence.length > 0 && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                      <Camera className="w-4 h-4 text-primary" />
                      Evidence Photos
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {delivery.evidence.length} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {delivery.evidence.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedEvidence(item);
                          setEvidencePreviewOpen(true);
                        }}
                        className="relative group cursor-pointer text-left"
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.type}
                            className="w-full aspect-square object-cover rounded-xl border border-slate-200 dark:border-slate-800 group-hover:ring-2 group-hover:ring-primary/50 transition-all"
                          />
                        ) : item.value ? (
                          <div className="w-full aspect-square rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                            <span className="text-[10px] font-mono text-slate-500 text-center p-2">{item.value}</span>
                          </div>
                        ) : (
                          <div className="w-full aspect-square rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                            <Camera className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                          {item.imageUrl && (
                            <div className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                              <Download className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "absolute top-1 right-1 text-[8px] px-1 py-0",
                            item.phase === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {item.phase}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status History */}
            {delivery.statusHistory && delivery.statusHistory.length > 0 && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Status History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="relative">
                    <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-4">
                      {delivery.statusHistory.map((entry, index) => (
                        <div key={entry.id} className="relative flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center z-10 shrink-0">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge status={entry.toStatus} />
                              {entry.fromStatus && (
                                <>
                                  <ArrowRight className="w-3 h-3 text-slate-300" />
                                  <span className="text-xs text-slate-400">{entry.fromStatus}</span>
                                </>
                              )}
                            </div>
                            {entry.note && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{entry.note}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">
                              {formatDeliveryDate(entry.createdAt)}
                              {entry.actorRole && ` • by ${entry.actorRole}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notifications */}
            {delivery.notifications && delivery.notifications.length > 0 && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {delivery.notifications.map((notification) => (
                      <div 
                        key={notification.id} 
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {notification.channel === 'EMAIL' ? (
                              <Mail className="w-4 h-4 text-primary" />
                            ) : (
                              <MessageSquare className="w-4 h-4 text-primary" />
                            )}
                            <div>
                              <p className="text-xs font-semibold">{notification.subject || notification.type}</p>
                              <p className="text-[10px] text-slate-500">{notification.toEmail || notification.toPhone}</p>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px]",
                              notification.status === 'SENT' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                              notification.status === 'FAILED' && "bg-rose-50 text-rose-700 border-rose-200",
                              notification.status === 'PENDING' && "bg-amber-50 text-amber-700 border-amber-200"
                            )}
                          >
                            {notification.status}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                          {formatDeliveryDate(notification.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="xl:col-span-4 space-y-6">
            {/* Driver Info */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  Driver Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {driverName ? (
                  <div className="flex items-center gap-3 mb-4">
                    {driverPhoto ? (
                      <img 
                        src={driverPhoto} 
                        alt={driverName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-primary"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold">{driverName}</p>
                      <p className="text-[10px] text-slate-500">
                        Assigned {formatDeliveryDate(delivery.activeAssignment?.assignedAt, true)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No driver assigned</p>
                    <Button 
                      size="sm" 
                      onClick={handleAssignDriver}
                      className="mt-2 rounded-xl bg-primary text-slate-950"
                    >
                      Assign Driver
                    </Button>
                  </div>
                )}
                
                {/* Assignment history */}
                {delivery.assignments && delivery.assignments.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Previous Assignments
                    </p>
                    <p className="text-xs text-slate-500">{delivery.assignments.length - 1} previous</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-[10px] text-slate-500">Gross Amount</p>
                  <p className="text-xl font-black">{formatCurrency(delivery.financialSummary?.grossAmount)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400">Insurance Fee</p>
                    <p className="text-sm font-bold">{formatCurrency(delivery.financialSummary?.insuranceFee)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400">Platform Fee</p>
                    <p className="text-sm font-bold">{formatCurrency(delivery.financialSummary?.platformFee)}</p>
                  </div>
                </div>
                
                <Separator className="my-2" />
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Driver Share ({delivery.financialSummary?.driverSharePct}%)</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(delivery.financialSummary?.netPayoutAmount)}</span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Payment Status</span>
                  <Badge variant="outline" className="text-[10px]">
                    {delivery.financialSummary?.paymentStatus || 'Pending'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Payout Status</span>
                  <Badge variant="outline" className="text-[10px]">
                    {delivery.financialSummary?.payoutStatus || 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Admin Actions */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  Admin Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Button onClick={handleAssignDriver} className="w-full rounded-xl bg-primary text-slate-950">
                  <User className="w-4 h-4 mr-2" />
                  Assign / Reassign Driver
                </Button>
                <Button variant="outline" onClick={handleApproveCompliance} className="w-full rounded-xl">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Compliance
                </Button>
                <Button variant="outline" onClick={handleOpenDispute} className="w-full rounded-xl">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Open Dispute
                </Button>
                <Button variant="outline" onClick={handleApplyLegalHold} className="w-full rounded-xl">
                  <Scale className="w-4 h-4 mr-2" />
                  Apply Legal Hold
                </Button>
                <Button variant="destructive" onClick={handleForceCancel} className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                  <Ban className="w-4 h-4 mr-2" />
                  Force Cancel
                </Button>
              </CardContent>
            </Card>

            {/* Counts Summary */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black">Record Counts</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-slate-500">Evidence</span>
                    <span className="font-bold">{delivery._count?.evidence || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-slate-500">Notifications</span>
                    <span className="font-bold">{delivery._count?.notifications || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-slate-500">Status History</span>
                    <span className="font-bold">{delivery._count?.statusHistory || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-slate-500">Assignments</span>
                    <span className="font-bold">{delivery._count?.assignments || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDriverOpen} onOpenChange={setAssignDriverOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {delivery?.activeAssignment ? 'Reassign Driver' : 'Assign Driver'}
            </DialogTitle>
            <DialogDescription>
              {delivery?.activeAssignment 
                ? 'Current driver will be unassigned and the new driver will take over.'
                : 'Select a driver to assign to this delivery.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Assignment Info */}
            {delivery?.activeAssignment && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Currently Assigned</p>
                <div className="flex items-center gap-3">
                  {delivery.activeAssignment.driver?.profilePhotoUrl ? (
                    <img 
                      src={delivery.activeAssignment.driver.profilePhotoUrl} 
                      alt={delivery.activeAssignment.driver.user?.fullName || 'Driver'}
                      className="w-10 h-10 rounded-full object-cover border-2 border-blue-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {delivery.activeAssignment.driver?.user?.fullName || 'Unknown Driver'}
                    </p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      Assigned {formatRelativeTime(delivery.activeAssignment.assignedAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Driver Selection */}
            <div className="space-y-2">
              <Label htmlFor="driverId">
                {delivery?.activeAssignment ? 'Select New Driver' : 'Select Driver'}
              </Label>
              <Select
                value={assignDriverForm.driverId}
                onValueChange={(value) => setAssignDriverForm(prev => ({ ...prev, driverId: value }))}
                disabled={isLoadingDrivers}
              >
                <SelectTrigger id="driverId" className="rounded-xl">
                  <SelectValue placeholder={isLoadingDrivers ? "Loading drivers..." : "Select a driver"} />
                </SelectTrigger>
                <SelectContent>
                  {drivers
                    ?.filter(d => d.status === 'APPROVED')
                    // Exclude current driver if there's an active assignment
                    .filter(d => !delivery?.activeAssignment || d.id !== delivery.activeAssignment.driverId)
                    .map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <span>{driver.name}</span>
                          <Badge 
                            variant="outline" 
                            className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            APPROVED
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  {drivers?.filter(d => 
                    d.status === 'APPROVED' && 
                    (!delivery?.activeAssignment || d.id !== delivery.activeAssignment.driverId)
                  ).length === 0 && (
                    <SelectItem value="_none" disabled>
                      No other approved drivers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {delivery?.activeAssignment && (
                <p className="text-[10px] text-slate-500">
                  Current driver is excluded from the list.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder={delivery?.activeAssignment 
                  ? "Enter reason for reassignment" 
                  : "Enter reason for assignment"}
                value={assignDriverForm.reason}
                onChange={(e) => setAssignDriverForm(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-xl"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDriverOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={submitAssignDriver} 
              disabled={deliveryActions.assignDriver.isPending || !assignDriverForm.driverId}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl"
            >
              {deliveryActions.assignDriver.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {delivery?.activeAssignment ? 'Reassign Driver' : 'Assign Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Compliance Dialog */}
      <Dialog open={approveComplianceOpen} onOpenChange={setApproveComplianceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Approve Compliance
            </DialogTitle>
            <DialogDescription>
              Approve the compliance verification for this delivery. This will mark the VIN and evidence as reviewed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Enter review notes"
                value={approveComplianceNote}
                onChange={(e) => setApproveComplianceNote(e.target.value)}
                className="rounded-xl"
                rows={3}
              />
            </div>
            {delivery?.compliance && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-xs text-slate-500">Compliance Status</p>
                <p className="text-sm font-semibold">
                  VIN Confirmed: {delivery.compliance.vinConfirmed ? 'Yes' : 'No'}
                </p>
                {delivery.compliance.odometerStart && (
                  <p className="text-sm text-slate-600">Odometer Start: {delivery.compliance.odometerStart.toLocaleString()} mi</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveComplianceOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={submitApproveCompliance} 
              disabled={deliveryActions.approveCompliance.isPending}
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl"
            >
              {deliveryActions.approveCompliance.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Cancel Dialog */}
      <AlertDialog open={forceCancelOpen} onOpenChange={setForceCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" />
              Force Cancel Delivery
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will cancel the delivery, void any payment, and cancel the driver payout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Reason for Cancellation</Label>
              <Textarea
                id="cancelReason"
                placeholder="Enter reason for force cancellation (required)"
                value={forceCancelReason}
                onChange={(e) => setForceCancelReason(e.target.value)}
                className="rounded-xl border-rose-200 focus:border-rose-400"
                rows={3}
              />
            </div>
            {delivery && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800">
                <p className="text-xs text-rose-600 dark:text-rose-400">Warning</p>
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  Delivery {delivery.id.slice(-8).toUpperCase()} will be cancelled.
                  {delivery.payment && ` Payment status: ${delivery.payment.status}.`}
                  {delivery.payout && ` Payout status: ${delivery.payout.status}.`}
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitForceCancel}
              disabled={deliveryActions.forceCancel.isPending || !forceCancelReason.trim()}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-xl"
            >
              {deliveryActions.forceCancel.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Force Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Legal Hold Dialog */}
      <Dialog open={legalHoldOpen} onOpenChange={setLegalHoldOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              Legal Hold
            </DialogTitle>
            <DialogDescription>
              Apply or remove legal hold on this delivery for dispute preservation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">Legal Hold Status</span>
              <Select
                value={legalHoldForm.legalHold ? 'true' : 'false'}
                onValueChange={(v) => setLegalHoldForm(prev => ({ ...prev, legalHold: v === 'true' }))}
              >
                <SelectTrigger className="w-32 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Apply Hold</SelectItem>
                  <SelectItem value="false">Remove Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="holdNote">Note</Label>
              <Textarea
                id="holdNote"
                placeholder="Enter reason for legal hold"
                value={legalHoldForm.note}
                onChange={(e) => setLegalHoldForm(prev => ({ ...prev, note: e.target.value }))}
                className="rounded-xl"
                rows={3}
              />
            </div>
            {delivery?.dispute && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-600 dark:text-amber-400">Active Dispute</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Dispute ID: {delivery.dispute.id.slice(-8).toUpperCase()}
                  <br />
                  Status: {delivery.dispute.status}
                  <br />
                  Current Legal Hold: {delivery.dispute.legalHold ? 'Yes' : 'No'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegalHoldOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={submitLegalHold} 
              disabled={deliveryActions.legalHold.isPending}
              className={cn(
                "rounded-xl",
                legalHoldForm.legalHold 
                  ? "bg-amber-600 text-white hover:bg-amber-700" 
                  : "bg-primary text-slate-950 hover:bg-primary/90"
              )}
            >
              {deliveryActions.legalHold.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {legalHoldForm.legalHold ? 'Apply Hold' : 'Remove Hold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Dispute Dialog */}
      <Dialog open={openDisputeOpen} onOpenChange={setOpenDisputeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              Open Dispute
            </DialogTitle>
            <DialogDescription>
              Open a dispute for this delivery. This will change the delivery status to DISPUTED.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disputeReason">Reason *</Label>
              <Textarea
                id="disputeReason"
                placeholder="Enter dispute reason (e.g., Vehicle condition mismatch reported at drop-off)"
                value={openDisputeForm.reason}
                onChange={(e) => setOpenDisputeForm(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-xl"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disputeNote">Note</Label>
              <Textarea
                id="disputeNote"
                placeholder="Additional notes about the dispute"
                value={openDisputeForm.note}
                onChange={(e) => setOpenDisputeForm(prev => ({ ...prev, note: e.target.value }))}
                className="rounded-xl"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-sm font-medium">Apply Legal Hold</span>
                <p className="text-[10px] text-slate-500">Preserve evidence for dispute review</p>
              </div>
              <Select
                value={openDisputeForm.legalHold ? 'true' : 'false'}
                onValueChange={(v) => setOpenDisputeForm(prev => ({ ...prev, legalHold: v === 'true' }))}
              >
                <SelectTrigger className="w-24 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {delivery && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800">
                <p className="text-xs text-rose-600 dark:text-rose-400">Warning</p>
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  Delivery {delivery.id.slice(-8).toUpperCase()} will be marked as DISPUTED.
                  {delivery.activeAssignment && ` Driver assignment will be affected.`}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDisputeOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={submitOpenDispute} 
              disabled={deliveryActions.openDispute.isPending || !openDisputeForm.reason.trim()}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-xl"
            >
              {deliveryActions.openDispute.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Open Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence Preview Dialog */}
      <Dialog open={evidencePreviewOpen} onOpenChange={setEvidencePreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Evidence Preview
            </DialogTitle>
            <DialogDescription>
              {selectedEvidence?.type?.replace(/_/g, ' ')} • {selectedEvidence?.phase} Phase
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEvidence?.imageUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={selectedEvidence.imageUrl}
                  alt={selectedEvidence.type}
                  className="w-full max-h-[60vh] object-contain"
                />
              </div>
            ) : selectedEvidence?.value ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-lg font-mono">{selectedEvidence.value}</p>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No image available</p>
              </div>
            )}
            
            {/* Evidence details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</span>
                <p className="font-medium">{selectedEvidence?.type?.replace(/_/g, ' ') || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phase</span>
                <p className="font-medium">{selectedEvidence?.phase || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</span>
                <p className="font-medium">{selectedEvidence?.createdAt ? formatDeliveryDate(selectedEvidence.createdAt) : '—'}</p>
              </div>
              {selectedEvidence?.slotIndex !== null && selectedEvidence?.slotIndex !== undefined && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Slot Index</span>
                  <p className="font-medium">{selectedEvidence.slotIndex}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setEvidencePreviewOpen(false)} className="rounded-xl">
              Close
            </Button>
            {selectedEvidence?.imageUrl && (
              <Button
                onClick={() => {
                  // Open image in new tab for download
                  window.open(selectedEvidence.imageUrl, '_blank');
                }}
                className="bg-primary text-slate-950 rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                Open Full Size
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
