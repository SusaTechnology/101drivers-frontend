import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleHelp,
  Copy,
  DollarSign,
  Heading2,
  Heading3,
  Link2,
  List,
  ListOrdered,
  MessageSquareQuote,
  Plus,
  Table2,
  Tags,
  Trash2,
  XCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichField } from "@/components/admin/cms/RichField";
import {
  CmsTableField,
  PricingRowsField,
} from "@/components/admin/cms/CmsTableField";
import { renderCmsInline } from "@/lib/cms-inline";
import type { BlogBlock } from "@/content/types";

/**
 * Structured blog body editor.
 *
 * The public renderer consumes TYPED blocks (never raw HTML), so instead of
 * a free-form WYSIWYG this editor exposes one card per block — the same
 * authoring model as WordPress/Gutenberg and headless CMSes, which keeps
 * the published markup identical to the hand-written posts. Text fields use
 * RichField: a formatting toolbar (bold / italic / link, Ctrl/Cmd+B I K)
 * that writes the same inline markup the public renderCmsInline parses —
 * no syntax memorization. Tables and pricing rows are visual grids
 * (CmsTableField / PricingRowsField).
 *
 * The preview dialog re-renders the blocks with the SAME styling as the
 * public blog page so what the editor sees is what visitors get.
 */

// ── Block type registry ──
type BlockFactory = () => BlogBlock;

const BLOCK_TYPES: { type: BlogBlock["type"]; label: string; icon: typeof AlignLeft; make: BlockFactory }[] = [
  { type: "p", label: "Paragraph", icon: AlignLeft, make: () => ({ type: "p", text: "" }) },
  { type: "h2", label: "Section heading", icon: Heading2, make: () => ({ type: "h2", text: "" }) },
  { type: "h3", label: "Sub heading", icon: Heading3, make: () => ({ type: "h3", text: "" }) },
  { type: "ul", label: "Bulleted list", icon: List, make: () => ({ type: "ul", items: [""] }) },
  { type: "ol", label: "Numbered list", icon: ListOrdered, make: () => ({ type: "ol", items: [""] }) },
  { type: "callout", label: "Callout box", icon: MessageSquareQuote, make: () => ({ type: "callout", text: "" }) },
  { type: "table", label: "Table", icon: Table2, make: () => ({ type: "table", head: ["", ""], rows: [["", ""]] }) },
  { type: "pricing", label: "Pricing card", icon: DollarSign, make: () => ({ type: "pricing", big: "", label: "", rows: [{ k: "", v: "" }] }) },
  { type: "faq", label: "FAQ (also powers Google rich results)", icon: CircleHelp, make: () => ({ type: "faq", items: [{ q: "", a: "" }] }) },
  { type: "chips", label: "Chip grid", icon: Tags, make: () => ({ type: "chips", items: [] }) },
  { type: "related", label: "Related links", icon: Link2, make: () => ({ type: "related", items: [{ to: "", label: "", description: "" }] }) },
];

// ── line helpers (lists, table rows, pricing rows) ──
const splitLines = (text: string): string[] =>
  text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
const joinLines = (items: string[]): string => items.join("\n");

