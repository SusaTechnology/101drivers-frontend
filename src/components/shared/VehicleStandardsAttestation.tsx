"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Vehicle standards attestation checkbox — required by insurance.
 *
 * The customer must confirm, at delivery-creation time, that the vehicle
 * being transported is:
 *   1. Under 12 years old
 *   2. Under 120,000 miles
 *   3. Valued under $75,000
 *
 * This is a single attestation checkbox (not three separate input fields).
 * The legal text is the operative piece; the backend persists both the
 * boolean flag AND a timestamp so insurers get a full audit trail.
 *
 * The checkbox itself is rendered larger than the default shadcn size
 * (h-5 w-5 instead of h-4 w-4) with a thicker unchecked border so it
 * stands out as a required, legally-meaningful control rather than a
 * minor preference toggle.
 *
 * Used on:
 *   - dealer-create-delivery (required for form submission)
 *   - dealer-edit-delivery   (required for form submission)
 *
 * Read-only display (admin / dealer delivery details pages) is handled
 * inline in those pages, not by this component — this component is only
 * for the interactive create/edit flow.
 */
export interface VehicleStandardsAttestationProps {
  /** Current checked state */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** When true, renders the box with a red border + error message */
  showError?: boolean;
  /** Override the helper text shown below the checkbox */
  helperText?: string;
  /** Optional id for the checkbox element (defaults to "vehicleStandardsConfirmed") */
  id?: string;
  /** Optional className for the outer wrapper */
  className?: string;
}

const DEFAULT_HELPER_TEXT =
  "Required for insurance coverage. Dealer inventory typically meets these standards automatically.";

/**
 * The exact attestation text. Bolded in full per spec; the red asterisk
 * prefix marks it as a required field.
 *
 * NOTE: If insurance ever changes the wording (e.g. "under 150k miles" for
 * trucks), change it here — this is the single source of truth.
 */
export const VEHICLE_STANDARDS_ATTESTATION_TEXT =
  "I confirm the vehicle is under 12 years old, under 120k miles, and under $75k value.";

export function VehicleStandardsAttestation({
  checked,
  onChange,
  showError = false,
  helperText = DEFAULT_HELPER_TEXT,
  id = "vehicleStandardsConfirmed",
  className,
}: VehicleStandardsAttestationProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border transition-colors",
        showError
          ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800"
          : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          className={cn(
            // Larger than default (size-5 vs size-4) + thicker border when unchecked
            "size-5 mt-0.5 rounded-md data-[state=unchecked]:border-2 data-[state=unchecked]:border-slate-400 dark:data-[state=unchecked]:border-slate-500",
            showError &&
              "data-[state=unchecked]:border-red-500 dark:data-[state=unchecked]:border-red-500"
          )}
        />
        <div className="space-y-1 min-w-0 flex-1">
          <Label
            htmlFor={id}
            className="block text-sm font-bold cursor-pointer leading-snug"
          >
            <span className="text-red-500 mr-1" aria-hidden="true">
              *
            </span>
            {VEHICLE_STANDARDS_ATTESTATION_TEXT}
          </Label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {helperText}
          </p>
          {showError && (
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold pt-1">
              You must confirm the vehicle meets these standards to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact read-only badge for displaying the attestation status on
 * admin / dealer delivery detail pages. Renders one of three states:
 *   - Confirmed (green checkmark + timestamp)
 *   - Not captured (neutral grey — for legacy deliveries created before the feature)
 *   - Missing (red — for deliveries that somehow don't have it but should)
 *
 * The "Not captured" state is important: we don't want to falsely imply
 * a customer refused to attest when the feature simply didn't exist yet.
 */
export function VehicleStandardsAttestationBadge({
  confirmed,
  confirmedAt,
  size = "sm",
}: {
  confirmed: boolean | null | undefined;
  confirmedAt?: string | Date | null;
  size?: "sm" | "md";
}) {
  const sizeClasses =
    size === "md"
      ? "px-3 py-2 text-sm"
      : "px-2 py-1 text-[11px]";

  if (confirmed === true) {
    const dateStr = confirmedAt
      ? new Date(confirmedAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold",
          sizeClasses
        )}
        title={dateStr ? `Attested ${dateStr}` : "Attested"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-3.5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        Standards confirmed
        {dateStr && <span className="font-normal opacity-75">· {dateStr}</span>}
      </span>
    );
  }

  if (confirmed === false) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-semibold",
          sizeClasses
        )}
        title="Customer did not attest to vehicle standards"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-3.5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        Not confirmed
      </span>
    );
  }

  // null / undefined — feature didn't exist when delivery was created
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium",
        sizeClasses
      )}
      title="Attestation not captured at time of creation (feature shipped July 2026)"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-3.5"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 7zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      Not captured
    </span>
  );
}
