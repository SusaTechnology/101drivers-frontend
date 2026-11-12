import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Reusable "Request Meeting" dialog for the driver lifecycle.
 *
 * Lets the admin compose the scheduling email that goes to a
 * Pending-Approval driver, then sends it through
 * POST /api/users/:id/request-meeting-driver. The backend commits the
 * email send and the MEETING_REQUESTED status flip in ONE transaction —
 * if the email fails, the status change rolls back and the error surfaces
 * here — so the dialog copy can promise "email + status move together".
 *
 * Used by BOTH entry points:
 *   - admin-users.tsx (row action in the Users table)
 *   - admin-user-detail.tsx (action row on the Driver Profile page)
 *
 * Usage:
 *   <RequestMeetingDialog
 *     open={open} onOpenChange={setOpen}
 *     driverName={user.fullName}
 *     pending={mutation.isPending}
 *     onConfirm={(message) => mutation.mutate({ pathParams: { id }, message })}
 *   />
 */
export const DEFAULT_MEETING_MESSAGE = `Hi, we've reviewed your driver application and would like to schedule a short meeting to finish your onboarding. Please reply with a few times that work for you this week, and we'll send you a calendar invite.`;

export interface RequestMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Driver display name, shown in the description ("Send {name}..."). */
  driverName?: string | null;
  /** Mutation pending state — disables the send button. */
  pending?: boolean;
  /** Called with the composed message when the admin clicks Send Email. */
  onConfirm: (message: string) => void;
  /** Prefill for the textarea; defaults to DEFAULT_MEETING_MESSAGE. */
  initialMessage?: string;
}

const MAX_MESSAGE_LENGTH = 2000;

export function RequestMeetingDialog({
  open,
  onOpenChange,
  driverName,
  pending = false,
  onConfirm,
  initialMessage,
}: RequestMeetingDialogProps) {
  const [message, setMessage] = React.useState(initialMessage ?? DEFAULT_MEETING_MESSAGE);
  const trimmed = message.trim();
  // Valid length = non-empty after trim and within the backend's cap.
  const valid = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;

  // Reset the composed text each time the dialog opens so a retry starts
  // from the default suggestion instead of the last attempt's leftovers.
  React.useEffect(() => {
    if (open) {
      setMessage(initialMessage ?? DEFAULT_MEETING_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Request Meeting</DialogTitle>
          <DialogDescription>
            {driverName
              ? `Send ${driverName} an email to schedule their onboarding meeting. Their status will move to Meeting Requested.`
              : `Send an email to schedule the onboarding meeting. The driver's status will move to Meeting Requested.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-xl text-sm space-y-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300">
            <p>
              The email and the status change happen together: if the email
              fails to send, nothing changes and you can retry.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="request-meeting-message"
              className="text-sm font-bold text-slate-700 dark:text-slate-300"
            >
              Email message
            </label>
            <Textarea
              id="request-meeting-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Write the message the driver will receive..."
              className="rounded-xl"
              disabled={pending}
            />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                {trimmed.length === 0
                  ? 'A message is required.'
                  : trimmed.length > MAX_MESSAGE_LENGTH
                    ? 'Message is too long.'
                    : 'Sent as the body of the scheduling email.'}
              </span>
              <span className={trimmed.length > MAX_MESSAGE_LENGTH ? 'text-rose-600 font-bold' : ''}>
                {trimmed.length}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(trimmed)}
              className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white"
              disabled={pending || !valid}
            >
              {pending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
