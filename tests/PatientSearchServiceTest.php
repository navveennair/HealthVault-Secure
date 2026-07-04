<?php

declare(strict_types=1);

namespace HealthVault\Tests;

use HealthVault\Search\PatientSearchService;
use PHPUnit\Framework\TestCase;

final class PatientSearchServiceTest extends TestCase
{
    private \PDO $pdo;
    private PatientSearchService $service;

    protected function setUp(): void
    {
        $this->pdo = new \PDO('sqlite::memory:', null, null, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
        ]);

        $this->pdo->exec('CREATE TABLE patient_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            illness_history TEXT NOT NULL
        )');

        $stmt = $this->pdo->prepare(
            'INSERT INTO patient_records (name, illness_history) VALUES (:name, :history)'
        );
        $stmt->execute(['name' => 'John Doe', 'history' => 'Stage-2 Carcinoma']);
        $stmt->execute(['name' => 'Jane Smith', 'history' => 'Stage-2 Carcinoma']);

        $this->service = new PatientSearchService($this->pdo);
    }

    public function testSearchReturnsMatchingRecordsForOrdinaryKeyword(): void
    {
        $results = $this->service->searchByName('John');

        $this->assertCount(1, $results);
        $this->assertSame('John Doe', $results[0]['name']);
    }

    /**
     * The classic payload that broke the legacy string-concatenated query:
     * `x' OR '1'='1`. Against a parameterized query, this is bound as a
     * literal search string — it matches zero rows rather than short-
     * circuiting the WHERE clause to return the entire table.
     */
    public function testClassicSqlInjectionPayloadIsTreatedAsLiteralData(): void
    {
        $results = $this->service->searchByName("x' OR '1'='1");

        $this->assertCount(0, $results);
    }

    /**
     * A payload attempting to terminate the query and append a second
     * statement is likewise inert: PDO/PDO_SQLITE with prepared
     * statements does not execute it as SQL, it is only ever compared as
     * string data inside the LIKE pattern.
     */
    public function testStackedQueryInjectionPayloadDoesNotAlterResultSet(): void
    {
        $before = $this->pdo->query('SELECT COUNT(*) FROM patient_records')->fetchColumn();

        $results = $this->service->searchByName("'; DROP TABLE patient_records; --");

        $after = $this->pdo->query('SELECT COUNT(*) FROM patient_records')->fetchColumn();

        $this->assertCount(0, $results);
        $this->assertSame($before, $after, 'patient_records table must survive the injection attempt untouched');
    }
}
