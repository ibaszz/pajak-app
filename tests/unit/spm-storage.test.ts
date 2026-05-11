import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  copySpmFile,
  deleteSpmFile,
  determinePnsSuffix,
  spmDestPath
} from '../../src/main/spm/spm-storage';
import { formatSpmFileName, sanitizeForFileName } from '../../src/shared/constants';
import type { Pegawai, Periode, SPMGajiRow } from '../../src/shared/types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pajak-storage-'));
}

const PERIODE: Periode = { nomorUrut: 3, bulan: 3, tahun: 2026, label: 'Maret 2026' };

describe('formatSpmFileName', () => {
  it('builds canonical name with suffix', () => {
    expect(formatSpmFileName('00007A', 'gaji', 1, 2026, 'PNS')).toBe('SPM_00007A_GAJI_JANUARI_2026_PNS.xlsx');
  });

  it('uppercases bulan in name', () => {
    expect(formatSpmFileName('X', 'gaji', 3, 2026, 'PNS')).toBe('SPM_X_GAJI_MARET_2026_PNS.xlsx');
  });

  it('sanitizes weird characters in noSPM', () => {
    expect(formatSpmFileName('00/01:A B', 'gaji', 1, 2026, 'PNS')).toBe('SPM_00_01_A_B_GAJI_JANUARI_2026_PNS.xlsx');
  });

  it('uses PPPK suffix for PPPK-only batch', () => {
    expect(formatSpmFileName('X', 'tunjangan', 3, 2026, 'PPPK'))
      .toBe('SPM_X_TUNJANGAN_MARET_2026_PPPK.xlsx');
  });

  it('uses MIX suffix when batch has both PNS and PPPK', () => {
    expect(formatSpmFileName('X', 'uang_makan', 3, 2026, 'MIX'))
      .toBe('SPM_X_UANG_MAKAN_MARET_2026_MIX.xlsx');
  });
});

describe('sanitizeForFileName', () => {
  it('replaces non-alphanumeric runs with single underscore', () => {
    expect(sanitizeForFileName('a/b:c d')).toBe('a_b_c_d');
  });
  it('trims leading/trailing underscores', () => {
    expect(sanitizeForFileName('///abc///')).toBe('abc');
  });
});

describe('copySpmFile', () => {
  it('copies file to per-periode subfolder with rapi name', () => {
    const ws = tmpDir();
    const source = path.join(ws, 'source.xlsx');
    fs.writeFileSync(source, 'dummy excel content');

    const dest = copySpmFile(source, ws, PERIODE, '00001A', 'gaji', 'PNS');

    expect(fs.existsSync(dest)).toBe(true);
    expect(dest).toBe(path.join(ws, '3. Maret', 'SPM_00001A_GAJI_MARET_2026_PNS.xlsx'));
    expect(fs.readFileSync(dest, 'utf-8')).toBe('dummy excel content');
  });

  it('throws if destination already exists', () => {
    const ws = tmpDir();
    const source = path.join(ws, 'source.xlsx');
    fs.writeFileSync(source, 'x');
    copySpmFile(source, ws, PERIODE, '00001A', 'gaji', 'PNS');
    expect(() => copySpmFile(source, ws, PERIODE, '00001A', 'gaji', 'PNS')).toThrow(/sudah ada/);
  });

  it('throws if source missing', () => {
    const ws = tmpDir();
    expect(() => copySpmFile(path.join(ws, 'nope.xlsx'), ws, PERIODE, 'X', 'gaji', 'PNS'))
      .toThrow(/tidak ditemukan/);
  });
});

describe('deleteSpmFile', () => {
  it('deletes existing file', () => {
    const ws = tmpDir();
    const f = path.join(ws, 'a.xlsx');
    fs.writeFileSync(f, 'x');
    deleteSpmFile(f);
    expect(fs.existsSync(f)).toBe(false);
  });

  it('is idempotent for non-existent or null', () => {
    expect(() => deleteSpmFile(null)).not.toThrow();
    expect(() => deleteSpmFile(undefined)).not.toThrow();
    expect(() => deleteSpmFile('/no/such/path/xyz.xlsx')).not.toThrow();
  });
});

describe('spmDestPath', () => {
  it('produces consistent path for given periode', () => {
    expect(spmDestPath('/ws', PERIODE, '00001A', 'gaji', 'PNS'))
      .toBe(path.join('/ws', '3. Maret', 'SPM_00001A_GAJI_MARET_2026_PNS.xlsx'));
  });

  it('formats kategori correctly for non-gaji', () => {
    expect(spmDestPath('/ws', PERIODE, 'TJ1', 'tunjangan', 'PPPK'))
      .toBe(path.join('/ws', '3. Maret', 'SPM_TJ1_TUNJANGAN_MARET_2026_PPPK.xlsx'));
    expect(spmDestPath('/ws', PERIODE, 'UM1', 'uang_makan', 'MIX'))
      .toBe(path.join('/ws', '3. Maret', 'SPM_UM1_UANG_MAKAN_MARET_2026_MIX.xlsx'));
  });
});

describe('determinePnsSuffix', () => {
  const PEG_PNS: Pegawai = { nip: '1001', nik: 'A', nama: 'Alice', statusPtkp: 'K/1', golongan: null, jenisAsn: 'PNS', aktif: true };
  const PEG_PPPK: Pegawai = { nip: '1002', nik: 'B', nama: 'Bob', statusPtkp: 'TK/0', golongan: null, jenisAsn: 'PPPK', aktif: true };

  function gajiRow(nip: string): SPMGajiRow {
    return {
      nip, nama: '',
      gjpokok: 0, tjistri: 0, tjanak: 0, tjupns: 0, tjstruk: 0, tjfungs: 0,
      pembul: 0, tjberas: 0, tjpph: 0, potpfk10: 0
    };
  }

  it('returns PNS when all rows are PNS', () => {
    expect(determinePnsSuffix([gajiRow('1001')], [PEG_PNS, PEG_PPPK])).toBe('PNS');
  });

  it('returns PPPK when all rows are PPPK', () => {
    expect(determinePnsSuffix([gajiRow('1002')], [PEG_PNS, PEG_PPPK])).toBe('PPPK');
  });

  it('returns MIX when both kinds present', () => {
    expect(determinePnsSuffix([gajiRow('1001'), gajiRow('1002')], [PEG_PNS, PEG_PPPK])).toBe('MIX');
  });

  it('falls back to PNS when no rows match pegawai master', () => {
    expect(determinePnsSuffix([gajiRow('9999')], [PEG_PNS])).toBe('PNS');
  });
});
