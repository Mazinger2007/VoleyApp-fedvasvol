<?php
/**
 * scraper/parser.php
 *
 * Clase FedvasParser — descarga y parsea las páginas HTML de fedvasvol.com.
 * Usa DOMDocument + DOMXPath, sin dependencias externas.
 *
 * Métodos principales:
 *   fetch($url)                   → string|null   (HTTP sencillo)
 *   fetchMulti($urls, $concurr)   → array          (HTTP paralelo)
 *   parseCompetitionsList($html)  → array competiciones
 *   parseRankingPage($html, $tid) → array equipos
 *   parseCalendarPage($html)      → array partidos
 *   parseTeamDetail($html)        → array {players, info}
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

class FedvasParser
{
    // ── User-agent y cabeceras comunes ─────────────────────────────────────
    private const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 '
                     . '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

    private array $curlBase = [];

    public function __construct()
    {
        $this->curlBase = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_TIMEOUT        => SCRAPE_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => SCRAPE_CONNECT,
            CURLOPT_USERAGENT      => self::UA,
            CURLOPT_HTTPHEADER     => [
                'Accept: text/html,application/xhtml+xml',
                'Accept-Language: es-ES,es;q=0.9,en;q=0.7',
            ],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_ENCODING       => 'gzip, deflate, br',
        ];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HTTP
    // ═══════════════════════════════════════════════════════════════════════

    /** Descarga una URL y devuelve el HTML (null si falla) */
    public function fetch(string $url): ?string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, $this->curlBase);
        $html = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($err || $code >= 400) {
            error_log("[Parser] fetch($url) → HTTP $code / $err");
            return null;
        }
        return $html ?: null;
    }

    /**
     * Descarga varias URLs en paralelo (curl_multi).
     * @param array  $urls        [key => url]
     * @param int    $concurrency Peticiones simultáneas
     * @return array [key => html|null]
     */
    public function fetchMulti(array $urls, int $concurrency = 5): array
    {
        $results = [];
        foreach (array_chunk($urls, $concurrency, true) as $chunk) {
            $mh      = curl_multi_init();
            $handles = [];

            foreach ($chunk as $key => $url) {
                $ch = curl_init($url);
                curl_setopt_array($ch, $this->curlBase);
                curl_multi_add_handle($mh, $ch);
                $handles[$key] = $ch;
            }

            do {
                $status = curl_multi_exec($mh, $active);
                if ($active) curl_multi_select($mh);
            } while ($active && $status === CURLM_OK);

            foreach ($handles as $key => $ch) {
                $code           = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $results[$key]  = ($code < 400) ? curl_multi_getcontent($ch) : null;
                curl_multi_remove_handle($mh, $ch);
                curl_close($ch);
            }
            curl_multi_close($mh);
        }
        return $results;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Parseo: lista de competiciones
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Parsea la página /es/tournaments y devuelve array de competiciones.
     * Cada elemento: [tournament_id, name, season, category, gender, url]
     */
    public function parseCompetitionsList(string $html): array
    {
        $dom = $this->loadDOM($html);
        if (!$dom) return [];
        $xp   = new DOMXPath($dom);
        $seen = [];
        $out  = [];

        // Estrategia 1: filas de tabla que contengan enlace a /tournament/{id}/
        $rows = $xp->query('//table//tr[.//a[contains(@href, "/tournament/")]]');
        foreach ($rows as $row) {
            /** @var DOMElement $row */
            $anchor = $xp->query('.//a[contains(@href, "/tournament/")]', $row)->item(0);
            if (!$anchor) continue;
            $href = $anchor->getAttribute('href');
            if (!preg_match('#/tournament/(\d+)#', $href, $m)) continue;
            $tid = $m[1];
            if (isset($seen[$tid])) continue;
            $seen[$tid] = true;

            $cells      = $xp->query('.//td', $row);
            $cellTexts  = [];
            foreach ($cells as $c) $cellTexts[] = $this->text($c);

            $name = $this->cleanName($this->text($anchor));
            foreach ($cellTexts as $ct) {
                if (mb_strlen($ct) > mb_strlen($name) && mb_strlen($ct) < 150) $name = $ct;
            }

            $out[] = $this->buildCompetition($tid, $name, $cellTexts);
        }

        // Estrategia 2 (fallback): todos los anchors con /tournament/{id}/
        if (empty($out)) {
            $anchors = $xp->query('//a[contains(@href, "/tournament/")]');
            foreach ($anchors as $anchor) {
                $href = $anchor->getAttribute('href');
                if (!preg_match('#/tournament/(\d+)#', $href, $m)) continue;
                $tid = $m[1];
                if (isset($seen[$tid])) continue;
                $name = $this->cleanName($this->text($anchor));
                if (empty($name) || in_array(strtolower($name), ['ver','summary','ranking','classification','calendar'], true)) continue;
                $seen[$tid] = true;
                $out[]      = $this->buildCompetition($tid, $name, [$name]);
            }
        }

        return $out;
    }

    private function buildCompetition(string $tid, string $name, array $cellTexts): array
    {
        $name = $this->cleanName($name) ?: "Torneo $tid";
        return [
            'tournament_id' => $tid,
            'name'          => $name,
            'season'        => $this->detectSeason($cellTexts),
            'category'      => $this->detectCategory($cellTexts, $name),
            'gender'        => $this->detectGender($cellTexts, $name),
            'url'           => BASE_URL . '/es/tournament/' . $tid . '/ranking',
        ];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Parseo: página de clasificación (ranking)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Parsea la página /ranking de un torneo.
     * Devuelve array de equipos: [position, name, points, played, ...]
     */
    public function parseRankingPage(string $html, string $tournamentId = ''): array
    {
        $dom = $this->loadDOM($html);
        if (!$dom) return [];
        $xp  = new DOMXPath($dom);

        $tables = $xp->query('//table[.//th or .//td]');
        foreach ($tables as $table) {
            $rows = $xp->query('.//tr', $table);
            if ($rows->length < 2) continue;

            $headers = $this->parseHeaderRow($xp, $rows->item(0));
            if (!$this->looksLikeStandings($headers)) continue;

            $posCol  = $this->colIdx($headers, 'pos', '#', 'puesto');
            $teamCol = $this->colIdx($headers, 'equipo', 'club', 'nombre', 'team');
            $ptsCol  = $this->colIdx($headers, 'pts', 'puntos', 'point');
            $pjCol   = $this->colIdx($headers, 'pj', 'jugados', 'played', 'partidos');
            $wonCol  = $this->colIdx($headers, 'pg', 'ganados', 'won', 'v');
            $lostCol = $this->colIdx($headers, 'pp', 'perdidos', 'lost', 'd');
            $sfCol   = $this->colIdx($headers, 'sf', 'sets f', 'setsg');
            $saCol   = $this->colIdx($headers, 'sc', 'sets c', 'setsp');

            $teams = [];
            for ($i = 1; $i < $rows->length; $i++) {
                $cells = $this->parseCells($xp, $rows->item($i));
                if (count($cells) < 2) continue;

                $name = $teamCol >= 0 ? ($cells[$teamCol] ?? '') : ($cells[1] ?? $cells[0] ?? '');
                $name = $this->cleanName($name);
                if (empty($name)) continue;

                $teamAnchor = $xp->query('.//a[contains(@href, "/team/")]', $rows->item($i))->item(0);
                $teamUrl    = $teamAnchor ? BASE_URL . $teamAnchor->getAttribute('href') : null;

                $teams[] = [
                    'position'     => $posCol >= 0 ? ((int)($cells[$posCol] ?? 0) ?: $i) : $i,
                    'name'         => $name,
                    'points'       => (int)($cells[$ptsCol]  ?? 0),
                    'played'       => (int)($cells[$pjCol]   ?? 0),
                    'won'          => (int)($cells[$wonCol]  ?? 0),
                    'lost'         => (int)($cells[$lostCol] ?? 0),
                    'sets_for'     => (int)($cells[$sfCol]   ?? 0),
                    'sets_against' => (int)($cells[$saCol]   ?? 0),
                    'team_url'     => $teamUrl,
                ];
            }
            if (!empty($teams)) return $teams;
        }
        return [];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Parseo: calendario de partidos
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Parsea la página /calendar/{id}/all de un torneo.
     * Devuelve array de partidos.
     */
    public function parseCalendarPage(string $html): array
    {
        $dom = $this->loadDOM($html);
        if (!$dom) return [];
        $xp  = new DOMXPath($dom);

        $matches = [];
        $tables  = $xp->query('//table');
        foreach ($tables as $table) {
            $rows = $xp->query('.//tr', $table);
            for ($i = 1; $i < $rows->length; $i++) {
                $m = $this->parseMatchRow($xp, $rows->item($i));
                if ($m) $matches[] = $m;
            }
        }
        return $matches;
    }

    private function parseMatchRow(DOMXPath $xp, DOMElement $row): ?array
    {
        $cells = $xp->query('.//td', $row);
        if ($cells->length < 2) return null;

        $dateCell  = $this->cellByClass($xp, $row, 'colstyle-fecha');
        $teamCell  = $this->cellByClass($xp, $row, 'colstyle-equipo');
        $setsCell  = $this->cellByClass($xp, $row, 'colstyle-parciales');

        $dateInfo = $dateCell ? $this->parseDateCell($xp, $dateCell) : [];
        $teamInfo = $teamCell ? $this->parseTeamCell($xp, $teamCell) : null;
        $setsInfo = $setsCell ? $this->parseSetsCell($xp, $setsCell) : null;

        if (!$teamInfo) return null;

        return [
            'match_date'  => $dateInfo['date']   ?? null,
            'match_time'  => $dateInfo['time']   ?? null,
            'venue'       => $dateInfo['venue']  ?? null,
            'home_team'   => $teamInfo['home']   ?? null,
            'away_team'   => $teamInfo['away']   ?? null,
            'home_score'  => $setsInfo['home_score'] ?? null,
            'away_score'  => $setsInfo['away_score'] ?? null,
            'status'      => ($setsInfo && $setsInfo['home_score'] !== null) ? 'finished' : 'upcoming',
            'sets_detail' => $setsInfo['sets'] ?? [],
        ];
    }

    private function cellByClass(DOMXPath $xp, DOMElement $row, string $cls): ?DOMElement
    {
        /** @var DOMElement|null $node */
        $node = $xp->query('.//td[contains(@class,"' . $cls . '")]', $row)->item(0);
        return $node instanceof DOMElement ? $node : null;
    }

    private function parseDateCell(DOMXPath $xp, DOMElement $cell): array
    {
        $raw  = $this->text($cell);
        $date = null;
        $time = null;

        if (preg_match('#(\d{2}/\d{2}/\d{4})#', $raw, $m)) {
            $dt   = DateTime::createFromFormat('d/m/Y', $m[1]);
            $date = $dt ? $dt->format('Y-m-d') : null;
        } elseif (preg_match('#(\d{4}-\d{2}-\d{2})#', $raw, $m)) {
            $date = $m[1];
        }
        if (preg_match('#\b(\d{1,2}:\d{2})\b#', $raw, $m)) {
            $time = $m[1] . ':00';
        }

        $venueSpan = $xp->query('.//span[contains(@class,"ellipsis")]', $cell)->item(0);
        $venue     = null;
        if ($venueSpan instanceof DOMElement) {
            $venue = $venueSpan->getAttribute('title') ?: $this->text($venueSpan);
        }

        return ['date' => $date, 'time' => $time, 'venue' => $venue ?: null];
    }

    private function parseTeamCell(DOMXPath $xp, DOMElement $cell): ?array
    {
        $spans = $xp->query('.//span[contains(@class,"ellipsis")]', $cell);
        $names = [];
        foreach ($spans as $span) {
            /** @var DOMElement $span */
            $n = $span->getAttribute('title') ?: $this->text($span);
            if ($n) $names[] = trim($n);
        }
        return count($names) >= 2 ? ['home' => $names[0], 'away' => $names[1]] : null;
    }

    private function parseSetsCell(DOMXPath $xp, DOMElement $cell): array
    {
        $verts = $xp->query('.//span[contains(@class,"vertical-result")]', $cell);
        $homeScore = null;
        $awayScore = null;
        $sets      = [];
        $setNum    = 0;

        foreach ($verts as $vert) {
            $parts = $xp->query('.//span[contains(@class,"partial-result")]', $vert);
            $vals  = [];
            foreach ($parts as $p) {
                $v = trim(preg_replace('/[\p{Pd}]+/u', '', $p->textContent));
                $vals[] = is_numeric($v) ? (int)$v : null;
            }
            if ($setNum === 0) {
                $homeScore = $vals[0] ?? null;
                $awayScore = $vals[1] ?? null;
            } else {
                $sets[] = ['number' => $setNum, 'home' => $vals[0] ?? null, 'away' => $vals[1] ?? null];
            }
            $setNum++;
        }
        return ['home_score' => $homeScore, 'away_score' => $awayScore, 'sets' => $sets];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Parseo: ficha de equipo
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Parsea una página de equipo y devuelve jugadores + info básica.
     */
    public function parseTeamDetail(string $html): array
    {
        $dom = $this->loadDOM($html);
        if (!$dom) return ['players' => [], 'info' => []];
        $xp  = new DOMXPath($dom);

        $players = [];
        // Filas con enlace a jugador (/player/ o /athletes/)
        $rows = $xp->query('//table//tr[.//a[contains(@href,"/player/") or contains(@href,"/athletes/")]]');
        foreach ($rows as $row) {
            /** @var DOMElement $row */
            $anchor = $xp->query('.//a[contains(@href,"/player/") or contains(@href,"/athletes/")]', $row)->item(0);
            if (!$anchor) continue;

            $name = $this->cleanPlayerName($this->text($anchor));
            if (!$name) continue;

            $cells  = $xp->query('.//td', $row);
            $played = 0;
            if ($cells->length >= 2) {
                $last = $cells->item($cells->length - 2);
                $played = (int)trim($last->textContent);
            }
            $players[] = ['name' => $name, 'played' => $played];
        }

        // Nombre de equipo: primer h1 o h2
        $info = [];
        $h    = $xp->query('//h1 | //h2')->item(0);
        if ($h) $info['team_name'] = $this->cleanName($this->text($h));

        return ['players' => $players, 'info' => $info];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DOM helpers
    // ═══════════════════════════════════════════════════════════════════════

    private function loadDOM(string $html): ?DOMDocument
    {
        if (empty($html)) return null;
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8"?>' . $html);
        libxml_clear_errors();
        return $dom;
    }

    private function text(?DOMNode $node): string
    {
        if (!$node) return '';
        return trim(preg_replace('/\s+/', ' ', $node->textContent));
    }

    private function parseHeaderRow(DOMXPath $xp, DOMNode $row): array
    {
        $headers = [];
        foreach ($xp->query('.//th|.//td', $row) as $cell) {
            $headers[] = strtolower(trim($cell->textContent));
        }
        return $headers;
    }

    private function parseCells(DOMXPath $xp, DOMNode $row): array
    {
        $cells = [];
        foreach ($xp->query('.//th|.//td', $row) as $cell) {
            // Prefer span.ellipsis title (team names with full text)
            $ellipsis = $xp->query('.//span[contains(@class,"ellipsis")]', $cell)->item(0);
            if ($ellipsis instanceof DOMElement) {
                $title = $ellipsis->getAttribute('title');
                $cells[] = $title ?: trim($ellipsis->textContent);
            } else {
                $cells[] = trim($cell->textContent);
            }
        }
        return $cells;
    }

    private function looksLikeStandings(array $headers): bool
    {
        foreach ($headers as $h) {
            if (str_contains($h, 'equipo') || str_contains($h, 'club')
             || str_contains($h, 'nombre') || str_contains($h, 'pts')
             || str_contains($h, 'puntos')) {
                return true;
            }
        }
        return false;
    }

    private function colIdx(array $headers, string ...$keywords): int
    {
        foreach ($keywords as $kw) {
            foreach ($headers as $i => $h) {
                if (str_contains($h, $kw)) return $i;
            }
        }
        return -1;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Limpieza de texto
    // ═══════════════════════════════════════════════════════════════════════

    private function cleanName(string $s): string
    {
        $s = preg_replace('/^Ver\s*/iu', '', $s);
        $s = trim(preg_replace('/\s+/', ' ', $s));
        // Deduplicar cadenas tipo "Equipo AEquipo A"
        $len = mb_strlen($s);
        if ($len > 10 && $len % 2 === 0) {
            $half = intdiv($len, 2);
            if (mb_substr($s, 0, $half) === mb_substr($s, $half)) {
                return trim(mb_substr($s, 0, $half));
            }
        }
        return $s;
    }

    private function cleanPlayerName(string $s): string
    {
        $s = preg_replace('/^Ver\s*/iu', '', $s);
        $s = trim(preg_replace('/\s+/', ' ', $s));
        // Deduplicar
        $len = mb_strlen($s);
        if ($len > 8 && $len % 2 === 0) {
            $half = intdiv($len, 2);
            if (mb_substr($s, 0, $half) === mb_substr($s, $half)) {
                return trim(mb_substr($s, 0, $half));
            }
        }
        return $s;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Detección de metadatos
    // ═══════════════════════════════════════════════════════════════════════

    private function detectSeason(array $cells): ?string
    {
        $all = implode(' ', $cells);
        if (preg_match('/\b(20\d{2}[\/\-]20\d{2})\b/', $all, $m)) return str_replace('-', '/', $m[1]);
        if (preg_match('/\b(20\d{2})\b/', $all, $m)) return $m[1];
        return null;
    }

    private function detectCategory(array $cells, string $name): ?string
    {
        $all = strtolower(implode(' ', $cells) . ' ' . $name);
        if (str_contains($all, 'senior') || str_contains($all, 'sénior')) return 'Senior';
        if (str_contains($all, 'junior') || str_contains($all, 'júnior')) return 'Junior';
        if (str_contains($all, 'cadete'))   return 'Cadete';
        if (str_contains($all, 'infantil')) return 'Infantil';
        if (str_contains($all, 'juvenil'))  return 'Juvenil';
        if (str_contains($all, 'absolut'))  return 'Absoluto';
        return null;
    }

    private function detectGender(array $cells, string $name): ?string
    {
        $all = strtolower(implode(' ', $cells) . ' ' . $name);
        if (str_contains($all, 'femenin')) return 'Femenino';
        if (str_contains($all, 'masculin')) return 'Masculino';
        if (str_contains($all, 'mixto') || str_contains($all, 'mixed')) return 'Mixto';
        return null;
    }
}
