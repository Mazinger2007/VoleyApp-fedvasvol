<?php
/**
 * api/teams.php
 *
 * GET /api/teams.php?tournament_id=1234
 * Devuelve el ranking de equipos de un torneo.
 *
 * Flujo: caché JSON → MySQL → escribe caché
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=30');

// Validar parámetro (solo dígitos para evitar inyección)
$tid = isset($_GET['tournament_id']) ? trim($_GET['tournament_id']) : '';
if ($tid === '' || !ctype_digit($tid)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid tournament_id']);
    exit;
}

// 1. Caché JSON
$cacheKey = 'teams_' . $tid;
$cached   = readCache($cacheKey);
if ($cached !== null) {
    echo json_encode($cached, JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. MySQL
try {
    $stmt = getDB()->prepare('
        SELECT position, name, points, played, won, lost, sets_for, sets_against, team_url
        FROM teams
        WHERE tournament_id = ?
        ORDER BY position ASC
    ');
    $stmt->execute([$tid]);
    $rows = $stmt->fetchAll();

    if (empty($rows)) {
        http_response_code(404);
        echo json_encode(['error' => 'No teams found for this tournament']);
        exit;
    }

    writeCache($cacheKey, $rows);
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
    error_log('[API/teams] ' . $e->getMessage());
}
