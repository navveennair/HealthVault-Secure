# HealthVault-Secure

Post-incident secure refactor of the E-MedicVault `search.php`, `auth.php`,
and `crypto_vault.php` modules, produced for the SECR4483/SCSR4483 Secure
Programming alternative assessment (MediChain HealthVault-API case study).

## Layout

```
legacy/     Original vulnerable artifacts, unmodified (for before/after comparison)
src/        Refactored, secure implementation
tests/      PHPUnit test suite (14 tests / 20 assertions)
demo/       Standalone CLI scripts producing terminal evidence (SQLi, XSS, ECB vs GCM)
db/         schema.sql (unmodified, as supplied)
.env.example  Template for required environment variables (copy to .env)
```

## Setup

```bash
composer install
cp .env.example .env   # then fill in DB_* and CRYPTO_VAULT_KEY_B64
```

Generate a vault key:

```bash
php -r "echo base64_encode(random_bytes(32));"
```

## Running the test suite

```bash
./vendor/bin/phpunit --testdox
```

## Running the evidence demos

```bash
php demo/demo_sqli_vs_pdo.php
php demo/demo_xss_encoding.php
php demo/demo_ecb_vs_gcm.php
```

## Vulnerabilities fixed

| Flaw | Legacy file | Fix |
|---|---|---|
| A — SQL Injection | `legacy/search.php` | PDO prepared statements (`src/Search/PatientSearchService.php`) |
| B/C — Reflected XSS | `legacy/search.php` | `htmlspecialchars()` context-aware output encoding (`src/search.php`) |
| D — Byte/character bound mismatch | `legacy/auth.php` | `mb_strlen()` character-accurate bound (`src/Auth/AuthService.php`) |
| E — MD5 credential hashing | `legacy/auth.php` | Argon2id via `password_hash()`/`password_verify()` |
| F — AES-128-ECB pattern leakage | `legacy/crypto_vault.php` | AES-256-GCM AEAD (`src/Crypto/VaultCipher.php`) |
| G — Hardcoded key | `legacy/crypto_vault.php` | `.env`-sourced key, `.gitignore`d |
