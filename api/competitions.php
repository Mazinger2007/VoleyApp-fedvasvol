<?php
/**
 * api/competitions.php
 *
 * GET /api/competitions.php
 * Devuelve la lista de competiciones con número de equipos.
 *
 * Flujo: caché JSON → MySQL → escribe caché
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=30');

// 1. Caché JSON (~1 ms)
$cached = readCache('competitions');
if ($cached !== null) {
    echo json_encode($cached, JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. MySQL
try {
    $rows = getDB()->query('
        SELECT c.tournament_id, c.name, c.season, c.category, c.gender,
               DATE_FORMAT(c.updated_at, "%Y-%m-%dT%T") AS updated_at,
               COUNT(t.id) AS team_count
        FROM competitions c
        LEFT JOIN teams t ON t.competition_id = c.id
        GROUP BY c.id
        ORDER BY c.name
    ')->fetchAll();

    writeCache('competitions', $rows);
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
    error_log('[API/competitions] ' . $e->getMessage());
}
