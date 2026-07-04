const fs = require("fs");
const { patchDocument, PatchType } = require("docx");

const { ch1 } = require("./build");
const { ch2 } = require("./build_ch2");
const { ch3 } = require("./build_ch3");
const { ch4, references } = require("./build_ch4");

// Drop each chapter array's own leading h1() heading (index 0): the official
// template already supplies that chapter-title paragraph, so injecting the
// generated one too would duplicate the heading.
function dropLeadingHeading(arr) {
  return arr.slice(1);
}

async function main() {
  const templateBuf = fs.readFileSync(process.argv[2]);
  const outPath = process.argv[3];

  // NOTE: only PatchType.DOCUMENT body patches here. Front-page text and the
  // GitHub/YouTube hyperlinks are already injected as real XML by
  // inject-tokens.js, so no ExternalHyperlink objects ever reach
  // patchDocument (that path has a relationship-scattering bug that corrupts
  // the package).
  const doc = await patchDocument({
    outputType: "nodebuffer",
    data: templateBuf,
    keepOriginalStyles: true,
    placeholderDelimiters: { start: "<<", end: ">>" },
    patches: {
      CH1_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch1) },
      CH2_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch2) },
      CH3_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch3) },
      CH4_BODY: { type: PatchType.DOCUMENT, children: dropLeadingHeading(ch4) },
      REFERENCES_BODY: { type: PatchType.DOCUMENT, children: references.slice(1) },
    },
  });

  fs.writeFileSync(outPath, doc);
  console.log("Wrote patched document:", outPath, doc.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
