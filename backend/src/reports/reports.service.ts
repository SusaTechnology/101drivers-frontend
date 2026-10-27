import { BadRequestException, Injectable } from "@nestjs/common";
import { ReportExportService } from "./report-export.service";
import { ReportsDomain } from "./reports.domain";
import { ReportPagination } from "./types/report.types";
import { mapReportRows } from "./export/report-row-mappers";
import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
} from "./export/report-column.definitions";
import {
  ComplianceReportQueryDto,
  DeliveriesReportQueryDto,
  DisputesReportQueryDto,
  InsuranceMileageReportQueryDto,
  PaymentsReportQueryDto,
  PayoutsReportQueryDto,
} from "./dto/report-query.dto";

type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

/**
 * Columns that must NEVER appear in an EXPORT of a given report, no matter
 * what the client requests. Internal row IDs mean nothing to an underwriter
 * and leak system identifiers — insurance exports carry human-readable rows
 * only. Applied to csv/xlsx/pdf AFTER the client's column selection, so a
 * stale dialog, old bookmark, or crafted `columns=deliveryId,...` request
 * still cannot reintroduce them. JSON (the on-screen table data) is NOT
 * filtered — ops keeps IDs for cross-referencing on screen.
 */
const EXPORT_EXCLUDED_COLUMNS: Partial<
  Record<EnterpriseReportKey, ReadonlySet<string>>
> = {
  "insurance-mileage": new Set([
    "deliveryId", // delivery / ride ID
    "trackingSessionId", // underlying tracking-session ID
    "driverId", // driver ID
    "customerId", // dealer/customer ID (customer IS the dealer here)
    "dealerId", // defensive alias
  ]),
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly domain: ReportsDomain,
    private readonly exporter: ReportExportService
  ) {}

  private getSupportedFormats(reportKey: string): ReportFormat[] {
    switch (reportKey) {
      case "insurance-mileage":
        return ["json", "csv", "xlsx", "pdf"];
      case "compliance":
      case "disputes":
      case "deliveries":
      case "payments":
      case "payouts":
        return ["json", "csv", "xlsx"];
      default:
        return ["json"];
    }
  }

  private sanitizeFilters<T extends Record<string, any>>(query: T) {
    return Object.fromEntries(
      Object.entries(query).filter(
        ([, value]) => value !== undefined && value !== null && value !== ""
      )
    );
  }

  private ensureFormatSupported(reportKey: string, format?: string) {
    const supportedFormats = this.getSupportedFormats(reportKey);
    const normalized = (format || "json") as ReportFormat;

    if (!supportedFormats.includes(normalized)) {
      throw new BadRequestException(
        `Format '${normalized}' is not supported for report '${reportKey}'. Supported formats: ${supportedFormats.join(
          ", "
        )}`
      );
    }

    return normalized;
  }

  private buildPagination(
    data: { rows?: any[]; pagination?: Partial<ReportPagination> }
  ): ReportPagination {
    return {
      page: data.pagination?.page ?? 1,
      pageSize: data.pagination?.pageSize ?? data.rows?.length ?? 0,
      totalRows: data.pagination?.totalRows ?? data.rows?.length ?? 0,
      totalPages: data.pagination?.totalPages ?? 1,
    };
  }

  private async finalize(
    reportKey: EnterpriseReportKey,
    query: { format?: string; columns?: string } & Record<string, any>,
    data: {
      rows: any[];
      summary?: Record<string, any>;
      groupings?: Record<string, any>;
      pagination?: Partial<ReportPagination>;
      evidenceMeta?: Record<string, any>;
    }
  ) {
    const format = this.ensureFormatSupported(reportKey, query.format);
    const supportedFormats = this.getSupportedFormats(reportKey);
    const pagination = this.buildPagination(data);

    const displayRows = mapReportRows(reportKey, data.rows ?? []);
    const allColumns = REPORT_COLUMNS[reportKey] ?? [];

    // Filter columns based on the `columns` query param (comma-separated keys).
    // Only applies to exports (csv/xlsx/pdf). For JSON, return all columns.
    let columns = allColumns;
    if (format !== "json" && query.columns && typeof query.columns === "string") {
      const requestedKeys = query.columns
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      if (requestedKeys.length > 0) {
        const filtered = allColumns.filter((col: any) =>
          requestedKeys.includes(col.key)
        );
        if (filtered.length > 0) {
          columns = filtered;
        }
      }
    }

    // Hard exclusion (exports only — see EXPORT_EXCLUDED_COLUMNS). Runs
    // after selection filtering so internal IDs can never be exported.
    const excludedKeys = EXPORT_EXCLUDED_COLUMNS[reportKey];
    if (format !== "json" && excludedKeys) {
      columns = columns.filter((col: any) => !excludedKeys.has(col.key));
    }

    const payload = {
      reportKey,
      generatedAt: new Date().toISOString(),
      filtersApplied: this.sanitizeFilters(query),
      summary: data.summary ?? {},
      groupings: data.groupings ?? {},
      columns,
      displayRows,
      rows: data.rows ?? [],
      pagination,
      ...(data.evidenceMeta ? { evidenceMeta: data.evidenceMeta } : {}),
      export: {
        requestedFormat: format,
        supportedFormats,
      },
    };

    if (format === "json") {
      return payload;
    }

    return this.exporter.export(reportKey, payload, format);
  }

  async deliveries(query: DeliveriesReportQueryDto) {
    const data = await this.domain.getDeliveriesReport(query);
    return this.finalize("deliveries", query, data);
  }

  async compliance(query: ComplianceReportQueryDto) {
    const data = await this.domain.getComplianceReport(query);
    return this.finalize("compliance", query, data);
  }

  async disputes(query: DisputesReportQueryDto) {
    const data = await this.domain.getDisputesReport(query);
    return this.finalize("disputes", query, data);
  }

  async payments(query: PaymentsReportQueryDto) {
    const data = await this.domain.getPaymentsReport(query);
    return this.finalize("payments", query, data);
  }

  async payouts(query: PayoutsReportQueryDto) {
    const data = await this.domain.getPayoutsReport(query);
    return this.finalize("payouts", query, data);
  }

  async insuranceMileage(query: InsuranceMileageReportQueryDto) {
    const data = await this.domain.getInsuranceMileageReport(query);
    return this.finalize("insurance-mileage", query, data);
  }
}