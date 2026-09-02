/**
 * Admin Dispute Details Page
 *
 * Shows a single dispute with:
 *  - Real data fetched via useDisputeDetail(disputeId)
 *  - Real action buttons wired to useDisputeActions
 *  - Notes timeline
 *  - Audit info (resolvedBy, stripeRefundId, rejectionReason)
 *
 * Replaces the previous mock-data version that always showed DSP-100238.
 *
 * Route: /admin-dispute-detail?disputeId=xxx
 * Reads disputeId from the URL search params (set by the route's
 * validateSearch in src/routes/admin-dispute-detail/index.tsx).
 */
import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Gavel,
  RefreshCw as Sync,
  Hourglass as HourglassTop,
  History,
  Info,
  Undo,
  StickyNote as NoteAdd,
  CheckCircle,
  X as Cancel,
  Flag,
  AlertTriangle as CarCrash,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  useDisputeDetail,
  useDisputeActions,
  formatDisputeDate,
  getDisputeStatusColor,
} from "@/hooks/useAdminDisputes";
import type { DisputeListItem } from "@/types/dispute";
import { Navbar } from "../shared/layout/testNavbar";
import { navItems } from "@/lib/items/navItems";
import { Brand } from "@/lib/items/brand";
import { useAdminActions } from "@/hooks/useAdminActions";

interface AdminDisputeDetailsPageProps {
  disputeId: string;
}

