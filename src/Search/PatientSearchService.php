<?php

declare(strict_types=1);

namespace HealthVault\Search;

/**
 * Replacement for the raw mysqli string-concatenation query in the legacy
 * search.php (Hidden Flaw A).
 *
 * The vulnerable version built SQL by concatenating $_GET['keyword']
 * directly into the query text, so attacker-supplied characters (', --,
 * UNION, etc.) were parsed by the SQL engine as *syntax*. Here, the
 * keyword is bound as a *parameter* via PDO prepared statements: the SQL
 * text is compiled first, and the bound value is only ever interpreted as
 * data by the driver — it can never change the shape of the query, no
 * matter what characters it contains.
 */
final class PatientSearchService
{
    public function __construct(private readonly \PDO $pdo)
    {
    }

    /**
     * @return array<int, array{id:int,name:string,illness_history:string}>
     */
    public function searchByName(string $keyword): array
    {
        $sql = 'SELECT id, name, illness_history
                FROM patient_records
                WHERE name LIKE :keyword';

        $stmt = $this->pdo->prepare($sql);

        // LIKE wildcards are escaped so a keyword containing literal
        // % or _ cannot widen the match beyond the intended substring
        // search — a data-plane concern, independent of the SQLi fix.
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $keyword);

        $stmt->bindValue(':keyword', '%' . $escaped . '%', \PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
