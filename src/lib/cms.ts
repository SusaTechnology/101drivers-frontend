import {
  useDataMutation,
  useDataQuery,
  useFileUpload,
} from "@/lib/tanstack/dataQuery";
import type { QueryKey } from "@tanstack/react-query";

import { BLOG_POSTS, getBlogPost } from "@/content/blog";
import { NEWS_POSTS, getNewsPost } from "@/content/news";
import { OPEN_ROLES, getJobPosting } from "@/content/careers";
import type { BlogPost, JobPosting, NewsPost } from "@/content/types";

/**
 * CMS data layer — blog / news / careers content lives in Postgres (edited
 * from /admin-cms) and is served by /api/cms/*.
 *
 * Fallback contract ( resilience ):
 *  - Lists: the DB payload wins once the API has ANSWERED (even if empty —
 *    the owner may legitimately unpublish everything); the static registry in
 *    the bundle covers the loading window AND network failures, so the public
 *    site never flashes empty and keeps working if the API is down.
 *  - Detail: same, except a 404 from the API is authoritative (the item was
 *    deleted/unpublished) — the static twin is NOT resurrected in that case.
 */

const API_BASE = import.meta.env.VITE_API_URL;
export const CMS_API = `${API_BASE}/api/cms`;

// ── Public hooks ────────────────────────────────────────────────────────────

function cmsQueryOptions(staleMs = 60_000) {
  return {
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    noFilter: true,
    staleTime: staleMs,
  } as const;
}

function errorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | null)?.status;
}

export interface CmsListResult<T> {
  /** DB content when the API answered; the static registry otherwise. */
  items: T[];
  isFromDb: boolean;
  isLoading: boolean;
}

export function useCmsBlogList(): CmsListResult<BlogPost> {
  const query = useDataQuery<{ posts: BlogPost[] }>({
    apiEndPoint: `${CMS_API}/blog`,
    queryKey: ["cms", "public", "blog"],
    ...cmsQueryOptions(),
  });
  return {
    items: query.data ? query.data.posts : BLOG_POSTS,
    isFromDb: !!query.data,
    isLoading: query.isPending,
  };
}

export function useCmsNewsList(): CmsListResult<NewsPost> {
  const query = useDataQuery<{ posts: NewsPost[] }>({
    apiEndPoint: `${CMS_API}/news`,
    queryKey: ["cms", "public", "news"],
    ...cmsQueryOptions(),
  });
  return {
    items: query.data ? query.data.posts : NEWS_POSTS,
    isFromDb: !!query.data,
    isLoading: query.isPending,
  };
}

export function useCmsCareersList(): CmsListResult<JobPosting> {
  const query = useDataQuery<{ roles: JobPosting[] }>({
    apiEndPoint: `${CMS_API}/careers`,
    queryKey: ["cms", "public", "careers"],
    ...cmsQueryOptions(),
  });
  return {
    items: query.data ? query.data.roles : OPEN_ROLES,
    isFromDb: !!query.data,
    isLoading: query.isPending,
  };
}

// ── Public detail hooks ─────────────────────────────────────────────────────

export interface CmsDetailResult<T> {
  post: T | undefined;
  /** True when loading finished and nothing could be found anywhere. */
  notFound: boolean;
  isLoading: boolean;
}

export function useCmsBlogPost(slug: string): CmsDetailResult<BlogPost> {
  const query = useDataQuery<BlogPost>({
    apiEndPoint: `${CMS_API}/blog/${slug}`,
    queryKey: ["cms", "public", "blog", slug],
    ...cmsQueryOptions(),
  });
  const staticPost = getBlogPost(slug);
  // 404 from the API is authoritative; any other failure (or the loading
  // window) falls back to the bundled registry.
  const post = query.data ?? (errorStatus(query.error) === 404 ? undefined : staticPost);
  const settled = query.isSuccess || query.isError;
  return { post, notFound: settled && !post, isLoading: !settled && !staticPost };
}

export function useCmsNewsPost(slug: string): CmsDetailResult<NewsPost> {
  const query = useDataQuery<NewsPost>({
    apiEndPoint: `${CMS_API}/news/${slug}`,
    queryKey: ["cms", "public", "news", slug],
    ...cmsQueryOptions(),
  });
  const staticPost = getNewsPost(slug);
  const post = query.data ?? (errorStatus(query.error) === 404 ? undefined : staticPost);
  const settled = query.isSuccess || query.isError;
  return { post, notFound: settled && !post, isLoading: !settled && !staticPost };
}

