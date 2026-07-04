<?php

declare(strict_types=1);

// search.php - Patient & Medical Record Search Proxy (SECURE REFACTOR)
// Fixes Hidden Flaws A, B, C from the legacy version in /legacy/search.php.

require_once __DIR__ . '/bootstrap.php';

use HealthVault\Database\Connection;
use HealthVault\Search\PatientSearchService;

$keyword = $_GET['keyword'] ?? '';

// FIX (Flaw A — SQL Injection): the query is no longer built by string
// concatenation. PatientSearchService binds $keyword as a PDO parameter,
// so the interpreter compiles the SQL text first and the user-supplied
// value is only ever bound to a placeholder afterwards — it cannot alter
// the command structure regardless of quotes, comments, or UNION syntax.
$pdo = Connection::fromEnv();
$service = new PatientSearchService($pdo);
$rows = $service->searchByName($keyword);

// FIX (Flaws B & C — Reflected XSS): every value that originated from the
// client or the database is passed through htmlspecialchars() before it
// touches the HTML response, so `<`, `>`, `"`, `'`, `&` are rendered as
// inert text glyphs instead of being re-parsed as markup/script by the
// browser. This is context-aware encoding, not input filtering — the data
// itself is never mutated, only its output representation.
function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

if (count($rows) > 0) {
    foreach ($rows as $row) {
        echo '<div>Result found for keyword: ' . e($keyword) . '<br>';
        echo 'Patient: ' . e($row['name']) . ' | History: ' . e($row['illness_history']) . '</div><hr>';
    }
} else {
    echo 'No records found for: ' . e($keyword);
}
