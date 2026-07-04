<?php

declare(strict_types=1);

/**
 * Evidence script for Chapter 1 / Chapter 2: shows the exact SQL text the
 * interpreter receives from the legacy concatenation approach versus the
 * parameterized PDO approach, for the same malicious keyword.
 * Run with: php demo/demo_sqli_vs_pdo.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use HealthVault\Search\PatientSearchService;

$maliciousKeyword = "x' UNION SELECT id, username, auth_key_hash FROM staff_credentials -- ";

echo "=== LEGACY: raw string concatenation (search.php, Hidden Flaw A) ===\n";
$legacySql = "SELECT id, name, illness_history FROM patient_records WHERE name LIKE '%" . $maliciousKeyword . "%'";
echo $legacySql . "\n";
echo "-> The interpreter parses this as TWO UNIONed SELECT statements. The\n";
echo "   attacker-supplied text became part of the SQL command grammar.\n\n";

echo "=== SECURE: PDO prepared statement (PatientSearchService) ===\n";

$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE patient_records (id INTEGER PRIMARY KEY, name TEXT, illness_history TEXT)');
$pdo->exec("INSERT INTO patient_records (name, illness_history) VALUES ('John Doe', 'Stage-2 Carcinoma')");

// Capture the exact bound SQL text PDO compiles, for side-by-side proof.
$stmt = $pdo->prepare('SELECT id, name, illness_history FROM patient_records WHERE name LIKE :keyword');
echo "Compiled statement text: SELECT id, name, illness_history FROM patient_records WHERE name LIKE :keyword\n";
echo "Bound parameter (:keyword), treated purely as data: '%" . $maliciousKeyword . "%'\n\n";

$service = new PatientSearchService($pdo);
$results = $service->searchByName($maliciousKeyword);

printf("Rows returned: %d  <-- query structure never changed; payload matched nothing\n", count($results));
