import { describe, it, expect } from 'vitest';
import { parseTunjanganSPM, parseSPMByKategori } from '../../src/main/excel/spm-parser';
import { writeXlsxFixture } from '../helpers/build-xlsx';
import type { SPMTunjanganRow } from '../../src/shared/types';

describe('parseTunjanganSPM', () => {
  it('parses tunjangan xlsx and aliases nama_pegawai → nama', async () => {
    const filePath = await writeXlsxFixture(
      ['nip', 'nama_pegawai', 'kotor', 'potongan', 'bersih', 'pajak', 'tunj_pajak'],
      [
        ['1001', 'Alice', 5_000_000, 100_000, 4_900_000, 245_000, 245_000],
        ['1002', 'Bob', 4_000_000, 80_000, 3_920_000, 0, 0]
      ]
    );

    const r = await parseTunjanganSPM(filePath);

    expect(r.kategori).toBe('tunjangan');
    expect(r.rowCount).toBe(2);
    if (r.kategori !== 'tunjangan') throw new Error('narrow');
    const rows: SPMTunjanganRow[] = r.rows;
    expect(rows[0]).toEqual({ nip: '1001', nama: 'Alice', bersih: 4_900_000, pajak: 245_000 });
    expect(rows[1]).toEqual({ nip: '1002', nama: 'Bob', bersih: 3_920_000, pajak: 0 });
  });

  it('skips rows with empty nip', async () => {
    const filePath = await writeXlsxFixture(
      ['nip', 'nama_pegawai', 'bersih', 'pajak'],
      [
        ['1001', 'Alice', 1000, 50],
        [null, '', 0, 0],
        ['1002', 'Bob', 2000, 100]
      ]
    );
    const r = await parseTunjanganSPM(filePath);
    expect(r.rowCount).toBe(2);
  });

  it('throws on missing required column', async () => {
    const filePath = await writeXlsxFixture(
      ['nip', 'nama', 'bersih'],
      [['1001', 'Alice', 1000]]
    );
    await expect(parseTunjanganSPM(filePath)).rejects.toThrow(/Missing columns/);
  });

  it('parseSPMByKategori dispatches to tunjangan parser', async () => {
    const filePath = await writeXlsxFixture(
      ['nip', 'nama', 'bersih', 'pajak'],
      [['1001', 'Alice', 1000, 50]]
    );
    const r = await parseSPMByKategori(filePath, 'tunjangan');
    expect(r.kategori).toBe('tunjangan');
  });
});
