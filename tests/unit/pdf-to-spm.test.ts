import { describe, it, expect } from 'vitest';
import { finalizePdfToSPM } from '../../src/main/pdf/pdf-to-spm';
import type { ParsedPdf } from '../../src/shared/types';

function makeParsedPdf(overrides: Partial<ParsedPdf> = {}): ParsedPdf {
  return {
    filePath: '/tmp/honor.pdf',
    fileName: 'honor.pdf',
    sourceKind: 'honorarium_pdf',
    rowCount: 2,
    rows: [
      {
        namaAsli: 'Agus Setiawan',
        kotor: 7_200_000,
        potongan: 1_080_000,
        bersih: 6_120_000,
        pph: 15,
        matchStatus: 'matched',
        nip: '198001012000011001',
        candidates: []
      },
      {
        namaAsli: 'Nama Ambigu',
        kotor: 1_000_000,
        potongan: 50_000,
        bersih: 950_000,
        pph: 5,
        matchStatus: 'ambiguous',
        nip: null,
        candidates: [
          { nip: '1', nama: 'Nama Ambigu Satu', score: 0.9 },
          { nip: '2', nama: 'Nama Ambigu Dua', score: 0.88 }
        ]
      }
    ],
    ...overrides
  };
}

describe('finalizePdfToSPM', () => {
  it('converts resolved rows into kategori uang_makan ParsedSPM', () => {
    const parsed = makeParsedPdf();
    const result = finalizePdfToSPM(parsed, { 1: '2' }); // pick candidate NIP '2' for the ambiguous row
    expect(result.kategori).toBe('uang_makan');
    expect(result.rowCount).toBe(2);
    if (result.kategori !== 'uang_makan') throw new Error('narrow');
    expect(result.rows[0]).toEqual({
      nip: '198001012000011001',
      nama: 'Agus Setiawan',
      kotor: 7_200_000,
      potongan: 1_080_000,
      bersih: 6_120_000,
      pph: 15
    });
    expect(result.rows[1]).toEqual({
      nip: '2',
      nama: 'Nama Ambigu',
      kotor: 1_000_000,
      potongan: 50_000,
      bersih: 950_000,
      pph: 5
    });
  });

  it('throws when a row has no resolved NIP and no override provided', () => {
    const parsed = makeParsedPdf();
    expect(() => finalizePdfToSPM(parsed, {})).toThrow(/belum punya NIP terkonfirmasi/);
  });
});
