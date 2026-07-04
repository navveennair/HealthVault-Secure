<?php

declare(strict_types=1);

namespace HealthVault\Database;

/**
 * Central PDO factory. Every consumer gets the same hardened defaults:
 *  - ERRMODE_EXCEPTION: a failed query throws instead of returning false,
 *    so callers cannot silently ignore a broken statement.
 *  - EMULATE_PREPARES = false: forces the *database driver* (not PHP) to
 *    perform real server-side prepared statements, which is what makes
 *    parameter binding a hard boundary between SQL syntax and data.
 */
final class Connection
{
    public static function fromEnv(): \PDO
    {
        $driver = $_ENV['DB_DRIVER'] ?? 'mysql';

        if ($driver === 'sqlite') {
            // Used for local/CI test runs so PHPUnit never needs a live
            // MySQL server just to exercise query logic.
            $dsn = 'sqlite:' . ($_ENV['DB_PATH'] ?? (sys_get_temp_dir() . '/healthvault_test.sqlite'));
        } else {
            $dsn = sprintf(
                '%s:host=%s;port=%s;dbname=%s;charset=%s',
                $driver,
                $_ENV['DB_HOST'] ?? '127.0.0.1',
                $_ENV['DB_PORT'] ?? '3306',
                $_ENV['DB_NAME'] ?? '',
                $_ENV['DB_CHARSET'] ?? 'utf8mb4',
            );
        }

        return new \PDO($dsn, $_ENV['DB_USER'] ?? null, $_ENV['DB_PASS'] ?? null, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_EMULATE_PREPARES => false,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
    }
}
