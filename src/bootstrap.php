<?php

declare(strict_types=1);

/**
 * Loads secrets from .env into $_ENV / getenv() at runtime. Nothing in
 * this codebase hardcodes a key, password, or connection string — that
 * was Hidden Flaw G in the legacy crypto_vault.php. See .env.example for
 * the required variables and .gitignore for why .env itself never
 * reaches version control.
 */
require_once __DIR__ . '/../vendor/autoload.php';

$root = dirname(__DIR__);
if (file_exists($root . '/.env')) {
    $dotenv = \Dotenv\Dotenv::createImmutable($root);
    $dotenv->load();
}
