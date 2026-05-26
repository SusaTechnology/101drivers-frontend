import { Injectable } from "@nestjs/common";
import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
} from "./export/report-column.definitions";
import { mapReportRows } from "./export/report-row-mappers";
import { buildCsvBuffer } from "./export/report-csv.builder";
import { buildXlsxBuffer } from "./export/report-xlsx.builder";
import { buildPdfBuffer } from "./export/report-pdf.builder";

export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

export type ReportExportPayload = {
  reportKey: string;
  generatedAt: string;
  filtersApplied: Record<string, any>;
  summary: Record<string, any>;
  groupings: Record<string, any>;
  rows: any[];
  displayRows?: any[];
  columns?: Array<{
    key: string;
    label: string;
    type?: string;
    width?: number;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  export: {
    requestedFormat: ReportFormat;
    supportedFormats: ReportFormat[];
  };
  evidenceMeta?: Record<string, any>;
};

export type ReportExportResult = {
  format: Exclude<ReportFormat, "json">;
  filename: string;
  contentType: string;
  buffer: Buffer;
};

@Injectable()
export class ReportExportService {
  private makeFilename(reportKey: string, ext: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${reportKey}-report-${stamp}.${ext}`;
  }

  async export(
    reportKey: string,
    payload: ReportExportPayload,
    format: Exclude<ReportFormat, "json">
  ): Promise<ReportExportResult> {
    const typedReportKey = reportKey as EnterpriseReportKey;

    if (!REPORT_COLUMNS[typedReportKey]) {
      throw new Error(`Unsupported report key: ${reportKey}`);
    }

    const mappedRows =
      payload.displayRows && Array.isArray(payload.displayRows)
        ? payload.displayRows
        : mapReportRows(typedReportKey, payload.rows ?? []);

    const enterprisePayload = {
      ...payload,
      rows: mappedRows,
    };

    switch (format) {
      case "csv":
        return {
          format: "csv",
          filename: this.makeFilename(reportKey, "csv"),
          contentType: "text/csv; charset=utf-8",
          buffer: buildCsvBuffer(typedReportKey, mappedRows),
        };

      case "xlsx":
        return {
          format: "xlsx",
          filename: this.makeFilename(reportKey, "xlsx"),
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: await buildXlsxBuffer(typedReportKey, enterprisePayload),
        };

      case "pdf":
        return {
          format: "pdf",
          filename: this.makeFilename(reportKey, "pdf"),
          contentType: "application/pdf",
          buffer: await buildPdfBuffer(typedReportKey, enterprisePayload),
        };

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}