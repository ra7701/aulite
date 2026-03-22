import PDFDocument from "pdfkit";

const COLORS = {
  primary: "#1a1a2e" as const,
  accent: "#0066cc" as const,
  danger: "#cc0000" as const,
  warning: "#cc8800" as const,
  success: "#008844" as const,
  muted: "#666666" as const,
};

const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT;

export function createDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: LEFT, right: 50 },
    info: {
      Title: "Aulite Compliance Report",
      Author: "Aulite — EU AI Act Compliance Proxy",
    },
  });
}

export function header(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  doc
    .fontSize(22)
    .fillColor(COLORS.primary)
    .text(title, LEFT, doc.y, { width: WIDTH, align: "left" });

  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(subtitle, LEFT, doc.y, { width: WIDTH })
    .moveDown(0.5);

  const y = doc.y;
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(COLORS.accent).lineWidth(2).stroke();
  doc.moveDown(1);
  doc.x = LEFT;
}

export function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc
    .moveDown(0.5)
    .fontSize(14)
    .fillColor(COLORS.primary)
    .text(text, LEFT, doc.y, { width: WIDTH })
    .moveDown(0.3);
  doc.x = LEFT;
}

export function paragraph(doc: PDFKit.PDFDocument, text: string): void {
  doc
    .fontSize(10)
    .fillColor("#333333")
    .text(text, LEFT, doc.y, { width: WIDTH, lineGap: 3 })
    .moveDown(0.3);
  doc.x = LEFT;
}

export function keyValue(doc: PDFKit.PDFDocument, key: string, value: string | number): void {
  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(`${key}: `, LEFT, doc.y, { continued: true })
    .fillColor(COLORS.primary)
    .text(String(value));
  doc.x = LEFT;
}

export function riskBadge(doc: PDFKit.PDFDocument, score: number, label: string): void {
  const color = score >= 9 ? COLORS.danger : score >= 7 ? COLORS.warning : score >= 4 ? "#cc6600" : COLORS.success;
  doc
    .fontSize(10)
    .fillColor(color)
    .text(`[${score}/10] ${label}`, LEFT, doc.y, { width: WIDTH });
  doc.x = LEFT;
}

export function table(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], colWidths: number[]): void {
  let y = doc.y;
  const rowHeight = 18;

  const tableHeight = (rows.length + 1) * rowHeight + 10;
  if (y + tableHeight > 750) {
    doc.addPage();
    y = doc.y;
  }

  doc.fontSize(9).fillColor(COLORS.primary);
  let x = LEFT;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, y, { width: colWidths[i], align: "left" });
    x += colWidths[i];
  }
  y += rowHeight;

  doc.moveTo(LEFT, y - 4).lineTo(RIGHT, y - 4).strokeColor("#dddddd").lineWidth(0.5).stroke();

  doc.fontSize(9).fillColor("#333333");
  for (const row of rows) {
    if (y > 750) {
      doc.addPage();
      y = doc.y;
    }

    x = LEFT;
    for (let i = 0; i < row.length; i++) {
      const text = row[i].length > 60 ? row[i].slice(0, 57) + "..." : row[i];
      doc.text(text, x, y, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    }
    y += rowHeight;
  }

  doc.x = LEFT;
  doc.y = y + 5;
}

export function footer(doc: PDFKit.PDFDocument, text: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(text, LEFT, 780, { align: "center", width: WIDTH });
    doc.text(`Page ${i + 1} of ${range.count}`, LEFT, 790, { align: "center", width: WIDTH });
  }
}
