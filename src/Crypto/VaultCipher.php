<?php

declare(strict_types=1);

namespace HealthVault\Crypto;

/**
 * Thrown whenever the AEAD authentication tag fails to verify, i.e. the
 * ciphertext or tag was tampered with, truncated, or paired with the wrong
 * key/IV. Kept distinct from generic RuntimeException so callers can trap
 * it without accidentally swallowing unrelated failures.
 */
final class VaultIntegrityException extends \RuntimeException
{
}

/**
 * AES-256-GCM replacement for the legacy AES-128-ECB routine in
 * crypto_vault.php.
 *
 * Wire format (single base64 string so it round-trips safely through JSON /
 * databases / HTTP bodies as plain text):
 *
 *   base64( IV[12 bytes] || TAG[16 bytes] || CIPHERTEXT[n bytes] )
 *
 * The IV and tag are fixed-length and placed before the ciphertext, so
 * unpacking never needs a delimiter that could collide with ciphertext
 * bytes — the split points are byte offsets, not string search.
 */
final class VaultCipher
{
    private const CIPHER = 'aes-256-gcm';
    private const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
    private const TAG_LENGTH = 16;  // 128-bit authentication tag

    /** @var string raw 32-byte (256-bit) key */
    private string $key;

    public function __construct(string $keyBase64)
    {
        $key = base64_decode($keyBase64, true);
        if ($key === false || strlen($key) !== 32) {
            throw new \InvalidArgumentException(
                'CRYPTO_VAULT_KEY_B64 must decode to exactly 32 bytes (AES-256).'
            );
        }
        $this->key = $key;
    }

    /**
     * Encrypts plaintext and returns the packed, base64-encoded envelope.
     * A fresh random IV is generated on every call — GCM security depends
     * on the (key, IV) pair never repeating.
     */
    public function encrypt(string $plaintext): string
    {
        $iv = random_bytes(self::IV_LENGTH);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',                 // no additional authenticated data (AAD)
            self::TAG_LENGTH
        );

        if ($ciphertext === false) {
            throw new \RuntimeException('AES-256-GCM encryption failed at the OpenSSL layer.');
        }

        return base64_encode($iv . $tag . $ciphertext);
    }

    /**
     * Unpacks and decrypts an envelope produced by encrypt().
     *
     * @throws VaultIntegrityException if the tag does not verify (tampered
     *         ciphertext, wrong key, or corrupted envelope) — this is the
     *         secure, isolated failure state contrasted against an
     *         unhandled fatal error in the documentation.
     */
    public function decrypt(string $envelopeBase64): string
    {
        $envelope = base64_decode($envelopeBase64, true);
        if ($envelope === false || strlen($envelope) < self::IV_LENGTH + self::TAG_LENGTH) {
            throw new VaultIntegrityException('Envelope is malformed or too short to contain IV+tag.');
        }

        $iv = substr($envelope, 0, self::IV_LENGTH);
        $tag = substr($envelope, self::IV_LENGTH, self::TAG_LENGTH);
        $ciphertext = substr($envelope, self::IV_LENGTH + self::TAG_LENGTH);

        // openssl_decrypt() returns false (not an exception) on tag
        // mismatch — we translate that into a typed exception so callers
        // cannot accidentally treat `false` as valid plaintext.
        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($plaintext === false) {
            throw new VaultIntegrityException('Authentication tag mismatch: ciphertext failed AEAD verification.');
        }

        return $plaintext;
    }
}