export function useCmsJobPosting(slug: string): CmsDetailResult<JobPosting> {
  const query = useDataQuery<JobPosting>({
    apiEndPoint: `${CMS_API}/careers/${slug}`,
    queryKey: ["cms", "public", "careers", slug],
    ...cmsQueryOptions(),
  });
  const staticPost = getJobPosting(slug);
  const post = query.data ?? (errorStatus(query.error) === 404 ? undefined : staticPost);
  const settled = query.isSuccess || query.isError;
  return { post, notFound: settled && !post, isLoading: !settled && !staticPost };
}

// ── Admin hooks ─────────────────────────────────────────────────────────────

export type CmsSection = "blog" | "news" | "careers";

export function cmsSectionKeys(section: CmsSection): QueryKey[] {
  return [
    ["cms", "admin", section],
    ["cms", "public", section],
    // Detail pages key on ["cms","public",section,slug] — invalidate the whole
    // subtree so a published edit is visible immediately after saving.
    ["cms", "public", section],
  ];
}

export interface CmsAdminRow {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  date?: string;
  tag?: string;
  image?: string | null;
  excerpt?: string;
  updatedAt: string;
  publishedAt?: string | null;
  [key: string]: unknown;
}

function adminListEndpoint(section: CmsSection): string {
  return `${CMS_API}/admin/${section}`;
}

export function useCmsAdminList<T extends CmsAdminRow>(section: CmsSection) {
  const query = useDataQuery<{ posts?: T[]; roles?: T[] }>({
    apiEndPoint: adminListEndpoint(section),
    queryKey: ["cms", "admin", section],
    noFilter: true,
    staleTime: 30_000,
  });
  const rows = query.data ? (query.data.posts ?? query.data.roles ?? []) : [];
  return { rows, isLoading: query.isPending, isError: query.isError, refetch: query.refetch };
}

/** Create a new item in a section. Body must be a validated Cms payload. */
export function useCmsAdminCreate<TData = unknown>(section: CmsSection) {
  return useDataMutation<TData, Record<string, unknown>>({
    apiEndPoint: adminListEndpoint(section),
    method: "POST",
    onSuccessInvalidate: true,
    invalidateQueryKey: cmsSectionKeys(section),
  });
}

/** Partially update an item. Variables: { pathParams: { id }, ...patch }. */
export function useCmsAdminUpdate<TData = unknown>(section: CmsSection) {
  return useDataMutation<TData, Record<string, unknown>>({
    apiEndPoint: `${adminListEndpoint(section)}/:id`,
    method: "PATCH",
    onSuccessInvalidate: true,
    invalidateQueryKey: cmsSectionKeys(section),
  });
}

/** Delete an item. Variables: { pathParams: { id } }. */
export function useCmsAdminDelete(section: CmsSection) {
  return useDataMutation<{ success: boolean }, Record<string, unknown>>({
    apiEndPoint: `${adminListEndpoint(section)}/:id`,
    method: "DELETE",
    onSuccessInvalidate: true,
    invalidateQueryKey: cmsSectionKeys(section),
  });
}

/** Upload an image to the CMS media library. */
export function useCmsMediaUpload() {
  return useFileUpload<{
    id: string;
    filename: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
  }>(`${CMS_API}/admin/media`);
}

/**
 * Resolve a stored image URL to something an <img> can load:
 * uploaded media is served by the API origin, legacy paths (/assets/…)
 * by the PWA origin.
 */
export function resolveCmsAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/api/cms/media/")) return `${API_BASE}${url}`;
  return url;
}

/**
 * Absolute (SEO/og:image-safe) form of a stored image URL. Legacy /assets
 * paths live on the public site origin; uploads live on the API origin.
 */
export function resolveCmsAssetAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/api/cms/media/")) return `${API_BASE}${url}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://101drivers.com${url}`;
}

/** Auto-slug from a title, matching the backend's slugify. */
export function slugifyTitle(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      // eslint-disable-next-line no-misleading-character-class
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120)
      .replace(/-+$/g, "") || "post"
  );
}
