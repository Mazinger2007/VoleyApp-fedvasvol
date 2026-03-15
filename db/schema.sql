-- db/schema.sql
-- Esquema de base de datos para el sistema de scraping de fedvasvol.com
-- Ejecutar: mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS fedvas_voley
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE fedvas_voley;

-- ── Competiciones ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitions (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tournament_id VARCHAR(20)   NOT NULL,
    name          VARCHAR(255)  NOT NULL,
    season        VARCHAR(30)   DEFAULT NULL,
    category      VARCHAR(100)  DEFAULT NULL,
    gender        VARCHAR(30)   DEFAULT NULL,
    url           VARCHAR(800)  DEFAULT NULL,
    raw_hash      CHAR(32)      DEFAULT NULL  COMMENT 'md5 del JSON de los datos; evita updates innecesarios',
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tournament (tournament_id),
    INDEX idx_gender   (gender),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Equipos (clasificación de cada torneo) ──────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    competition_id INT UNSIGNED NOT NULL,
    tournament_id VARCHAR(20)   NOT NULL,
    position      TINYINT UNSIGNED DEFAULT NULL,
    name          VARCHAR(255)  NOT NULL,
    points        SMALLINT      DEFAULT 0,
    played        SMALLINT      DEFAULT 0,
    won           SMALLINT      DEFAULT 0,
    lost          SMALLINT      DEFAULT 0,
    sets_for      SMALLINT      DEFAULT 0,
    sets_against  SMALLINT      DEFAULT 0,
    team_url      VARCHAR(800)  DEFAULT NULL,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY fk_team_comp (competition_id)
        REFERENCES competitions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_team_in_comp (tournament_id, name),
    INDEX idx_team_tournament (tournament_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Partidos / Calendario ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches_calendar (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tournament_id VARCHAR(20)   NOT NULL,
    match_date    DATE          DEFAULT NULL,
    match_time    TIME          DEFAULT NULL,
    venue         VARCHAR(500)  DEFAULT NULL,
    home_team     VARCHAR(255)  DEFAULT NULL,
    away_team     VARCHAR(255)  DEFAULT NULL,
    home_score    TINYINT       DEFAULT NULL,
    away_score    TINYINT       DEFAULT NULL,
    status        VARCHAR(50)   DEFAULT 'unknown',
    sets_detail   JSON          DEFAULT NULL,
    raw_hash      CHAR(32)      DEFAULT NULL,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_match (tournament_id, match_date, home_team, away_team),
    INDEX idx_match_tournament (tournament_id),
    INDEX idx_match_date       (match_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Jugadores de equipo ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_players (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tournament_id VARCHAR(20)   NOT NULL,
    team_name     VARCHAR(255)  NOT NULL,
    player_name   VARCHAR(255)  NOT NULL,
    played        TINYINT       DEFAULT 0,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_player (tournament_id, team_name, player_name),
    INDEX idx_players_team (tournament_id, team_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Log de ejecuciones del scraper ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraper_log (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    run_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status               ENUM('ok','error','partial') NOT NULL,
    competitions_updated SMALLINT  DEFAULT 0,
    teams_updated        SMALLINT  DEFAULT 0,
    matches_updated      SMALLINT  DEFAULT 0,
    duration_ms          INT       DEFAULT NULL,
    message              TEXT      DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
