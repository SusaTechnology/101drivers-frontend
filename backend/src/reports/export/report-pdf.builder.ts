import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
  ReportColumnDefinition,
} from "./report-column.definitions";
import { formatCellValue } from "./report-formatters";

/**
 * Builds a human-readable PDF with a table layout.
 * No summary page. No row cap. Page numbers on every page.
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
    // No bufferPages — we track page numbers manually
  });
  const chunks: Buffer[] = [];
  const columns = payload.columns ?? REPORT_COLUMNS[reportKey];
  const rows = payload.rows ?? [];

  // ── Layout constants ──
  const PAGE_WIDTH = doc.page.width;
  const MARGIN = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const HEADER_BG = "#e2e8f0";
  const ROW_BG_ALT = "#f8fafc";
  const ROW_BG = "#ffffff";
  const TEXT_COLOR = "#1e293b";
  const MUTED_COLOR = "#64748b";
  const ROW_HEIGHT = 18;
  const HEADER_HEIGHT = 22;
  const DATA_FONT_SIZE = 8;
  const HEADER_FONT_SIZE = 8;
  const PAGE_NUMBER_Y = doc.page.height - 25;

  // ── Calculate column widths ──
  const minColWidth = 50;
  const totalLabelChars = columns.reduce(
    (sum, col) => sum + Math.max(col.label.length, 8),
    0
  );
  const colWidths = columns.map((col) => {
    const proportion = Math.max(col.label.length, 8) / totalLabelChars;
    return Math.max(minColWidth, CONTENT_WIDTH * proportion);
  });
  const totalColWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const scaleFactor = CONTENT_WIDTH / totalColWidth;
  const scaledWidths = colWidths.map((w) => w * scaleFactor);

  // ── Track page count manually ──
  let pageCount = 1;

  // ── Page number helper (writes at bottom of current page) ──
  const writePageNumber = (current: number, total: number) => {
    doc.fontSize(8).font("Helvetica").fillColor(MUTED_COLOR);
    doc.text(
      `Page ${current} of ${total}`,
      MARGIN,
      PAGE_NUMBER_Y,
      { align: "center", width: CONTENT_WIDTH, lineBreak: false }
    );
  };

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Calculate total pages first
    const rowsPerPage = Math.floor((doc.page.height - MARGIN * 2 - HEADER_HEIGHT) / ROW_HEIGHT);
    const totalPages = rows.length === 0 ? 1 : Math.ceil(rows.length / rowsPerPage);

    let y = MARGIN;
    let rowIndex = 0;
    let currentPageRows = 0;

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
          lineBreak: false,
        });
        x += scaledWidths[i];
      }
      y += HEADER_HEIGHT;
      currentPageRows = 0;
    };

    drawHeader();

    if (rows.length === 0) {
      doc.fillColor(MUTED_COLOR).fontSize(10).font("Helvetica");
      doc.text("No data found for the selected filters.", MARGIN, y + 20);
      writePageNumber(1, 1);
      doc.end();
      return;
    }

    // Draw data rows
    for (const row of rows) {
      // Check if we need a new page
      if (currentPageRows >= rowsPerPage) {
        // Write page number on the current page before moving on
        writePageNumber(pageCount, totalPages);
        doc.addPage();
        pageCount++;
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
          lineBreak: false,
        });
        x += scaledWidths[i];
      }

      y += ROW_HEIGHT;
      rowIndex++;
      currentPageRows++;
    }

    // Write page number on the last page
    writePageNumber(pageCount, totalPages);

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
