#!/usr/local/bin/php82
<?php
/**
 * scraper/scraper.php
 *
 * Orquestador principal del scraping:
 *   1. Descarga el listado de competiciones
 *   2. Upsert en MySQL
 *   3. Descarga páginas de ranking en paralelo
 *   4. Upsert equipos por torneo
 *   5. (Opcional) Descarga calendario
 *   6. Escribe caché JSON doble:
 *        cache/competitions.json
 *        cache/teams_{tournament_id}.json
 *
 * Uso manual:   /usr/local/bin/php82 scraper/scraper.php [--debug] [--limit=N] [--no-calendar]
 * Cron (cada 5 min):
 *   [cada 5 min] /usr/local/bin/php82 /path/to/scraper/scraper.php >> /var/log/fedvas.log 2>&1
 */

declare(strict_types=1);
set_time_limit(300);   // 5 min máx
ini_set('memory_limit', '128M');

if (!extension_loaded('pdo')) {
    fwrite(STDERR, "[Scraper] ERROR: extensión PDO no cargada en CLI.\n");
    fwrite(STDERR, "[Scraper] PHP_BINARY=" . PHP_BINARY . " | PHP_VERSION=" . PHP_VERSION . "\n");
    exit(2);
}

if (!extension_loaded('pdo_mysql')) {
    fwrite(STDERR, "[Scraper] ERROR: extensión pdo_mysql no cargada en CLI.\n");
    fwrite(STDERR, "[Scraper] PHP_BINARY=" . PHP_BINARY . " | PHP_VERSION=" . PHP_VERSION . "\n");
    fwrite(STDERR, "[Scraper] Prueba: /usr/local/bin/php82 -m | grep -Ei \"pdo|mysql\"\n");
    fwrite(STDERR, "[Scraper] Ejecuta scraper con: /usr/local/bin/php82 /volume1/web/voleibol/scraper/scraper.php --debug --limit=3\n");
    exit(2);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/parser.php';

// ── CLI flags ─────────────────────────────────────────────────────────────
$args        = $argv ?? [];
$debug       = in_array('--debug',       $args, true);
$noCalendar  = in_array('--no-calendar', $args, true);
$limitArg    = null;
foreach ($args as $arg) {
    if (preg_match('/--limit=(\d+)/', $arg, $m)) { $limitArg = (int)$m[1]; break; }
}

// ── Logger ────────────────────────────────────────────────────────────────
function log_msg(string $msg, bool $verbose = false): void
{
    if ($verbose && !$GLOBALS['debug']) return;
    echo '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
}

// ── Init ──────────────────────────────────────────────────────────────────
$t0      = microtime(true);
$parser  = new FedvasParser();
$pdo     = getDB();
$nComp   = 0;
$nTeams  = 0;
$nMatch  = 0;
$errors  = [];

log_msg('=== FedVas Scraper — start ===');

// ══════════════════════════════════════════════════════════════════════════
// 1. Fetch + parse competition list
// ══════════════════════════════════════════════════════════════════════════
$listUrl  = BASE_URL . '/es/tournaments';
log_msg("Fetching competition list: $listUrl");
$listHtml = $parser->fetch($listUrl);

if (!$listHtml) {
    $msg = "Could not fetch $listUrl";
    log_msg("ERROR: $msg");
    saveLog($pdo, 'error', 0, 0, 0, $t0, $msg);
    exit(1);
}

$competitions = $parser->parseCompetitionsList($listHtml);
log_msg('Competitions found: ' . count($competitions));

if (empty($competitions)) {
    log_msg('WARN: No competitions parsed — check HTML structure');
    saveLog($pdo, 'partial', 0, 0, 0, $t0, 'No competitions found');
    exit(0);
}

if ($limitArg !== null) {
    $competitions = array_slice($competitions, 0, $limitArg);
    log_msg("Limited to $limitArg competitions");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. Upsert competitions
// ══════════════════════════════════════════════════════════════════════════
$stmtComp = $pdo->prepare('
    INSERT INTO competitions (tournament_id, name, season, category, gender, url, raw_hash)
    VALUES (:tid, :name, :season, :category, :gender, :url, :hash)
    ON DUPLICATE KEY UPDATE
        name      = IF(raw_hash <> VALUES(raw_hash), VALUES(name),      name),
        season    = IF(raw_hash <> VALUES(raw_hash), VALUES(season),    season),
        category  = IF(raw_hash <> VALUES(raw_hash), VALUES(category),  category),
        gender    = IF(raw_hash <> VALUES(raw_hash), VALUES(gender),    gender),
        url       = VALUES(url),
        raw_hash  = VALUES(raw_hash),
        updated_at= NOW()
');

foreach ($competitions as $c) {
    $hash = md5(json_encode($c));
    $stmtComp->execute([
        'tid'      => $c['tournament_id'],
        'name'     => $c['name'],
        'season'   => $c['season'],
        'category' => $c['category'],
        'gender'   => $c['gender'],
        'url'      => $c['url'],
        'hash'     => $hash,
    ]);
    $nComp++;
}
log_msg("Upserted $nComp competitions");

// Reload DB IDs for use later
$compIds = [];
foreach ($pdo->query('SELECT id, tournament_id FROM competitions')->fetchAll() as $r) {
    $compIds[$r['tournament_id']] = (int)$r['id'];
}

// ══════════════════════════════════════════════════════════════════════════
// 3. Fetch ranking pages in parallel
// ══════════════════════════════════════════════════════════════════════════
$rankUrls = [];
foreach ($competitions as $c) {
    $rankUrls[$c['tournament_id']] = BASE_URL . '/es/tournament/' . $c['tournament_id'] . '/ranking';
}

log_msg('Fetching ' . count($rankUrls) . ' ranking pages (parallel)...');
$rankHtmls = $parser->fetchMulti($rankUrls, 5);

// ══════════════════════════════════════════════════════════════════════════
// 4. Parse and save teams
// ══════════════════════════════════════════════════════════════════════════
$stmtTeam = $pdo->prepare('
    INSERT INTO teams
        (competition_id, tournament_id, position, name, points, played, won, lost, sets_for, sets_against, team_url)
    VALUES
        (:cid, :tid, :pos, :name, :pts, :pj, :won, :lost, :sf, :sa, :url)
    ON DUPLICATE KEY UPDATE
        competition_id = VALUES(competition_id),
        position       = VALUES(position),
        points         = VALUES(points),
        played         = VALUES(played),
        won            = VALUES(won),
        lost           = VALUES(lost),
        sets_for       = VALUES(sets_for),
        sets_against   = VALUES(sets_against),
        team_url       = VALUES(team_url),
        updated_at     = NOW()
');

foreach ($competitions as $c) {
    $tid   = $c['tournament_id'];
    $html  = $rankHtmls[$tid] ?? null;
    $cid   = $compIds[$tid]  ?? null;

    if (!$html || !$cid) {
        $errors[] = "No ranking HTML for $tid";
        continue;
    }

    $teams = $parser->parseRankingPage($html, $tid);
    log_msg("  [$tid] {$c['name']}: " . count($teams) . ' teams', true);

    $pdo->beginTransaction();
    try {
        foreach ($teams as $t) {
            $stmtTeam->execute([
                'cid'  => $cid,
                'tid'  => $tid,
                'pos'  => $t['position'],
                'name' => $t['name'],
                'pts'  => $t['points'],
                'pj'   => $t['played'],
                'won'  => $t['won'],
                'lost' => $t['lost'],
                'sf'   => $t['sets_for'],
                'sa'   => $t['sets_against'],
                'url'  => $t['team_url'],
            ]);
            $nTeams++;
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        $msg = "Error saving teams for $tid: " . $e->getMessage();
        log_msg("ERROR: $msg");
        $errors[] = $msg;
    }
}
log_msg("Teams saved/updated: $nTeams");

// ══════════════════════════════════════════════════════════════════════════
// 5. (Optional) Calendar scraping
// ══════════════════════════════════════════════════════════════════════════
if (!$noCalendar) {
    $calUrls = [];
    foreach ($competitions as $c) {
        $calUrls[$c['tournament_id']] = BASE_URL . '/es/tournament/' . $c['tournament_id'] . '/calendar';
    }
    log_msg('Fetching ' . count($calUrls) . ' calendar pages (parallel)...');
    $calHtmls = $parser->fetchMulti($calUrls, 5);

    $stmtMatch = $pdo->prepare('
        INSERT INTO matches_calendar
            (tournament_id, match_date, match_time, venue, home_team, away_team,
             home_score, away_score, status, sets_detail, raw_hash)
        VALUES
            (:tid, :date, :time, :venue, :home, :away,
             :hs, :as_, :status, :sets, :hash)
        ON DUPLICATE KEY UPDATE
            match_time  = VALUES(match_time),
            venue       = VALUES(venue),
            home_score  = VALUES(home_score),
            away_score  = VALUES(away_score),
            status      = VALUES(status),
            sets_detail = IF(raw_hash <> VALUES(raw_hash), VALUES(sets_detail), sets_detail),
            raw_hash    = VALUES(raw_hash),
            updated_at  = NOW()
    ');

    foreach ($competitions as $c) {
        $tid  = $c['tournament_id'];
        $html = $calHtmls[$tid] ?? null;
        if (!$html) continue;

        $matches = $parser->parseCalendarPage($html);
        log_msg("  [$tid] calendar: " . count($matches) . ' matches', true);

        $pdo->beginTransaction();
        try {
            foreach ($matches as $m) {
                $setsJson = json_encode($m['sets_detail']);
                $hash     = md5($tid . $m['match_date'] . $m['home_team'] . $m['away_team'] . $setsJson);
                $stmtMatch->execute([
                    'tid'    => $tid,
                    'date'   => $m['match_date'],
                    'time'   => $m['match_time'],
                    'venue'  => $m['venue'],
                    'home'   => $m['home_team'],
                    'away'   => $m['away_team'],
                    'hs'     => $m['home_score'],
                    'as_'    => $m['away_score'],
                    'status' => $m['status'],
                    'sets'   => $setsJson,
                    'hash'   => $hash,
                ]);
                $nMatch++;
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            $errors[] = "Calendar error $tid: " . $e->getMessage();
        }
    }
    log_msg("Matches saved/updated: $nMatch");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. Write JSON cache files
// ══════════════════════════════════════════════════════════════════════════
log_msg('Writing JSON cache...');

// cache/competitions.json
$allComps = $pdo->query('
    SELECT c.tournament_id, c.name, c.season, c.category, c.gender, c.updated_at,
           COUNT(t.id) AS team_count
    FROM competitions c
    LEFT JOIN teams t ON t.competition_id = c.id
    GROUP BY c.id
    ORDER BY c.name
')->fetchAll();
writeCache('competitions', $allComps);
log_msg('cache/competitions.json written');

// cache/teams_{tid}.json  — one per tournament
foreach ($allComps as $comp) {
    $tid   = $comp['tournament_id'];
    $stmt  = $pdo->prepare('
        SELECT position, name, points, played, won, lost, sets_for, sets_against, team_url
        FROM teams
        WHERE tournament_id = ?
        ORDER BY position ASC
    ');
    $stmt->execute([$tid]);
    writeCache('teams_' . $tid, $stmt->fetchAll());
}
log_msg('Per-tournament team caches written');

// ══════════════════════════════════════════════════════════════════════════
// Done
// ══════════════════════════════════════════════════════════════════════════
$status = empty($errors) ? 'ok' : 'partial';
saveLog($pdo, $status, $nComp, $nTeams, $nMatch, $t0, implode('; ', $errors));

$elapsed = round((microtime(true) - $t0) * 1000);
log_msg("=== Done in {$elapsed}ms | status=$status | comp=$nComp teams=$nTeams matches=$nMatch ===");
if (!empty($errors)) {
    log_msg('Errors: ' . implode('; ', $errors));
}

// ── Helpers ───────────────────────────────────────────────────────────────
function saveLog(PDO $db, string $status, int $comp, int $teams, int $matches, float $t0, string $msg = ''): void
{
    try {
        $db->prepare('
            INSERT INTO scraper_log (status, competitions_updated, teams_updated, matches_updated, duration_ms, message)
            VALUES (?, ?, ?, ?, ?, ?)
        ')->execute([$status, $comp, $teams, $matches, (int)round((microtime(true) - $t0) * 1000), $msg ?: null]);
    } catch (Throwable $e) {
        error_log('[Scraper] Log error: ' . $e->getMessage());
    }
}
