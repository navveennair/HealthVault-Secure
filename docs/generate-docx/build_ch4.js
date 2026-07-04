const G = require("./gen");
const {
  h1, h2, h3, p, bold, italic, plain, bullet, figCaption, tblCaption,
  codeBlock, dataTable, pageBreak,
} = G;

const ch4 = [
  h1("CHAPTER 4: SYSTEMIC VULNERABILITY CORRELATION, FORENSIC DOCUMENTATION, & ARCHITECTURAL SYNTHESIS"),

  h2("4.1 Forensic Exploit-Chain Dependency Analysis"),
  p("The three files audited in Chapters 1-3 were not independent point failures; they formed a single cascading exploit chain, reconstructed below in the order the case study's Post-Breach Incident Chronology implies."),

  h3("4.1.1 Root Cause: Data-Access-Plane Failure (Flaw A) Enables Full Database Dumping"),
  p("search.php's unparameterised query gave any unauthenticated client the ability to inject arbitrary SELECT/UNION clauses into a root-privileged database session (Section 1.3, Section 2.2). This is the root node of the dependency graph: every subsequent stage of the breach requires data that only this flaw could supply. Without Flaw A, an attacker has no channel to read staff_credentials, patient_records, or any other table beyond what the application's intended query already exposes."),

  h3("4.1.2 Relational Link: Exposed MD5 State Enables Credential Reversal"),
  p("Because auth.php stored credentials as unsalted MD5 digests (Flaw E), the auth_key_hash column exfiltrated via Flaw A was not merely 'data' in the abstract sense used in Section 1.7 — it was directly, offline reversible. MD5's negligible per-attempt cost (Section 2.3.2) means the entire staff_credentials table, once dumped, can be brute-forced or rainbow-table-matched to recover plaintext physician keys in a timeframe measured in minutes to hours on commodity GPU hardware, entirely outside the application's monitoring or rate-limiting reach (since the cracking happens offline, against the raw hash, not against the live auth.php endpoint). This is the exact mechanism the case study describes as the Authentication Bypass Traversal: 'ephemeral, unverified Physician accounts utilizing structurally anomalous, randomly generated credential strings' are precisely what a successful offline MD5 crack yields — the recovered key is a random-looking string with no relationship to a memorable password, because it was never chosen by a human; it was mathematically reversed from a stolen digest."),

  h3("4.1.3 Cascading Collapse Across Module Boundaries"),
  p("Table 4 traces the complete cross-file cascade, demonstrating that a single input-validation defect in one module (search.php) directly collapsed the security boundary of an entirely separate module (auth.php) that shares no code path with it — the two modules are linked only by the shared database and the shared weak hashing choice, which is precisely why the audit in Chapters 1-3 treats them as a single system rather than as three unrelated code reviews."),
  tblCaption("Cross-module exploit-chain dependency trace"),
  dataTable(
    ["Stage", "Module", "Precondition", "Outcome / enables"],
    [
      ["1", "search.php", "Attacker-controlled keyword parameter reaches an unparameterised query", "Full read access to patient_records and staff_credentials via UNION-based SQLi"],
      ["2", "auth.php (data)", "staff_credentials.auth_key_hash values obtained from Stage 1", "Offline MD5 brute-force yields plaintext physician auth keys"],
      ["3", "auth.php (endpoint)", "Valid plaintext auth key obtained from Stage 2", "Authenticated 'Physician' session used to approve narcotic dispensations"],
      ["4", "crypto_vault.php", "Same root-level DB access from Stage 1 also exposes AES-128-ECB-encrypted payload columns", "Ciphertext block-pattern analysis (Section 1.6) reveals relational structure between patient records even without breaking the key"],
    ],
    [8, 20, 36, 36]
  ),
  p("Remediating any single stage in isolation — for example, upgrading only the hashing algorithm without fixing the SQL injection — would have left the chain intact, because the attacker would simply pivot to a different exfiltration channel to reach the same credential table. This is why Chapters 1-3 apply the fix at every stage: PDO prepared statements sever Stage 1 (denying the initial dump entirely), and Argon2id independently raises the cost of Stage 2 even in the hypothetical event that some other exfiltration channel is later discovered — a defense-in-depth posture rather than a single point fix."),

  h2("4.2 Structural Synthesis, Typological Coherence, & Technical Clarity"),
  p("Chapters 1-3 present every code remediation as a labelled split-screen Before/After table (Tables in Sections 2.2.4 and 2.3.4), every runtime claim as a captioned, numbered Figure reproducing an actual terminal transcript rather than a hypothetical one, and every cross-cutting relationship (vulnerability -> principle -> PDPA clause -> exploit stage) as a structured data table rather than free prose. This consistent typological pattern — Figure for terminal/runtime evidence, Table for structural/comparative claims — is maintained across all four chapters so that a reader can locate any category of evidence by its caption alone, satisfying the requirement for an analytical flow that binds the payload-delivery phase (Chapters 1-2) to the exception-trapping verification phase (Chapter 3, Section 3.7)."),
  p("Figure 4 (below) is the single consolidated architecture view referenced throughout this chapter, showing the full cascade of Table 4 as a directional flow."),
  figCaption("Consolidated exploit-chain and remediation architecture"),
  codeBlock([
    "[ Attacker ]",
    "     |  malicious ?keyword=  (Section 1.3 / 2.2)",
    "     v",
    "[ search.php ]  --(Flaw A: raw SQL concat)-->  [ patient_records, staff_credentials ]",
    "     |                                                    |",
    "     | (Flaw B/C: reflected XSS,                          | dumped auth_key_hash (MD5)",
    "     |  session hijack path)                              v",
    "     v                                          [ Offline MD5 brute-force / rainbow table ]",
    "[ Victim clinician session ]                               |",
    "                                                           v",
    "                                          [ auth.php ]  <-- plaintext physician key replayed",
    "                                                |",
    "                                                v",
    "                                 [ Forged 'Physician' session --",
    "                                   unauthorized narcotic dispensation ]",
    "",
    "REMEDIATION (Chapters 2-3): PDO prepared statements sever the top edge;",
    "Argon2id raises the cost of the middle edge; htmlspecialchars() severs",
    "the session-hijack edge; AES-256-GCM removes the pattern-leak edge on",
    "the crypto_vault.php payload store.",
  ]),

  h2("4.3 Chapter Summary & Conclusion"),
  p("This document has traced the MediChain / E-MedicVault breach from its root cause — a single unparameterised SQL query — through its cascading compromise of the authentication and cryptographic subsystems, and delivered a fully tested, environment-isolated, AEAD-secured refactor for all three implicated files. The accompanying PHPUnit suite (Chapter 3, Section 3.7) provides continuous, automated evidence that the fixes hold under both correct-use and adversarial-input conditions, and the GitHub repository referenced on the front page preserves the untouched legacy artefacts alongside the refactor for direct auditability. The overarching lesson of this incident is architectural rather than incidental: every hidden flaw audited in this report is a well-known, independently detectable defect class (OWASP Top 10 categories A02 and A03, and CWE-798/CWE-1284), and a properly resourced Secure Software Development Lifecycle — specifically the SAST and penetration-testing stages MediChain's leadership chose to omit under the 72-hour Phase 2 deadline — would very likely have surfaced each of them before Phase 2 reached production."),
  pageBreak(),
];

