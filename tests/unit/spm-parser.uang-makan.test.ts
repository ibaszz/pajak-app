import { describe, it, expect } from 'vitest';
import { parseUangMakanSPM, parseSPMByKategori } from '../../src/main/excel/spm-parser';
import { writeXlsxFixture } from '../helpers/build-xlsx';
import type { SPMUangMakanRow } from '../../src/shared/types';

describe('parseUangMakanSPM', () => {
  it('parses uang_makan xlsx and aliases nmpeg → nama, ignores kdgol', async () => {
    const filePath = await writeXlsxFixture(
      ['nip', 'nmpeg', 'kdgol', 'pph', 'kotor', 'potongan', 'bersih'],
      [
        ['1001', 'Alice', 'IIIa', 0, 500_000, 0, 500_000],
        ['1002', 'Bob', 'IIb', 25_000, 400_000, 0, 375_000]
      ]
    );

    const r = await parseUangMakanSPM(filePath);
    expect(r.kategori).toBe('uang_makan');
    expect(r.rowCount).toBe(2);
    if (r.kategori !== 'uang_makan') throw new Error('narrow');
    const rows: SPMUangMakanRow[] = r.rows;
    expect(rows[0]).toEqual({
      nip: '1001', nama: 'Alice',
      kotor: 500_000, potongan: 0, bersih: 500_000, pph: 0
    });
    expect(rows[1]).toEqual({
      nip: '1002', nama: 'Bob',
      kotor: 400_000, potongan: 0, bersih: 375_000, pph: 25_000
    });
  });

  it('throws on missing required column', async () => {
    const filePath = await writeXlsxFixture(
      ['nip', 'nama', 'kotor', 'bersih'],
      [['1001', 'Alice', 1000, 1000]]
    );
    await expect(parseUangMakanSPM(filePath)).rejects.toThrow(/Missing columns/);
  });

  it('parseSPMByKategori dispatches to uang_makan parser', async () => {
    const filePath = await writeXlsxFixture(
      ['nip', 'nama', 'kotor', 'potongan', 'bersih', 'pph'],
      [['1001', 'Alice', 1000, 0, 1000, 0]]
    );
    const r = await parseSPMByKategori(filePath, 'uang_makan');
    expect(r.kategori).toBe('uang_makan');
  });
});
