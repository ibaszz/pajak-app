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
`;

export function applyMigrations(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
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
