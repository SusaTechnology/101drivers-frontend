/**
 * CMS payload validation — blog / news / careers.
 *
 * The public renderers consume TYPED block objects (src/content/types.ts on
 * the FE) and build React nodes from them — raw HTML is never rendered, so
 * the stored content must strictly match the shape below. These validators
 * clean + bound every field and return friendly error messages that the
 * admin panel surfaces as toasts.
 *
 * Rules of thumb:
 *  - everything is trimmed; empty optional strings become undefined
 *  - lengths are capped so a fat-fingered paste cannot bloat the row
 *  - `requireBody` is true when the item is being saved as PUBLISHED
 *    (drafts may be empty so editors can save partial work)
 */

import { BadRequestException } from "@nestjs/common";

// ── Limits ──
const MAX = {
  slug: 120,
  title: 200,
  excerpt: 1000,
  tag: 60,
  location: 120,
  typeLabel: 60,
  email: 200,
  kicker: 80,
  author: 120,
  image: 600,
  alt: 300,
  paragraph: 10_000,
  blocks: 300,
  listItems: 100,
  faqItems: 60,
  tableRows: 100,
  tableCols: 10,
  pricingRows: 30,
  chips: 80,
  related: 12,
  paragraphs: 300,
};

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACTOR",
  "INTERN",
  "TEMPORARY",
] as const;

// ── Shapes (mirror src/content/types.ts on the FE) ──
export type BlogBlockIn =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[]; marker?: "check" | "cross" }
  | { type: "ol"; items: string[] }
  | { type: "callout"; label?: string; text: string }
  | {
      type: "table";
      head: string[];
      rows: string[][];
      highlightCol?: number;
      highlightRow?: number;
      note?: string;
    }
  | { type: "pricing"; big: string; label: string; rows: { k: string; v: string; included?: boolean }[] }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "chips"; items: string[] }
  | { type: "related"; items: { to: string; label: string; description: string }[] };

export interface BlogInput {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  kicker?: string;
  readingMinutes?: number;
  author?: string;
  image?: string;
  imageAlt?: string;
  body: BlogBlockIn[];
  status: "DRAFT" | "PUBLISHED";
}

export interface NewsInput {
  slug: string;
  title: string;
  date: string;
  tag: string;
  excerpt: string;
  image?: string;
  imageAlt?: string;
  body: string[];
  status: "DRAFT" | "PUBLISHED";
}

export interface JobInput {
  slug: string;
  title: string;
  location: string;
  type: string;
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  excerpt: string;
  body: string[];
  applyEmail: string;
  status: "DRAFT" | "PUBLISHED";
}

// ── Helpers ──
class Collector {
  errors: string[] = [];
  add(message: string): void {
    this.errors.push(message);
  }
}

function cleanString(c: Collector, value: unknown, field: string, max: number, required: boolean): string | undefined {
  if (value === undefined || value === null) {
    if (required) c.add(`${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string") {
    c.add(`${field} must be text.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) c.add(`${field} is required.`);
    return required ? undefined : undefined;
  }
  if (trimmed.length > max) {
    c.add(`${field} is too long (max ${max} characters).`);
    return trimmed.slice(0, max);
  }
  return trimmed;
}

function cleanStringArray(c: Collector, value: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) {
    c.add(`${field} must be a list.`);
    return [];
  }
  const out: string[] = [];
  value.forEach((item, i) => {
    const cleaned = cleanString(c, item, `${field} item ${i + 1}`, maxLen, true);
    if (cleaned !== undefined) out.push(cleaned);
  });
  if (out.length > maxItems) {
    c.add(`${field} has too many entries (max ${maxItems}).`);
    out.length = maxItems;
  }
  return out;
}

function cleanOptionalString(c: Collector, value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return cleanString(c, value, field, max, false);
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX.slug)
    .replace(/-+$/g, "");
  return slug || "post";
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= MAX.slug;
}

