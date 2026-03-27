// Drafts page - List all draft deliveries
// @ts-nocheck
import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Edit,
  Trash2,
  ArrowLeft,
  MapPin,
  Car,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { getUser, getAccessToken } from '@/lib/tanstack/dataQuery';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

// Service type labels
const serviceTypeLabels: Record<string, string> = {
  HOME_DELIVERY: 'Home Delivery',
  BETWEEN_LOCATIONS: 'Between Locations',
  SERVICE_PICKUP_RETURN: 'Service Pickup & Return',
};

export default function DealerDrafts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getUser();
  const customerId = user?.profileId;

  // Fetch draft deliveries
  const { data: drafts, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['draftDeliveries', customerId],
    queryFn: async () => {
      const token = getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests?where[status]=DRAFT&where[customer][id]=${customerId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to fetch drafts');
      return response.json();
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
  });

  // Delete draft mutation
  const deleteMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const token = getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${draftId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to delete draft');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Draft deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['draftDeliveries', customerId] });
    },
    onError: (error: any) => {
      toast.error('Failed to delete draft', { description: error?.message });
    },
  });

  const handleDelete = (draftId: string) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      deleteMutation.mutate(draftId);
    }
  };

  const handleEdit = (draftId: string) => {
    // Navigate to create-delivery with draftId as search param
    navigate({ 
      to: '/dealer-create-delivery',
      search: { draftId }
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading drafts...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load drafts</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
          <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950">Retry</Button>
        </Card>
      </div>
    );
  }

  const draftList = drafts || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dealer-dashboard" className="flex items-center" aria-label="101 Drivers">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Dealer Portal</span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white">Draft Deliveries</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dealer-create-delivery"
              className="hidden sm:inline-flex items-center gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 px-5 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-lime-500/20 transition-all font-extrabold"
            >
              <Plus className="h-4 w-4" />
              New Delivery
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        {/* Back button and title */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate({ to: '/dealer-dashboard' })}
              className="h-10 w-10 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-2">
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                Draft Deliveries
              </h1>
              <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
                Manage your saved drafts. Continue editing to complete and submit for a quote.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-2 text-sm px-4 py-2">
            <FileText className="h-4 w-4" />
            {draftList.length} Draft{draftList.length !== 1 ? 's' : ''}
          </Badge>
        </section>

        {/* Empty state */}
        {draftList.length === 0 ? (
          <section className="mt-12">
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                  No drafts yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  When you save a delivery as draft, it will appear here. Start creating a delivery and save it as draft to continue later.
                </p>
                <Link
                  to="/dealer-create-delivery"
                  className="inline-flex items-center gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 px-6 py-3 rounded-full text-sm font-extrabold transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Create New Delivery
                </Link>
              </CardContent>
            </Card>
          </section>
        ) : (
          <>
            {/* Desktop table */}
            <section className="mt-8 hidden lg:block">
              <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                    Your Drafts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] uppercase tracking-widest font-black">Created</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-black">Service Type</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-black">Pickup</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-black">Drop-off</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-black">Vehicle</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-black">Quote</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-widest font-black text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftList.map((draft: any) => (
                        <TableRow key={draft.id}>
                          <TableCell>
                            <div className="font-black text-slate-900 dark:text-white">
                              {formatDate(draft.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-bold">
                              {serviceTypeLabels[draft.serviceType] || draft.serviceType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-lime-500 flex-shrink-0" />
                              <span className="text-sm font-medium truncate max-w-[150px]">
                                {draft.pickupAddress?.split(',')[0] || '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <span className="text-sm font-medium truncate max-w-[150px]">
                                {draft.dropoffAddress?.split(',')[0] || '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm font-medium">
                                {draft.vehicleMake && draft.vehicleModel
                                  ? `${draft.vehicleMake} ${draft.vehicleModel}`
                                  : '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {draft.quote?.estimatedAmount ? (
                              <div className="text-sm font-black text-lime-600">
                                ${draft.quote.estimatedAmount.toFixed(2)}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">No quote</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(draft.id)}
                                className="gap-2"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(draft.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            {/* Mobile cards */}
            <section className="mt-8 lg:hidden space-y-4">
              {draftList.map((draft: any) => (
                <Card key={draft.id} className="rounded-3xl border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">
                          {formatDate(draft.createdAt)}
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold mt-1">
                          {serviceTypeLabels[draft.serviceType] || draft.serviceType}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(draft.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(draft.id)}
                          className="h-8 w-8 p-0 text-red-500"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-lime-500" />
                        <span className="text-slate-600 dark:text-slate-400">Pickup:</span>
                        <span className="font-medium truncate">{draft.pickupAddress?.split(',')[0] || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span className="text-slate-600 dark:text-slate-400">Drop-off:</span>
                        <span className="font-medium truncate">{draft.dropoffAddress?.split(',')[0] || '—'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </>
        )}

        {/* Info section */}
        <section className="mt-8">
          <Card className="bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800 rounded-3xl">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-lime-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-black text-lime-700 dark:text-lime-300">About Drafts</h3>
                  <p className="text-sm text-lime-600 dark:text-lime-400 mt-1">
                    Drafts are saved delivery requests that are not yet submitted for a quote. You can edit them anytime and submit when ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
