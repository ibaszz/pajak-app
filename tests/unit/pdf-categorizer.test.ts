import { describe, it, expect } from 'vitest';
import { detectPdfKindFromFilename, detectPdfKindFromText } from '../../src/main/pdf/pdf-categorizer';

describe('detectPdfKindFromFilename', () => {
  it('detects uang_makan from UM prefix', () => {
    expect(detectPdfKindFromFilename('UM_Agust_2026_P3K.pdf')).toBe('uang_makan_pdf');
  });

  it('detects uang_makan from uangmakan keyword', () => {
    expect(detectPdfKindFromFilename('uangmakan_202608.pdf')).toBe('uang_makan_pdf');
  });

  it('detects honorarium from honor keyword', () => {
    expect(detectPdfKindFromFilename('honorarium_mei_agustus.pdf')).toBe('honorarium_pdf');
  });

  it('returns null for ambiguous filename', () => {
    expect(detectPdfKindFromFilename('mei-agustus (2).pdf')).toBeNull();
  });
});

describe('detectPdfKindFromText', () => {
  it('detects uang_makan from header phrase', () => {
    expect(detectPdfKindFromText('Daftar Perhitungan Uang Makan\nSatuan Kerja: X')).toBe('uang_makan_pdf');
  });

  it('detects honorarium from header phrase', () => {
    expect(detectPdfKindFromText('DAFTAR PEMBAYARAN\nHonorarium Pengangkatan Pejabat KPA')).toBe('honorarium_pdf');
  });

  it('returns null when no header phrase matches', () => {
    expect(detectPdfKindFromText('some unrelated document text')).toBeNull();
  });
});
