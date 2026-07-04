const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, Header, Footer, PageNumber, ExternalHyperlink,
  TableOfContents, ShadingType, VerticalAlign, PageBreak, convertInchesToTwip
} = require("docx");

// ---------- Front-page placeholders (swap these once supplied) ----------
const STUDENT_NAME = process.env.DOC_NAME || "[Student Full Name]";
const MATRIC_NO = process.env.DOC_MATRIC || "[Matric Number]";
const SECTION = process.env.DOC_SECTION || "[Section]";
const LECTURER = process.env.DOC_LECTURER || "[Lecturer Name]";
const GITHUB_URL = process.env.DOC_GITHUB || "https://github.com/REPLACE_WITH_YOUR_USERNAME/HealthVault-Secure";
const YOUTUBE_URL = process.env.DOC_YOUTUBE || "https://youtu.be/REPLACE_WITH_VIDEO_ID";

const FONT = "Times New Roman";
const SZ = 24; // 12pt in half-points
const CODE_FONT = "Consolas";
const CODE_SZ = 18; // 9pt

const LINE_SPACING = { line: 360, lineRule: "auto" }; // 1.5 lines

// ---------------- helpers ----------------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240, ...LINE_SPACING },
    children: [new TextRun({ text, bold: true, font: FONT, size: 32 })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 200, ...LINE_SPACING },
    children: [new TextRun({ text, bold: true, font: FONT, size: 28 })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 160, ...LINE_SPACING },
    children: [new TextRun({ text, bold: true, font: FONT, size: 26 })],
  });
}
function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, font: FONT, size: SZ })];
  return new Paragraph({
    spacing: { after: 200, ...LINE_SPACING },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: runs,
  });
}
function bold(text) { return new TextRun({ text, font: FONT, size: SZ, bold: true }); }
function italic(text) { return new TextRun({ text, font: FONT, size: SZ, italics: true }); }
function plain(text) { return new TextRun({ text, font: FONT, size: SZ }); }

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 120, ...LINE_SPACING },
    children: [new TextRun({ text, font: FONT, size: SZ })],
  });
}

function caption(label, text) {
  return new Paragraph({
    spacing: { before: 120, after: 240 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `${label}: ${text}`, font: FONT, size: 22, italics: true, bold: true })],
  });
}

let figCount = 0, tblCount = 0;
function figCaption(text) { figCount++; return caption(`Figure ${figCount}`, text); }
function tblCaption(text) { tblCount++; return caption(`Table ${tblCount}`, text); }

function codeBlock(lines) {
  const text = Array.isArray(lines) ? lines.join("\n") : lines;
  const rows = text.split("\n").map((line) => new Paragraph({
    spacing: { after: 0, line: 240, lineRule: "auto" },
    children: [new TextRun({ text: line.length ? line : " ", font: CODE_FONT, size: CODE_SZ })],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F5F5F5", type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: rows,
          }),
        ],
      }),
    ],
  });
}

function cellText(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({ text, font: opts.code ? CODE_FONT : FONT, size: opts.code ? CODE_SZ : 20, bold: !!opts.bold })],
      spacing: { after: 0 },
    })],
  });
}

function cellCode(lines, opts = {}) {
  const text = Array.isArray(lines) ? lines : [lines];
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: { fill: opts.shade || "FFF5F5", type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: text.map((line) => new Paragraph({
      spacing: { after: 0, line: 240, lineRule: "auto" },
      children: [new TextRun({ text: line.length ? line : " ", font: CODE_FONT, size: 16 })],
    })),
  });
}

function twoColCodeTable(headerLeft, headerRight, leftLines, rightLines, leftShade = "FFEAEA", rightShade = "EAFCEA") {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cellText(headerLeft, { width: 50, shade: "D9D9D9", bold: true }),
          cellText(headerRight, { width: 50, shade: "D9D9D9", bold: true }),
        ],
      }),
      new TableRow({
        children: [
          cellCode(leftLines, { width: 50, shade: leftShade }),
          cellCode(rightLines, { width: 50, shade: rightShade }),
        ],
      }),
    ],
  });
}

function dataTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((htext, i) => cellText(htext, { width: widths ? widths[i] : undefined, shade: "D9D9D9", bold: true })),
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((c, i) => cellText(c, { width: widths ? widths[i] : undefined })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    },
    rows: [headerRow, ...bodyRows],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

module.exports = {
  STUDENT_NAME, MATRIC_NO, SECTION, LECTURER, GITHUB_URL, YOUTUBE_URL,
  FONT, SZ, LINE_SPACING,
  h1, h2, h3, p, bold, italic, plain, bullet, figCaption, tblCaption,
  codeBlock, twoColCodeTable, dataTable, pageBreak, cellText, cellCode,
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, Header, Footer, PageNumber, ExternalHyperlink,
  TableOfContents, convertInchesToTwip,
};
