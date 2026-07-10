import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
  ReportColumnDefinition,
} from "./report-column.definitions";
import { formatCellValue } from "./report-formatters";

/**
 * Builds a human-readable PDF with a table layout.
 * Landscape orientation for wider tables. No summary page.
 * No row cap. Page numbers on every page. No empty/duplicate pages.
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

  // Landscape A4: 842 x 595 points
  const doc = new PDFDocument({
    size: [842, 595],
    margin: 30,
  });
  const chunks: Buffer[] = [];
  const columns = payload.columns ?? REPORT_COLUMNS[reportKey];
  const rows = payload.rows ?? [];

  // ── Layout constants ──
  const MARGIN = 30;
  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 595;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const HEADER_BG = "#e2e8f0";
  const ROW_BG_ALT = "#f8fafc";
  const ROW_BG = "#ffffff";
  const TEXT_COLOR = "#1e293b";
  const MUTED_COLOR = "#64748b";
  const ROW_HEIGHT = 16;
  const HEADER_HEIGHT = 20;
  const DATA_FONT_SIZE = 7;
  const HEADER_FONT_SIZE = 7;
  const FOOTER_Y = PAGE_HEIGHT - 20;

  // ── Calculate column widths ──
  const minColWidth = 40;
  const totalLabelChars = columns.reduce(
    (sum, col) => sum + Math.max(col.label.length, 6),
    0
  );
  const colWidths = columns.map((col) => {
    const proportion = Math.max(col.label.length, 6) / totalLabelChars;
    return Math.max(minColWidth, CONTENT_WIDTH * proportion);
  });
  const totalColWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const scaleFactor = CONTENT_WIDTH / totalColWidth;
  const scaledWidths = colWidths.map((w) => w * scaleFactor);

  // ── Calculate rows per page based on actual y position ──
  const maxRowY = FOOTER_Y - 5; // stop before footer
  const usableHeight = maxRowY - MARGIN - HEADER_HEIGHT;
  const rowsPerPage = Math.floor(usableHeight / ROW_HEIGHT);
  const totalPages = rows.length === 0 ? 1 : Math.ceil(rows.length / rowsPerPage);

  let pageCount = 1;

  const writePageNumber = (current: number, total: number) => {
    doc.save();
    doc.fontSize(7).font("Helvetica").fillColor(MUTED_COLOR);
    doc.text(
      `Page ${current} of ${total}`,
      MARGIN,
      FOOTER_Y,
      { align: "center", width: CONTENT_WIDTH, lineBreak: false }
    );
    doc.restore();
  };

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

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
        const text = truncate(col.label, scaledWidths[i] - 4, HEADER_FONT_SIZE, doc);
        doc.text(text, x + 2, y + 5, {
          width: scaledWidths[i] - 4,
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
      // Check if we need a new page — BEFORE drawing the row
      if (currentPageRows >= rowsPerPage) {
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
        const text = truncate(String(formatted ?? ""), scaledWidths[i] - 4, DATA_FONT_SIZE, doc);
        doc.text(text, x + 2, y + 3, {
          width: scaledWidths[i] - 4,
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
