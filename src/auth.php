<?php

declare(strict_types=1);

// auth.php - Staff Key Authentication System (SECURE REFACTOR)
// Fixes Hidden Flaws D and E from the legacy version in /legacy/auth.php.

require_once __DIR__ . '/bootstrap.php';

use HealthVault\Auth\AuthService;
use HealthVault\Database\Connection;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $inputKey = $_POST['auth_key'] ?? '';
    $username = $_POST['username'] ?? '';

    $auth = new AuthService(
        (int) ($_ENV['ARGON2ID_MEMORY_COST'] ?? 65536),
        (int) ($_ENV['ARGON2ID_TIME_COST'] ?? 4),
        (int) ($_ENV['ARGON2ID_THREADS'] ?? 2),
    );

    // FIX (Flaw D — defective bound constraint): mb_strlen() counts
    // Unicode *characters*, not bytes, so a multi-byte payload can no
    // longer smuggle more semantic content past the bound than a
    // byte-counting strlen() check would permit, and cannot trigger the
    // disproportionate memory cost the legacy byte-length trap allowed.
    if (!$auth->isWithinBounds($inputKey)) {
        http_response_code(400);
        echo 'Rejected: authentication key exceeds the 256-character bound.';
        exit;
    }

    $pdo = Connection::fromEnv();
    $stmt = $pdo->prepare('SELECT auth_key_hash FROM staff_credentials WHERE username = :username');
    $stmt->bindValue(':username', $username, \PDO::PARAM_STR);
    $stmt->execute();
    $storedHash = $stmt->fetchColumn();

    // FIX (Flaw E — obsolete primitive): verification now runs through
    // password_verify() against an Argon2id hash instead of comparing
    // raw md5() digests. Argon2id is salted per-record and
    // memory/time-hard, so stealing the hash table no longer yields an
    // offline-crackable, GPU-parallel workload the way MD5 did.
    if ($storedHash !== false && $auth->verify($inputKey, $storedHash)) {
        echo 'Access Granted.';
    } else {
        http_response_code(401);
        echo 'Access Denied.';
    }
}
