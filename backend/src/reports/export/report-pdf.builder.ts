import {
  EnterpriseReportKey,
  REPORT_COLUMNS,
} from "./report-column.definitions";
import { formatCellValue } from "./report-formatters";

export async function buildPdfBuffer(
  reportKey: EnterpriseReportKey,
  payload: {
    reportKey: string;
    generatedAt: string;
    filtersApplied: Record<string, any>;
    summary: Record<string, any>;
    rows: Record<string, any>[];
  }
): Promise<Buffer> {
  let PDFDocument: any;

  try {
    PDFDocument = (await import("pdfkit")).default;
  } catch {
    throw new Error("PDF export requires 'pdfkit'. Install it with: npm i pdfkit");
  }

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  const columns = REPORT_COLUMNS[reportKey];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(`${payload.reportKey} Report`);
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated At: ${payload.generatedAt}`);

    doc.moveDown();
    doc.fontSize(12).text("Filters");
    doc.fontSize(9).text(JSON.stringify(payload.filtersApplied || {}, null, 2));

    doc.moveDown();
    doc.fontSize(12).text("Summary");
    doc.fontSize(9).text(JSON.stringify(payload.summary || {}, null, 2));

    doc.addPage();
    doc.fontSize(12).text("Data Preview");
    doc.moveDown(0.5);

    const previewRows = payload.rows.slice(0, 25);
    for (const row of previewRows) {
      for (const column of columns) {
        doc
          .fontSize(9)
          .text(`${column.label}: ${formatCellValue(row[column.key], column)}`);
      }
      doc.moveDown();
    }

    if (payload.rows.length > 25) {
      doc
        .fontSize(9)
        .text(`Preview limited to 25 rows out of ${payload.rows.length}.`);
    }

    doc.end();
  });
}