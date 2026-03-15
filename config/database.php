<?php
/**
 * config/database.php
 * Configuración de base de datos, caché JSON y helpers de conexión.
 * Ajusta las constantes de entorno para tu instalación XAMPP.
 */

// ── Credenciales MySQL ─────────────────────────────────────────────────────
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'fedvas_voley');

// ── Rutas ─────────────────────────────────────────────────────────────────
define('PROJECT_ROOT', dirname(__DIR__));
define('CACHE_DIR',    PROJECT_ROOT . '/cache/');

// ── URL base de la web a scrapar ───────────────────────────────────────────
define('BASE_URL', 'https://fedvasvol.com');

// ── Timeouts y TTL ────────────────────────────────────────────────────────
define('SCRAPE_TIMEOUT', 20);   // segundos por petición HTTP
define('SCRAPE_CONNECT', 10);   // timeout de conexión
define('CACHE_TTL',      300);  // segundos que vale el caché JSON (5 min)

// ── Singleton PDO ─────────────────────────────────────────────────────────
function getDB(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    try {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            DB_HOST, DB_PORT, DB_NAME
        );
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        error_log('[DB] Connection failed: ' . $e->getMessage());
        if (PHP_SAPI !== 'cli') {
            header('Content-Type: application/json');
            http_response_code(503);
        }
        exit(json_encode(['error' => 'Database unavailable']));
    }
    return $pdo;
}

/**
 * Escribe datos en el caché JSON de forma atómica (tmp → rename).
 */
function writeCache(string $key, array $data): void
{
    if (!is_dir(CACHE_DIR)) {
        mkdir(CACHE_DIR, 0755, true);
    }
    $path = CACHE_DIR . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $key) . '.json';
    $tmp  = $path . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    rename($tmp, $path);
}

/**
 * Lee el caché JSON. Devuelve null si no existe o está caducado.
 */
function readCache(string $key): ?array
{
    $path = CACHE_DIR . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $key) . '.json';
    if (!file_exists($path)) return null;
    if (time() - filemtime($path) > CACHE_TTL) return null;
    $data = json_decode(file_get_contents($path), true);
    return is_array($data) ? $data : null;
}

/**
 * Devuelve el timestamp del último caché (null si no existe).
 */
function cacheAge(string $key): ?int
{
    $path = CACHE_DIR . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $key) . '.json';
    return file_exists($path) ? (int)(time() - filemtime($path)) : null;
}
