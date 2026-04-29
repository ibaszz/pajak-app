import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { writePajakOutput, writeEmptyPajakOutput } from '../../src/main/excel/output-writer';
import type { Pegawai, SPMGajiRow, Periode } from '../../src/shared/types';

function tmpFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pajak-test-'));
  return path.join(dir, 'out.xlsx');
}

const PEGAWAI: Pegawai[] = [
  { nip: '1001', nik: '3201001', nama: 'Alice', statusPtkp: 'K/1', golongan: 'IIIa', jenisAsn: 'PNS', aktif: true },
  { nip: '1002', nik: '3201002', nama: 'Bob', statusPtkp: 'TK/0', golongan: 'IIb', jenisAsn: 'PPPK', aktif: true }
];

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

const PERIODE: Periode = { nomorUrut: 3, bulan: 3, tahun: 2026, label: 'Maret 2026' };

describe('writePajakOutput', () => {
  it('creates output xlsx with Ref Pegawai and Gaji Ledger sheets', async () => {
    const outPath = tmpFile();
    const result = await writePajakOutput({
      outputPath: outPath,
      pegawai: PEGAWAI,
      gajiRows: [{ rows: ROWS, keterangan: 'Gaji Maret', noSPM: '00001A' }],
      periode: PERIODE
    });

    expect(result.outputPath).toBe(outPath);
    expect(result.rowsWritten).toBe(2);
    expect(fs.existsSync(outPath)).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);

    const ref = wb.getWorksheet('Ref Pegawai');
    expect(ref).toBeDefined();
    expect(ref!.rowCount).toBeGreaterThanOrEqual(3);

    const ledger = wb.getWorksheet('Gaji Ledger');
    expect(ledger).toBeDefined();
    expect(ledger!.rowCount).toBeGreaterThanOrEqual(3);

    const headerRow = ledger!.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((c, i) => { headers[i] = String(c.value); });
    const nipCol = headers.findIndex(h => h?.toLowerCase() === 'nip');
    const nominalCol = headers.findIndex(h => h?.toLowerCase() === 'nominal');
    const ketCol = headers.findIndex(h => h?.toLowerCase() === 'keterangan');
    const spmCol = headers.findIndex(h => h?.toLowerCase() === 'spm');
    const namaCol = headers.findIndex(h => h?.toLowerCase() === 'nama');
    expect(nipCol).toBeGreaterThan(0);
    expect(nominalCol).toBeGreaterThan(0);

    const row2 = ledger!.getRow(2);
    expect(String(row2.getCell(nipCol).value)).toBe('1001');
    expect(Number(row2.getCell(nominalCol).value)).toBe(5_300_000);
    expect(String(row2.getCell(ketCol).value)).toBe('Gaji Maret');
    expect(String(row2.getCell(spmCol).value)).toBe('00001A');

    const namaCell = row2.getCell(namaCol);
    expect(namaCell.formula).toMatch(/VLOOKUP.*Ref Pegawai/i);
  });

  it('writeEmptyPajakOutput creates file with header-only Gaji Ledger', async () => {
    const outPath = tmpFile();
    const result = await writeEmptyPajakOutput({
      outputPath: outPath,
      pegawai: PEGAWAI,
      periode: PERIODE
    });

    expect(result.rowsWritten).toBe(0);
    expect(fs.existsSync(outPath)).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);

    const ref = wb.getWorksheet('Ref Pegawai');
    expect(ref).toBeDefined();
    expect(ref!.rowCount).toBe(3); // header + 2 pegawai

    const ledger = wb.getWorksheet('Gaji Ledger');
    expect(ledger).toBeDefined();
    expect(ledger!.rowCount).toBe(1); // header only
  });

  it('nominal sums all PNS allowance components', async () => {
    const outPath = tmpFile();
    const row: SPMGajiRow = {
      nip: '1001', nama: 'Alice',
      gjpokok: 5_000_000,
      tjistri: 500_000,
      tjanak: 200_000,
      tjupns: 185_000,
      tjstruk: 540_000,
      tjfungs: 0,
      pembul: 75,
      tjberas: 300_000,
      tjpph: 150_000,
      potpfk10: 50_000
    };
    await writePajakOutput({
      outputPath: outPath,
      pegawai: PEGAWAI,
      gajiRows: [{ rows: [row], keterangan: 'k', noSPM: 'X' }],
      periode: PERIODE
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);
    const ledger = wb.getWorksheet('Gaji Ledger')!;
    const headers: string[] = [];
    ledger.getRow(1).eachCell((c, i) => { headers[i] = String(c.value); });
    const nominalCol = headers.findIndex(h => h?.toLowerCase() === 'nominal');
    const expected =
      row.gjpokok + row.tjistri + row.tjanak + row.tjupns +
      row.tjstruk + row.tjfungs + row.pembul + row.tjberas;
    expect(Number(ledger.getRow(2).getCell(nominalCol).value)).toBe(expected);
  });

  it('overwrites existing output file', async () => {
    const outPath = tmpFile();
    fs.writeFileSync(outPath, 'old content');
    await writePajakOutput({
      outputPath: outPath,
      pegawai: PEGAWAI,
      gajiRows: [{ rows: ROWS, keterangan: 'X', noSPM: 'Y' }],
      periode: PERIODE
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);
    expect(wb.getWorksheet('Ref Pegawai')).toBeDefined();
  });
});
