-- PastCraft Coordinates database schema
-- SQLite 3

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Admin accounts (password stored as hex-encoded SHA-256 HMAC)
CREATE TABLE IF NOT EXISTS admins (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT NOT NULL UNIQUE,
    pw_hash   TEXT NOT NULL   -- sha256 hmac hex
);

-- Global settings (spawn coordinates, etc.)
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Nations, in display order
CREATE TABLE IF NOT EXISTS nations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0
);

-- Locations belonging to a nation, in display order
CREATE TABLE IF NOT EXISTS locations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nation_id     INTEGER NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    coordinates   TEXT    NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL   -- unix timestamp
);
