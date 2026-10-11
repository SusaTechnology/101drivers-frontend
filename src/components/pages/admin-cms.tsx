import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
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

import { Navbar } from "../shared/layout/testNavbar";
import { navItems } from "@/lib/items/navItems";
import { Brand } from "@/lib/items/brand";
import { useAdminActions } from "@/hooks/useAdminActions";
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
import { CmsBlockEditor, CmsBlockPreviewDialog } from "@/components/admin/cms/CmsBlockEditor";
import { CmsImageField } from "@/components/admin/cms/CmsImageField";
import { RichField } from "@/components/admin/cms/RichField";
import { CmsTextPreviewDialog } from "@/components/admin/cms/CmsTextPreviewDialog";
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
 * public renderer; news and careers use a fast paragraphs field).
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
      kicker: draft.kicker.trim() || undefined,
      readingMinutes: draft.readingMinutes ? Number(draft.readingMinutes) : undefined,
      author: draft.author.trim() || undefined,
      image: draft.image || undefined,
      imageAlt: draft.imageAlt.trim() || undefined,
      body: draft.body,
    };
  }
  if (draft.section === "news") {
    return {
      ...base,
      date: draft.date,
      tag: draft.tag.trim(),
      image: draft.image || undefined,
      imageAlt: draft.imageAlt.trim() || undefined,
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
  const { actionItems, signOut } = useAdminActions();

  const [section, setSection] = useState<CmsSection>("blog");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [snapshot, setSnapshot] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

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
    const mutation = draft.id
      ? updateFor(section)
      : createFor(section);
    const variables = draft.id
      ? { pathParams: { id: draft.id }, ...payload }
      : payload;

    mutation.mutate(variables, {
      onSuccess: (row) => {
        const saved = row as { id?: string; publishedAt?: string | null };
        const next = { ...draft, status: payload.status } as Draft;
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
      },
      onError: (error: Error) => {
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
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />
        <main className="max-w-[900px] mx-auto px-6 py-6 pb-24">
          {/* Sticky action bar */}
          <div className="sticky top-16 lg:top-20 z-30 -mx-2 px-2 py-2 mb-4 bg-background-light dark:bg-background-dark border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={closeEditor} className="text-xs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <StatusPill status={draft.status} />
              {dirty && <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Unsaved changes</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-3.5 w-3.5" /> Preview
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

          {draft.section === "blog" && <BlogEditor draft={draft} onChange={setDraft} />}
          {draft.section === "news" && <NewsEditor draft={draft} onChange={setDraft} />}
          {draft.section === "careers" && <CareerEditor draft={draft} onChange={setDraft} />}

          {/* Hint */}
          <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Drafts are private until you publish. Publishing puts the content live on the public site
            immediately — no rebuild needed. Unpublishing keeps a copy as a draft.
          </p>
        </main>

        {draft.section === "blog" && (
          <CmsBlockPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            blocks={draft.body}
            title={draft.title}
            excerpt={draft.excerpt}
            imageUrl={resolveCmsAssetUrl(draft.image)}
          />
        )}
        {draft.section === "news" && (
          <CmsTextPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            title={draft.title}
            metaLine={[draft.tag, draft.date].filter(Boolean).join(" · ")}
            imageUrl={resolveCmsAssetUrl(draft.image)}
            paragraphs={splitParagraphs(draft.bodyText)}
          />
        )}
        {draft.section === "careers" && (
          <CmsTextPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            title={draft.title}
            metaLine={[draft.type, draft.location].filter(Boolean).join(" · ")}
            paragraphs={splitParagraphs(draft.bodyText)}
            emptyHint="Nothing to preview yet — write the job description first."
          />
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
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {children}
    </Label>
  );
}

// ── Blog editor ──
function BlogEditor({
  draft,
  onChange,
}: {
  draft: BlogDraft;
  onChange: (draft: BlogDraft) => void;
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
        <div className="space-y-1.5">
          <FieldLabel>URL slug — 101drivers.com/blog/…</FieldLabel>
          <Input
            value={draft.slug}
            onChange={(e) => set({ slug: slugifyTitle(e.target.value), slugTouched: true })}
            placeholder="how-flat-rate-pricing-works"
            className="h-9 font-mono text-xs"
          />
        </div>
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
            <FieldLabel>Kicker (optional)</FieldLabel>
            <Input value={draft.kicker} onChange={(e) => set({ kicker: e.target.value })} placeholder="For dealerships" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Author (optional)</FieldLabel>
            <Input value={draft.author} onChange={(e) => set({ author: e.target.value })} placeholder="101 Drivers Team" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Read time, min (optional)</FieldLabel>
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
}: {
  draft: NewsDraft;
  onChange: (draft: NewsDraft) => void;
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <FieldLabel>Date</FieldLabel>
            <Input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Category tag</FieldLabel>
            <Input value={draft.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="Product, Service Update, Company" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>URL slug — /news/…</FieldLabel>
            <Input value={draft.slug} onChange={(e) => set({ slug: slugifyTitle(e.target.value), slugTouched: true })} className="h-9 font-mono text-xs" />
          </div>
        </div>
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
}: {
  draft: CareerDraft;
  onChange: (draft: CareerDraft) => void;
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