export default function AdminDisputeDetailsPage({
  disputeId,
}: AdminDisputeDetailsPageProps) {
  const { data: dispute, isLoading, isError, refetch } = useDisputeDetail(disputeId);
  const actions = useDisputeActions(disputeId);
  const { actionItems, signOut } = useAdminActions();

  // ─── Action dialog state ───
  const [activeAction, setActiveAction] = useState<
    null | 'addNote' | 'resolve' | 'reject' | 'close' | 'legalHold'
  >(null);

  // ─── Form state for the active action ───
  const [noteText, setNoteText] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [approveRefund, setApproveRefund] = useState(true);
  const [refundAmount, setRefundAmount] = useState<string>(''); // empty = full
  const [rejectionReason, setRejectionReason] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [legalHoldValue, setLegalHoldValue] = useState(true);

  if (!disputeId) {
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
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No dispute selected</AlertTitle>
            <AlertDescription>
              Open a dispute from the{' '}
              <Link to="/admin-disputes" className="underline font-semibold">
                disputes list
              </Link>{' '}
              to see its details here.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

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
          <div className="flex items-center gap-3 text-slate-500">
            <Sync className="h-4 w-4 animate-spin" />
            Loading dispute…
          </div>
        </main>
      </div>
    );
  }

  if (isError || !dispute) {
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
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load dispute</AlertTitle>
            <AlertDescription>
              The dispute could not be loaded. It may have been deleted, or there
              was a network error.
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  <Sync className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  const statusColor = getDisputeStatusColor(dispute.status);

  // ─── Action handlers ───
  const handleSubmitAddNote = () => {
    if (!noteText.trim()) {
      toast.error('Note is required');
      return;
    }
    actions.addNote.mutate(
      { note: noteText.trim() },
      {
        onSuccess: () => {
          toast.success('Note added');
          setNoteText('');
          setActiveAction(null);
        },
        onError: (err) => toast.error(err.message || 'Failed to add note'),
      },
    );
  };

  const handleSubmitResolve = () => {
    const refundAmt = refundAmount.trim() === '' ? null : Number(refundAmount);
    if (approveRefund && refundAmt != null && (Number.isNaN(refundAmt) || refundAmt <= 0)) {
      toast.error('Refund amount must be a positive number');
      return;
    }
    actions.resolve.mutate(
      {
        approveRefund,
        refundAmount: refundAmt,
        resolutionNote: resolutionNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(approveRefund ? 'Dispute resolved with refund' : 'Dispute resolved without refund');
          setResolutionNote('');
          setRefundAmount('');
          setApproveRefund(true);
          setActiveAction(null);
        },
        onError: (err) => toast.error(err.message || 'Failed to resolve dispute'),
      },
    );
  };

  const handleSubmitReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    actions.reject.mutate(
      {
        rejectionReason: rejectionReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success('Dispute rejected');
          setRejectionReason('');
          setActiveAction(null);
        },
        onError: (err) => toast.error(err.message || 'Failed to reject dispute'),
      },
    );
  };

  const handleSubmitClose = () => {
    actions.close.mutate(
      { closingNote: closingNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Dispute closed');
          setClosingNote('');
          setActiveAction(null);
        },
        onError: (err) => toast.error(err.message || 'Failed to close dispute'),
      },
    );
  };

  const handleSubmitLegalHold = () => {
    actions.legalHold.mutate(
      { legalHold: legalHoldValue },
      {
        onSuccess: () => {
          toast.success(legalHoldValue ? 'Legal hold enabled' : 'Legal hold removed');
          setActiveAction(null);
        },
        onError: (err) => toast.error(err.message || 'Failed to toggle legal hold'),
      },
    );
  };

  // Whether each action is allowed given the current status
  const canResolve = dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW';
  const canReject = dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW';
  const canClose = dispute.status !== 'CLOSED';
  const canToggleLegalHold = dispute.status !== 'CLOSED';
  const canAddNote = dispute.status !== 'CLOSED';

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* ─── Admin navigation (same as all other admin pages) ─── */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      {/* ─── Page content ─── */}
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin-disputes"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to disputes
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={actions.isAnyPending}
          >
            <Sync className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── Title card ─── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gavel className="h-5 w-5 text-slate-400" />
                Dispute {dispute.id.slice(-8).toUpperCase()}
              </CardTitle>
              <CardDescription className="mt-1">
                Opened {formatDisputeDate(dispute.openedAt)}
                {dispute.resolvedAt && (
                  <> · Resolved {formatDisputeDate(dispute.resolvedAt)}</>
                )}
                {dispute.closedAt && (
                  <> · Closed {formatDisputeDate(dispute.closedAt)}</>
                )}
              </CardDescription>
            </div>
            <Badge className={cn(statusColor.bg, statusColor.text, statusColor.border, 'border')}>
              {statusColor.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Reason */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Reason
              </p>
              <p className="mt-1 text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                {dispute.reason}
              </p>
            </div>

            {/* Rejection reason (only when REJECTED) */}
            {dispute.status === 'REJECTED' && dispute.rejectionReason && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Dispute rejected</AlertTitle>
                <AlertDescription>{dispute.rejectionReason}</AlertDescription>
              </Alert>
            )}

            {/* Refund info (only when RESOLVED with refund) */}
            {dispute.status === 'RESOLVED' && dispute.stripeRefundId && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <AlertTitle>Refund issued</AlertTitle>
                <AlertDescription>
                  Stripe refund ID:{' '}
                  <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                    {dispute.stripeRefundId}
                  </code>
                </AlertDescription>
              </Alert>
            )}

            {/* Audit grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Legal Hold
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {dispute.legalHold ? (
                    <span className="text-amber-600 dark:text-amber-400">ON</span>
                  ) : (
                    <span className="text-slate-500">Off</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Resolved By
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {dispute.resolvedBy?.fullName ||
                    dispute.resolvedBy?.email ||
                    dispute.resolvedBy?.username ||
                    '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Notes
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {dispute._count?.notes ?? dispute.notes?.length ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Last Updated
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {formatDisputeDate(dispute.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Linked delivery ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CarCrash className="h-4 w-4 text-slate-400" />
            Linked Delivery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Delivery ID
              </p>
              <Link
                to="/admin-delivery-detail"
                search={{ deliveryId: dispute.deliveryId }}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                {dispute.deliveryId.slice(-8).toUpperCase()}
              </Link>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Delivery Status
              </p>
              <p className="font-semibold">{dispute.delivery?.status ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Pickup
              </p>
              <p className="font-medium">{dispute.delivery?.pickupAddress ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Drop-off
              </p>
              <p className="font-medium">{dispute.delivery?.dropoffAddress ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Actions ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
          <CardDescription>
            Resolve (with refund), reject (no refund), close, or add a note.
            Customers are notified automatically on resolve / reject / close.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canResolve || actions.isAnyPending}
              onClick={() => {
                setActiveAction('resolve');
                setApproveRefund(true);
                setRefundAmount('');
                setResolutionNote('');
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" />
              Resolve
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canReject || actions.isAnyPending}
              onClick={() => {
                setActiveAction('reject');
                setRejectionReason('');
              }}
            >
              <Cancel className="h-4 w-4 mr-2 text-red-500" />
              Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canClose || actions.isAnyPending}
              onClick={() => {
                setActiveAction('close');
                setClosingNote('');
              }}
            >
              <Flag className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canToggleLegalHold || actions.isAnyPending}
              onClick={() => {
                setActiveAction('legalHold');
                setLegalHoldValue(!dispute.legalHold);
              }}
            >
              <HourglassTop className="h-4 w-4 mr-2 text-amber-500" />
              {dispute.legalHold ? 'Remove Hold' : 'Enable Hold'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canAddNote || actions.isAnyPending}
              onClick={() => {
                setActiveAction('addNote');
                setNoteText('');
              }}
            >
              <NoteAdd className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>

          {/* ─── Inline action dialogs ─── */}
          {activeAction === 'addNote' && (
            <ActionDialog
              title="Add a note"
              description="Internal note for the dispute timeline. Not shared with the customer."
              onCancel={() => setActiveAction(null)}
              onSubmit={handleSubmitAddNote}
              isPending={actions.addNote.isPending}
              submitLabel="Add Note"
            >
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter your note…"
                rows={4}
              />
            </ActionDialog>
          )}

          {activeAction === 'resolve' && (
            <ActionDialog
              title="Resolve dispute"
              description="Resolving marks the dispute as resolved and reverts the delivery to COMPLETED. The customer is notified automatically."
              onCancel={() => setActiveAction(null)}
              onSubmit={handleSubmitResolve}
              isPending={actions.resolve.isPending}
              submitLabel="Resolve"
            >
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-bold">Refund decision</Label>
                  <div className="flex gap-3 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="refundDecision"
                        checked={approveRefund === true}
                        onChange={() => setApproveRefund(true)}
                      />
                      <span className="text-sm">Approve refund (customer-favor)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="refundDecision"
                        checked={approveRefund === false}
                        onChange={() => setApproveRefund(false)}
                      />
                      <span className="text-sm">No refund (driver-favor)</span>
                    </label>
                  </div>
                </div>
                {approveRefund && (
                  <div>
                    <Label className="text-xs font-bold">
                      Refund amount (USD) — leave blank for full refund
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="Full refund"
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      A Stripe refund will be issued with an idempotency key
                      derived from the dispute ID — retrying this action will
                      NOT double-refund.
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-xs font-bold">Resolution note (optional)</Label>
                  <Textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Internal note about this resolution…"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            </ActionDialog>
          )}

          {activeAction === 'reject' && (
            <ActionDialog
              title="Reject dispute"
              description="Rejecting marks the dispute as REJECTED (no refund). The customer is notified with the rejection reason you provide below. The delivery is reverted to COMPLETED."
              onCancel={() => setActiveAction(null)}
              onSubmit={handleSubmitReject}
              isPending={actions.reject.isPending}
              submitLabel="Reject Dispute"
              submitVariant="destructive"
            >
              <div>
                <Label className="text-xs font-bold">
                  Rejection reason (required — shared with customer)
                </Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why the dispute is being rejected…"
                  rows={4}
                  className="mt-1"
                />
              </div>
            </ActionDialog>
          )}

          {activeAction === 'close' && (
            <ActionDialog
              title="Close dispute"
              description="Closing formally closes the dispute. The customer is notified. The delivery is reverted to COMPLETED if it was still DISPUTED."
              onCancel={() => setActiveAction(null)}
              onSubmit={handleSubmitClose}
              isPending={actions.close.isPending}
              submitLabel="Close"
            >
              <Textarea
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="Optional closing note…"
                rows={3}
              />
            </ActionDialog>
          )}

          {activeAction === 'legalHold' && (
            <ActionDialog
              title={legalHoldValue ? 'Enable legal hold' : 'Remove legal hold'}
              description={
                legalHoldValue
                  ? 'A legal hold prevents deletion of the dispute and freezes associated payouts until resolved.'
                  : 'Removing the legal hold allows the dispute to be deleted and releases any held payouts.'
              }
              onCancel={() => setActiveAction(null)}
              onSubmit={handleSubmitLegalHold}
              isPending={actions.legalHold.isPending}
              submitLabel={legalHoldValue ? 'Enable Hold' : 'Remove Hold'}
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">
                The customer will be notified about this change.
              </p>
            </ActionDialog>
          )}
        </CardContent>
      </Card>

      {/* ─── Notes timeline ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            Notes &amp; Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!dispute.notes || dispute.notes.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No notes yet.</p>
          ) : (
            <ol className="space-y-4">
              {dispute.notes.map((note) => (
                <li key={note.id} className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                    {(note.author?.fullName?.[0] ?? note.author?.username?.[0] ?? 'A').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-semibold">
                        {note.author?.fullName ||
                          note.author?.email ||
                          note.author?.username ||
                          'Admin'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDisputeDate(note.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                      {note.note}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      </main>
    </div>
  );
}

// ─── Helper: small inline action dialog (avoids pulling in a Dialog component) ───
function ActionDialog({
  title,
  description,
  onCancel,
  onSubmit,
  isPending,
  submitLabel,
  submitVariant = 'default',
  children,
}: {
  title: string;
  description?: string;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
  submitVariant?: 'default' | 'destructive';
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
      <div>
        <p className="text-sm font-bold">{title}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {children}
      <div className="flex gap-2 justify-end pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant={submitVariant}
          onClick={onSubmit}
          disabled={isPending}
        >
          {isPending ? 'Working…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

// Local import of cn — keep file self-contained
function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
