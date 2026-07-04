<?php

declare(strict_types=1);

namespace HealthVault\Auth;

/**
 * Replacement for the legacy MD5 + byte-length check in auth.php.
 *
 * Two independent defects are fixed here:
 *  - Hidden Flaw D (bound constraint): strlen() counts bytes, not
 *    characters. A multi-byte UTF-8 payload can pass a byte-based bound
 *    check while containing far fewer semantic characters than intended,
 *    or trip the bound with a small number of visible characters. We use
 *    mb_strlen($input, 'UTF-8') to bound the actual character count.
 *  - Hidden Flaw E (weak primitive): MD5 is fast, unsalted, and has no
 *    configurable cost — it is trivially reversible via rainbow tables /
 *    GPU brute force. We use PASSWORD_ARGON2ID, which is salted
 *    automatically and tunable for memory- and time-hardness.
 */
final class AuthService
{
    private const MAX_KEY_CHARS = 256;

    public function __construct(
        private readonly int $memoryCost = 65536,
        private readonly int $timeCost = 4,
        private readonly int $threads = 2,
    ) {
    }

    /**
     * Character-accurate boundary check. Returns false (never dies/exits)
     * so the caller decides how to respond — keeping this class free of
     * transport-layer concerns (HTTP status codes, echo, die()).
     */
    public function isWithinBounds(string $inputKey): bool
    {
        return mb_strlen($inputKey, 'UTF-8') <= self::MAX_KEY_CHARS;
    }

    /**
     * Hashes a credential for storage. Never returns/logs the raw input.
     */
    public function hash(string $plainKey): string
    {
        $hash = password_hash($plainKey, PASSWORD_ARGON2ID, [
            'memory_cost' => $this->memoryCost,
            'time_cost' => $this->timeCost,
            'threads' => $this->threads,
        ]);

        if ($hash === false) {
            throw new \RuntimeException('Argon2id hashing failed — check php.ini sodium/argon2 support.');
        }

        return $hash;
    }

    /**
     * Constant-time verification against a stored Argon2id hash.
     * password_verify() internally uses a timing-safe comparison, closing
     * off the timing side-channel that a naive `===` string compare risks.
     */
    public function verify(string $plainKey, string $storedHash): bool
    {
        return password_verify($plainKey, $storedHash);
    }

    /**
     * True if a stored hash was produced with weaker parameters than the
     * service's current policy (or a legacy non-Argon2id hash such as raw
     * MD5). Lets an authentication flow transparently re-hash on next
     * successful login without forcing a mass password reset.
     */
    public function needsRehash(string $storedHash): bool
    {
        return password_needs_rehash($storedHash, PASSWORD_ARGON2ID, [
            'memory_cost' => $this->memoryCost,
            'time_cost' => $this->timeCost,
            'threads' => $this->threads,
        ]);
    }
}
