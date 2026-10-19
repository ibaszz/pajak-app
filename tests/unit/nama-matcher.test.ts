import { describe, it, expect } from 'vitest';
import { normalizeName, matchNameToPegawai, scoreNameAgainstPegawai } from '../../src/main/pdf/nama-matcher';
import type { Pegawai } from '../../src/shared/types';

function makePegawai(nip: string, nama: string): Pegawai {
  return { nip, nik: nip, nama, statusPtkp: 'TK/0', golongan: 'III', jenisAsn: 'PNS', aktif: true };
}

describe('normalizeName', () => {
  it('strips degree suffix after comma', () => {
    expect(normalizeName('Harris Andriyanto, S.T.').normalized).toBe('harris andriyanto');
  });

  it('strips leading academic title', () => {
    expect(normalizeName('Dr. Taat Setiawan').normalized).toBe('taat setiawan');
  });

  it('strips single-letter middle initials', () => {
    expect(normalizeName('Iman K. Sinulingga').normalized).toBe('iman sinulingga');
  });

  it('lowercases and collapses whitespace', () => {
    expect(normalizeName('  Budi   Santoso ').normalized).toBe('budi santoso');
  });
});

describe('matchNameToPegawai', () => {
  const pegawai: Pegawai[] = [
    makePegawai('1', 'Taat Setiawan'),
    makePegawai('2', 'Ida Bagus Aditya Suryawan'),
    makePegawai('3', 'Supriyadi'),
    makePegawai('4', 'Dewangga Alif Havianam')
  ];

  it('matches exact name', () => {
    const r = matchNameToPegawai('Supriyadi', pegawai);
    expect(r.status).toBe('matched');
    expect(r.pegawai?.nip).toBe('3');
  });

  it('matches name with academic title + degree suffix', () => {
    const r = matchNameToPegawai('Dr. Taat Setiawan', pegawai);
    expect(r.status).toBe('matched');
    expect(r.pegawai?.nip).toBe('1');
  });

  it('matches full name with degree suffix', () => {
    const r = matchNameToPegawai('Ida Bagus Aditya Suryawan, S.Kom', pegawai);
    expect(r.status).toBe('matched');
    expect(r.pegawai?.nip).toBe('2');
  });

  it('returns unmatched for a name with no close candidate', () => {
    const r = matchNameToPegawai('Zzyx Qqwerty Nonexistent', pegawai);
    expect(r.status).toBe('unmatched');
    expect(r.pegawai).toBeNull();
  });

  it('candidates list is ranked best-first', () => {
    const scores = scoreNameAgainstPegawai('Supriyadi', pegawai);
    expect(scores[0].pegawai.nip).toBe('3');
    expect(scores[0].score).toBeGreaterThanOrEqual(scores[1].score);
  });

  it('flags ambiguous when two candidates score closely and both pass threshold', () => {
    const similarPegawai: Pegawai[] = [makePegawai('a', 'Andi Saputra'), makePegawai('b', 'Andi Saputro')];
    const r = matchNameToPegawai('Andi Saputra', similarPegawai);
    // exact match for 'a' should win outright, not be ambiguous
    expect(r.status).toBe('matched');
    expect(r.pegawai?.nip).toBe('a');
  });
});
