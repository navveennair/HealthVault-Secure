const fs = require("fs");
const JSZip = require("jszip");

const TEMPLATE_PATH = process.argv[2];
const OUT_PATH = process.argv[3];

if (!TEMPLATE_PATH || !OUT_PATH) {
  console.error("Usage: node inject-tokens.js <template.dotx> <out.docx>");
  process.exit(1);
}

// Front-page text values (plain runs, injected directly — NOT via patchDocument,
// to keep the buggy ExternalHyperlink path out of the pipeline entirely).
const NAME = process.env.DOC_NAME || "[Student Full Name]";
const MATRIC = process.env.DOC_MATRIC || "[Matric Number]";
const YEARCOURSE = process.env.DOC_YEARCOURSE || "[Year / Programme]";
const SECTION = process.env.DOC_SECTION || "[Section]";
const LECTURER = process.env.DOC_LECTURER || "[Lecturer Name]";
const GITHUB_URL = process.env.DOC_GITHUB || "https://github.com/REPLACE/HealthVault-Secure";
const YOUTUBE_URL = process.env.DOC_YOUTUBE || "https://youtu.be/REPLACE_VIDEO_ID";

const GH_RID = "rId100";
const YT_RID = "rId101";

function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// A plain text run for a front-page value cell.
function textRun(text) {
  return `<w:r><w:rPr><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

// A real hyperlink element (blue + underline) referencing a relationship id.
function hyperlinkRun(rid, url) {
  return `<w:hyperlink r:id="${rid}" w:history="1"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${xmlEscape(url)}</w:t></w:r></w:hyperlink>`;
}

function bodyTokenParagraph(token) {
  return `<w:p><w:r><w:t xml:space="preserve">&lt;&lt;${token}&gt;&gt;</w:t></w:r></w:p>`;
}

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
  let xml = await zip.file("word/document.xml").async("string");

  const edits = [];

  // ---------- 1. Front-page fields ----------
  // Each label paragraph is followed by an EMPTY value paragraph in the
  // next cell. Insert content just before that value paragraph's </w:p>.
  function insertAfterLabel(labelAnchor, contentXml) {
    const labelIdx = xml.indexOf(labelAnchor);
    if (labelIdx === -1) throw new Error("Label not found: " + labelAnchor);
    const afterLabelClose = xml.indexOf("</w:p>", labelIdx) + "</w:p>".length;
    const valueParaStart = xml.indexOf("<w:p ", afterLabelClose);
    const valueParaEnd = xml.indexOf("</w:p>", valueParaStart);
    if (valueParaStart === -1 || valueParaEnd === -1) throw new Error("value paragraph missing for " + labelAnchor);
    edits.push({ start: valueParaEnd, end: valueParaEnd, insert: contentXml });
  }

  insertAfterLabel(">Name<", textRun(NAME));
  insertAfterLabel(">Matric No.<", textRun(MATRIC));
  insertAfterLabel(">Year / Course<", textRun(YEARCOURSE));
  insertAfterLabel(">Section<", textRun(SECTION));
  insertAfterLabel(">Lecturer Name<", textRun(LECTURER));
  insertAfterLabel(">GitHub Link<", hyperlinkRun(GH_RID, GITHUB_URL));
  insertAfterLabel(">YouTube Link<", hyperlinkRun(YT_RID, YOUTUBE_URL));

  // ---------- 2. Chapter body tokens ----------
  function findParagraphSpan(markerIdx) {
    const start = xml.lastIndexOf("<w:p ", markerIdx);
    const end = xml.indexOf("</w:p>", markerIdx) + "</w:p>".length;
    return { start, end };
  }

  const heading1Positions = [];
  {
    const re = /<w:pStyle w:val="Heading1"\/>/g;
    let m;
    while ((m = re.exec(xml))) heading1Positions.push(m.index);
  }
  if (heading1Positions.length !== 4) throw new Error("Expected 4 Heading1 paragraphs, found " + heading1Positions.length);

  const referencesTitleIdx = xml.indexOf(">REFERENCES<");
  if (referencesTitleIdx === -1) throw new Error("REFERENCES title not found");

  const h1 = heading1Positions.map(findParagraphSpan);
  const refSpan = findParagraphSpan(referencesTitleIdx);
  const lastSectPrStart = xml.lastIndexOf("<w:sectPr");

  edits.push({ start: h1[0].end, end: h1[1].start, insert: bodyTokenParagraph("CH1_BODY") });
  edits.push({ start: h1[1].end, end: h1[2].start, insert: bodyTokenParagraph("CH2_BODY") });
  edits.push({ start: h1[2].end, end: h1[3].start, insert: bodyTokenParagraph("CH3_BODY") });
  edits.push({ start: h1[3].end, end: refSpan.start, insert: bodyTokenParagraph("CH4_BODY") });
  edits.push({ start: refSpan.end, end: lastSectPrStart, insert: bodyTokenParagraph("REFERENCES_BODY") });

  // ---------- Apply edits ----------
  edits.sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const e of edits) {
    if (e.start < cursor) throw new Error("Overlapping edit detected");
    result += xml.slice(cursor, e.start) + e.insert;
    cursor = e.end;
  }
  result += xml.slice(cursor);
  zip.file("word/document.xml", result);

  // ---------- 3. Add the two hyperlink relationships to document.xml.rels ----------
  let rels = await zip.file("word/_rels/document.xml.rels").async("string");
  const newRels =
    `<Relationship Id="${GH_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(GITHUB_URL)}" TargetMode="External"/>` +
    `<Relationship Id="${YT_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(YOUTUBE_URL)}" TargetMode="External"/>`;
  rels = rels.replace("</Relationships>", newRels + "</Relationships>");
  zip.file("word/_rels/document.xml.rels", rels);

  // ---------- 4. Convert template content type to document content type ----------
  // The source is a .dotx TEMPLATE: [Content_Types].xml declares word/document.xml
  // as "...wordprocessingml.template.main+xml". A .docx MUST declare it as
  // "...wordprocessingml.document.main+xml"; otherwise Word rejects the whole
  // package as corrupt regardless of how valid the XML is.
  let contentTypes = await zip.file("[Content_Types].xml").async("string");
  if (!contentTypes.includes("wordprocessingml.document.main+xml")) {
    contentTypes = contentTypes.replace(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
    );
    zip.file("[Content_Types].xml", contentTypes);
  }

  const outBuf = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(OUT_PATH, outBuf);
  console.log("Wrote token-injected template with real hyperlinks:", OUT_PATH, outBuf.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