function cleanDate(c: Collector, value: unknown): string {
  const s = cleanString(c, value, "Date", 10, true);
  if (s === undefined) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    c.add("Date must use the YYYY-MM-DD format.");
    return new Date().toISOString().slice(0, 10);
  }
  return s;
}

function cleanStatus(c: Collector, value: unknown): "DRAFT" | "PUBLISHED" {
  if (value === "PUBLISHED") return "PUBLISHED";
  if (value === "DRAFT" || value === undefined || value === null) return "DRAFT";
  c.add("Status must be DRAFT or PUBLISHED.");
  return "DRAFT";
}

function cleanSlug(c: Collector, value: unknown, fallbackTitle: string): string {
  const raw = value === undefined || value === null || (typeof value === "string" && !value.trim())
    ? slugify(fallbackTitle ?? "")
    : (value as string);
  const slug = String(raw).trim().toLowerCase();
  if (!isValidSlug(slug)) {
    c.add(
      "URL slug may only contain lowercase letters, numbers and hyphens (e.g. my-new-post).",
    );
    return slugify(slug);
  }
  return slug;
}

// ── Blog blocks ──
function cleanBlogBlocks(c: Collector, value: unknown): BlogBlockIn[] {
  if (!Array.isArray(value)) {
    c.add("Body must be a list of content blocks.");
    return [];
  }
  const blocks: BlogBlockIn[] = [];
  value.forEach((raw, index) => {
    const n = index + 1;
    if (typeof raw !== "object" || raw === null) {
      c.add(`Block ${n}: invalid content.`);
      return;
    }
    const b = raw as Record<string, unknown>;
    switch (b.type) {
      case "p":
      case "h2":
      case "h3": {
        const text = cleanString(c, b.text, `Block ${n} (${b.type}) text`, MAX.paragraph, true);
        if (text !== undefined) blocks.push({ type: b.type, text });
        break;
      }
      case "ul":
      case "ol": {
        const items = cleanStringArray(c, b.items, `Block ${n} (${b.type}) items`, MAX.listItems, MAX.paragraph);
        if (items.length > 0) {
          const marker = b.marker === "check" || b.marker === "cross" ? b.marker : undefined;
          blocks.push(
            marker && b.type === "ul"
              ? { type: "ul", items, marker }
              : { type: b.type, items },
          );
        }
        break;
      }
      case "callout": {
        const text = cleanString(c, b.text, `Block ${n} (callout) text`, MAX.paragraph, true);
        const label = cleanOptionalString(c, b.label, `Block ${n} (callout) label`, 80);
        if (text !== undefined) blocks.push({ type: "callout", label, text });
        break;
      }
      case "table": {
        const head = cleanStringArray(c, b.head, `Block ${n} (table) header`, MAX.tableCols, 200);
        if (!Array.isArray(b.rows)) {
          c.add(`Block ${n} (table): rows must be a list.`);
          break;
        }
        const rows: string[][] = [];
        (b.rows as unknown[]).slice(0, MAX.tableRows).forEach((row, r) => {
          if (!Array.isArray(row)) {
            c.add(`Block ${n} (table): row ${r + 1} must be a list of cells.`);
            return;
          }
          rows.push(cleanStringArray(c, row, `Block ${n} (table) row ${r + 1}`, MAX.tableCols, 500));
        });
        if (head.length === 0 || rows.length === 0) {
          c.add(`Block ${n} (table): needs a header row and at least one data row.`);
          break;
        }
        const highlightCol = cleanOptionalIndex(b.highlightCol, head.length - 1);
        const highlightRow = cleanOptionalIndex(b.highlightRow, rows.length - 1);
        const note = cleanOptionalString(c, b.note, `Block ${n} (table) note`, 300);
        blocks.push({ type: "table", head, rows, highlightCol, highlightRow, note });
        break;
      }
      case "pricing": {
        const big = cleanString(c, b.big, `Block ${n} (pricing) headline figure`, 40, true);
        const label = cleanString(c, b.label, `Block ${n} (pricing) label`, 120, true);
        if (!Array.isArray(b.rows)) {
          c.add(`Block ${n} (pricing): rows must be a list.`);
          break;
        }
        const rows: { k: string; v: string; included?: boolean }[] = [];
        (b.rows as unknown[]).slice(0, MAX.pricingRows).forEach((row, r) => {
          if (typeof row !== "object" || row === null) return;
          const rRow = row as Record<string, unknown>;
          const k = cleanString(c, rRow.k, `Block ${n} (pricing) row ${r + 1} label`, 120, true);
          const v = cleanString(c, rRow.v, `Block ${n} (pricing) row ${r + 1} value`, 120, true);
          if (k !== undefined && v !== undefined) {
            rows.push({ k, v, included: rRow.included === true ? true : undefined });
          }
        });
        if (big !== undefined && label !== undefined && rows.length > 0) {
          blocks.push({ type: "pricing", big, label, rows });
        }
        break;
      }
      case "faq": {
        if (!Array.isArray(b.items)) {
          c.add(`Block ${n} (FAQ): items must be a list.`);
          break;
        }
        const items: { q: string; a: string }[] = [];
        (b.items as unknown[]).slice(0, MAX.faqItems).forEach((item, i) => {
          if (typeof item !== "object" || item === null) return;
          const f = item as Record<string, unknown>;
          const q = cleanString(c, f.q, `Block ${n} (FAQ) question ${i + 1}`, 300, true);
          const a = cleanString(c, f.a, `Block ${n} (FAQ) answer ${i + 1}`, MAX.paragraph, true);
          if (q !== undefined && a !== undefined) items.push({ q, a });
        });
        if (items.length > 0) blocks.push({ type: "faq", items });
        break;
      }
      case "chips": {
        const items = cleanStringArray(c, b.items, `Block ${n} (chips) items`, MAX.chips, 120);
        if (items.length > 0) blocks.push({ type: "chips", items });
        break;
      }
      case "related": {
        if (!Array.isArray(b.items)) {
          c.add(`Block ${n} (related): items must be a list.`);
          break;
        }
        const items: { to: string; label: string; description: string }[] = [];
        (b.items as unknown[]).slice(0, MAX.related).forEach((item, i) => {
          if (typeof item !== "object" || item === null) return;
          const r = item as Record<string, unknown>;
          const to = cleanString(c, r.to, `Block ${n} (related) link ${i + 1} path`, 300, true);
          const label = cleanString(c, r.label, `Block ${n} (related) link ${i + 1} label`, 200, true);
          const description = cleanString(c, r.description, `Block ${n} (related) link ${i + 1} description`, 500, false);
          if (to !== undefined && label !== undefined) {
            items.push({ to, label, description: description ?? "" });
          }
        });
        if (items.length > 0) blocks.push({ type: "related", items });
        break;
      }
      default:
        c.add(`Block ${n}: unknown block type "${String((b as { type?: unknown }).type)}".`);
    }
  });
  if (blocks.length > MAX.blocks) {
    c.add(`Body has too many blocks (max ${MAX.blocks}).`);
    blocks.length = MAX.blocks;
  }
  return blocks;
}