export function CmsBlockEditor({
  blocks,
  onChange,
}: {
  blocks: BlogBlock[];
  onChange: (blocks: BlogBlock[]) => void;
}) {
  const update = (index: number, block: BlogBlock) => {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  const duplicate = (index: number) => {
    const copy = JSON.parse(JSON.stringify(blocks[index])) as BlogBlock;
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const add = (block: BlogBlock) => onChange([...blocks, block]);

  const blockLabel = (block: BlogBlock): string =>
    BLOCK_TYPES.find((t) => t.type === block.type)?.label ?? block.type;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Article body ({blocks.length} {blocks.length === 1 ? "block" : "blocks"})
        </Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" className="h-8 text-xs bg-lime-600 hover:bg-lime-700 text-white">
              <Plus className="h-3.5 w-3.5" /> Add block
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {BLOCK_TYPES.map(({ type, label, icon: Icon, make }) => (
              <DropdownMenuItem key={type} onClick={() => add(make())}>
                <Icon className="h-4 w-4 mr-2 text-lime-600" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {blocks.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Start writing — add your first block. A paragraph is a good beginning.
        </div>
      )}

      {blocks.map((block, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          {/* Card header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {index + 1}. {blockLabel(block)}
            </span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === 0} onClick={() => move(index, -1)} title="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === blocks.length - 1} onClick={() => move(index, 1)} title="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => duplicate(index)} title="Duplicate">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={() => remove(index)} title="Remove block">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Card body — fields per block type */}
          <div className="p-3 space-y-2">
            <BlockFields block={block} onChange={(b) => update(index, b)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Per-type fields ──
function BlockFields({
  block,
  onChange,
}: {
  block: BlogBlock;
  onChange: (block: BlogBlock) => void;
}) {
  switch (block.type) {
    case "p":
      return (
        <RichField
          value={block.text}
          onChange={(text) => onChange({ type: "p", text })}
          multiline
          rows={4}
          placeholder="Write the paragraph… use the toolbar above for bold, italic and links."
        />
      );
    case "h2":
      return (
        <RichField
          value={block.text}
          onChange={(text) => onChange({ type: "h2", text })}
          placeholder="Section heading"
        />
      );
    case "h3":
      return (
        <RichField
          value={block.text}
          onChange={(text) => onChange({ type: "h3", text })}
          placeholder="Sub heading"
        />
      );
    case "ul":
    case "ol":
      return (
        <div className="space-y-2">
          <RichField
            value={joinLines(block.items)}
            onChange={(text) => onChange({ type: block.type, items: splitLines(text) })}
            multiline
            placeholder={"One list item per line"}
          />
          {block.type === "ul" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Marker</Label>
              <div className="flex gap-1">
                {([undefined, "check", "cross"] as const).map((marker) => (
                  <Button
                    key={marker ?? "plain"}
                    type="button"
                    size="sm"
                    variant={block.marker === marker ? "default" : "outline"}
                    className="h-7 text-[10px] px-2"
                    onClick={() => onChange({ type: "ul", items: block.items, marker })}
                  >
                    {marker === "check" ? "✓ pros" : marker === "cross" ? "✗ cons" : "plain dots"}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    case "callout":
      return (
        <div className="space-y-2">
          <TextField
            value={block.label ?? ""}
            onChange={(label) => onChange({ type: "callout", label: label || undefined, text: block.text })}
            placeholder="Optional label (e.g. TL;DR)"
          />
          <RichField
            value={block.text}
            onChange={(text) => onChange({ type: "callout", label: block.label, text })}
            multiline
            placeholder="The callout text…"
          />
        </div>
      );
    case "table":
      return (
        <CmsTableField
          value={block}
          onChange={(v) => onChange({ type: "table", ...v })}
        />
      );
    case "pricing":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <TextField
              value={block.big}
              onChange={(big) => onChange({ ...block, big })}
              placeholder="Big figure (e.g. $349)"
            />
            <TextField
              value={block.label}
              onChange={(label) => onChange({ ...block, label })}
              placeholder="Label (e.g. Standard sedan)"
            />
          </div>
          <PricingRowsField
            rows={block.rows}
            onChange={(rows) => onChange({ ...block, rows })}
          />
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 space-y-2">
              <div className="flex items-start gap-2">
                <span className="pt-2 text-[10px] font-bold text-slate-400">Q{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <RichField
                    value={item.q}
                    onChange={(q) =>
                      onChange({ type: "faq", items: block.items.map((it, j) => (j === i ? { ...it, q } : it)) })
                    }
                    placeholder="Question"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 h-7 w-7 p-0 text-red-600"
                  onClick={() =>
                    onChange({ type: "faq", items: block.items.filter((_, j) => j !== i) })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <RichField
                value={item.a}
                onChange={(a) =>
                  onChange({ type: "faq", items: block.items.map((it, j) => (j === i ? { ...it, a } : it)) })
                }
                multiline
                rows={2}
                placeholder="Answer"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onChange({ type: "faq", items: [...block.items, { q: "", a: "" }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </Button>
        </div>
      );
    case "chips":
      return (
        <TextField
          value={block.items.join(", ")}
          onChange={(text) =>
            onChange({
              type: "chips",
              items: text.split(",").map((c) => c.trim()).filter(Boolean),
            })
          }
          placeholder="Comma-separated chips (e.g. Los Angeles, San Diego, San Jose)"
        />
      );
    case "related":
      return (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">#{i + 1}</span>
                <TextField
                  value={item.label}
                  onChange={(label) =>
                    onChange({ type: "related", items: block.items.map((it, j) => (j === i ? { ...it, label } : it)) })
                  }
                  placeholder="Link label"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-600"
                  onClick={() => onChange({ type: "related", items: block.items.filter((_, j) => j !== i) })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TextField
                value={item.to}
                onChange={(to) =>
                  onChange({ type: "related", items: block.items.map((it, j) => (j === i ? { ...it, to } : it)) })
                }
                placeholder="Internal path (e.g. /blog/how-flat-rate-pricing-works)"
              />
              <TextField
                value={item.description}
                onChange={(description) =>
                  onChange({ type: "related", items: block.items.map((it, j) => (j === i ? { ...it, description } : it)) })
                }
                placeholder="Short description"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              onChange({ type: "related", items: [...block.items, { to: "", label: "", description: "" }] })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add link
          </Button>
        </div>
      );
    default:
      return null;
  }
}

// ── Small shared inputs ──
function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 text-sm"
    />
  );
}

// ── Preview ──
export function CmsBlockPreviewDialog({
  open,
  onOpenChange,
  blocks,
  title,
  excerpt,
  imageUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: BlogBlock[];
  title: string;
  excerpt: string;
  imageUrl?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-black">{title || "(untitled)"}</DialogTitle>
          <DialogDescription className="text-left">{excerpt || ""}</DialogDescription>
        </DialogHeader>
        {imageUrl && (
          <img src={imageUrl} alt="Cover preview" className="aspect-video w-full rounded-xl object-cover" />
        )}
        <div className="space-y-4">
          {blocks.length === 0 && (
            <p className="text-sm text-slate-400">Nothing to preview yet — the body is empty.</p>
          )}
          {blocks.map((block, i) => (
            <PreviewBlock key={i} block={block} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Mirrors the public blog renderer's styling AND formatting. */
function PreviewBlock({ block }: { block: BlogBlock }) {
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
      toast.error("Unknown block type in preview");
      return null;
  }
}
