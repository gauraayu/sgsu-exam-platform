import "server-only";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface Column<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined | Date;
  width?: number;
  /** Relative width used for PDF tables. */
  pdfWidth?: number;
  align?: "left" | "right";
}

const PURPLE = rgb(0x4d / 255, 0x27 / 255, 0x7d / 255);
const ORANGE = rgb(0xe7 / 255, 0x7b / 255, 0x31 / 255);
const GREY = rgb(0.42, 0.42, 0.47);
const LIGHT = rgb(0.96, 0.95, 0.98);

function cellText(v: ReturnType<Column<unknown>["value"]>): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** CSV with protection against spreadsheet formula injection. */
export function toCsv<T>(rows: T[], columns: Column<T>[]) {
  const safe = (s: string) => (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s);
  return Papa.unparse({
    fields: columns.map((c) => c.header),
    data: rows.map((r) => columns.map((c) => safe(cellText(c.value(r))))),
  });
}

export async function toXlsx<T>(rows: T[], columns: Column<T>[], opts: { sheetName: string; title: string; subtitle?: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SGSU Smart Assessment Portal";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
  ws.mergeCells(1, 1, 1, columns.length);
  ws.getCell(1, 1).value = opts.title;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF4D277D" } };
  ws.mergeCells(2, 1, 2, columns.length);
  ws.getCell(2, 1).value = opts.subtitle ?? `Scope Global Skills University · Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: "FF6B6B78" } };
  const header = ws.getRow(4);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4D277D" } };
    cell.alignment = { vertical: "middle", horizontal: c.align === "right" ? "right" : "left" };
    ws.getColumn(i + 1).width = c.width ?? Math.max(12, c.header.length + 4);
  });
  header.height = 20;
  rows.forEach((r) => {
    const row = ws.addRow(
      columns.map((c) => {
        const v = c.value(r);
        if (v instanceof Date) return v;
        if (typeof v === "boolean") return v ? "Yes" : "No";
        return v ?? "";
      }),
    );
    columns.forEach((c, i) => {
      const v = c.value(r);
      if (v instanceof Date) row.getCell(i + 1).numFmt = "dd-mmm-yyyy hh:mm";
      if (c.align === "right") row.getCell(i + 1).alignment = { horizontal: "right" };
    });
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** pdf-lib standard fonts only support WinAnsi; replace characters it cannot encode. */
function sanitize(text: string, font: PDFFont) {
  let out = "";
  for (const ch of text.replace(/[\r\n\t]+/g, " ")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number) {
  let t = sanitize(text, font);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

async function loadLogo(pdf: PDFDocument) {
  try {
    const bytes = fs.readFileSync(path.join(process.cwd(), "public", "branding", "sgsu-logo-transparent.png"));
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export interface PdfReportOptions<T> {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  rows: T[];
  columns: Column<T>[];
}

/** Landscape A4 tabular report with SGSU branding, repeated headers and page numbers. */
export async function toPdf<T>(opts: PdfReportOptions<T>) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setProducer("SGSU Smart Assessment Portal");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(pdf);
  const W = 842;
  const H = 595;
  const M = 36;
  const tableWidth = W - 2 * M;
  const totalRel = opts.columns.reduce((a, c) => a + (c.pdfWidth ?? 1), 0);
  const widths = opts.columns.map((c) => ((c.pdfWidth ?? 1) / totalRel) * tableWidth);
  const rowH = 18;
  const pages: PDFPage[] = [];

  const newPage = (first: boolean) => {
    const page = pdf.addPage([W, H]);
    pages.push(page);
    let y = H - M;
    if (logo) {
      const scale = 28 / logo.height;
      page.drawImage(logo, { x: M, y: y - 28, width: logo.width * scale, height: 28 });
    }
    page.drawText(sanitize("Examination Cell · Smart Assessment Portal", font), { x: W - M - font.widthOfTextAtSize("Examination Cell · Smart Assessment Portal", 9), y: y - 12, size: 9, font, color: GREY });
    y -= 40;
    page.drawRectangle({ x: M, y, width: tableWidth, height: 1.5, color: ORANGE });
    y -= 22;
    if (first) {
      page.drawText(truncate(opts.title, bold, 16, tableWidth), { x: M, y, size: 16, font: bold, color: PURPLE });
      y -= 16;
      if (opts.subtitle) {
        page.drawText(truncate(opts.subtitle, font, 10, tableWidth), { x: M, y, size: 10, font, color: GREY });
        y -= 18;
      }
      if (opts.summary?.length) {
        const boxW = Math.min(150, tableWidth / opts.summary.length - 8);
        opts.summary.forEach((s, i) => {
          const x = M + i * (boxW + 8);
          page.drawRectangle({ x, y: y - 34, width: boxW, height: 38, color: LIGHT });
          page.drawText(truncate(s.label, font, 8, boxW - 12), { x: x + 6, y: y - 8, size: 8, font, color: GREY });
          page.drawText(truncate(s.value, bold, 13, boxW - 12), { x: x + 6, y: y - 26, size: 13, font: bold, color: PURPLE });
        });
        y -= 50;
      }
    }
    // Table header
    page.drawRectangle({ x: M, y: y - rowH + 5, width: tableWidth, height: rowH, color: PURPLE });
    let x = M;
    opts.columns.forEach((c, i) => {
      const t = truncate(c.header, bold, 8.5, widths[i] - 8);
      const tx = c.align === "right" ? x + widths[i] - 4 - bold.widthOfTextAtSize(t, 8.5) : x + 4;
      page.drawText(t, { x: tx, y: y - 8, size: 8.5, font: bold, color: rgb(1, 1, 1) });
      x += widths[i];
    });
    return { page, y: y - rowH };
  };

  let { page, y } = newPage(true);
  if (!opts.rows.length) page.drawText("No records.", { x: M + 4, y: y - 8, size: 9, font, color: GREY });
  opts.rows.forEach((row, idx) => {
    if (y < M + 30) ({ page, y } = newPage(false));
    if (idx % 2 === 1) page.drawRectangle({ x: M, y: y - rowH + 5, width: tableWidth, height: rowH, color: LIGHT });
    let x = M;
    opts.columns.forEach((c, i) => {
      const t = truncate(cellText(c.value(row)), font, 8.5, widths[i] - 8);
      const tx = c.align === "right" ? x + widths[i] - 4 - font.widthOfTextAtSize(t, 8.5) : x + 4;
      page.drawText(t, { x: tx, y: y - 8, size: 8.5, font, color: rgb(0.1, 0.1, 0.12) });
      x += widths[i];
    });
    y -= rowH;
  });

  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: W - M - font.widthOfTextAtSize(label, 8), y: 20, size: 8, font, color: GREY });
    p.drawText(sanitize(`Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, font), { x: M, y: 20, size: 8, font, color: GREY });
  });
  return Buffer.from(await pdf.save());
}

export function fileResponse(body: Buffer | string, filename: string, contentType: string) {
  const data = typeof body === "string" ? body : new Uint8Array(body);
  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const MIME = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};
