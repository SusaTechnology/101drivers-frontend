/**
 * Shared shapes for the public content registry (src/content/).
 *
 * Content lives ONE FILE PER ITEM inside its section folder
 * (src/content/blog/, src/content/news/, src/content/careers/) and each
 * folder has an index.ts that registers its items. The index pages and
 * the /$slug detail routes are both generated from those registries —
 * adding an item is "new file + one line in the folder's index"; nothing
 * in the pages or routes is hard-coded per item.
 */

/**
 * Inline formatting inside blog text: `**bold**` renders as <strong>,
 * `[label](/path)` renders as an internal link. Both are parsed by the
 * detail-page renderer (no raw HTML — React nodes only).
 */

/** One block of a rich article body (blog posts). */
export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  /** Bulleted list; `marker: "check" | "cross"` styles items as
   *  pros/cons (purely presentational). */
  | { type: "ul"; items: string[]; marker?: "check" | "cross" }
  | { type: "ol"; items: string[] }
  /** Highlighted callout box (e.g. "TL;DR", "Quick answer"). */
  | { type: "callout"; label?: string; text: string }
  /** Data table; optional highlighted column (0-based, rendered in the
   *  brand color) and highlighted row. */
  | { type: "table"; head: string[]; rows: string[][]; highlightCol?: number; highlightRow?: number; note?: string }
  /** Pricing card — big headline figure + key/value rows. */
  | { type: "pricing"; big: string; label: string; rows: { k: string; v: string; included?: boolean }[] }
  /** FAQ section (also emitted as FAQPage JSON-LD). */
  | { type: "faq"; items: { q: string; a: string }[] }
  /** Chip grid (e.g. service areas). */
  | { type: "chips"; items: string[] }
  /** Related resources grid at the end of an article. */
  | { type: "related"; items: { to: string; label: string; description: string }[] };

/** A blog article — rendered at /blog/<slug>. */
export interface BlogPost {
  /** URL segment. Must be unique, kebab-case. */
  slug: string;
  title: string;
  /** ISO date (yyyy-mm-dd). Drives ordering (newest first) and display. */
  date: string;
  /** Short card description (also the SEO description of the detail page). */
  excerpt: string;
  /** Optional kicker chip in the detail header, e.g. "For dealerships". */
  kicker?: string;
  /** Optional hero meta, e.g. 12 -> "12 min read". */
  readingMinutes?: number;
  author?: string;
  /** Card + detail cover, served from /public (e.g. "/assets/foo.jpg").
   *  Omit it and the card falls back to a branded gradient cover. */
  image?: string;
  imageAlt?: string;
  /** Article body as rich blocks (see BlogBlock). */
  body: BlogBlock[];
}

/** A company announcement — rendered at /news/<slug>. */
export interface NewsPost {
  slug: string;
  title: string;
  date: string;
  /** Short category label, e.g. "Product", "Service Update", "Company". */
  tag: string;
  excerpt: string;
  image?: string;
  imageAlt?: string;
  body: string[];
}

/** An open role — rendered at /careers/<slug>. */
export interface JobPosting {
  slug: string;
  title: string;
  location: string;
  /** Human label shown on chips, e.g. "Full-time". */
  type: string;
  /** schema.org employmentType, for the JobPosting JSON-LD. */
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "INTERN" | "TEMPORARY";
  /** Card summary (first body paragraph should expand on it). */
  excerpt: string;
  /** Full posting paragraphs, in order. */
  body: string[];
  /** Applications go here (mailto). */
  applyEmail: string;
}
