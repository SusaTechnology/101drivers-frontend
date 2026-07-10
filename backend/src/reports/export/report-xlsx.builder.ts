import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
  ReportColumnDefinition,
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
    columns?: ReportColumnDefinition[];
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
  const columns = payload.columns ?? REPORT_COLUMNS[reportKey];

  // Only the data sheet — no Summary or Groupings sheets.
  // The export should contain only the table data.
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

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}