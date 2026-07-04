const fs = require("fs");
const {
  patchDocument, PatchType, TextRun, ExternalHyperlink, Paragraph,
} = require("docx");

const { ch1 } = require("./build");
const { ch2 } = require("./build_ch2");
const { ch3 } = require("./build_ch3");
const { ch4, references } = require("./build_ch4");

const NAME = process.env.DOC_NAME || "[Student Full Name]";
const MATRIC = process.env.DOC_MATRIC || "[Matric Number]";
const YEARCOURSE = process.env.DOC_YEARCOURSE || "[Year / Programme]";
const SECTION = process.env.DOC_SECTION || "[Section]";
const LECTURER = process.env.DOC_LECTURER || "[Lecturer Name]";
const GITHUB_URL = process.env.DOC_GITHUB || "https://github.com/REPLACE/HealthVault-Secure";
const YOUTUBE_URL = process.env.DOC_YOUTUBE || "https://youtu.be/REPLACE_VIDEO_ID";

const FONT = "Times New Roman";
const SZ = 24;

// Drop each chapter array's own leading h1() heading (index 0) since the
// official template already has that exact chapter-title paragraph in
// place; injecting a second one would duplicate the heading. Trailing
// pageBreak() paragraphs are kept so the next chapter still starts clean.
function dropLeadingHeading(arr) {
  return arr.slice(1);
}

async function main() {
  const templateBuf = fs.readFileSync(process.argv[2]);
  const outPath = process.argv[3];

  const doc = await patchDocument({
    outputType: "nodebuffer",
    data: templateBuf,
    keepOriginalStyles: true,
    placeholderDelimiters: { start: "<<", end: ">>" },
    patches: {
      NAME: { type: PatchType.PARAGRAPH, children: [new TextRun({ text: NAME, font: FONT, size: SZ })] },
      MATRIC: { type: PatchType.PARAGRAPH, children: [new TextRun({ text: MATRIC, font: FONT, size: SZ })] },
      YEARCOURSE: { type: PatchType.PARAGRAPH, children: [new TextRun({ text: YEARCOURSE, font: FONT, size: SZ })] },
      SECTION: { type: PatchType.PARAGRAPH, children: [new TextRun({ text: SECTION, font: FONT, size: SZ })] },
      LECTURER: { type: PatchType.PARAGRAPH, children: [new TextRun({ text: LECTURER, font: FONT, size: SZ })] },
      GITHUB: {
        type: PatchType.PARAGRAPH,
        children: [new ExternalHyperlink({
          link: GITHUB_URL,
          children: [new TextRun({ text: GITHUB_URL, font: FONT, size: SZ, style: "Hyperlink" })],
        })],
      },
      YOUTUBE: {
        type: PatchType.PARAGRAPH,
        children: [new ExternalHyperlink({
          link: YOUTUBE_URL,
          children: [new TextRun({ text: YOUTUBE_URL, font: FONT, size: SZ, style: "Hyperlink" })],
        })],
      },
      CH1_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch1) },
      CH2_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch2) },
      CH3_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch3) },
      CH4_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch4) },
      REFERENCES_BODY: { type: PatchType.DOCUMENT, children: references.slice(1) }, // drop duplicate "REFERENCES" h1
    },
  });

  fs.writeFileSync(outPath, doc);
  console.log("Wrote patched document:", outPath, doc.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
