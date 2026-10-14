import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Service-area badge (derived, not manual) — ONE shared definition for the
 * admin Users table and the admin user-detail page, so the two can never
 * drift apart in color or meaning:
 *
 *   Green = inside the LA-metro service-area polygon. Means "eligible for
 *           review" ONLY — never "approved to drive"; the manual Status
 *           field keeps that truth (team flips waitlisted → active).
 *   Gray  = outside the polygon. NOT rejected — no action taken yet.
 *   Amber = no usable zip / unresolvable zip — flagged for review.
 *
 * The polygon is evaluated server-side on the driver's zip (point-in-
 * polygon); this badge only renders the derived fields.
 */
export function ServiceAreaBadge({
  inArea,
  flagged,
  className,
}: {
  inArea: boolean | null;
  flagged: boolean;
  /** Optional refinements (e.g. a slightly larger size on the detail
   *  page). Merged with tailwind-merge, so conflicting utilities from the
   *  caller win over the defaults. */
  className?: string;
}) {
  if (inArea === true) {
    return (
      <Badge
        className={cn(
          'w-fit text-[9px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
          className,
        )}
        title="ZIP is inside the service-area polygon — eligible for review. This does NOT mean approved to drive; approval stays manual."
      >
        In service area
      </Badge>
    );
  }
  if (flagged || inArea === null) {
    return (
      <Badge
        className={cn(
          'w-fit text-[9px] font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
          className,
        )}
        title="No usable ZIP or it could not be resolved — flagged for manual review."
      >
        Review needed
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        'w-fit text-[9px] font-bold border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700',
        className,
      )}
      title="ZIP is outside the service-area polygon. NOT rejected — no action taken yet; approval stays manual."
    >
      Outside area
    </Badge>
  );
}
