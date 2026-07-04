const G = require("./gen");
const {
  h1, h2, h3, p, bold, italic, plain, bullet, figCaption, tblCaption,
  codeBlock, twoColCodeTable, dataTable, pageBreak,
  Paragraph, TextRun, AlignmentType,
} = G;

const ch2 = [
  h1("CHAPTER 2: SECURE REFACTORING IMPLEMENTATION & EXPLOIT-CHAIN DISRUPTION MATRIX"),

  h2("2.1 Introduction"),
  p("This chapter documents the structural remediation applied to search.php and auth.php. Each subsection isolates the specific interpreter-level mechanism the vulnerable code relied on, contrasts it with the mechanism the refactored code relies on instead, and embeds the full before/after source as a split-screen comparison table. The complete refactored codebase is version-controlled under HealthVault-Secure/src/, with the untouched legacy artefacts preserved under HealthVault-Secure/legacy/ for direct diffing."),

  h2("2.2 Structural Dissection & Deconstruction of search.php"),

  h3("2.2.1 Data-Plane vs. Command-Plane Compilation"),
  p("PHP's mysqli::query() sends a single string to the MySQL server, which then performs lexing, parsing, and query-plan compilation on that entire string as one unit. There is no phase in this lifecycle where the server can distinguish 'text the developer wrote' from 'text a user supplied' — both are simply bytes in the same command-plane buffer at the moment parsing begins. Raw concatenation (Section 1.3) therefore forces 100% of the incoming keyword through the command-plane compiler, where SQL metacharacters (', --, ;, UNION) are interpreted as grammar rather than as inert data."),

  h3("2.2.2 Structural Memory Isolation via PDO Prepared Statements"),
  p("Migrating the data-access layer to PHP Data Objects (PDO) with native prepared statements changes this lifecycle fundamentally. PDOStatement::prepare() sends only the fixed query template — containing a named placeholder such as :keyword — to the database driver, which compiles and caches an execution plan for that template before any user data is transmitted. A second, separate protocol message then binds the actual keyword value to the placeholder. Because the value arrives after compilation has already fixed the query's structure, the database engine has no grammar-parsing step left to apply to it: the bound value can only ever be interpreted as the literal contents of a column-comparison operand, regardless of which characters it contains. This is why the setting PDO::ATTR_EMULATE_PREPARES to false (configured in src/Database/Connection.php) matters: with emulation enabled, PDO itself would locally interpolate the bound value into the SQL text before sending it to the driver — collapsing the same data/command separation the refactor is meant to restore. With emulation disabled, the database driver performs genuine server-side parameter binding."),

  h3("2.2.3 Contextual Boundary Shift: HTML Output Encoding"),
  p("General-purpose input sanitisation (e.g., stripping or blacklisting characters like < and >  at the point of input) fails structurally because a single piece of data can legitimately cross multiple, differently-contexted output boundaries: the same keyword may need to appear inside an HTML text node, inside an HTML attribute, inside a URL, or inside a SQL LIKE clause, and each context has a different set of characters that are dangerous and a different escaping grammar. Blacklisting at the input boundary either breaks legitimate input (e.g., a patient named O'Brien) or misses an encoding the developer did not anticipate. htmlspecialchars() instead performs context-aware output encoding at the exact point data is serialised into a specific context — HTML text content — translating <, >, &, \", and ' into their corresponding HTML entities (&lt;, &gt;, &amp;, &quot;, &#039;) immediately before the string is written into the response body. The underlying data is never mutated; only its output representation for that one context changes. This is why the refactor calls htmlspecialchars() at the echo site rather than filtering $_GET['keyword'] on input — the same $keyword variable can still be safely used, unescaped, inside the PDO bound parameter (Section 2.2.2), because SQL-context safety and HTML-context safety are enforced independently, each at its own boundary."),

  h3("2.2.4 Before / After Comparison — search.php"),
  tblCaption("search.php — vulnerable legacy logic vs. refactored secure logic"),
  twoColCodeTable(
    "BEFORE (legacy/search.php) — Hidden Flaws A, B, C",
    "AFTER (src/search.php + PatientSearchService) — Fixed",
    [
      "$keyword = $_GET['keyword'];",
      "",
      "// Flaw A: raw concatenation",
      "$sql = \"SELECT id, name, illness_history\"",
      "     . \" FROM patient_records WHERE name\"",
      "     . \" LIKE '%\" . $keyword . \"%'\";",
      "$result = $conn->query($sql);",
      "",
      "while ($row = $result->fetch_assoc()) {",
      "  // Flaw B: unencoded echo",
      "  echo \"<div>Result for: \" . $keyword",
      "     . \"<br>Patient: \" . $row['name']",
      "     . \" | History: \"",
      "     . $row['illness_history']",
      "     . \"</div><hr>\";",
      "}",
      "// Flaw C: unencoded error echo",
      "echo \"No records found for: \" . $keyword;",
    ],
    [
      "$keyword = $_GET['keyword'] ?? '';",
      "",
      "// FIX A: PDO prepared statement —",
      "// keyword is bound, never concatenated",
      "$pdo = Connection::fromEnv();",
      "$service = new PatientSearchService($pdo);",
      "$rows = $service->searchByName($keyword);",
      "",
      "// FIX B/C: htmlspecialchars() at the",
      "// exact HTML-context output boundary",
      "function e(string $v): string {",
      "  return htmlspecialchars(",
      "    $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'",
      "  );",
      "}",
      "foreach ($rows as $row) {",
      "  echo '<div>Result for: '.e($keyword)",
      "     . '<br>Patient: '.e($row['name'])",
      "     . ' | History: '",
      "     . e($row['illness_history'])",
      "     . '</div><hr>';",
      "}",
    ]
  ),

  h2("2.3 Boundary Characterization & Cryptographic Profiling of auth.php"),

  h3("2.3.1 Raw Byte-Allocation vs. Semantic Character-Length Boundary"),
  p("As established in Section 1.5, strlen() operates on the byte buffer underlying a PHP string, while mb_strlen($value, 'UTF-8') walks that same buffer applying the UTF-8 continuation-byte rules to count logical Unicode code points. The refactored AuthService::isWithinBounds() method replaces the byte-counting guard with mb_strlen($inputKey, 'UTF-8') <= 256, so the enforced limit and the developer's intended limit (256 human-readable characters) are now the same quantity, regardless of how many bytes each character occupies on the wire."),

  h3("2.3.2 MD5 vs. Memory-Hard Hashing — Structural and Mathematical Analysis"),
  p("MD5 is a fast, fixed-cost Merkle-Damgard hash function with a 128-bit digest. Its design goal was throughput and collision resistance for checksumming, not credential storage, and it has three properties that make it structurally unsuitable here: (1) it is unsalted at the algorithm level, so identical inputs always produce identical digests, enabling precomputed rainbow-table attacks across every account sharing a password; (2) it is computationally cheap — modern GPUs compute billions of MD5 digests per second, so an offline attacker who obtains the auth_key_hash column (as would follow from the SQL injection in Section 1.3) can exhaustively brute-force short keys in a trivial amount of wall-clock time; and (3) MD5 has known cryptanalytic collision weaknesses (Wang & Yu, 2005) that, while more relevant to signature forgery than password cracking, further evidence that the primitive has been deprecated by NIST and the wider cryptographic community for any security-relevant purpose."),
  p("Argon2id (accessed in PHP via password_hash($key, PASSWORD_ARGON2ID, [...])) is a memory-hard key-derivation function and the winner of the 2015 Password Hashing Competition. It takes three explicit cost parameters — memory_cost (KiB of RAM required per hash computation), time_cost (number of internal passes), and threads — and combines a per-hash random salt with a data-independent first pass (resisting one class of side-channel/GPU-friendly attack) and a data-dependent second pass (resisting time-memory trade-off precomputation). Because memory_cost forces every parallel hashing attempt to allocate its own large memory region, the attacker's achievable degree of parallelism on a GPU or ASIC is bounded by available memory bandwidth rather than by raw compute throughput — this is the 'memory-hardness' property that specifically neutralises the economics of GPU/ASIC password cracking that make MD5 (and even un-tuned bcrypt/PBKDF2) comparatively weak."),

  h3("2.3.3 Migrating to Argon2id — Micro-Architectural Disruption of Cracking Pipelines"),
  p("A brute-force attacker's throughput is approximately: attempts/second = (available compute or memory bandwidth) / (cost per attempt). Raising memory_cost directly raises the denominator for every attempt in a way that cannot be amortised across parallel attempts sharing a GPU's compute cores, because each attempt needs its own dedicated memory region of that size. Raising time_cost adds sequential internal iterations that cannot be skipped or parallelised within a single hash computation. Together, these parameters let the defender tune the primitive so that a legitimate login (one hash computation, tolerable latency) remains fast, while an offline dictionary/brute-force campaign (billions of attempts) becomes economically infeasible on commodity or even specialised cracking hardware — a property MD5, having no cost parameters at all, cannot offer at any configuration."),

  h3("2.3.4 Before / After Comparison — auth.php"),
  tblCaption("auth.php — vulnerable legacy logic vs. refactored secure logic"),
  twoColCodeTable(
    "BEFORE (legacy/auth.php) — Hidden Flaws D, E",
    "AFTER (src/auth.php + AuthService) — Fixed",
    [
      "$inputKey = $_POST['auth_key'];",
      "",
      "// Flaw D: byte-length bound check",
      "if (strlen($inputKey) > 256) {",
      "  die(\"Fatal Error: Bound overflow\"",
      "    . \" detected.\");",
      "}",
      "",
      "// Flaw E: unsalted MD5 comparison",
      "$stored_hash =",
      "  \"098f6bcd4621d373cade4e832627b4f6\";",
      "if (md5($inputKey) === $stored_hash) {",
      "  echo \"Access Granted.\";",
      "}",
    ],
    [
      "$inputKey = $_POST['auth_key'] ?? '';",
      "$auth = new AuthService(",
      "  memoryCost: 65536, timeCost: 4,",
      "  threads: 2",
      ");",
      "",
      "// FIX D: character-accurate bound",
      "if (!$auth->isWithinBounds($inputKey)) {",
      "  http_response_code(400);",
      "  echo 'Rejected: exceeds 256 chars.';",
      "  exit;",
      "}",
      "",
      "// FIX E: Argon2id, timing-safe verify",
      "$stmt = $pdo->prepare(",
      "  'SELECT auth_key_hash FROM ' .",
      "  'staff_credentials WHERE username=:u'",
      ");",
      "$stmt->execute(['u' => $username]);",
      "$hash = $stmt->fetchColumn();",
      "if ($hash && $auth->verify($inputKey,",
      "    $hash)) {",
      "  echo 'Access Granted.';",
      "}",
    ]
  ),

  h2("2.4 Exploit-Chain Disruption Matrix & Logical Defense"),

  h3("2.4.1 Before/After Structural Framework"),
  p("Table 3 consolidates every modified code fragment against the exploit technique it neutralises, the interpreter-level mechanism responsible, and the residual risk (if any) that remains out of scope for this remediation pass."),
  tblCaption("Exploit-chain disruption matrix"),
  dataTable(
    ["Exploit stage", "Legacy mechanism exploited", "Refactor that breaks it", "Interpreter-level guarantee"],
    [
      ["Stage 1 — SQLi recon/dump", "String concatenation lets input reach the SQL grammar parser", "PDO prepared statement, EMULATE_PREPARES=false", "Bound values are transmitted after query-plan compilation; cannot alter grammar"],
      ["Stage 2 — reflected script execution", "Unescaped echo lets input reach the HTML/DOM parser as markup", "htmlspecialchars(ENT_QUOTES) at every output site", "Metacharacters are replaced by inert HTML entities before serialization"],
      ["Stage 3 — auth bound bypass", "strlen() miscounts multi-byte input, breaking the intended limit", "mb_strlen($v,'UTF-8') <= 256", "Boundary is evaluated in the same unit (characters) the limit was specified in"],
      ["Stage 4 — offline credential cracking", "MD5 is unsalted and computationally cheap to brute-force at scale", "Argon2id via password_hash()/password_verify()", "Per-hash salt + tunable memory/time cost bound attacker throughput"],
    ],
    [16, 26, 26, 32]
  ),

  h3("2.4.2 Logical Exploit Pathway Trace"),
  p("The original attack chain observed by the client hospital's CERT (Section: Post-Breach Incident Chronology) proceeded: (i) an attacker submits a crafted keyword to search.php, exploiting Flaw A to enumerate or dump patient_records and, via UNION, the staff_credentials table; (ii) the exfiltrated auth_key_hash values, being unsalted MD5, are fed to an offline GPU cracking rig and reversed to plaintext keys (Flaw E); (iii) those plaintext keys are replayed against auth.php to obtain ephemeral 'Physician' sessions authorized to approve narcotic dispensations (the Authentication Bypass Traversal noted in the case study); (iv) in parallel, any reflected-XSS-bearing link (Flaw B/C) sent to a legitimate clinician's session could hijack their already-authenticated cookie, bypassing the need to crack a hash at all. Each refactor in this chapter removes one link: PDO prepared statements deny Stage (i) at the interpreter level (the UNION payload cannot alter query grammar, so no cross-table dump occurs); Argon2id denies Stage (ii) by making the stolen digest computationally infeasible to reverse within an actionable time window; the character-accurate bound denies the resource-exhaustion variant of Stage (iii); and htmlspecialchars() denies Stage (iv) by ensuring no reflected payload can execute as script in any client browser."),

  h3("2.4.3 Why Structural Boundaries Reject Payloads Without Signature Matching"),
  p("None of the four fixes rely on recognising a specific attack signature (e.g., blacklisting the string UNION or <script>). Instead, each fix relocates the trust boundary to a point in the runtime where the dangerous interpretation is structurally impossible: a bound SQL parameter is never re-parsed as grammar no matter what bytes it contains; an HTML-entity-encoded string is never re-parsed as a tag no matter what bytes it contains; a character-count bound is correct for any Unicode content because it operates on the same unit as the specification; and an Argon2id hash's cost is enforced by the algorithm itself, independent of what the underlying plaintext key looks like. This is why the refactor generalises to payloads not explicitly tested here — the defense is a property of the mechanism, not a list of forbidden strings."),

  h2("2.5 Chapter Summary"),
  p("This chapter delivered a line-level, mechanism-level remediation of search.php and auth.php, embedded as before/after code tables, and traced how each fix independently severs one stage of the observed multi-stage breach. Chapter 3 extends this treatment to the cryptographic subsystem, replacing crypto_vault.php's AES-128-ECB routine with an authenticated AES-256-GCM pipeline and formalising the associated key-management and automated-testing controls."),
  pageBreak(),
];

module.exports = { ch2 };
