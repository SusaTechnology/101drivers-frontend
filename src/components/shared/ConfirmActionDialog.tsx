import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Reusable confirmation dialog for sensitive admin actions.
 *
 * One drop-in component for every "are you sure?" flow: a tinted callout
 * explaining the consequence, optional extra fields (e.g. a reason
 * textarea), and Cancel / Confirm buttons with a pending state. Used by
 * the super-admin tier actions on the Users page (disable / enable /
 * promote / demote admin); reuse it for any future confirmation.
 *
 * Usage:
 *   <ConfirmActionDialog
 *     open={open} onOpenChange={setOpen}
 *     title="Disable Admin"
 *     description="Disable John's administrator account? ..."
 *     tone="danger"
 *     message={<p>John loses admin access immediately...</p>}
 *     confirmLabel="Disable Admin" confirmingLabel="Disabling..."
 *     pending={mutation.isPending}
 *     onConfirm={handleDisable}
 *   />
 */
export type ConfirmTone = 'danger' | 'positive' | 'accent' | 'neutral' | 'info';

const TONE_STYLES: Record<
  ConfirmTone,
  { callout: string; confirmVariant: 'destructive' | 'default'; confirmClass: string }
> = {
  /** Rose callout + destructive button — removing/taking away access. */
  danger: {
    callout: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
    confirmVariant: 'destructive',
    confirmClass: 'rounded-xl',
  },
  /** Emerald callout + emerald button — restoring/granting back access. */
  positive: {
    callout: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    confirmVariant: 'default',
    confirmClass: 'rounded-xl bg-emerald-600 hover:bg-emerald-700',
  },
  /** Violet callout + violet button — elevating into the super-admin tier. */
  accent: {
    callout: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
    confirmVariant: 'default',
    confirmClass: 'rounded-xl bg-violet-600 hover:bg-violet-700 text-white',
  },
  /** Slate callout + destructive button — downgrades/neutral changes. */
  neutral: {
    callout: 'bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300',
    confirmVariant: 'destructive',
    confirmClass: 'rounded-xl',
  },
  /** Sky callout + sky button — informational actions (emails, invites). */
  info: {
    callout: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300',
    confirmVariant: 'default',
    confirmClass: 'rounded-xl bg-sky-600 hover:bg-sky-700 text-white',
  },
};

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short dialog title, e.g. "Disable Admin". */
  title: string;
  /** Muted one-liner under the title describing exactly what happens. */
  description?: string;
  /** Color scheme for the callout box and confirm button. */
  tone?: ConfirmTone;
  /** Callout content — the consequence of the action. */
  message: React.ReactNode;
  /** Optional extra fields between the callout and the footer
   *  (e.g. a reason textarea bound to react-hook-form's register). */
  children?: React.ReactNode;
  confirmLabel: string;
  /** Label shown while pending; defaults to `${confirmLabel}...`. */
  confirmingLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  cancelLabel?: string;
  /** Extra classes on the DialogContent (default matches admin dialogs). */
  contentClassName?: string;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  tone = 'neutral',
  message,
  children,
  confirmLabel,
  confirmingLabel,
  pending = false,
  onConfirm,
  cancelLabel = 'Cancel',
  contentClassName = 'rounded-2xl max-w-md',
}: ConfirmActionDialogProps) {
  const styles = TONE_STYLES[tone];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className={`p-3 rounded-xl text-sm space-y-1.5 ${styles.callout}`}>{message}</div>
          {children}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              {cancelLabel}
            </Button>
            <Button
              onClick={onConfirm}
              variant={styles.confirmVariant}
              className={styles.confirmClass}
              disabled={pending}
            >
              {pending ? confirmingLabel ?? `${confirmLabel}...` : confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
