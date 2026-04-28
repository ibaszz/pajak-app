import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations } from '../../src/main/db/connection';
import { createPegawaiRepo } from '../../src/main/db/pegawai-repo';

describe('pegawai-repo', () => {
  let db: Database.Database;
  let repo: ReturnType<typeof createPegawaiRepo>;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
    repo = createPegawaiRepo(db);
  });

  it('lists empty when no rows', () => {
    expect(repo.list()).toEqual([]);
  });

  it('upserts and lists pegawai', () => {
    repo.upsert({
      nip: '199001012020121001',
      nik: '3201012345678901',
      nama: 'Budi Santoso',
      statusPtkp: 'K/2',
      golongan: 'IIIa',
      jenisAsn: 'PNS',
      aktif: true
    });
    const all = repo.list();
    expect(all).toHaveLength(1);
    expect(all[0].nama).toBe('Budi Santoso');
    expect(all[0].jenisAsn).toBe('PNS');
  });

  it('upsert updates existing row', () => {
    const base = {
      nip: '1', nik: '11', nama: 'A', statusPtkp: 'TK/0',
      golongan: null, jenisAsn: 'PPPK' as const, aktif: true
    };
    repo.upsert(base);
    repo.upsert({ ...base, nama: 'A-updated' });
    expect(repo.list()[0].nama).toBe('A-updated');
  });

  it('findByNip returns null when not found', () => {
    expect(repo.findByNip('nonexistent')).toBeNull();
  });
});
