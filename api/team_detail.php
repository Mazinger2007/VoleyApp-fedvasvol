<?php
/**
 * api/team_detail.php
 *
 * GET /api/team_detail.php?tournament_id=1234&team_name=NombreEquipo
 * Devuelve los jugadores de un equipo en un torneo.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=60');

$tid  = isset($_GET['tournament_id']) ? trim($_GET['tournament_id']) : '';
$team = isset($_GET['team_name'])     ? trim($_GET['team_name'])     : '';

if ($tid === '' || !ctype_digit($tid) || $team === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing tournament_id or team_name']);
    exit;
}

// Sanitizar clave de caché
$cacheKey = 'players_' . $tid . '_' . preg_replace('/[^a-z0-9]/i', '_', $team);
$cached   = readCache($cacheKey);
if ($cached !== null) {
    echo json_encode($cached, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = getDB();

    // Datos del equipo desde rankings
    $teamStmt = $pdo->prepare('
        SELECT position, name, points, played, won, lost, sets_for, sets_against, team_url
        FROM teams WHERE tournament_id = ? AND name = ? LIMIT 1
    ');
    $teamStmt->execute([$tid, $team]);
    $teamData = $teamStmt->fetch();

    if (!$teamData) {
        http_response_code(404);
        echo json_encode(['error' => 'Team not found']);
        exit;
    }

    // Jugadores
    $playersStmt = $pdo->prepare('
        SELECT player_name AS name, played
        FROM team_players
        WHERE tournament_id = ? AND team_name = ?
        ORDER BY played DESC, player_name ASC
    ');
    $playersStmt->execute([$tid, $team]);
    $teamData['players'] = $playersStmt->fetchAll();

    writeCache($cacheKey, $teamData);
    echo json_encode($teamData, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
    error_log('[API/team_detail] ' . $e->getMessage());
}
