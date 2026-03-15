/* eslint-disable no-console */
const mysql = require('mysql2/promise');
const { syncSite } = require('./fedvas-sync');

function getCliArg(name, fallback = null) {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === `--${name}`);
  if (idx < 0) return fallback;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return true;
  return value;
}

function env(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

async function ensureSchema(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      status VARCHAR(20) NOT NULL,
      message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS tournaments (
      tournament_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(255) NULL,
      season_id BIGINT UNSIGNED NULL,
      season_label VARCHAR(255) NULL,
      category VARCHAR(255) NULL,
      sex VARCHAR(100) NULL,
      status_text VARCHAR(255) NULL,
      summary_url VARCHAR(512) NULL,
      ranking_base_url VARCHAR(512) NULL,
      refreshed_at DATETIME NULL,
      payload_json LONGTEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (tournament_id),
      KEY idx_tournaments_season_id (season_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS tournament_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      tournament_id BIGINT UNSIGNED NOT NULL,
      group_id BIGINT UNSIGNED NOT NULL,
      ranking_url VARCHAR(512) NULL,
      calendar_all_url VARCHAR(512) NULL,
      ranking_json LONGTEXT NULL,
      calendar_json LONGTEXT NULL,
      extracted_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tournament_group (tournament_id, group_id),
      KEY idx_groups_tournament_id (tournament_id),
      CONSTRAINT fk_groups_tournament FOREIGN KEY (tournament_id)
        REFERENCES tournaments (tournament_id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function persistResult(conn, result) {
  const tournaments = result?.cache?.tournaments || [];

  for (const t of tournaments) {
    await conn.query(
      `
      INSERT INTO tournaments (
        tournament_id, name, season_id, season_label, category, sex, status_text,
        summary_url, ranking_base_url, refreshed_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        season_id = VALUES(season_id),
        season_label = VALUES(season_label),
        category = VALUES(category),
        sex = VALUES(sex),
        status_text = VALUES(status_text),
        summary_url = VALUES(summary_url),
        ranking_base_url = VALUES(ranking_base_url),
        refreshed_at = VALUES(refreshed_at),
        payload_json = VALUES(payload_json)
      `,
      [
        Number(t.tournamentId),
        t.name || null,
        t.seasonId ? Number(t.seasonId) : null,
        t.seasonLabel || null,
        t.category || null,
        t.sex || null,
        t.status || null,
        t.summaryUrl || null,
        t.rankingBaseUrl || t.rankingUrl || null,
        asDate(t.refreshedAt),
        JSON.stringify(t),
      ]
    );

    await conn.query('DELETE FROM tournament_groups WHERE tournament_id = ?', [Number(t.tournamentId)]);

    for (const g of t.groups || []) {
      await conn.query(
        `
        INSERT INTO tournament_groups (
          tournament_id, group_id, ranking_url, calendar_all_url,
          ranking_json, calendar_json, extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          ranking_url = VALUES(ranking_url),
          calendar_all_url = VALUES(calendar_all_url),
          ranking_json = VALUES(ranking_json),
          calendar_json = VALUES(calendar_json),
          extracted_at = VALUES(extracted_at)
        `,
        [
          Number(t.tournamentId),
          Number(g.groupId),
          g.rankingUrl || null,
          g.calendarAllUrl || null,
          JSON.stringify(g.rankingTable || null),
          JSON.stringify(g.calendarRounds || []),
          asDate(g.extractedAt),
        ]
      );
    }
  }
}

async function runOnce(conn, options = {}) {
  const start = new Date();
  const [runInsert] = await conn.query(
    'INSERT INTO sync_runs (started_at, status, message) VALUES (?, ?, ?)',
    [start, 'running', 'sync started']
  );
  const runId = runInsert.insertId;

  try {
    const result = await syncSite({
      limitSeasons: options.limitSeasons,
      limitTournaments: options.limitTournaments,
      discoverOnly: false,
      writeFiles: true,
    });

    await persistResult(conn, result);

    await conn.query(
      'UPDATE sync_runs SET finished_at = ?, status = ?, message = ? WHERE id = ?',
      [new Date(), 'ok', `synced ${result.cache.tournaments.length} tournaments`, runId]
    );

    console.log(`[db-sync] ok - tournaments=${result.cache.tournaments.length}`);
  } catch (error) {
    await conn.query(
      'UPDATE sync_runs SET finished_at = ?, status = ?, message = ? WHERE id = ?',
      [new Date(), 'error', error.message, runId]
    );
    console.error('[db-sync] error:', error.message);
  }
}

async function main() {
  const dbConfig = {
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', '3306')),
    user: env('DB_USER', ''),
    password: env('DB_PASSWORD', ''),
    database: env('DB_NAME', ''),
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    timezone: 'Z',
  };

  if (!dbConfig.user || !dbConfig.database) {
    throw new Error('Missing DB env vars. Required: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
  }

  const limitSeasons = Number(getCliArg('limitSeasons', '0')) || 0;
  const limitTournaments = Number(getCliArg('limitTournaments', '0')) || 0;
  const once = Boolean(getCliArg('once', false));

  const intervalMin = Number(env('SYNC_INTERVAL_MINUTES', '5')) || 5;
  const intervalMs = Math.max(1, intervalMin) * 60 * 1000;

  const conn = await mysql.createPool(dbConfig);
  await ensureSchema(conn);

  await runOnce(conn, { limitSeasons, limitTournaments });

  if (once) {
    await conn.end();
    return;
  }

  console.log(`[db-sync] scheduler running every ${intervalMin} minute(s)`);
  setInterval(() => {
    runOnce(conn, { limitSeasons, limitTournaments }).catch((err) => {
      console.error('[db-sync] scheduler error:', err.message);
    });
  }, intervalMs);
}

main().catch((error) => {
  console.error('[fatal]', error.message);
  process.exitCode = 1;
});
