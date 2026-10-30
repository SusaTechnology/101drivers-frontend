import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleHelp,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  Briefcase,
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CmsBlockEditor } from "@/components/admin/cms/CmsBlockEditor";
import { CmsImageField } from "@/components/admin/cms/CmsImageField";
import { CmsLivePreview } from "@/components/admin/cms/CmsLivePreview";
import { RichField } from "@/components/admin/cms/RichField";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  CMS_API,
  slugifyTitle,
  useCmsAdminCreate,
  useCmsAdminDelete,
  useCmsAdminList,
  useCmsAdminUpdate,
  resolveCmsAssetUrl,
} from "@/lib/cms";
import type { CmsSection } from "@/lib/cms";
import type { BlogBlock } from "@/content/types";

/**
 * Admin CMS — blog / news / careers content, WordPress-style.
 *
 * Content lives in Postgres (backend/src/cms) and goes live the moment it is
 * published — no code changes, no rebuilds. This page is the single entry
 * point: section tabs → list (draft/published with actions) → a focused
 * editor per section (blog uses the structured block editor that mirrors the
 * public renderer; news and careers use a fast paragraphs field). Writing
 * happens against a LIVE split preview — the draft renders on the right
 * (draggable divider with a 320px floor) exactly as the public page will,
 * instead of hiding the preview behind a dialog. On desktop the editor view
 * is a fixed-height frame: the two panes scroll INDEPENDENTLY while the
 * action bar and the preview header never move. The public web address is
 * generated from the title (kept unique automatically) — there is no slug
 * field for the admin to think about.
 *
 * Hard rules honored here: all hooks run unconditionally at the top of the
 * component (the Task 129 lesson), every mutation invalidates both the admin
 * and the public query keys so the site reflects changes immediately, and
 * save/publish/delete buttons disable while their mutation is in flight.
 */

type Status = "DRAFT" | "PUBLISHED";

interface DraftBase {
  id?: string;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  status: Status;
  publishedAt?: string | null;
}

interface BlogDraft extends DraftBase {
  section: "blog";
  date: string;
  kicker: string;
  author: string;
  readingMinutes: string;
  image: string | null;
  imageAlt: string;
  body: BlogBlock[];
}

interface NewsDraft extends DraftBase {
  section: "news";
  date: string;
  tag: string;
  image: string | null;
  imageAlt: string;
  bodyText: string;
}

interface CareerDraft extends DraftBase {
  section: "careers";
  location: string;
  type: string;
  employmentType: string;
  applyEmail: string;
  bodyText: string;
}

type Draft = BlogDraft | NewsDraft | CareerDraft;

const today = () => new Date().toISOString().slice(0, 10);

const SECTIONS: { key: CmsSection; label: string; icon: typeof FileText; newLabel: string }[] = [
  { key: "blog", label: "Blog", icon: FileText, newLabel: "New post" },
  { key: "news", label: "News", icon: Newspaper, newLabel: "New announcement" },
  { key: "careers", label: "Careers", icon: Briefcase, newLabel: "New role" },
];

// paragraphs textarea ⇄ string[]
const splitParagraphs = (text: string): string[] =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
const joinParagraphs = (items: string[]): string => items.join("\n\n");

