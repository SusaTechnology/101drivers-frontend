import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Visual editors for the two "grid" blog blocks — replacements for typing
 * pipe-separated cells into a textarea. They map 1:1 onto the published
 * block shapes, so nothing changes for the public renderer:
 *
 *   CmsTableField    → { type: "table", head[], rows[][], highlightCol?, highlightRow?, note? }
 *   PricingRowsField → pricing.rows[] of { k, v, included? }
 */

const CELL_INPUT =
  "h-8 w-full min-w-[72px] border-slate-200 text-xs dark:border-slate-700";
const ICON_BTN =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-slate-300 hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-500/10 transition-colors";

export interface TableValue {
  head: string[];
  rows: string[][];
  highlightCol?: number;
  highlightRow?: number;
  note?: string;
}

export function CmsTableField({
  value,
  onChange,
}: {
  value: TableValue;
  onChange: (value: TableValue) => void;
}) {
  const colCount = Math.max(
    1,
    value.head.length,
    ...value.rows.map((r) => r.length),
  );
  const rowAt = (r: number): string[] =>
    Array.from({ length: colCount }, (_, c) => value.rows[r]?.[c] ?? "");

  const setHeadCell = (c: number, v: string) => {
    const head = Array.from({ length: colCount }, (_, i) =>
      i === c ? v : value.head[i] ?? "",
    );
    onChange({ ...value, head });
  };

  const setBodyCell = (r: number, c: number, v: string) => {
    const rows = value.rows.map((row, i) =>
      i === r
        ? Array.from({ length: colCount }, (_, j) =>
            j === c ? v : row[j] ?? "",
          )
        : row,
    );
    onChange({ ...value, rows });
  };

  const addRow = () =>
    onChange({ ...value, rows: [...value.rows, Array(colCount).fill("")] });

  const addColumn = () =>
    onChange({
      ...value,
      head: Array.from({ length: colCount + 1 }, (_, i) => value.head[i] ?? ""),
      rows: value.rows.map((row) => [
        ...Array.from({ length: colCount }, (_, i) => row[i] ?? ""),
        "",
      ]),
    });

  const removeColumn = (c: number) => {
    if (colCount <= 1) {
      onChange({ ...value, head: [""], rows: value.rows.map(() => [""]) });
      return;
    }
    const clamp = (n: number | undefined) =>
      n === undefined ? undefined : n === c ? undefined : n > c ? n - 1 : n;
    onChange({
      ...value,
      head: value.head.filter((_, i) => i !== c),
      rows: value.rows.map((row) => row.filter((_, i) => i !== c)),
      highlightCol: clamp(value.highlightCol),
    });
  };

  const removeRow = (r: number) => {
    const rows =
      value.rows.length <= 1
        ? [Array(colCount).fill("")]
        : value.rows.filter((_, i) => i !== r);
    onChange({
      ...value,
      rows,
      highlightRow:
        value.highlightRow === r
          ? undefined
          : value.highlightRow !== undefined && value.highlightRow > r
            ? value.highlightRow - 1
            : value.highlightRow,
    });
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              {Array.from({ length: colCount }, (_, c) => (
                <th key={c} className="min-w-[110px] p-1 text-left">
                  <div className="flex items-center gap-0.5">
                    <Input
                      value={value.head[c] ?? ""}
                      onChange={(e) => setHeadCell(c, e.target.value)}
                      placeholder={`Column ${c + 1}`}
                      className={`${CELL_INPUT} font-bold`}
                    />
                    <button
                      type="button"
                      className={ICON_BTN}
                      onClick={() => removeColumn(c)}
                      title="Remove this column"
                      aria-label={`Remove column ${c + 1}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-8" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {value.rows.map((_, r) => (
              <tr key={r} className="border-t border-slate-100 dark:border-slate-800">
                {Array.from({ length: colCount }, (_, c) => (
                  <td key={c} className="p-1">
                    <Input
                      value={rowAt(r)[c]}
                      onChange={(e) => setBodyCell(r, c, e.target.value)}
                      className={CELL_INPUT}
                    />
                  </td>
                ))}
                <td className="p-1 text-center">
                  <button
                    type="button"
                    className={ICON_BTN}
                    onClick={() => removeRow(r)}
                    title="Remove this row"
                    aria-label={`Remove row ${r + 1}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={addRow}
        >
          <Plus className="h-3 w-3" /> Row
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={addColumn}
        >
          <Plus className="h-3 w-3" /> Column
        </Button>
        <HighlightPick
          label="Highlight column"
          count={colCount}
          unit="Col"
          value={value.highlightCol}
          onChange={(v) => onChange({ ...value, highlightCol: v })}
        />
        <HighlightPick
          label="Highlight row"
          count={value.rows.length}
          unit="Row"
          value={value.highlightRow}
          onChange={(v) => onChange({ ...value, highlightRow: v })}
        />
      </div>

      <Input
        value={value.note ?? ""}
        onChange={(e) => onChange({ ...value, note: e.target.value || undefined })}
        placeholder="Optional note under the table"
        className="h-8 text-xs"
      />
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        Tip: **bold**, *italic* and [text](/link) work inside cells too — they
        render exactly like the live page.
      </p>
    </div>
  );
}

function HighlightPick({
  label,
  count,
  unit,
  value,
  onChange,
}: {
  label: string;
  count: number;
  unit: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-[11px] whitespace-nowrap text-slate-500 dark:text-slate-400">
        {label}
      </Label>
      <Select
        value={value === undefined ? "none" : String(value)}
        onValueChange={(v) => onChange(v === "none" ? undefined : Number(v))}
      >
        <SelectTrigger className="h-7 w-[92px] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {Array.from({ length: count }, (_, i) => (
            <SelectItem key={i} value={String(i)}>
              {unit} {i + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface PricingRow {
  k: string;
  v: string;
  included?: boolean;
}

export function PricingRowsField({
  rows,
  onChange,
}: {
  rows: PricingRow[];
  onChange: (rows: PricingRow[]) => void;
}) {
  const setRow = (i: number, patch: Partial<PricingRow>) =>
    onChange(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 p-1.5 dark:border-slate-700"
        >
          <span className="text-[10px] font-bold text-slate-400">
            {i + 1}
          </span>
          <Input
            value={row.k}
            onChange={(e) => setRow(i, { k: e.target.value })}
            placeholder="What's included"
            className="h-7 flex-1 text-xs"
          />
          <Input
            value={row.v}
            onChange={(e) => setRow(i, { v: e.target.value })}
            placeholder="Value"
            className="h-7 w-28 text-xs"
          />
          <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <Checkbox
              checked={row.included ?? false}
              onCheckedChange={(checked) =>
                setRow(i, { included: checked === true || undefined })
              }
              className="h-3.5 w-3.5"
            />
            green
          </label>
          <button
            type="button"
            className={ICON_BTN}
            onClick={() =>
              onChange(
                rows.length <= 1
                  ? [{ k: "", v: "" }]
                  : rows.filter((_, j) => j !== i),
              )
            }
            title="Remove this row"
            aria-label={`Remove row ${i + 1}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-[11px]"
        onClick={() => onChange([...rows, { k: "", v: "" }])}
      >
        <Plus className="h-3 w-3" /> Add row
      </Button>
    </div>
  );
}
