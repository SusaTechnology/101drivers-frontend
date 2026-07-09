import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
  ReportColumnDefinition,
} from "./report-column.definitions";
import { formatCellValue } from "./report-formatters";

/**
 * Builds a human-readable PDF with:
 *   - Page 1: Summary cover (title, generated date, filters, summary stats)
 *   - Page 2+: Table layout with header row, zebra-striped data rows,
 *     auto-sized columns, repeating headers on each page, page numbers
 *
 * No row cap — renders all matching rows with proper pagination.
 */
export async function buildPdfBuffer(
  reportKey: EnterpriseReportKey,
  payload: {
    reportKey: string;
    generatedAt: string;
    filtersApplied: Record<string, any>;
    summary: Record<string, any>;
    rows: Record<string, any>[];
    columns?: ReportColumnDefinition[];
  }
): Promise<Buffer> {
  let PDFDocument: any;

  try {
    PDFDocument = (await import("pdfkit")).default;
  } catch {
    throw new Error("PDF export requires 'pdfkit'. Install it with: npm i pdfkit");
  }

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true, // enables page numbering via doc.bufferedPageRange
  });
  const chunks: Buffer[] = [];

  // Use payload.columns if provided (filtered by user), otherwise all
  const columns = payload.columns ?? REPORT_COLUMNS[reportKey];
  const rows = payload.rows ?? [];

  // ── Layout constants ──
  const PAGE_WIDTH = doc.page.width;
  const MARGIN = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const HEADER_BG = "#e2e8f0"; // slate-200
  const ROW_BG_ALT = "#f8fafc"; // slate-50
  const ROW_BG = "#ffffff";
  const TEXT_COLOR = "#1e293b"; // slate-800
  const MUTED_COLOR = "#64748b"; // slate-500
  const ROW_HEIGHT = 18;
  const HEADER_HEIGHT = 22;
  const DATA_FONT_SIZE = 8;
  const HEADER_FONT_SIZE = 8;

  // ── Calculate column widths ──
  // Distribute width proportionally based on label length, with a minimum.
  const minColWidth = 50;
  const totalLabelChars = columns.reduce(
    (sum, col) => sum + Math.max(col.label.length, 8),
    0
  );
  const colWidths = columns.map((col) => {
    const proportion = Math.max(col.label.length, 8) / totalLabelChars;
    return Math.max(minColWidth, (CONTENT_WIDTH * proportion));
  });

  // Scale to fit content width exactly
  const totalColWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const scaleFactor = CONTENT_WIDTH / totalColWidth;
  const scaledWidths = colWidths.map((w) => w * scaleFactor);

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ════════════════════════════════════════════════════════════
    // PAGE 1 — Summary Cover
    // ════════════════════════════════════════════════════════════
    const reportTitle = payload.reportKey
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) + " Report";

    doc.fillColor(TEXT_COLOR);
    doc.fontSize(22).font("Helvetica-Bold").text(reportTitle, { align: "center" });
    doc.moveDown(0.3);

    doc.fontSize(10).font("Helvetica").fillColor(MUTED_COLOR);
    doc.text(`Generated: ${formatDate(new Date(payload.generatedAt))}`, {
      align: "center",
    });
    doc.moveDown(1);

    // ── Filters Applied ──
    if (payload.filtersApplied && Object.keys(payload.filtersApplied).length > 0) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor(TEXT_COLOR);
      doc.text("Filters Applied", MARGIN, doc.y);
      doc.moveDown(0.3);

      doc.fontSize(9).font("Helvetica").fillColor(MUTED_COLOR);
      for (const [key, value] of Object.entries(payload.filtersApplied)) {
        if (key === "format" || key === "columns") continue; // skip meta filters
        const displayValue = formatFilterValue(key, value);
        if (displayValue) {
          doc.text(`${formatFilterLabel(key)}: ${displayValue}`, MARGIN + 10);
        }
      }
      doc.moveDown(1);
    }

    // ── Summary Stats ──
    if (payload.summary && Object.keys(payload.summary).length > 0) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor(TEXT_COLOR);
      doc.text("Summary", MARGIN, doc.y);
      doc.moveDown(0.3);

      doc.fontSize(10).font("Helvetica").fillColor(TEXT_COLOR);
      for (const [key, value] of Object.entries(payload.summary)) {
        doc.text(`${formatSummaryLabel(key)}: ${formatNumber(value)}`, MARGIN + 10);
      }
      doc.moveDown(1);
    }

    // ── Row count ──
    doc.fontSize(10).font("Helvetica-Oblique").fillColor(MUTED_COLOR);
    doc.text(`Total rows in this report: ${rows.length.toLocaleString()}`);

    // ════════════════════════════════════════════════════════════
    // PAGE 2+ — Data Table
    // ════════════════════════════════════════════════════════════
    doc.addPage();

    let y = MARGIN;
    let rowIndex = 0;
    let currentPageRows = 0;
    const rowsPerPage = Math.floor((doc.page.height - MARGIN * 2 - HEADER_HEIGHT) / ROW_HEIGHT);

    // Draw table header
    const drawHeader = () => {
      doc.rect(MARGIN, y, CONTENT_WIDTH, HEADER_HEIGHT).fill(HEADER_BG);
      doc.fillColor(TEXT_COLOR).font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE);
      let x = MARGIN;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const text = truncate(col.label, scaledWidths[i] - 6, HEADER_FONT_SIZE, doc);
        doc.text(text, x + 3, y + 6, {
          width: scaledWidths[i] - 6,
          ellipsis: true,
        });
        x += scaledWidths[i];
      }
      y += HEADER_HEIGHT;
      currentPageRows = 0;
    };

    drawHeader();

    // Draw data rows
    for (const row of rows) {
      // Check if we need a new page
      if (currentPageRows >= rowsPerPage) {
        doc.addPage();
        y = MARGIN;
        drawHeader();
      }

      // Zebra stripe background
      const bg = rowIndex % 2 === 0 ? ROW_BG : ROW_BG_ALT;
      doc.rect(MARGIN, y, CONTENT_WIDTH, ROW_HEIGHT).fill(bg);

      // Draw cell values
      doc.fillColor(TEXT_COLOR).font("Helvetica").fontSize(DATA_FONT_SIZE);
      let x = MARGIN;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const rawValue = row[col.key];
        const formatted = formatCellValue(rawValue, col);
        const text = truncate(String(formatted ?? ""), scaledWidths[i] - 6, DATA_FONT_SIZE, doc);
        doc.text(text, x + 3, y + 4, {
          width: scaledWidths[i] - 6,
          ellipsis: true,
        });
        x += scaledWidths[i];
      }

      y += ROW_HEIGHT;
      rowIndex++;
      currentPageRows++;
    }

    // ════════════════════════════════════════════════════════════
    // PAGE NUMBERS — add to every page
    // ════════════════════════════════════════════════════════════
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font("Helvetica").fillColor(MUTED_COLOR);
      doc.text(
        `Page ${i + 1} of ${range.count}`,
        MARGIN,
        doc.page.height - 25,
        { align: "center", width: CONTENT_WIDTH }
      );
    }

    doc.end();
  });
}

