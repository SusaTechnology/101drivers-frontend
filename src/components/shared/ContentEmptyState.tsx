import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

/**
 * ContentEmptyState — the one shared "nothing here yet" state for the
 * public content index pages (blog, news, careers). Rendered in place
 * of the card grid when a section's registry has no items, so an
 * emptied content folder shows a friendly panel instead of a blank
 * page area. Pairs with ContentNotFound (detail-page "unknown slug")
 * — dashed border here signals "empty", not "broken link".
 */
export function ContentEmptyState({
  icon: Icon,
  title,
  description,
  actionTo,
  actionLabel,
}: {
  /** Section icon, e.g. Briefcase / Newspaper / BookOpen. */
  icon: LucideIcon;
  /** Short headline, e.g. "No open roles right now". */
  title: string;
  /** One or two supporting sentences. */
  description: string;
  /** Optional call to action (internal route), e.g. "/" or "/help-customer". */
  actionTo?: LinkProps["to"];
  /** CTA text — rendered only when actionTo is also provided. */
  actionLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-lime-500/15">
        <Icon
          className="h-6 w-6 text-lime-600 dark:text-lime-400"
          aria-hidden="true"
        />
      </div>
      <h2 className="text-lg font-black text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
      {actionTo && actionLabel && (
        <Link
          to={actionTo}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-lime-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-lime-600 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
