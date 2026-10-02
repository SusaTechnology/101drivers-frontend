import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { SearchX } from "lucide-react";

/**
 * ContentNotFound — friendly in-page "we couldn't find that" state for
 * the /$slug detail pages of the public content sections (blog, news,
 * careers). This is an SPA: unknown slugs resolve to index.html server-
 * side, so the not-found case is handled here rather than by an HTTP
 * 404. Rendered inside the page shell (NavBar + footer stay in place).
 */
export function ContentNotFound({
  label,
  backTo,
  backLabel,
}: {
  /** What the visitor was looking for, e.g. "blog post". */
  label: string;
  /** Where to send them back to, e.g. "/blog". */
  backTo: LinkProps["to"];
  /** Back-link text, e.g. "Back to the blog". */
  backLabel: string;
}) {
  return (
    <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-lime-500/15">
          <SearchX className="h-6 w-6 text-lime-600 dark:text-lime-400" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-black text-slate-900 dark:text-white">
          We couldn&rsquo;t find that {label}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          It may have been moved or removed. The link might also be
          mistyped — check it and try again.
        </p>
        <Link
          to={backTo}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-lime-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-lime-600 transition-colors"
        >
          {backLabel}
        </Link>
      </div>
    </main>
  );
}
