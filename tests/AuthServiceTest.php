<?php

declare(strict_types=1);

namespace HealthVault\Tests;

use HealthVault\Auth\AuthService;
use PHPUnit\Framework\TestCase;

final class AuthServiceTest extends TestCase
{
    private AuthService $auth;

    protected function setUp(): void
    {
        // Lowered cost factors so the suite runs fast; production values
        // come from ARGON2ID_* in .env (see .env.example).
        $this->auth = new AuthService(memoryCost: 1 << 12, timeCost: 2, threads: 1);
    }

    /** Credential hash integrity: a hash produced by hash() must verify successfully against its own plaintext. */
    public function testHashThenVerifySucceedsForCorrectKey(): void
    {
        $hash = $this->auth->hash('doctorsecret');

        $this->assertTrue($this->auth->verify('doctorsecret', $hash));
        $this->assertStringStartsWith('$argon2id$', $hash);
    }

    public function testVerifyFailsForIncorrectKey(): void
    {
        $hash = $this->auth->hash('doctorsecret');

        $this->assertFalse($this->auth->verify('wrong-guess', $hash));
    }

    /** Boundary check counts characters, not bytes: a 256-character multi-byte (emoji) string must stay within bounds. */
    public function testMultiByteInputIsBoundedByCharacterCountNotByteCount(): void
    {
        // Each "😀" is 4 bytes in UTF-8 but 1 character (via mb_strlen).
        $multiByteKey = str_repeat('😀', 256);

        $this->assertSame(256, mb_strlen($multiByteKey, 'UTF-8'));
        $this->assertGreaterThan(256, strlen($multiByteKey)); // byte length, for contrast
        $this->assertTrue($this->auth->isWithinBounds($multiByteKey));
    }

    public function testMultiByteInputExceedingCharacterBoundIsRejected(): void
    {
        $multiByteKey = str_repeat('😀', 257);

        $this->assertFalse($this->auth->isWithinBounds($multiByteKey));
    }

    public function testLegacyMd5HashIsFlaggedAsNeedingRehash(): void
    {
        // Simulates a row migrated from the legacy staff_credentials table.
        $legacyMd5 = '098f6bcd4621d373cade4e832627b4f6';

        $this->assertTrue($this->auth->needsRehash($legacyMd5));
    }
}