// ── Helpers ──

function truncate(text: string, maxWidth: number, fontSize: number, doc: any): string {
  doc.fontSize(fontSize);
  if (doc.widthOfString(text) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && doc.widthOfString(truncated + "…") > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + "…" : "";
}

function formatDate(d: Date): string {
  return d
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");
}

function formatNumber(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return String(value);
}

function formatFilterLabel(key: string): string {
  const labels: Record<string, string> = {
    from: "Date From",
    to: "Date To",
    customerId: "Customer ID",
    driverId: "Driver ID",
    status: "Delivery Status",
    serviceType: "Service Type",
    minDrivenHours: "Min Driven Hours",
    maxDrivenHours: "Max Driven Hours",
    groupBy: "Group By",
    sortBy: "Sort By",
    sortOrder: "Sort Order",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function formatFilterValue(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (key === "from" || key === "to") {
    return formatDate(new Date(value));
  }
  return String(value);
}

function formatSummaryLabel(key: string): string {
  const labels: Record<string, string> = {
    totalTrackingSessions: "Total Tracking Sessions",
    totalDrivenMiles: "Total Driven Miles",
    averageMilesPerTrip: "Average Miles Per Trip",
    totalDrivenHours: "Total Driven Hours",
    averageDrivenHoursPerTrip: "Average Driven Hours Per Trip",
    startedCount: "Sessions Started",
    stoppedCount: "Sessions Stopped",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
