import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pegawai (
  nip           TEXT PRIMARY KEY,
  nik           TEXT NOT NULL,
  nama          TEXT NOT NULL,
  status_ptkp   TEXT NOT NULL,
  golongan      TEXT,
  jenis_asn     TEXT NOT NULL CHECK (jenis_asn IN ('PNS','PPPK')),
  aktif         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS process_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  periode      TEXT,
  file_name    TEXT,
  kategori     TEXT,
  no_spm       TEXT,
  keterangan   TEXT,
  rows_count   INTEGER,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spm_batch (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  periode     TEXT NOT NULL,
  no_spm      TEXT NOT NULL,
  keterangan  TEXT NOT NULL,
  kategori    TEXT NOT NULL,
  stored_file TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(periode, no_spm)
);

CREATE TABLE IF NOT EXISTS spm_row (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id   INTEGER NOT NULL REFERENCES spm_batch(id) ON DELETE CASCADE,
  nip        TEXT NOT NULL,
  nama       TEXT NOT NULL,
  gjpokok    REAL NOT NULL,
  tjistri    REAL NOT NULL DEFAULT 0,
  tjanak     REAL NOT NULL DEFAULT 0,
  tjupns     REAL NOT NULL DEFAULT 0,
  tjstruk    REAL NOT NULL DEFAULT 0,
  tjfungs    REAL NOT NULL DEFAULT 0,
  pembul     REAL NOT NULL DEFAULT 0,
  tjberas    REAL NOT NULL,
  tjpph      REAL NOT NULL,
  potpfk10   REAL NOT NULL,
  row_order  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spm_row_batch ON spm_row(batch_id);
`;

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run();
  }
}

export function applyMigrations(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
  // Add columns to existing tables (CREATE TABLE IF NOT EXISTS skips if table exists)
  ensureColumn(db, 'spm_batch', 'stored_file', 'stored_file TEXT');
  ensureColumn(db, 'spm_row', 'tjistri', 'tjistri REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'spm_row', 'tjanak',  'tjanak  REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'spm_row', 'tjupns',  'tjupns  REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'spm_row', 'tjstruk', 'tjstruk REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'spm_row', 'tjfungs', 'tjfungs REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'spm_row', 'pembul',  'pembul  REAL NOT NULL DEFAULT 0');
}

export function openDatabase(userDataDir: string): Database.Database {
  fs.mkdirSync(userDataDir, { recursive: true });
  const dbPath = path.join(userDataDir, 'pajak.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applyMigrations(db);
  return db;
}
