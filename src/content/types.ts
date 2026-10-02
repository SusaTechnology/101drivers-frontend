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

/** A blog article — rendered at /blog/<slug>. */
export interface BlogPost {
  /** URL segment. Must be unique, kebab-case. */
  slug: string;
  title: string;
  /** ISO date (yyyy-mm-dd). Drives ordering (newest first) and display. */
  date: string;
  /** Short card description (also the SEO description of the detail page). */
  excerpt: string;
  /** Card + detail cover, served from /public (e.g. "/assets/foo.jpg").
   *  Omit it and the card falls back to a branded gradient cover. */
  image?: string;
  imageAlt?: string;
  /** Article paragraphs, in order. */
  body: string[];
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
