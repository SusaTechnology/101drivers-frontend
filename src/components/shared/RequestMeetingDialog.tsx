import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { getUser } from '@/lib/tanstack/dataQuery';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
 *     onConfirm={(message, fromMode, fromEmail) =>
 *       mutation.mutate({ pathParams: { id }, message, fromMode, fromEmail })}
 *   />
 */
export const DEFAULT_MEETING_MESSAGE = `Hi, we've reviewed your driver application and would like to schedule a short meeting to finish your onboarding. Please reply with a few times that work for you this week, and we'll send you a calendar invite.`;

export type MeetingFromMode = 'platform' | 'mine';

export interface RequestMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Driver display name, shown in the description ("Send {name}..."). */
  driverName?: string | null;
  /** Mutation pending state — disables the send button. */
  pending?: boolean;
  /** Called with the composed message + From scope when Send is clicked. */
  onConfirm: (message: string, fromMode: MeetingFromMode, fromEmail: string) => void;
  /** Prefill for the textarea; defaults to DEFAULT_MEETING_MESSAGE. */
  initialMessage?: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestMeetingDialog({
  open,
  onOpenChange,
  driverName,
  pending = false,
  onConfirm,
  initialMessage,
}: RequestMeetingDialogProps) {
  const [message, setMessage] = React.useState(initialMessage ?? DEFAULT_MEETING_MESSAGE);
  // From scope: default to the admin's own address (pre-filled, editable).
  // The mail still LEAVES from the shared platform address — the chosen
  // address becomes Reply-To + BCC copy (deliverability: the SMTP account
  // is only authorized for the platform domain).
  const [fromMode, setFromMode] = React.useState<MeetingFromMode>('mine');
  const [fromEmail, setFromEmail] = React.useState('');
  const trimmed = message.trim();
  const emailOk = fromMode === 'platform' || EMAIL_SHAPE.test(fromEmail.trim());
  // Valid = message present + a usable From address when "mine" is picked.
  const valid = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH && emailOk;

  // Reset the composed text and the From scope each time the dialog opens
  // so a retry starts from the defaults instead of the last attempt.
  React.useEffect(() => {
    if (open) {
      setMessage(initialMessage ?? DEFAULT_MEETING_MESSAGE);
      setFromMode('mine');
      setFromEmail(getUser()?.email ?? '');
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

          {/* FROM SCOPE — who the email should represent. Everything leaves
              from the shared platform address (only that address is
              authorized on SMTP); "mine" adds Reply-To + a BCC copy so the
              driver's replies and a tracking copy land in the admin's
              inbox, while the recipient still sees the official address. */}
          <div className="space-y-2">
            <label
              htmlFor="request-meeting-from"
              className="text-sm font-bold text-slate-700 dark:text-slate-300"
            >
              Send from
            </label>
            <Select
              value={fromMode}
              onValueChange={(v) => setFromMode(v as MeetingFromMode)}
            >
              <SelectTrigger id="request-meeting-from" className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">My email address</SelectItem>
                <SelectItem value="platform">
                  Platform — info@101drivers.com
                </SelectItem>
              </SelectContent>
            </Select>
            {fromMode === 'mine' && (
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="you@101drivers.com"
                className="rounded-xl"
                disabled={pending}
                aria-label="Your email address for replies and your BCC copy"
              />
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The email always leaves from the shared platform address.{' '}
              {fromMode === 'mine'
                ? 'Your address is set as Reply-To — replies come straight to you — and you get a hidden BCC copy for tracking.'
                : 'You still get a hidden BCC copy of every request you send.'}
            </p>
            {!emailOk && (
              <p className="text-xs font-bold text-rose-600">
                Enter a valid email address to send from your address.
              </p>
            )}
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
              onClick={() => onConfirm(trimmed, fromMode, fromEmail.trim())}
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
