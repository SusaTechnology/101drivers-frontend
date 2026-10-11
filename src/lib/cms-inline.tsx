import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Shared inline formatting for ALL CMS text — the single source of truth
 * used by the public pages (blog/news/careers detail) AND the admin editors
 * and previews, so what the editor previews is exactly what visitors get.
 *
 * Supported syntax (React nodes only, never raw HTML):
 *   **bold**        → <strong>
 *   *italic*        → <em>          (single asterisks; ** wins over *)
 *   [label](/path)  → internal router link
 *   [label](https…) → external link, new tab, rel=noopener
 *   [label](mailto…)→ plain anchor
 */

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*(?!\s)[^*]+\*)/g;

const BOLD_CLS = "font-bold text-slate-900 dark:text-white";
const LINK_CLS = "font-bold text-lime-600 dark:text-lime-400 hover:underline";

const LINK_TOKEN_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** True when the string contains at least one formatting token — handy for
 *  deciding whether to show the "formatting supported" hint in editors. */
export function hasCmsInlineMarkup(text: string): boolean {
  INLINE_PATTERN.lastIndex = 0;
  return INLINE_PATTERN.test(text);
}

export function renderCmsInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, "g"); // fresh lastIndex per call
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className={BOLD_CLS}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      const link = token.match(LINK_TOKEN_RE);
      if (link) {
        const [, label, href] = link;
        if (href.startsWith("/")) {
          nodes.push(
            <Link
              key={key++}
              to={href as LinkProps["to"]}
              className={LINK_CLS}
            >
              {label}
            </Link>,
          );
        } else if (/^https?:\/\//i.test(href)) {
          nodes.push(
            <a
              key={key++}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLS}
            >
              {label}
            </a>,
          );
        } else {
          nodes.push(
            <a key={key++} href={href} className={LINK_CLS}>
              {label}
            </a>,
          );
        }
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
