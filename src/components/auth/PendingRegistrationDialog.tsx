//@ts-nocheck
/**
 * PendingRegistrationDialog — shown when a user tries to sign up with an
 * email that has a pending (unverified) registration.
 *
 * Displays:
 *   • The email address
 *   • When the registration was started (createdAt)
 *   • Two buttons: "Use Another Email" or "Verify the Old Signup"
 *
 * Extracted into its own component so it can be reused and tested
 * independently from IndividualSignupForm.
 */
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

export interface PendingRegistrationDialogProps {
  /** The email with the pending registration */
  email: string | null;
  /** When the registration was started (ISO string from backend) */
  createdAt: string | null;
  /** Whether the resend OTP mutation is in progress */
  isResending: boolean;
  /** Called when user clicks "Verify the Old Signup" */
  onVerify: (email: string) => void;
  /** Called when user clicks "Use Another Email" or closes the dialog */
  onUseAnother: () => void;
}

/**
 * Format the createdAt date as a readable string.
 * e.g. "August 19, 2026 at 1:30 PM"
 */
function formatRegistrationDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) + " at " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export default function PendingRegistrationDialog({
  email,
  createdAt,
  isResending,
  onVerify,
  onUseAnother,
}: PendingRegistrationDialogProps) {
  const formattedDate = formatRegistrationDate(createdAt);

  return (
    <Dialog
      open={!!email}
      onOpenChange={(open) => {
        if (!open) onUseAnother();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-5 h-5" />
            Unverified Registration Found
          </DialogTitle>
          <DialogDescription className="text-left space-y-2 pt-2">
            <span className="block">
              You started a registration with{" "}
              <strong className="text-slate-900 dark:text-white">{email}</strong>
              {formattedDate && (
                <>
                  {" "}on{" "}
                  <strong className="text-slate-900 dark:text-white">{formattedDate}</strong>
                </>
              )}
              {" "}but didn't verify your email.
            </span>
            <span className="block">
              Would you like to pick up where you left off, or use a different
              email address?
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto rounded-xl"
            onClick={onUseAnother}
          >
            Use Another Email
          </Button>
          <Button
            className="w-full sm:w-auto rounded-xl bg-primary text-slate-950 hover:bg-primary/90"
            disabled={isResending}
            onClick={() => {
              if (email) onVerify(email);
            }}
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending Code...
              </>
            ) : (
              "Verify the Old Signup"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
