import { CheckCircle2, XCircle } from "lucide-react";

import { renderCmsInline } from "@/lib/cms-inline";
import type { BlogBlock } from "@/content/types";

/**
 * Live CMS preview — the body renderer shared by the admin CMS split view
 * (editor left, live preview right) and the stacked small-screen preview.
 *
 * It renders the draft with the SAME inline formatter (renderCmsInline) and
 * the same block styling as the public blog / news / careers pages, so what
 * the admin sees while typing is exactly what visitors will read — cover
 * image included. The per-block renderer was extracted verbatim from the
 * former CmsBlockPreviewDialog, so the live pane can never drift from what
 * the old dialog showed.
 */

export function CmsLivePreview({
  title,
  metaLine,
  excerpt,
  imageUrl,
  imageAlt,
  paragraphs,
  blocks,
  emptyHint = "Nothing to preview yet — the body is empty.",
}: {
  /** Post / announcement / role title. */
  title: string;
  /** e.g. "Product · 2026-10-14" (news) or "Full-time · Los Angeles" (careers). */
  metaLine?: string;
  /** Blog summary shown under the title. */
  excerpt?: string;
  /** Cover image, already resolved to an absolute URL (resolveCmsAssetUrl). */
  imageUrl?: string;
  imageAlt?: string;
  /** News + careers body: plain paragraphs. */
  paragraphs?: string[];
  /** Blog body: structured blocks. */
  blocks?: BlogBlock[];
  emptyHint?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight break-words">
        {title || "(untitled)"}
      </h1>
      {metaLine && (
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-lime-600 dark:text-lime-400">
          {metaLine}
        </p>
      )}
      {excerpt && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {renderCmsInline(excerpt)}
        </p>
      )}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={imageAlt || "Cover preview"}
          className="mt-4 aspect-video w-full rounded-xl object-cover"
        />
      )}

      <div className="mt-5 space-y-4">
        {blocks ? (
          blocks.length === 0 ? (
            <p className="text-sm text-slate-400">{emptyHint}</p>
          ) : (
            blocks.map((block, i) => <CmsPreviewBlock key={i} block={block} />)
          )
        ) : (paragraphs ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">{emptyHint}</p>
        ) : (
          (paragraphs ?? []).map((paragraph, i) => (
            <p
              key={i}
              className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
            >
              {renderCmsInline(paragraph)}
            </p>
          ))
        )}
      </div>
    </article>
  );
}

/** Mirrors the public blog renderer's styling AND formatting. */
function CmsPreviewBlock({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{renderCmsInline(block.text)}</p>;
    case "h2":
      return <h2 className="text-xl font-black text-slate-900 dark:text-white mt-6 mb-2">{renderCmsInline(block.text)}</h2>;
    case "h3":
      return <h3 className="text-base font-black text-slate-900 dark:text-white mt-4 mb-2">{renderCmsInline(block.text)}</h3>;
    case "ul":
      return (
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className={block.marker ? "flex items-start gap-2 list-none" : ""}>
              {block.marker === "check" && <CheckCircle2 className="w-4 h-4 text-lime-500 shrink-0 mt-0.5" />}
              {block.marker === "cross" && <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
              <span>{renderCmsInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
          {block.items.map((item, i) => (
            <li key={i}>{renderCmsInline(item)}</li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div className="bg-lime-50 dark:bg-lime-500/10 border-l-4 border-lime-500 p-4 rounded-r-lg">
          {block.label && <strong className="text-slate-900 dark:text-white">{block.label} </strong>}
          <span className="text-sm text-slate-700 dark:text-slate-300">{renderCmsInline(block.text)}</span>
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                {block.head.map((cell, i) => (
                  <th
                    key={i}
                    className={`p-2 text-left font-bold border-b-2 border-slate-200 dark:border-slate-700 ${
                      block.highlightCol === i ? "text-lime-600 dark:text-lime-400" : ""
                    }`}
                  >
                    {renderCmsInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className={block.highlightRow === r ? "bg-lime-50 dark:bg-lime-500/10" : ""}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={`p-2 border-b border-slate-200 dark:border-slate-800 ${
                        block.highlightCol === c ? "font-bold text-lime-700 dark:text-lime-400" : ""
                      }`}
                    >
                      {renderCmsInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.note && <p className="text-xs text-slate-400 mt-1">{renderCmsInline(block.note)}</p>}
        </div>
      );
    case "pricing":
      return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-center mb-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white">{block.big}</div>
            <p className="text-slate-500 text-xs">{block.label}</p>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1">
            {block.rows.map((row, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{renderCmsInline(row.k)}</span>
                <span className={`font-bold ${row.included ? "text-lime-600 dark:text-lime-400" : "text-slate-900 dark:text-white"}`}>
                  {renderCmsInline(row.v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          {block.items.map((faq, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <h3 className="font-bold text-sm mb-1">{renderCmsInline(faq.q)}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{renderCmsInline(faq.a)}</p>
            </div>
          ))}
        </div>
      );
    case "chips":
      return (
        <div className="flex flex-wrap gap-1.5">
          {block.items.map((chip) => (
            <span key={chip} className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded text-xs text-slate-700 dark:text-slate-300">
              {chip}
            </span>
          ))}
        </div>
      );
    case "related":
      return (
        <div className="grid grid-cols-2 gap-2">
          {block.items.map((item) => (
            <div key={item.label} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="text-lime-600 dark:text-lime-400 text-xs font-bold">{item.label}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      );
    default:
      // Live pane re-renders on every keystroke — never toast here; the
      // editor's own block cards keep unknown types out of the draft.
      console.warn("Unknown block type in CMS preview", block);
      return null;
  }
}
