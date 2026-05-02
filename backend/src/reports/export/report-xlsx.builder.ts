import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
} from "./report-column.definitions";
import { formatCellValue } from "./report-formatters";

export async function buildXlsxBuffer(
  reportKey: EnterpriseReportKey,
  payload: {
    reportKey: string;
    generatedAt: string;
    filtersApplied: Record<string, any>;
    summary: Record<string, any>;
    groupings: Record<string, any>;
    rows: Record<string, any>[];
    pagination: {
      page: number;
      pageSize: number;
      totalRows: number;
      totalPages: number;
    };
  }
): Promise<Buffer> {
  let ExcelJS: any;

  try {
    ExcelJS = await import("exceljs");
  } catch {
    throw new Error("XLSX export requires 'exceljs'. Install it with: npm i exceljs");
  }

  const workbook = new ExcelJS.Workbook();
  const columns = REPORT_COLUMNS[reportKey];

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 80 },
  ];

  const summaryRows = [
    ["Report", payload.reportKey],
    ["Generated At", payload.generatedAt],
    ["Page", payload.pagination.page],
    ["Page Size", payload.pagination.pageSize],
    ["Total Rows", payload.pagination.totalRows],
    ["Total Pages", payload.pagination.totalPages],
    ["Filters", JSON.stringify(payload.filtersApplied || {})],
    ["Summary", JSON.stringify(payload.summary || {})],
  ];

  for (const [field, value] of summaryRows) {
    summarySheet.addRow({ field, value });
  }

  summarySheet.getRow(1).font = { bold: true };

  const dataSheet = workbook.addWorksheet("Data");
  dataSheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width ?? 20,
  }));

  dataSheet.views = [{ state: "frozen", ySplit: 1 }];
  dataSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true };

  for (const row of payload.rows) {
    const normalized: Record<string, any> = {};
    for (const column of columns) {
      normalized[column.key] = formatCellValue(row[column.key], column);
    }
    dataSheet.addRow(normalized);
  }

  const groupingsSheet = workbook.addWorksheet("Groupings");
  groupingsSheet.columns = [
    { header: "Grouping", key: "grouping", width: 30 },
    { header: "Value", key: "value", width: 100 },
  ];
  groupingsSheet.getRow(1).font = { bold: true };

  for (const [grouping, value] of Object.entries(payload.groupings || {})) {
    groupingsSheet.addRow({
      grouping,
      value: JSON.stringify(value),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}