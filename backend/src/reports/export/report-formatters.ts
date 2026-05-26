import { ReportColumnDefinition } from "./report-column.definitions";

function isNil(value: unknown) {
  return value === null || value === undefined;
}

export function formatDateTime(value: unknown): string {
  if (isNil(value) || value === "") return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function formatBoolean(value: unknown): string {
  if (isNil(value) || value === "") return "";
  return value ? "Yes" : "No";
}

export function formatMoney(value: unknown): string {
  if (isNil(value) || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toFixed(2);
}

export function formatPercent(value: unknown): string {
  if (isNil(value) || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toFixed(2)}%`;
}

export function formatNumber(value: unknown): string {
  if (isNil(value) || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n}`;
}

export function formatMiles(value: unknown): string {
  if (isNil(value) || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toFixed(2);
}

export function formatStatus(value: unknown): string {
  if (isNil(value) || value === "") return "";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatCellValue(
  value: unknown,
  column?: ReportColumnDefinition
): string {
  switch (column?.type) {
    case "datetime":
      return formatDateTime(value);
    case "boolean":
      return formatBoolean(value);
    case "money":
      return formatMoney(value);
    case "percent":
      return formatPercent(value);
    case "number":
      return formatNumber(value);
    case "miles":
      return formatMiles(value);
    case "status":
      return formatStatus(value);
    default:
      return isNil(value) ? "" : String(value);
  }
}