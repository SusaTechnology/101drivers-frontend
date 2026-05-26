export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

export type ReportPagination = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

export type ReportEnvelope<TSummary = any, TRow = any, TGroupings = any> = {
  reportKey: string;
  generatedAt: string;
  filtersApplied: Record<string, any>;
  summary: TSummary;
  groupings?: TGroupings;
  rows: TRow[];
  pagination: ReportPagination;
  export: {
    supportedFormats: ReportFormat[];
  };
};

export type ExportPayload = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
};