function cleanOptionalIndex(value: unknown, maxIndex: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  if (value < 0 || value > maxIndex) return undefined;
  return value;
}

function cleanReadingMinutes(c: Collector, value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 600) {
    c.add("Reading time must be a whole number of minutes (1–600).");
    return undefined;
  }
  return n;
}

function assertPublishable(c: Collector, bodyCount: number, status: "DRAFT" | "PUBLISHED", label: string): void {
  if (status === "PUBLISHED" && bodyCount === 0) {
    c.add(`${label} needs at least one content block before it can be published.`);
  }
}

function throwIfErrors(c: Collector): void {
  if (c.errors.length > 0) {
    throw new BadRequestException(
      c.errors.length === 1 ? c.errors[0] : c.errors.slice(0, 6).join(" "),
    );
  }
}

// ── Public validators ──
export function validateBlogInput(
  raw: Record<string, unknown>,
  opts: { requireBody: boolean },
): BlogInput {
  const c = new Collector();
  const title = cleanString(c, raw.title, "Title", MAX.title, true);
  const slug = cleanSlug(c, raw.slug, title ?? "");
  const date = cleanDate(c, raw.date);
  const excerpt = cleanString(c, raw.excerpt, "Excerpt", MAX.excerpt, true);
  const body = cleanBlogBlocks(c, raw.body);
  const status = cleanStatus(c, raw.status);
  if (opts.requireBody) assertPublishable(c, body.length, status, "This post");
  throwIfErrors(c);
  return {
    slug,
    title: title!,
    date,
    excerpt: excerpt!,
    kicker: cleanOptionalString(c, raw.kicker, "Kicker", MAX.kicker),
    readingMinutes: cleanReadingMinutes(c, raw.readingMinutes),
    author: cleanOptionalString(c, raw.author, "Author", MAX.author),
    image: cleanOptionalString(c, raw.image, "Cover image", MAX.image),
    imageAlt: cleanOptionalString(c, raw.imageAlt, "Cover image alt text", MAX.alt),
    body,
    status,
  };
}

