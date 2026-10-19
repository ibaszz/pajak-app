import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations } from '../../src/main/db/connection';
import { createSpmBatchRepo, periodeKey } from '../../src/main/db/spm-batch-repo';
import type {
  SPMGajiRow,
  SPMTunjanganRow,
  SPMUangMakanRow
} from '../../src/shared/types';

const ROWS: SPMGajiRow[] = [
  {
    nip: '1001', nama: 'Alice',
    gjpokok: 5_000_000,
    tjistri: 0, tjanak: 0, tjupns: 0, tjstruk: 0, tjfungs: 0, pembul: 0,
    tjberas: 300_000, tjpph: 150_000, potpfk10: 50_000
  },
  {
    nip: '1002', nama: 'Bob',
    gjpokok: 3_500_000,
    tjistri: 0, tjanak: 0, tjupns: 0, tjstruk: 0, tjfungs: 0, pembul: 0,
    tjberas: 200_000, tjpph: 80_000, potpfk10: 30_000
  }
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

  it('round-trip tunjangan rows', () => {
    const tunjRows: SPMTunjanganRow[] = [
      { nip: '1001', nama: 'Alice', bersih: 4_900_000, pajak: 245_000 },
      { nip: '1002', nama: 'Bob', bersih: 3_920_000, pajak: 0 }
    ];
    const id = repo.insert(PKEY, 'TJ001', 'Tukin Maret', 'tunjangan', null, tunjRows);
    const found = repo.findById(id);
    expect(found).not.toBeNull();
    expect(found!.kategori).toBe('tunjangan');
    expect(found!.rows).toEqual(tunjRows);
  });

  it('round-trip uang_makan rows', () => {
    const umRows: SPMUangMakanRow[] = [
      { nip: '1001', nama: 'Alice', kotor: 500_000, potongan: 0, bersih: 500_000, pph: 0 },
      { nip: '1002', nama: 'Bob', kotor: 400_000, potongan: 0, bersih: 375_000, pph: 25_000 }
    ];
    const id = repo.insert(PKEY, 'UM001', 'Uang Makan Maret', 'uang_makan', null, umRows);
    const found = repo.findById(id);
    expect(found).not.toBeNull();
    expect(found!.kategori).toBe('uang_makan');
    expect(found!.rows).toEqual(umRows);
  });

  it('mixed kategori in same periode listed in insert order', () => {
    const gajiRow: SPMGajiRow = ROWS[0];
    const tunjRow: SPMTunjanganRow = { nip: '1001', nama: 'Alice', bersih: 100, pajak: 5 };
    const umRow: SPMUangMakanRow = { nip: '1001', nama: 'Alice', kotor: 50, potongan: 0, bersih: 50, pph: 0 };
    repo.insert(PKEY, 'A', 'k', 'gaji', null, [gajiRow]);
    repo.insert(PKEY, 'B', 'k', 'tunjangan', null, [tunjRow]);
    repo.insert(PKEY, 'C', 'k', 'uang_makan', null, [umRow]);
    const list = repo.listByPeriode(PKEY);
    expect(list.map(b => b.kategori)).toEqual(['gaji', 'tunjangan', 'uang_makan']);
    expect(list[0].rows[0]).toEqual(gajiRow);
    expect(list[1].rows[0]).toEqual(tunjRow);
    expect(list[2].rows[0]).toEqual(umRow);
  });
});
