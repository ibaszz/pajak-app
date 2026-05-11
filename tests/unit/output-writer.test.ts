import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { writePajakOutput, writeEmptyPajakOutput } from '../../src/main/excel/output-writer';
import type {
  Pegawai,
  Periode,
  SPMGajiRow,
  SPMTunjanganRow,
  SPMUangMakanRow
} from '../../src/shared/types';

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

function callWrite(outPath: string, opts: {
  gajiRows?: { rows: SPMGajiRow[]; keterangan: string; noSPM: string }[];
  tunjanganRows?: { rows: SPMTunjanganRow[]; keterangan: string; noSPM: string }[];
  uangMakanRows?: { rows: SPMUangMakanRow[]; keterangan: string; noSPM: string }[];
} = {}) {
  return writePajakOutput({
    outputPath: outPath,
    pegawai: PEGAWAI,
    gajiRows: opts.gajiRows ?? [],
    tunjanganRows: opts.tunjanganRows ?? [],
    uangMakanRows: opts.uangMakanRows ?? [],
    periode: PERIODE
  });
}

function readHeaders(ws: ExcelJS.Worksheet): string[] {
  const headers: string[] = [];
  ws.getRow(1).eachCell((c, i) => { headers[i] = String(c.value); });
  return headers;
}

describe('writePajakOutput', () => {
  it('creates output xlsx with Ref Pegawai, Gaji Ledger and Non Gaji Ledger sheets', async () => {
    const outPath = tmpFile();
    const result = await callWrite(outPath, {
      gajiRows: [{ rows: ROWS, keterangan: 'Gaji Maret', noSPM: '00001A' }]
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

    const nonGaji = wb.getWorksheet('Non Gaji Ledger');
    expect(nonGaji).toBeDefined();
    expect(nonGaji!.rowCount).toBe(1); // header-only

    const headers = readHeaders(ledger!);
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

  it('writeEmptyPajakOutput creates file with header-only Gaji Ledger and Non Gaji Ledger', async () => {
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

    const nonGaji = wb.getWorksheet('Non Gaji Ledger');
    expect(nonGaji).toBeDefined();
    expect(nonGaji!.rowCount).toBe(1); // header only
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
    await callWrite(outPath, {
      gajiRows: [{ rows: [row], keterangan: 'k', noSPM: 'X' }]
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);
    const ledger = wb.getWorksheet('Gaji Ledger')!;
    const headers = readHeaders(ledger);
    const nominalCol = headers.findIndex(h => h?.toLowerCase() === 'nominal');
    const expected =
      row.gjpokok + row.tjistri + row.tjanak + row.tjupns +
      row.tjstruk + row.tjfungs + row.pembul + row.tjberas;
    expect(Number(ledger.getRow(2).getCell(nominalCol).value)).toBe(expected);
  });

  it('overwrites existing output file', async () => {
    const outPath = tmpFile();
    fs.writeFileSync(outPath, 'old content');
    await callWrite(outPath, {
      gajiRows: [{ rows: ROWS, keterangan: 'X', noSPM: 'Y' }]
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);
    expect(wb.getWorksheet('Ref Pegawai')).toBeDefined();
  });

  it('merges tunjangan rows into Gaji Ledger after gaji rows; PNS keeps tunjPph, PPPK zeroed', async () => {
    const outPath = tmpFile();
    const tunjRows: SPMTunjanganRow[] = [
      { nip: '1001', nama: 'Alice', bersih: 4_900_000, pajak: 245_000 }, // PNS
      { nip: '1002', nama: 'Bob', bersih: 3_920_000, pajak: 196_000 }    // PPPK
    ];
    await callWrite(outPath, {
      gajiRows: [{ rows: ROWS, keterangan: 'Gaji', noSPM: 'G1' }],
      tunjanganRows: [{ rows: tunjRows, keterangan: 'Tukin', noSPM: 'T1' }]
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);
    const ledger = wb.getWorksheet('Gaji Ledger')!;
    expect(ledger.rowCount).toBe(5); // header + 2 gaji + 2 tunjangan

    const headers = readHeaders(ledger);
    const nipCol = headers.findIndex(h => h?.toLowerCase() === 'nip');
    const nominalCol = headers.findIndex(h => h?.toLowerCase() === 'nominal');
    const pphCol = headers.findIndex(h => h?.toLowerCase() === 'pph');
    const tunjPphCol = headers.findIndex(h => h?.toLowerCase() === 'tunjangan pph');
    const potCol = headers.findIndex(h => h === 'potpfk10');
    const ketCol = headers.findIndex(h => h?.toLowerCase() === 'keterangan');
    const spmCol = headers.findIndex(h => h?.toLowerCase() === 'spm');

    // Row 4 = first tunjangan row (Alice, PNS)
    const r4 = ledger.getRow(4);
    expect(String(r4.getCell(nipCol).value)).toBe('1001');
    expect(Number(r4.getCell(nominalCol).value)).toBe(4_900_000);
    expect(Number(r4.getCell(pphCol).value)).toBe(245_000);
    expect(Number(r4.getCell(tunjPphCol).value)).toBe(245_000);
    expect(Number(r4.getCell(potCol).value)).toBe(0);
    expect(String(r4.getCell(ketCol).value)).toBe('Tukin');
    expect(String(r4.getCell(spmCol).value)).toBe('T1');

    // Row 5 = second tunjangan row (Bob, PPPK)
    const r5 = ledger.getRow(5);
    expect(String(r5.getCell(nipCol).value)).toBe('1002');
    expect(Number(r5.getCell(nominalCol).value)).toBe(3_920_000);
    expect(Number(r5.getCell(pphCol).value)).toBe(196_000);
    expect(Number(r5.getCell(tunjPphCol).value)).toBe(0); // PPPK → 0
  });

  it('builds Non Gaji Ledger with 12 columns and VLOOKUP formulas for uang_makan', async () => {
    const outPath = tmpFile();
    const umRows: SPMUangMakanRow[] = [
      { nip: '1001', nama: 'Alice', kotor: 500_000, potongan: 0, bersih: 500_000, pph: 0 },
      { nip: '1002', nama: 'Bob', kotor: 400_000, potongan: 0, bersih: 375_000, pph: 25_000 }
    ];
    await callWrite(outPath, {
      uangMakanRows: [{ rows: umRows, keterangan: 'Uang Makan', noSPM: 'UM1' }]
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);
    const ws = wb.getWorksheet('Non Gaji Ledger')!;
    const headers = readHeaders(ws);

    // Check 12 expected columns in order
    expect(headers.slice(1)).toEqual([
      'NIP', 'NIK', 'Nama', 'Status', 'PTKP', 'Golongan',
      'Kotor', 'potongan', 'bersih', 'PPH', 'Keterangan', 'SPM'
    ]);

    expect(ws.rowCount).toBe(3); // header + 2 rows

    const r2 = ws.getRow(2);
    expect(String(r2.getCell(1).value)).toBe('1001');
    // NIK formula
    expect(r2.getCell(2).formula).toMatch(/VLOOKUP\(A2,'Ref Pegawai'!\$A\$2:\$F\$3,2,FALSE\)/);
    // Nama formula → col 3
    expect(r2.getCell(3).formula).toMatch(/,3,FALSE/);
    // Status → jenisAsn (col 6)
    expect(r2.getCell(4).formula).toMatch(/,6,FALSE/);
    // PTKP → statusPtkp (col 4)
    expect(r2.getCell(5).formula).toMatch(/,4,FALSE/);
    // Golongan → col 5
    expect(r2.getCell(6).formula).toMatch(/,5,FALSE/);
    // Numeric values
    expect(Number(r2.getCell(7).value)).toBe(500_000);
    expect(Number(r2.getCell(8).value)).toBe(0);
    expect(Number(r2.getCell(9).value)).toBe(500_000);
    expect(Number(r2.getCell(10).value)).toBe(0);
    expect(String(r2.getCell(11).value)).toBe('Uang Makan');
    expect(String(r2.getCell(12).value)).toBe('UM1');
  });

  it('rowsWritten counts both ledgers', async () => {
    const outPath = tmpFile();
    const result = await callWrite(outPath, {
      gajiRows: [{ rows: [ROWS[0]], keterangan: 'G', noSPM: 'G1' }],
      tunjanganRows: [{ rows: [{ nip: '1002', nama: 'Bob', bersih: 100, pajak: 5 }], keterangan: 'T', noSPM: 'T1' }],
      uangMakanRows: [{ rows: [{ nip: '1001', nama: 'Alice', kotor: 50, potongan: 0, bersih: 50, pph: 0 }], keterangan: 'U', noSPM: 'U1' }]
    });
    expect(result.rowsWritten).toBe(3);
  });
});
