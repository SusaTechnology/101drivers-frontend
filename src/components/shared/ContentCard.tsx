import { Link } from "@tanstack/react-router";
import type { LinkProps, RegisteredRouter } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * ContentCard / ContentCardGrid — the shared "YouTube-flex-style" card
 * used by the Blog, News and Careers index pages.
 *
 * Cards are rendered by iterating a content registry
 * (src/content/blog|news|careers), so the grid is never hard-coded:
 * a new registry item automatically becomes a card that navigates to
 * its own /$slug detail page.
 *
 * The card is generic over the Link target so TanStack Router keeps
 * full type safety through the wrapper — `to="/blog/$slug"` infers the
 * literal route at the call site and `params` is checked against it.
 *
 * The cover shows the item's image when it has one; otherwise a
 * deterministic brand gradient (keyed off the title, so a given post
 * always gets the same cover) with the section icon.
 */

export interface ContentCardMetaChip {
  icon?: LucideIcon;
  label: string;
}

/** Card-only props — everything else is forwarded to <Link>. */
interface ContentCardOwnProps {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  /** Small overlay pill on the cover (e.g. a news tag or role type). */
  badge?: string;
  /** Icon + text chips under the cover (e.g. date, location). */
  meta?: ContentCardMetaChip[];
  /** Section icon shown on gradient covers (and in fallbacks). */
  fallbackIcon: LucideIcon;
  /** Card call-to-action, e.g. "Read article" / "View role". */
  ctaLabel?: string;
}

type ContentCardProps<
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
> = ContentCardOwnProps &
  LinkProps<"a", RegisteredRouter, TFrom, TTo>;

/** Brand-consistent gradient covers — index derived from the title so
 *  the choice is deterministic per item. */
const COVER_GRADIENTS = [
  "from-lime-500/30 via-emerald-600/20 to-slate-900",
  "from-emerald-500/25 via-teal-600/20 to-slate-900",
  "from-teal-500/25 via-cyan-700/20 to-slate-900",
  "from-lime-400/25 via-green-600/20 to-slate-900",
] as const;

function coverGradientFor(title: string): string {
  const hash = [...title].reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) | 0,
    0,
  );
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
}

export function ContentCard<
  TFrom extends string = string,
  TTo extends string | undefined = undefined,
>({
  to,
  params,
  title,
  description,
  image,
  imageAlt,
  badge,
  meta,
  fallbackIcon: FallbackIcon,
  ctaLabel = "Read more",
}: ContentCardProps<TFrom, TTo>) {
  return (
    <Link
      to={to}
      params={params}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
    >
      {/* Cover — 16:9 like a video thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-slate-900">
        {image ? (
          <img
            src={image}
            alt={imageAlt ?? ""}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${coverGradientFor(title)}`}
          >
            <FallbackIcon
              className="h-10 w-10 text-white/40"
              aria-hidden="true"
            />
          </div>
        )}
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-lime-400 backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        {meta && meta.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {meta.map((chip) => (
              <span key={chip.label} className="inline-flex items-center gap-1.5">
                {chip.icon && <chip.icon className="h-3.5 w-3.5" aria-hidden="true" />}
                {chip.label}
              </span>
            ))}
          </div>
        )}
        <h3 className="text-base font-black leading-snug text-slate-900 dark:text-white transition-colors group-hover:text-lime-600 dark:group-hover:text-lime-400">
          {title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          {ctaLabel}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}

/** Responsive card grid — YouTube-flex layout. */
export function ContentCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}
