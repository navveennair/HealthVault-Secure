<?php

declare(strict_types=1);

// crypto_vault.php - Patient Medical Records Symmetric Protection (SECURE REFACTOR)
// Fixes Hidden Flaws F and G from the legacy version in /legacy/crypto_vault.php.

require_once __DIR__ . '/bootstrap.php';

use HealthVault\Crypto\VaultCipher;
use HealthVault\Crypto\VaultIntegrityException;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $medical_payload = $_POST['payload'] ?? '';

    // FIX (Flaw G — hardcoded key): the key is loaded from the environment
    // (.env -> CRYPTO_VAULT_KEY_B64), never written into source.
    $cipher = new VaultCipher($_ENV['CRYPTO_VAULT_KEY_B64']);

    // FIX (Flaw F — ECB pattern leakage): AES-256-GCM is an AEAD mode.
    // Every block is chained through a fresh, random IV and the whole
    // ciphertext is bound to a 16-byte authentication tag, so identical
    // plaintext blocks never produce identical ciphertext blocks the way
    // stateless ECB does — there is no repeating pattern for an attacker
    // to fingerprint.
    $envelope = $cipher->encrypt($medical_payload);

    echo json_encode(['status' => 'vaulted', 'data' => $envelope]);
}

/**
 * Companion decrypt endpoint. Demonstrates the RUNTIME TRAP called out in
 * the legacy file's comment: naively calling openssl_decrypt() with GCM
 * and an invalid/tampered tag returns `false` with no exception, and code
 * that doesn't check for `false` explicitly will silently treat forged
 * ciphertext as valid plaintext. VaultCipher::decrypt() closes that gap by
 * converting the false-return into a typed VaultIntegrityException, which
 * this endpoint traps into an isolated HTTP 422 rather than allowing an
 * unhandled fatal error (or worse, undetected data corruption) to
 * propagate.
 */
function handleDecrypt(VaultCipher $cipher, string $envelope): void
{
    try {
        $plaintext = $cipher->decrypt($envelope);
        echo json_encode(['status' => 'unvaulted', 'data' => $plaintext]);
    } catch (VaultIntegrityException $e) {
        http_response_code(422);
        echo json_encode(['status' => 'rejected', 'error' => 'Integrity check failed: ' . $e->getMessage()]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['decrypt_envelope'])) {
    $cipher = new VaultCipher($_ENV['CRYPTO_VAULT_KEY_B64']);
    handleDecrypt($cipher, $_POST['decrypt_envelope']);
}
