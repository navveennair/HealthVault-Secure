const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const TEMPLATE_PATH = process.argv[2];
const OUT_PATH = process.argv[3];

if (!TEMPLATE_PATH || !OUT_PATH) {
  console.error("Usage: node inject-tokens.js <template.dotx> <out.docx>");
  process.exit(1);
}

async function main() {
  const buf = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buf);
  let xml = await zip.file("word/document.xml").async("string");

  // ---------- 1. Front-page field tokens ----------
  // Each label (e.g. ">Name<") is immediately followed, in the next table
  // cell, by an EMPTY paragraph: <w:p ...><w:pPr>...</w:pPr></w:p>
  // We insert a run containing a <<TOKEN>> placeholder right before that
  // paragraph's closing </w:p>, using PatchType.PARAGRAPH-friendly syntax.
  function insertTokenAfterLabel(xmlStr, labelAnchor, token) {
    const labelIdx = xmlStr.indexOf(labelAnchor);
    if (labelIdx === -1) throw new Error("Label not found: " + labelAnchor);
    // find the next paragraph start after the label's own paragraph closes
    const afterLabelClose = xmlStr.indexOf("</w:p>", labelIdx) + "</w:p>".length;
    const valueParaStart = xmlStr.indexOf("<w:p ", afterLabelClose);
    const valueParaEnd = xmlStr.indexOf("</w:p>", valueParaStart);
    if (valueParaStart === -1 || valueParaEnd === -1) {
      throw new Error("Could not locate value paragraph for: " + labelAnchor);
    }
    const runXml = `<w:r><w:t xml:space="preserve">&lt;&lt;${token}&gt;&gt;</w:t></w:r>`;
    return {
      start: valueParaEnd,
      end: valueParaEnd,
      insert: runXml,
    };
  }

  const frontFields = [
    [">Name<", "NAME"],
    [">Matric No.<", "MATRIC"],
    [">Year / Course<", "YEARCOURSE"],
    [">Section<", "SECTION"],
    [">Lecturer Name<", "LECTURER"],
    [">GitHub Link<", "GITHUB"],
    [">YouTube Link<", "YOUTUBE"],
  ];

  const edits = [];
  for (const [anchor, token] of frontFields) {
    edits.push(insertTokenAfterLabel(xml, anchor, token));
  }

  // ---------- 2. Chapter body tokens ----------
  // Locate every Heading1 paragraph (the 4 chapter titles) plus the
  // References "Title"-styled paragraph, then replace everything BETWEEN
  // them with a single minimal paragraph containing a <<TOKEN>>. Because
  // PatchType.DOCUMENT (FilePatch) replaces the whole paragraph node that
  // contains the token, the exact styling of this placeholder paragraph
  // does not matter.
  function findParagraphSpan(xmlStr, markerIdx) {
    const start = xmlStr.lastIndexOf("<w:p ", markerIdx);
    const end = xmlStr.indexOf("</w:p>", markerIdx) + "</w:p>".length;
    return { start, end };
  }

  const heading1Positions = [];
  {
    const re = /<w:pStyle w:val="Heading1"\/>/g;
    let m;
    while ((m = re.exec(xml))) heading1Positions.push(m.index);
  }
  if (heading1Positions.length !== 4) {
    throw new Error("Expected 4 Heading1 paragraphs, found " + heading1Positions.length);
  }

  const referencesTitleIdx = xml.indexOf(">REFERENCES<");
  if (referencesTitleIdx === -1) throw new Error("REFERENCES title not found");

  const h1Spans = heading1Positions.map((idx) => findParagraphSpan(xml, idx));
  const refTitleSpan = findParagraphSpan(xml, referencesTitleIdx);

  // Body-level trailing sectPr must be preserved (last child of <w:body>).
  const lastSectPrStart = xml.lastIndexOf("<w:sectPr");

  function bodyTokenParagraph(token) {
    return `<w:p><w:r><w:t xml:space="preserve">&lt;&lt;${token}&gt;&gt;</w:t></w:r></w:p>`;
  }

  edits.push({ start: h1Spans[0].end, end: h1Spans[1].start, insert: bodyTokenParagraph("CH1_BODY") });
  edits.push({ start: h1Spans[1].end, end: h1Spans[2].start, insert: bodyTokenParagraph("CH2_BODY") });
  edits.push({ start: h1Spans[2].end, end: h1Spans[3].start, insert: bodyTokenParagraph("CH3_BODY") });
  edits.push({ start: h1Spans[3].end, end: refTitleSpan.start, insert: bodyTokenParagraph("CH4_BODY") });
  edits.push({ start: refTitleSpan.end, end: lastSectPrStart, insert: bodyTokenParagraph("REFERENCES_BODY") });

  // ---------- Apply all edits in one pass (sorted, non-overlapping) ----------
  edits.sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const e of edits) {
    result += xml.slice(cursor, e.start);
    result += e.insert;
    cursor = e.end;
  }
  result += xml.slice(cursor);

  zip.file("word/document.xml", result);
  const outBuf = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(OUT_PATH, outBuf);
  console.log("Wrote token-injected template:", OUT_PATH, outBuf.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
