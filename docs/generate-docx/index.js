const fs = require("fs");
const G = require("./gen");
const { frontPage, tocPage, ch1 } = require("./build");
const { ch2 } = require("./build_ch2");
const { ch3 } = require("./build_ch3");
const { ch4, references } = require("./build_ch4");

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Header, Footer, PageNumber, FONT, SZ, convertInchesToTwip,
} = G;

const footer = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
      ],
    }),
  ],
});

const header = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: "SECR4483/SCSR4483 — Secure Programming Alternative Assessment", font: FONT, size: 16, italics: true, color: "808080" }),
      ],
    }),
  ],
});

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: SZ },
        paragraph: { spacing: { line: 360, lineRule: "auto" } },
      },
      heading1: { run: { font: FONT, size: 32, bold: true, color: "000000" }, paragraph: { spacing: { before: 480, after: 240, line: 360, lineRule: "auto" } } },
      heading2: { run: { font: FONT, size: 28, bold: true, color: "000000" }, paragraph: { spacing: { before: 360, after: 200, line: 360, lineRule: "auto" } } },
      heading3: { run: { font: FONT, size: 26, bold: true, color: "000000" }, paragraph: { spacing: { before: 280, after: 160, line: 360, lineRule: "auto" } } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
          },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children: [
        ...frontPage,
        ...tocPage,
        ...ch1,
        ...ch2,
        ...ch3,
        ...ch4,
        ...references,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = process.argv[2] || "./output.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote", outPath, buffer.length, "bytes");
});
