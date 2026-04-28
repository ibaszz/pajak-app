import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations } from '../../src/main/db/connection';
import { createSpmBatchRepo, periodeKey } from '../../src/main/db/spm-batch-repo';
import type { SPMGajiRow } from '../../src/shared/types';

const ROWS: SPMGajiRow[] = [
  { nip: '1001', nama: 'Alice', gjpokok: 5_000_000, tjberas: 300_000, tjpph: 150_000, potpfk10: 50_000 },
  { nip: '1002', nama: 'Bob',   gjpokok: 3_500_000, tjberas: 200_000, tjpph:  80_000, potpfk10: 30_000 }
];

const PKEY = '2026-03';

describe('spm-batch-repo', () => {
  let db: Database.Database;
  let repo: ReturnType<typeof createSpmBatchRepo>;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    applyMigrations(db);
    repo = createSpmBatchRepo(db);
  });

  it('periodeKey formats correctly', () => {
    expect(periodeKey({ nomorUrut: 3, bulan: 3, tahun: 2026, label: 'Maret 2026' })).toBe('2026-03');
    expect(periodeKey({ nomorUrut: 1, bulan: 12, tahun: 2025, label: 'Desember 2025' })).toBe('2025-12');
  });

  it('insert + listByPeriode roundtrip', () => {
    const id = repo.insert(PKEY, '00001A', 'Gaji Maret', 'gaji', '/tmp/file.xlsx', ROWS);
    expect(id).toBeGreaterThan(0);
    const list = repo.listByPeriode(PKEY);
    expect(list).toHaveLength(1);
    expect(list[0].noSPM).toBe('00001A');
    expect(list[0].storedFile).toBe('/tmp/file.xlsx');
    expect(list[0].rows).toHaveLength(2);
    expect(list[0].rows[0].nip).toBe('1001');
  });

  it('insert preserves row order', () => {
    repo.insert(PKEY, 'X', 'k', 'gaji', null, ROWS);
    const [batch] = repo.listByPeriode(PKEY);
    expect(batch.rows.map(r => r.nip)).toEqual(['1001', '1002']);
  });

  it('has() returns true after insert, false otherwise', () => {
    expect(repo.has(PKEY, '00001A')).toBe(false);
    repo.insert(PKEY, '00001A', 'k', 'gaji', null, ROWS);
    expect(repo.has(PKEY, '00001A')).toBe(true);
    expect(repo.has(PKEY, '00002B')).toBe(false);
    expect(repo.has('2026-04', '00001A')).toBe(false);
  });

  it('UNIQUE(periode, no_spm) blocks duplicate insert', () => {
    repo.insert(PKEY, '00001A', 'k', 'gaji', null, ROWS);
    expect(() => repo.insert(PKEY, '00001A', 'k2', 'gaji', null, ROWS)).toThrow();
  });

  it('findById returns batch with rows or null', () => {
    const id = repo.insert(PKEY, '00001A', 'k', 'gaji', '/x.xlsx', ROWS);
    const found = repo.findById(id);
    expect(found).not.toBeNull();
    expect(found!.noSPM).toBe('00001A');
    expect(found!.storedFile).toBe('/x.xlsx');
    expect(found!.rows).toHaveLength(2);
    expect(repo.findById(99999)).toBeNull();
  });

  it('delete removes batch and cascades rows', () => {
    const id = repo.insert(PKEY, '00001A', 'k', 'gaji', null, ROWS);
    const beforeRows = db.prepare('SELECT COUNT(*) as c FROM spm_row').get() as { c: number };
    expect(beforeRows.c).toBe(2);
    repo.delete(id);
    expect(repo.findById(id)).toBeNull();
    const afterRows = db.prepare('SELECT COUNT(*) as c FROM spm_row').get() as { c: number };
    expect(afterRows.c).toBe(0);
  });

  it('listSummariesByPeriode returns counts and metadata only', () => {
    repo.insert(PKEY, '00001A', 'Gaji Maret', 'gaji', '/a.xlsx', ROWS);
    repo.insert(PKEY, '00002B', 'Gaji Maret CPNS', 'gaji', null, [ROWS[0]]);
    const summaries = repo.listSummariesByPeriode(PKEY);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].noSPM).toBe('00001A');
    expect(summaries[0].rowCount).toBe(2);
    expect(summaries[0].storedFile).toBe('/a.xlsx');
    expect(summaries[1].noSPM).toBe('00002B');
    expect(summaries[1].rowCount).toBe(1);
    expect(summaries[1].storedFile).toBeNull();
  });

  it('listByPeriode is scoped by periode', () => {
    repo.insert(PKEY, 'A', 'k', 'gaji', null, ROWS);
    repo.insert('2026-04', 'B', 'k', 'gaji', null, ROWS);
    expect(repo.listByPeriode(PKEY).map(b => b.noSPM)).toEqual(['A']);
    expect(repo.listByPeriode('2026-04').map(b => b.noSPM)).toEqual(['B']);
  });
});