/** Append -2, -3, … until the slug is free of everything in `taken`. */
function ensureUniqueSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function newDraft(section: CmsSection): Draft {
  if (section === "blog") {
    return { section: "blog", title: "", slug: "", slugTouched: false, date: today(), excerpt: "", kicker: "", author: "", readingMinutes: "", image: null, imageAlt: "", body: [], status: "DRAFT" };
  }
  if (section === "news") {
    return { section: "news", title: "", slug: "", slugTouched: false, date: today(), tag: "", excerpt: "", image: null, imageAlt: "", bodyText: "", status: "DRAFT" };
  }
  return { section: "careers", title: "", slug: "", slugTouched: false, location: "", type: "Full-time", employmentType: "FULL_TIME", excerpt: "", applyEmail: "info@101drivers.com", bodyText: "", status: "DRAFT" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function draftFromRow(section: CmsSection, row: any): Draft {
  const base = {
    id: row.id,
    title: row.title ?? "",
    slug: row.slug ?? "",
    slugTouched: true,
    excerpt: row.excerpt ?? "",
    status: (row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT") as Status,
    publishedAt: row.publishedAt ?? null,
  };
  if (section === "blog") {
    return { ...base, section: "blog", date: row.date ?? today(), kicker: row.kicker ?? "", author: row.author ?? "", readingMinutes: row.readingMinutes ? String(row.readingMinutes) : "", image: row.image ?? null, imageAlt: row.imageAlt ?? "", body: Array.isArray(row.body) ? row.body : [] };
  }
  if (section === "news") {
    return { ...base, section: "news", date: row.date ?? today(), tag: row.tag ?? "", image: row.image ?? null, imageAlt: row.imageAlt ?? "", bodyText: joinParagraphs(Array.isArray(row.body) ? row.body : []) };
  }
  return { ...base, section: "careers", location: row.location ?? "", type: row.type ?? "", employmentType: row.employmentType ?? "FULL_TIME", applyEmail: row.applyEmail ?? "info@101drivers.com", bodyText: joinParagraphs(Array.isArray(row.body) ? row.body : []) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function payloadOf(draft: Draft, statusOverride?: Status): any {
  const status = statusOverride ?? draft.status;
  const base = {
    title: draft.title.trim(),
    slug: (draft.slug || slugifyTitle(draft.title)).trim(),
    excerpt: draft.excerpt.trim(),
    status,
  };
  if (draft.section === "blog") {
    return {
      ...base,
      date: draft.date,
      // Clearable optionals MUST send explicit null when emptied — undefined
      // would be dropped by JSON.stringify and the backend would keep the
      // stored value (the "deleted image still shows on the public page" bug).
      kicker: draft.kicker.trim() || null,
      readingMinutes: draft.readingMinutes ? Number(draft.readingMinutes) : null,
      author: draft.author.trim() || null,
      image: draft.image || null,
      imageAlt: draft.imageAlt.trim() || null,
      body: draft.body,
    };
  }
  if (draft.section === "news") {
    return {
      ...base,
      date: draft.date,
      tag: draft.tag.trim(),
      image: draft.image || null,
      imageAlt: draft.imageAlt.trim() || null,
      body: splitParagraphs(draft.bodyText),
    };
  }
  return {
    ...base,
    location: draft.location.trim(),
    type: draft.type.trim(),
    employmentType: draft.employmentType,
    applyEmail: draft.applyEmail.trim(),
    body: splitParagraphs(draft.bodyText),
  };
}

function clientValidate(draft: Draft, forPublish: boolean): string | null {
  if (!draft.title.trim()) return "A title is required.";
  if (draft.section !== "careers" && !draft.excerpt.trim()) return "A short summary is required.";
  if (draft.section === "careers" && !draft.excerpt.trim()) return "A role summary is required.";
  if (forPublish) {
    const bodyEmpty =
      draft.section === "blog" ? draft.body.length === 0 : splitParagraphs(draft.bodyText).length === 0;
    if (bodyEmpty) return "Add some content before publishing.";
    if (draft.section === "news" && !draft.tag.trim()) return "Pick a category tag before publishing.";
    if (draft.section === "careers" && (!draft.location.trim() || !draft.applyEmail.trim())) {
      return "Location and apply email are required before publishing.";
    }
  }
  return null;
}

export default function AdminCmsPage() {

  const [section, setSection] = useState<CmsSection>("blog");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [snapshot, setSnapshot] = useState<string>("");
  const [previewVisible, setPreviewVisible] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  // Split view (editor left / live preview right) only from lg up — smaller
  // screens stack the preview below the editor. The hook reads the match
  // during render, so desktop gets the split on first paint (no flash).
  const isSplit = useMediaQuery("(min-width: 1024px)");

  // All hooks run unconditionally (Task 129 lesson) — one list + 3×3
  // mutations per section, regardless of which section is active.
  const blogList = useCmsAdminList(section);
  const createBlog = useCmsAdminCreate("blog");
  const updateBlog = useCmsAdminUpdate("blog");
  const deleteBlog = useCmsAdminDelete("blog");
  const createNews = useCmsAdminCreate("news");
  const updateNews = useCmsAdminUpdate("news");
  const deleteNews = useCmsAdminDelete("news");
  const createCareer = useCmsAdminCreate("careers");
  const updateCareer = useCmsAdminUpdate("careers");
  const deleteCareer = useCmsAdminDelete("careers");

  const createFor = (s: CmsSection) =>
    s === "blog" ? createBlog : s === "news" ? createNews : createCareer;
  const updateFor = (s: CmsSection) =>
    s === "blog" ? updateBlog : s === "news" ? updateNews : updateCareer;
  const deleteFor = (s: CmsSection) =>
    s === "blog" ? deleteBlog : s === "news" ? deleteNews : deleteCareer;

  const dirty = draft !== null && JSON.stringify(draft) !== snapshot;

  // Slugs already used in this section (minus the item being edited) — the
  // auto-generated web address is de-duplicated against these so the backend
  // never rejects a save with its "slug taken" conflict.
  const takenSlugs = useMemo(
    () => blogList.rows.filter((r) => r.id !== draft?.id).map((r) => r.slug),
    [blogList.rows, draft?.id],
  );

  // Guard against losing unsaved edits on tab close / refresh.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const openEditor = (row?: Record<string, unknown>) => {
    if (row) {
      const d = draftFromRow(section, row);
      setDraft(d);
      setSnapshot(JSON.stringify(d));
    } else {
      const d = newDraft(section);
      setDraft(d);
      setSnapshot(JSON.stringify(d));
    }
  };

  const closeEditor = () => {
    setDraft(null);
    setSnapshot("");
  };

  const handleSave = (statusOverride?: Status) => {
    if (!draft) return;
    const forPublish = statusOverride === "PUBLISHED";
    const problem = clientValidate(draft, forPublish);
    if (problem) {
      toast.error(problem);
      return;
    }
    const payload = payloadOf(draft, statusOverride);
    // New items get a guaranteed-unique web address generated from the title
    // (the exact value shown as "Web address" in the editor).
    if (!draft.id) payload.slug = ensureUniqueSlug(payload.slug, takenSlugs);
    const mutation = draft.id
      ? updateFor(section)
      : createFor(section);
    const variables = draft.id
      ? { pathParams: { id: draft.id }, ...payload }
      : payload;

    const applySaved = (saved: { id?: string; publishedAt?: string | null }, slug: string) => {
      const next = { ...draft, status: payload.status, slug } as Draft;
      if (!draft.id && saved.id) next.id = saved.id;
      if (saved.publishedAt) next.publishedAt = saved.publishedAt;
      setDraft(next);
      setSnapshot(JSON.stringify(next));
      toast.success(
        payload.status === "PUBLISHED"
          ? section === "blog"
            ? "Published — it's live on the blog"
            : section === "news"
              ? "Published — it's live on the news page"
              : "Published — it's live on the careers page"
          : "Draft saved",
      );
    };

    mutation.mutate(variables, {
      onSuccess: (row) =>
        applySaved(row as { id?: string; publishedAt?: string | null }, payload.slug),
      onError: (error: Error) => {
        // Rare: the in-memory list was stale and the backend still found the
        // generated address taken. Retry ONCE with a freshly-unique slug.
        const conflict = !draft.id && error.message.match(/slug "([^"]+)" is already taken/);
        if (conflict) {
          const retrySlug = ensureUniqueSlug(payload.slug, [...takenSlugs, conflict[1]]);
          mutation.mutate(
            { ...payload, slug: retrySlug },
            {
              onSuccess: (row) =>
                applySaved(row as { id?: string; publishedAt?: string | null }, retrySlug),
              onError: (retryError: Error) =>
                toast.error(retryError.message || "Saving failed — please try again."),
            },
          );
          return;
        }
        toast.error(error.message || "Saving failed — please try again.");
      },
    });
  };

  const handleUnpublish = () => {
    if (!draft?.id) return;
    updateFor(section).mutate(
      { pathParams: { id: draft.id }, status: "DRAFT" },
      {
        onSuccess: () => {
          const next = { ...draft, status: "DRAFT" as Status };
          setDraft(next);
          setSnapshot(JSON.stringify(next));
          toast.success("Unpublished — hidden from the site (kept as a draft)");
        },
        onError: (error: Error) => toast.error(error.message || "Unpublish failed."),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteFor(section).mutate(
      { pathParams: { id: deleteTarget.id } },
      {
        onSuccess: () => {
          toast.success("Deleted");
          setDeleteTarget(null);
          if (draft?.id === deleteTarget.id) closeEditor();
        },
        onError: (error: Error) => toast.error(error.message || "Delete failed."),
      },
    );
  };

  const activeMeta = SECTIONS.find((s) => s.key === section)!;
  const saving =
    createBlog.isPending || updateBlog.isPending || createNews.isPending ||
    updateNews.isPending || createCareer.isPending || updateCareer.isPending;

  // ── Editor view ──
  if (draft) {
    // One preview body for both layouts — the draft rendered with the SAME
    // inline formatter and block styling as the public pages (cover image
    // included), live-updating on every keystroke.
    const previewBody =
      draft.section === "blog" ? (
        <CmsLivePreview
          title={draft.title}
          excerpt={draft.excerpt}
          imageUrl={resolveCmsAssetUrl(draft.image)}
          imageAlt={draft.imageAlt}
          blocks={draft.body}
          emptyHint="Nothing to preview yet — add your first block."
        />
      ) : draft.section === "news" ? (
        <CmsLivePreview
          title={draft.title}
          metaLine={[draft.tag, draft.date].filter(Boolean).join(" · ")}
          imageUrl={resolveCmsAssetUrl(draft.image)}
          imageAlt={draft.imageAlt}
          paragraphs={splitParagraphs(draft.bodyText)}
        />
      ) : (
        <CmsLivePreview
          title={draft.title}
          metaLine={[draft.type, draft.location].filter(Boolean).join(" · ")}
          paragraphs={splitParagraphs(draft.bodyText)}
          emptyHint="Nothing to preview yet — write the job description first."
        />
      );

    const editorBody = (
      <>
        {draft.section === "blog" && (
          <BlogEditor draft={draft} onChange={setDraft} takenSlugs={takenSlugs} />
        )}
        {draft.section === "news" && (
          <NewsEditor draft={draft} onChange={setDraft} takenSlugs={takenSlugs} />
        )}
        {draft.section === "careers" && (
          <CareerEditor draft={draft} onChange={setDraft} takenSlugs={takenSlugs} />
        )}

        {/* Hint */}
        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          Drafts are private until you publish. Publishing puts the content live on the public site
          immediately — no rebuild needed. Unpublishing keeps a copy as a draft.
        </p>
      </>
    );

    return (
      <div className="min-h-screen lg:h-[100dvh] lg:overflow-hidden flex flex-col bg-background-light dark:bg-background-dark">

        {/* Action bar — fixed in view at all times: on small screens it sticks
            under the navbar while the page scrolls; on the desktop split it is
            the frame's first row and both panes scroll BENEATH it (the window
            itself never scrolls). */}
        <div className="sticky top-16 lg:top-20 z-30 shrink-0 px-4 sm:px-6 py-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={closeEditor} className="text-xs">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <StatusPill status={draft.status} />
            {dirty && <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Unsaved changes</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setPreviewVisible((v) => !v)}
            >
              {previewVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {previewVisible ? "Hide preview" : "Preview"}
            </Button>
              {draft.status === "PUBLISHED" && (
                <Button type="button" variant="outline" size="sm" className="text-xs" disabled={saving} onClick={handleUnpublish}>
                  <Undo2 className="h-3.5 w-3.5" /> Unpublish
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="text-xs" disabled={saving} onClick={() => handleSave("DRAFT")}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save draft
              </Button>
              {draft.status !== "PUBLISHED" && (
                <Button type="button" size="sm" className="text-xs bg-lime-600 hover:bg-lime-700 text-white" disabled={saving} onClick={() => handleSave("PUBLISHED")}>
                  <Send className="h-3.5 w-3.5" /> Publish
                </Button>
              )}
              {draft.id && (
                <Button type="button" variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-700" onClick={() => setDeleteTarget({ id: draft.id!, title: draft.title })}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          </div>

          {isSplit ? (
            // ── Desktop: editor left, LIVE preview right, draggable divider.
            // The preview floors at 320px and caps at 62% so the editor never
            // gets squeezed out; the divider is also keyboard-resizable
            // (focus it, then use the arrow keys).
            <div className="flex-1 min-h-0">
              <ResizablePanelGroup orientation="horizontal" className="h-full">
                <ResizablePanel id="editor" defaultSize="58%" minSize="38%" className="h-full">
                  <div className="h-full overflow-y-auto">
                    <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 pb-16">{editorBody}</main>
                  </div>
                </ResizablePanel>
                {previewVisible && (
                  <>
                    <ResizableHandle
                      withHandle
                      className="w-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-lime-300 dark:hover:bg-lime-500/40 transition-colors"
                    />
                    <ResizablePanel id="preview" defaultSize="42%" minSize="320px" maxSize="62%" className="h-full">
                      <LivePreviewPane onHide={() => setPreviewVisible(false)}>{previewBody}</LivePreviewPane>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </div>
          ) : (
            // ── Small screens: editor on top, live preview stacked below.
            <div className="flex-1">
              <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 pb-10">{editorBody}</main>
              {previewVisible && (
                <section className="border-t border-slate-200 dark:border-slate-800">
                  <LivePreviewPane stacked onHide={() => setPreviewVisible(false)}>
                    {previewBody}
                  </LivePreviewPane>
                </section>
              )}
            </div>
          )}

        <DeleteDialog
          open={deleteTarget !== null}
          title={deleteTarget?.title ?? ""}
          pending={deleteFor(section).isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <main className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Content</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Write blog posts, announcements and job openings — publish straight to the site.
            </p>
          </div>
          <Button type="button" size="sm" className="text-xs bg-lime-600 hover:bg-lime-700 text-white" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" /> {activeMeta.newLabel}
          </Button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 w-fit">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                section === key
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {blogList.isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : blogList.isError ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
            Couldn't load {activeMeta.label.toLowerCase()} content — check your connection and refresh.
          </div>
        ) : blogList.rows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
            <activeMeta.icon className="h-8 w-8 mx-auto text-slate-400 mb-2" />
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-1">
              Nothing here yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {section === "blog"
                ? "Write your first blog post — it goes live the moment you publish."
                : section === "news"
                  ? "Share your first announcement with customers and drivers."
                  : "Post your first open role."}
            </p>
            <Button type="button" size="sm" className="text-xs bg-lime-600 hover:bg-lime-700 text-white" onClick={() => openEditor()}>
              <Plus className="h-4 w-4" /> {activeMeta.newLabel}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {blogList.rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
              >
                {/* Thumb */}
                <div className="h-12 w-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                  {resolveCmsAssetUrl(row.image) ? (
                    <img src={resolveCmsAssetUrl(row.image)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <activeMeta.icon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                {/* Title */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{row.title || "(untitled)"}</p>
                  <p className="text-xs text-slate-400 truncate">/{section}/{row.slug}</p>
                </div>
                {/* Meta */}
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <StatusPill status={row.status} />
                  <span className="text-[10px] text-slate-400">
                    {row.status === "PUBLISHED" && row.date
                      ? `Published ${row.date}`
                      : `Edited ${new Date(row.updatedAt).toLocaleDateString()}`}
                  </span>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditor(row)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {row.status === "PUBLISHED" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-500"
                      disabled={updateFor(section).isPending}
                      onClick={() =>
                        updateFor(section).mutate(
                          { pathParams: { id: row.id }, status: "DRAFT" },
                          { onSuccess: () => toast.success("Unpublished — hidden from the site") },
                        )
                      }
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Unpublish
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-lime-700 dark:text-lime-400"
                      disabled={updateFor(section).isPending}
                      onClick={() => {
                        const problem = clientValidate(draftFromRow(section, row), true);
                        if (problem) {
                          // Item can't publish as-is → open the editor instead of failing silently.
                          toast.info(`${problem} — finishing it in the editor.`);
                          openEditor(row);
                          return;
                        }
                        updateFor(section).mutate(
                          { pathParams: { id: row.id }, status: "PUBLISHED" },
                          { onSuccess: () => toast.success("Published — it's live") },
                        );
                      }}
                    >
                      <Send className="h-3.5 w-3.5" /> Publish
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    onClick={() => setDeleteTarget({ id: row.id, title: row.title })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <DeleteDialog
        open={deleteTarget !== null}
        title={deleteTarget?.title ?? ""}
        pending={deleteFor(section).isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ── Shared pieces ──
function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
        status === "PUBLISHED"
          ? "bg-lime-500/15 text-lime-700 dark:text-lime-400"
          : "bg-slate-200/70 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
      }`}
    >
      {status === "PUBLISHED" ? "Published" : "Draft"}
    </span>
  );
}

function DeleteDialog({
  open,
  title,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes it from the site. If you only want it hidden, unpublish it instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {children}
      </Label>
      {hint && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="What is this field for?"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] font-medium normal-case tracking-normal">
              {hint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ── Web address (auto slug) ──
// Replaces the old editable URL-slug input: non-technical users should never
// have to think about slugs. The address is generated from the title and
// de-duplicated against the other items in the section (ensureUniqueSlug at
// save time + live here), so the backend's unique-slug rule never bites.
function LinkAddress({
  section,
  title,
  draftId,
  storedSlug,
  takenSlugs,
}: {
  section: CmsSection;
  title: string;
  draftId?: string;
  storedSlug: string;
  takenSlugs: string[];
}) {
  const slug = draftId ? storedSlug : ensureUniqueSlug(slugifyTitle(title), takenSlugs);
  return (
    <div className="space-y-1.5">
      <FieldLabel>Web address (automatic)</FieldLabel>
      {title.trim() ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-mono text-slate-600 dark:text-slate-300 break-all">
          101drivers.com/{section}/{slug}
        </div>
      ) : (
        <p className="text-xs italic text-slate-400 dark:text-slate-500">
          Created automatically from the title — nothing to type here.
        </p>
      )}
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        {draftId
          ? "This link is already live — it stays the same even if you edit the title."
          : "Built from the title and kept unique automatically."}
      </p>
    </div>
  );
}

// ── Live preview pane ──
// Flex column: the slim header (pulsing "live" dot + Hide) is a structural
// row that NEVER scrolls — only the content below it scrolls, independently
// of the editor pane. In the desktop split it fills the right panel (h-full);
// on small screens it stacks below the editor as a self-contained 70vh frame
// so its header stays fixed there too.
function LivePreviewPane({
  children,
  onHide,
  stacked = false,
}: {
  children: ReactNode;
  onHide: () => void;
  stacked?: boolean;
}) {
  return (
    <div
      className={
        stacked
          ? "h-[70vh] min-h-[320px] flex flex-col bg-slate-100/70 dark:bg-slate-950/70"
          : "h-full flex flex-col bg-slate-100/70 dark:bg-slate-950/70"
      }
    >
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-6 py-2 bg-slate-100/95 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800">
        <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500" />
          </span>
          Live preview — updates as you type
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onHide}>
          <EyeOff className="h-3.5 w-3.5" /> Hide
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-6 pb-16">{children}</div>
      </div>
    </div>
  );
}

// ── Blog editor ──
function BlogEditor({
  draft,
  onChange,
  takenSlugs,
}: {
  draft: BlogDraft;
  onChange: (draft: BlogDraft) => void;
  takenSlugs: string[];
}) {
  const set = (patch: Partial<BlogDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="space-y-1.5">
          <FieldLabel>Title</FieldLabel>
          <Input
            value={draft.title}
            onChange={(e) =>
              set({
                title: e.target.value,
                slug: draft.slugTouched ? draft.slug : slugifyTitle(e.target.value),
              })
            }
            placeholder="e.g. How our flat-rate pricing works"
            className="text-lg font-bold h-11"
          />
        </div>
        <LinkAddress
          section="blog"
          title={draft.title}
          draftId={draft.id}
          storedSlug={draft.slug}
          takenSlugs={takenSlugs}
        />
        <div className="space-y-1.5">
          <FieldLabel>Summary — shown on cards and in search results</FieldLabel>
          <Textarea
            value={draft.excerpt}
            onChange={(e) => set({ excerpt: e.target.value })}
            placeholder="One or two sentences that make people want to read."
            rows={2}
            className="text-sm"
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <FieldLabel>Date</FieldLabel>
            <Input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel
              hint={'A short label shown above the headline — like a topic or audience tag, e.g. "For dealerships". Optional.'}
            >
              Kicker (optional)
            </FieldLabel>
            <Input value={draft.kicker} onChange={(e) => set({ kicker: e.target.value })} placeholder="For dealerships" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Author (optional)</FieldLabel>
            <Input value={draft.author} onChange={(e) => set({ author: e.target.value })} placeholder="101 Drivers Team" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel
              hint={'Shown on the post as a "6 min read" label. A rough estimate is fine — it is purely informational. Leave blank to hide it.'}
            >
              Read time, min (optional)
            </FieldLabel>
            <Input type="number" min={1} value={draft.readingMinutes} onChange={(e) => set({ readingMinutes: e.target.value })} placeholder="6" className="h-9 text-sm" />
          </div>
        </div>
        <CmsImageField
          label="Cover image"
          value={draft.image}
          alt={draft.imageAlt}
          onChange={({ url, alt }) => set({ image: url, imageAlt: alt ?? draft.imageAlt })}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <CmsBlockEditor blocks={draft.body} onChange={(body) => set({ body })} />
      </div>
    </div>
  );
}

// ── News editor ──
function NewsEditor({
  draft,
  onChange,
  takenSlugs,
}: {
  draft: NewsDraft;
  onChange: (draft: NewsDraft) => void;
  takenSlugs: string[];
}) {
  const set = (patch: Partial<NewsDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="space-y-1.5">
          <FieldLabel>Headline</FieldLabel>
          <Input
            value={draft.title}
            onChange={(e) =>
              set({
                title: e.target.value,
                slug: draft.slugTouched ? draft.slug : slugifyTitle(e.target.value),
              })
            }
            placeholder="e.g. Same-day delivery is now live in Los Angeles"
            className="text-lg font-bold h-11"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <FieldLabel>Date</FieldLabel>
            <Input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Category tag</FieldLabel>
            <Input value={draft.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="Product, Service Update, Company" className="h-9 text-sm" />
          </div>
        </div>
        <LinkAddress
          section="news"
          title={draft.title}
          draftId={draft.id}
          storedSlug={draft.slug}
          takenSlugs={takenSlugs}
        />
        <div className="space-y-1.5">
          <FieldLabel>Summary — shown on cards</FieldLabel>
          <Textarea value={draft.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={2} className="text-sm" placeholder="One sentence summarizing the announcement." />
        </div>
        <CmsImageField
          label="Cover image (optional)"
          value={draft.image}
          alt={draft.imageAlt}
          onChange={({ url, alt }) => set({ image: url, imageAlt: alt ?? draft.imageAlt })}
        />
        <div className="space-y-1.5">
          <FieldLabel>Announcement text</FieldLabel>
          <RichField
            value={draft.bodyText}
            onChange={(bodyText) => set({ bodyText })}
            multiline
            rows={10}
            placeholder={"Write the announcement. Separate paragraphs with a blank line."}
          />
          <p className="text-[10px] text-slate-400">
            Each blank line starts a new paragraph — just like writing an email. Use the toolbar for bold, italic and links.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Careers editor ──
function CareerEditor({
  draft,
  onChange,
  takenSlugs,
}: {
  draft: CareerDraft;
  onChange: (draft: CareerDraft) => void;
  takenSlugs: string[];
}) {
  const set = (patch: Partial<CareerDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="space-y-1.5">
          <FieldLabel>Role title</FieldLabel>
          <Input
            value={draft.title}
            onChange={(e) =>
              set({
                title: e.target.value,
                slug: draft.slugTouched ? draft.slug : slugifyTitle(e.target.value),
              })
            }
            placeholder="e.g. Delivery Driver (Independent Contractor)"
            className="text-lg font-bold h-11"
          />
        </div>
        <LinkAddress
          section="careers"
          title={draft.title}
          draftId={draft.id}
          storedSlug={draft.slug}
          takenSlugs={takenSlugs}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <FieldLabel>Location</FieldLabel>
            <Input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="Greater Los Angeles, CA" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Badge label</FieldLabel>
            <Input value={draft.type} onChange={(e) => set({ type: e.target.value })} placeholder="Full-time" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Employment type</FieldLabel>
            <Select value={draft.employmentType} onValueChange={(v) => set({ employmentType: v })}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Full-time</SelectItem>
                <SelectItem value="PART_TIME">Part-time</SelectItem>
                <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                <SelectItem value="INTERN">Intern</SelectItem>
                <SelectItem value="TEMPORARY">Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Apply email</FieldLabel>
            <Input type="email" value={draft.applyEmail} onChange={(e) => set({ applyEmail: e.target.value })} className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Summary — shown on the role card</FieldLabel>
          <Textarea value={draft.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={2} className="text-sm" placeholder="One sentence that sells the role." />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Job description</FieldLabel>
          <RichField
            value={draft.bodyText}
            onChange={(bodyText) => set({ bodyText })}
            multiline
            rows={12}
            placeholder={"The full posting. Separate paragraphs with a blank line."}
          />
          <p className="text-[10px] text-slate-400">Each blank line starts a new paragraph. Use the toolbar for bold, italic and links.</p>
        </div>
      </div>
    </div>
  );
}
