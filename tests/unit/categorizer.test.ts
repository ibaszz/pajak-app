import { describe, it, expect } from 'vitest';
import { detectKategoriFromFilename } from '../../src/main/excel/categorizer';

describe('detectKategoriFromFilename', () => {
  it('detects gaji from Gaji_Bank filename', () => {
    expect(detectKategoriFromFilename('Gaji_Bank_41262000_1_000270.xlsx')).toBe('gaji');
  });

  it('detects gaji from lampiranspm filename', () => {
    expect(detectKategoriFromFilename('lampiranspm.xls')).toBe('gaji');
    expect(detectKategoriFromFilename('lampiranspm (1).xlsx')).toBe('gaji');
  });

  it('detects tunjangan from Tukin filename', () => {
    expect(detectKategoriFromFilename('Hasil_Excel_Detail_Tukin_export_1770601453523.xlsx')).toBe('tunjangan');
  });

  it('detects tunjangan from Tunsus filename', () => {
    expect(detectKategoriFromFilename('2. SPM 0005A - Tunsus CKO Desember PNS CPNS - foo.xlsx')).toBe('tunjangan');
  });

  it('detects uang_makan from Uangmakan filename', () => {
    expect(detectKategoriFromFilename('Uangmakan_202601_000044_export.xlsx')).toBe('uang_makan');
  });

  it('detects uang_makan case-insensitive', () => {
    expect(detectKategoriFromFilename('uangmakan_20-02-2026.xlsx')).toBe('uang_makan');
  });

  it('detects uang_makan from UM prefix', () => {
    expect(detectKategoriFromFilename('UM PNS - SPM 00053A - foo.xlsx')).toBe('uang_makan');
    expect(detectKategoriFromFilename('UM PPPK - SPM 00054A - bar.xlsx')).toBe('uang_makan');
  });

  it('returns null when no match', () => {
    expect(detectKategoriFromFilename('random_file.xlsx')).toBeNull();
    expect(detectKategoriFromFilename('')).toBeNull();
  });

  it('strips directory path', () => {
    expect(detectKategoriFromFilename('C:/path/to/Gaji_Bank_foo.xlsx')).toBe('gaji');
  });
});
