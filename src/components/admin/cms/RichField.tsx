import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import { Bold, Italic, Link2, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * A text field with a big-company formatting toolbar — the CMS-authoring
 * counterpart of renderCmsInline(). Instead of memorizing syntax, the
 * admin selects text and clicks Bold / Italic / Link (or presses
 * Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+K); the toolbar inserts the same
 * lightweight markup the public renderer parses (**bold**, *italic*,
 * [label](url)). Clicking an active toggle again removes it.
 *
 * Auto-grows when multiline; all hooks run unconditionally (Task 129 rule).
 */

const WRAPS = {
  bold: { before: "**", after: "**" },
  italic: { before: "*", after: "*" },
} as const;

type WrapKind = keyof typeof WRAPS;

const LINK_TOKEN_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

export function RichField({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}) {
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const selRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const captureSelection = () => {
    const el = fieldRef.current;
    if (el) selRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const refocus = (caret: number) => {
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  /** Wrap (or unwrap) the current selection with before/after markers. */
  const toggleWrap = (kind: WrapKind) => {
    const el = fieldRef.current;
    if (!el) return;
    captureSelection();
    const { start, end } = selRef.current;
    const { before, after } = WRAPS[kind];
    const sel = value.slice(start, end);
    if (
      sel.startsWith(before) &&
      sel.endsWith(after) &&
      sel.length >= before.length + after.length
    ) {
      const inner = sel.slice(before.length, sel.length - after.length);
      onChange(value.slice(0, start) + inner + value.slice(end));
      refocus(start + inner.length);
    } else {
      onChange(value.slice(0, start) + before + sel + after + value.slice(end));
      refocus(start + before.length + sel.length);
    }
  };

  const openLinkPopover = () => {
    const el = fieldRef.current;
    if (el) {
      captureSelection();
      const sel = value.slice(selRef.current.start, selRef.current.end);
      const m = sel.match(LINK_TOKEN_RE);
      if (m) {
        // Selection is already a link → clicking the button removes it.
        onChange(
          value.slice(0, selRef.current.start) + m[1] + value.slice(selRef.current.end),
        );
        refocus(selRef.current.start + m[1].length);
        return;
      }
    }
    setLinkOpen((open) => !open);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    setLinkOpen(false);
    setLinkUrl("");
    if (!url) return;
    const { start, end } = selRef.current;
    const sel = value.slice(start, end);
    const label = sel.length > 0 ? sel : url;
    const token = `[${label}](${url})`;
    onChange(value.slice(0, start) + token + value.slice(end));
    refocus(start + token.length);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") {
      e.preventDefault();
      toggleWrap("bold");
    } else if (k === "i") {
      e.preventDefault();
      toggleWrap("italic");
    } else if (k === "k") {
      e.preventDefault();
      openLinkPopover();
    }
  };

  const onLinkUrlKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyLink();
    } else if (e.key === "Escape") {
      setLinkOpen(false);
      setLinkUrl("");
    }
  };

  const keepSelection = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault();

  // Auto-grow the multiline field with the content (capped).
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || !multiline) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 460)}px`;
  }, [value, multiline]);

  const toolBtn =
    "flex h-7 w-7 items-center justify-center rounded-sm text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white transition-colors";

  return (
    <div className={className}>
      <div className="flex items-center gap-0.5 rounded-t-md border border-b-0 border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800/60">
        <button
          type="button"
          className={`${toolBtn} font-black text-xs`}
          onMouseDown={keepSelection}
          onClick={() => toggleWrap("bold")}
          title="Bold (Ctrl/Cmd+B)"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={`${toolBtn} italic font-serif text-sm`}
          onMouseDown={keepSelection}
          onClick={() => toggleWrap("italic")}
          title="Italic (Ctrl/Cmd+I)"
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          className={toolBtn}
          onMouseDown={keepSelection}
          onClick={openLinkPopover}
          title="Add or remove link (Ctrl/Cmd+K)"
          aria-label="Link"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto pr-1 font-mono text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
          **bold** · *italic* · [text](link)
        </span>
      </div>

      {multiline ? (
        <Textarea
          ref={fieldRef as RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onSelect={captureSelection}
          onClick={captureSelection}
          placeholder={placeholder}
          rows={rows ?? 3}
          className="rounded-t-none border-slate-200 text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 resize-none overflow-y-auto"
        />
      ) : (
        <Input
          ref={fieldRef as RefObject<HTMLInputElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onSelect={captureSelection}
          onClick={captureSelection}
          placeholder={placeholder}
          className="rounded-t-none border-slate-200 text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      )}

      {linkOpen && (
        <div className="mt-1 flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
          <Input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={onLinkUrlKeyDown}
            placeholder="https://… , /blog/post or mailto:… — Enter to apply"
            className="h-7 text-xs"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 shrink-0 rounded-md bg-lime-600 px-2 text-xs font-bold text-white hover:bg-lime-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen(false);
              setLinkUrl("");
            }}
            className={toolBtn}
            aria-label="Cancel link"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
