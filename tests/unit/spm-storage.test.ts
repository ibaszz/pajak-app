import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copySpmFile, deleteSpmFile, spmDestPath } from '../../src/main/spm/spm-storage';
import { formatSpmFileName, sanitizeForFileName } from '../../src/shared/constants';
import type { Periode } from '../../src/shared/types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pajak-storage-'));
}

const PERIODE: Periode = { nomorUrut: 3, bulan: 3, tahun: 2026, label: 'Maret 2026' };

describe('formatSpmFileName', () => {
  it('builds canonical name', () => {
    expect(formatSpmFileName('00007A', 'gaji', 1, 2026)).toBe('SPM_00007A_GAJI_JANUARI_2026_PNS.xlsx');
  });

  it('uppercases bulan in name', () => {
    expect(formatSpmFileName('X', 'gaji', 3, 2026)).toBe('SPM_X_GAJI_MARET_2026_PNS.xlsx');
  });

  it('sanitizes weird characters in noSPM', () => {
    expect(formatSpmFileName('00/01:A B', 'gaji', 1, 2026)).toBe('SPM_00_01_A_B_GAJI_JANUARI_2026_PNS.xlsx');
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

    const dest = copySpmFile(source, ws, PERIODE, '00001A', 'gaji');

    expect(fs.existsSync(dest)).toBe(true);
    expect(dest).toBe(path.join(ws, '3. Maret', 'SPM_00001A_GAJI_MARET_2026_PNS.xlsx'));
    expect(fs.readFileSync(dest, 'utf-8')).toBe('dummy excel content');
  });

  it('throws if destination already exists', () => {
    const ws = tmpDir();
    const source = path.join(ws, 'source.xlsx');
    fs.writeFileSync(source, 'x');
    copySpmFile(source, ws, PERIODE, '00001A', 'gaji');
    expect(() => copySpmFile(source, ws, PERIODE, '00001A', 'gaji')).toThrow(/sudah ada/);
  });

  it('throws if source missing', () => {
    const ws = tmpDir();
    expect(() => copySpmFile(path.join(ws, 'nope.xlsx'), ws, PERIODE, 'X', 'gaji'))
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
    expect(spmDestPath('/ws', PERIODE, '00001A', 'gaji'))
      .toBe(path.join('/ws', '3. Maret', 'SPM_00001A_GAJI_MARET_2026_PNS.xlsx'));
  });
});
