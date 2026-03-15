<?php
/**
 * api/competition_detail.php
 *
 * GET /api/competition_detail.php?tournament_id=1234
 * Devuelve la competición con su ranking de equipos anidado.
 *
 * Flujo: caché JSON → MySQL → escribe caché
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=30');

$tid = isset($_GET['tournament_id']) ? trim($_GET['tournament_id']) : '';
if ($tid === '' || !ctype_digit($tid)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid tournament_id']);
    exit;
}

$cacheKey = 'competition_detail_' . $tid;
$cached   = readCache($cacheKey);
if ($cached !== null) {
    echo json_encode($cached, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = getDB();

    $compStmt = $pdo->prepare('
        SELECT tournament_id, name, season, category, gender, url,
               DATE_FORMAT(updated_at, "%Y-%m-%dT%T") AS updated_at
        FROM competitions WHERE tournament_id = ? LIMIT 1
    ');
    $compStmt->execute([$tid]);
    $comp = $compStmt->fetch();

    if (!$comp) {
        http_response_code(404);
        echo json_encode(['error' => 'Competition not found']);
        exit;
    }

    $teamsStmt = $pdo->prepare('
        SELECT position, name, points, played, won, lost, sets_for, sets_against, team_url
        FROM teams WHERE tournament_id = ? ORDER BY position ASC
    ');
    $teamsStmt->execute([$tid]);
    $comp['teams'] = $teamsStmt->fetchAll();

    writeCache($cacheKey, $comp);
    echo json_encode($comp, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
    error_log('[API/competition_detail] ' . $e->getMessage());
}
