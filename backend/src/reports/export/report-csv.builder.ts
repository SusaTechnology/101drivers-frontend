import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
} from "./report-column.definitions";
import { formatCellValue } from "./report-formatters";

export function buildCsvBuffer(
  reportKey: EnterpriseReportKey,
  rows: Record<string, any>[]
): Buffer {
  const columns = REPORT_COLUMNS[reportKey];

  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsv(c.label)).join(","));

  for (const row of rows) {
    lines.push(
      columns
        .map((column) => escapeCsv(formatCellValue(row[column.key], column)))
        .join(",")
    );
  }

  return Buffer.from(lines.join("\n"), "utf-8");
}