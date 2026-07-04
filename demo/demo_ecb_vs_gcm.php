<?php

declare(strict_types=1);

/**
 * Evidence script for Chapter 1 / Chapter 3: demonstrates ECB pattern
 * leakage against the legacy cipher, then shows AES-256-GCM producing
 * non-repeating ciphertext for the same repeated plaintext blocks.
 * Run with: php demo/demo_ecb_vs_gcm.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use HealthVault\Crypto\VaultCipher;

echo "=== LEGACY: AES-128-ECB (crypto_vault.php, Hidden Flaw F) ===\n";

$legacyKey = "MedVaultKey123!"; // hardcoded key, Hidden Flaw G
// Two identical, exactly-16-byte-aligned AES blocks, as would occur
// across two patient records sharing the same diagnosis prefix (see
// schema.sql seed data: two "DIAGNOSIS: Stage-2 Carcinoma..." rows).
$sixteenByteBlock = substr('DIAGNOSIS: Stage', 0, 16); // exactly 16 bytes
$repeatingPlaintext = str_repeat($sixteenByteBlock, 2);  // block 1 === block 2

$ecbCiphertext = openssl_encrypt($repeatingPlaintext, 'aes-128-ecb', $legacyKey, OPENSSL_RAW_DATA);
$blockA = bin2hex(substr($ecbCiphertext, 0, 16));
$blockB = bin2hex(substr($ecbCiphertext, 16, 16));

printf("Plaintext block 1 == block 2: %s\n", (substr($repeatingPlaintext, 0, 16) === substr($repeatingPlaintext, 16, 16)) ? 'true' : 'false');
printf("Ciphertext block 1 (hex): %s\n", $blockA);
printf("Ciphertext block 2 (hex): %s\n", $blockB);
printf("Ciphertext blocks identical: %s  <-- pattern leakage\n\n", ($blockA === $blockB) ? 'TRUE (leak)' : 'false');

echo "=== SECURE: AES-256-GCM (VaultCipher, refactored) ===\n";

$cipher = new VaultCipher(base64_encode(random_bytes(32)));
$envelope1 = $cipher->encrypt($repeatingPlaintext);
$envelope2 = $cipher->encrypt($repeatingPlaintext);

printf("Envelope 1 (base64): %s\n", $envelope1);
printf("Envelope 2 (base64): %s\n", $envelope2);
printf("Envelopes identical for identical plaintext: %s  <-- no pattern leakage (fresh IV each call)\n", ($envelope1 === $envelope2) ? 'true (BUG)' : 'FALSE (secure)');
