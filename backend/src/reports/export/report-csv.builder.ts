import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
  ReportColumnDefinition,
} from "./report-column.definitions";
import { formatCellValue } from "./report-formatters";

export function buildCsvBuffer(
  reportKey: EnterpriseReportKey,
  rows: Record<string, any>[],
  columnsOverride?: ReportColumnDefinition[]
): Buffer {
  const columns = columnsOverride ?? REPORT_COLUMNS[reportKey];

  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const lines: string[] = [];
  // Add BOM so Excel auto-detects UTF-8
  lines.push("\uFEFF" + columns.map((c) => escapeCsv(c.label)).join(","));

  for (const row of rows) {
    lines.push(
      columns
        .map((column) => escapeCsv(formatCellValue(row[column.key], column)))
        .join(",")
    );
  }

  return Buffer.from(lines.join("\n"), "utf-8");
}