// =====================================================================
// REFERENCES (APA, alphabetical)
// =====================================================================
const references = [
  h1("REFERENCES"),
  p("Aumasson, J.-P., Neves, S., Wilcox-O'Hearn, Z., & Winnerlein, C. (2013). BLAKE2: Simpler, smaller, fast as MD5. In M. Jacobson, M. Locasto, P. Mohassel, & R. Safavi-Naini (Eds.), Applied Cryptography and Network Security (pp. 119-135). Springer."),
  p("Biryukov, A., Dinu, D., & Khovratovich, D. (2016). Argon2: The memory-hard function for password hashing and other applications (Version 1.3). Password Hashing Competition. https://www.password-hashing.net/argon2-specs.pdf"),
  p("Dworkin, M. J. (2007). Recommendation for block cipher modes of operation: Galois/Counter Mode (GCM) and GMAC (NIST Special Publication 800-38D). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-38D"),
  p("Laws of Malaysia. (2010). Personal Data Protection Act 2010 (Act 709). Attorney General's Chambers of Malaysia."),
  p("OWASP Foundation. (2021). OWASP Top 10:2021 — A02 Cryptographic Failures. https://owasp.org/Top10/A02_2021-Cryptographic_Failures/"),
  p("OWASP Foundation. (2021). OWASP Top 10:2021 — A03 Injection. https://owasp.org/Top10/A03_2021-Injection/"),
  p("OWASP Foundation. (2023). OWASP Cheat Sheet Series — Cross Site Scripting Prevention. https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"),
  p("OWASP Foundation. (2023). OWASP Cheat Sheet Series — Query Parameterization. https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html"),
  p("PHP Documentation Group. (2024). PDO prepared statements and stored procedures. PHP Manual. https://www.php.net/manual/en/pdo.prepared-statements.php"),
  p("PHP Documentation Group. (2024). password_hash — Create a password hash. PHP Manual. https://www.php.net/manual/en/function.password-hash.php"),
  p("PHP Documentation Group. (2024). Strings — Byte vs. multibyte handling (mbstring). PHP Manual. https://www.php.net/manual/en/book.mbstring.php"),
  p("Rivest, R. (1992). The MD5 message-digest algorithm (RFC 1321). Internet Engineering Task Force. https://www.rfc-editor.org/rfc/rfc1321"),
  p("Wang, X., & Yu, H. (2005). How to break MD5 and other hash functions. In R. Cramer (Ed.), Advances in Cryptology — EUROCRYPT 2005 (pp. 19-35). Springer."),
];

module.exports = { ch4, references };