export function validateNewsInput(
  raw: Record<string, unknown>,
  opts: { requireBody: boolean },
): NewsInput {
  const c = new Collector();
  const title = cleanString(c, raw.title, "Title", MAX.title, true);
  const slug = cleanSlug(c, raw.slug, title ?? "");
  const date = cleanDate(c, raw.date);
  const tag = cleanString(c, raw.tag, "Category tag", MAX.tag, true);
  const excerpt = cleanString(c, raw.excerpt, "Excerpt", MAX.excerpt, true);
  const body = cleanStringArray(c, raw.body, "Paragraph", MAX.paragraphs, MAX.paragraph);
  const status = cleanStatus(c, raw.status);
  if (opts.requireBody) assertPublishable(c, body.length, status, "This announcement");
  throwIfErrors(c);
  return {
    slug,
    title: title!,
    date,
    tag: tag!,
    excerpt: excerpt!,
    image: cleanOptionalString(c, raw.image, "Cover image", MAX.image),
    imageAlt: cleanOptionalString(c, raw.imageAlt, "Cover image alt text", MAX.alt),
    body,
    status,
  };
}

export function validateJobInput(
  raw: Record<string, unknown>,
  opts: { requireBody: boolean },
): JobInput {
  const c = new Collector();
  const title = cleanString(c, raw.title, "Title", MAX.title, true);
  const slug = cleanSlug(c, raw.slug, title ?? "");
  const location = cleanString(c, raw.location, "Location", MAX.location, true);
  const type = cleanString(c, raw.type, "Job type label", MAX.typeLabel, true);
  const employmentTypeRaw = cleanString(c, raw.employmentType, "Employment type", 20, true);
  let employmentType: JobInput["employmentType"] = "FULL_TIME";
  if (employmentTypeRaw !== undefined) {
    if ((EMPLOYMENT_TYPES as readonly string[]).includes(employmentTypeRaw)) {
      employmentType = employmentTypeRaw as JobInput["employmentType"];
    } else {
      c.add("Employment type must be one of: FULL_TIME, PART_TIME, CONTRACTOR, INTERN, TEMPORARY.");
    }
  }
  const excerpt = cleanString(c, raw.excerpt, "Summary", MAX.excerpt, true);
  const body = cleanStringArray(c, raw.body, "Paragraph", MAX.paragraphs, MAX.paragraph);
  const applyEmail = cleanString(c, raw.applyEmail, "Apply email", MAX.email, true);
  if (applyEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyEmail)) {
    c.add("Apply email must be a valid email address.");
  }
  const status = cleanStatus(c, raw.status);
  if (opts.requireBody) assertPublishable(c, body.length, status, "This role");
  throwIfErrors(c);
  return {
    slug,
    title: title!,
    location: location!,
    type: type!,
    employmentType,
    excerpt: excerpt!,
    body,
    applyEmail: applyEmail!,
    status,
  };
}
