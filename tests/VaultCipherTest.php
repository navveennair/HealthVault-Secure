<?php

declare(strict_types=1);

namespace HealthVault\Tests;

use HealthVault\Crypto\VaultCipher;
use HealthVault\Crypto\VaultIntegrityException;
use PHPUnit\Framework\TestCase;

final class VaultCipherTest extends TestCase
{
    private VaultCipher $cipher;

    protected function setUp(): void
    {
        // Fixed test key so results are reproducible; production keys
        // always come from CRYPTO_VAULT_KEY_B64 via .env, never a literal.
        $this->cipher = new VaultCipher(base64_encode(str_repeat("\x01", 32)));
    }

    /** Untampered cryptographic lifecycle: encrypt -> decrypt returns the original plaintext. */
    public function testEncryptDecryptRoundTripReturnsOriginalPlaintext(): void
    {
        $plaintext = 'DIAGNOSIS: Stage-2 Carcinoma. TREATMENT: Chemotherapy cycle 1. STATUS: Critical.';

        $envelope = $this->cipher->encrypt($plaintext);
        $recovered = $this->cipher->decrypt($envelope);

        $this->assertSame($plaintext, $recovered);
    }

    /** Two encryptions of identical plaintext never produce identical ciphertext (fresh IV per call, no ECB-style pattern leakage). */
    public function testIdenticalPlaintextProducesDifferentEnvelopes(): void
    {
        $plaintext = 'DIAGNOSIS: Stage-2 Carcinoma. TREATMENT: Chemotherapy cycle 1. STATUS: Critical.';

        $envelopeA = $this->cipher->encrypt($plaintext);
        $envelopeB = $this->cipher->encrypt($plaintext);

        $this->assertNotSame($envelopeA, $envelopeB);
    }

    /** Envelope is well-formed: base64( 12-byte IV || 16-byte tag || ciphertext ). */
    public function testEnvelopeContainsExpectedIvAndTagLengths(): void
    {
        $envelope = $this->cipher->encrypt('short payload');
        $raw = base64_decode($envelope, true);

        $this->assertNotFalse($raw);
        $this->assertGreaterThan(12 + 16, strlen($raw));
    }

    /** Tampered ciphertext execution path: flipping one byte must throw VaultIntegrityException, not return corrupted plaintext. */
    public function testTamperedCiphertextThrowsIntegrityException(): void
    {
        $envelope = $this->cipher->encrypt('sensitive narcotic dosage: 5mg every 8 hours');
        $raw = base64_decode($envelope, true);

        // Flip a bit inside the ciphertext region (after the 12-byte IV
        // and 16-byte tag) to simulate an adversary tampering in transit.
        $tamperedOffset = 12 + 16;
        $raw[$tamperedOffset] = chr(ord($raw[$tamperedOffset]) ^ 0xFF);
        $tamperedEnvelope = base64_encode($raw);

        $this->expectException(VaultIntegrityException::class);
        $this->cipher->decrypt($tamperedEnvelope);
    }

    /** A truncated/malformed envelope (too short for IV+tag) fails closed with the same typed exception. */
    public function testMalformedEnvelopeThrowsIntegrityException(): void
    {
        $this->expectException(VaultIntegrityException::class);
        $this->cipher->decrypt(base64_encode('too-short'));
    }

    public function testRejectsKeyThatIsNotExactly32BytesAfterDecoding(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new VaultCipher(base64_encode('short-key'));
    }
}
