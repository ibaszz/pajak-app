import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import type { Pegawai, SPMGajiRow, Periode, ProcessResult } from '@shared/types';

interface GajiBatch {
  rows: SPMGajiRow[];
  keterangan: string;
  noSPM: string;
}

export interface WriteOptions {
  outputPath: string;
  pegawai: Pegawai[];
  gajiRows: GajiBatch[];
  periode: Periode;
}

const REF_SHEET = 'Ref Pegawai';
const GAJI_LEDGER = 'Gaji Ledger';

function buildRefPegawaiSheet(wb: ExcelJS.Workbook, pegawai: Pegawai[]): void {
  const ws = wb.addWorksheet(REF_SHEET);
  ws.columns = [
    { header: 'NIP', key: 'nip', width: 22 },
    { header: 'NIK', key: 'nik', width: 22 },
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Status', key: 'status', width: 8 },
    { header: 'Golongan', key: 'golongan', width: 10 },
    { header: 'Jenis ASN', key: 'jenisAsn', width: 10 }
  ];
  ws.getRow(1).font = { bold: true };
  for (const p of pegawai) {
    ws.addRow({
      nip: p.nip,
      nik: p.nik,
      nama: p.nama,
      status: p.statusPtkp,
      golongan: p.golongan ?? '',
      jenisAsn: p.jenisAsn
    });
  }
}

function buildGajiLedgerSheet(wb: ExcelJS.Workbook, batches: GajiBatch[], refCount: number): number {
  const ws = wb.addWorksheet(GAJI_LEDGER);
  ws.columns = [
    { header: 'NIP', key: 'nip', width: 22 },
    { header: 'NIK', key: 'nik', width: 22 },
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Status', key: 'status', width: 8 },
    { header: 'Nominal', key: 'nominal', width: 16 },
    { header: 'PPH', key: 'pph', width: 14 },
    { header: 'Tunjangan PPH', key: 'tunjPph', width: 16 },
    { header: 'potpfk10', key: 'potpfk10', width: 14 },
    { header: 'Keterangan', key: 'keterangan', width: 24 },
    { header: 'SPM', key: 'spm', width: 14 }
  ];
  ws.getRow(1).font = { bold: true };

  const refRange = `'${REF_SHEET}'!$A$2:$F$${refCount + 1}`;
  let written = 0;
  let excelRow = 2;
  for (const batch of batches) {
    for (const r of batch.rows) {
      ws.addRow({
        nip: r.nip,
        nik: { formula: `VLOOKUP(A${excelRow},${refRange},2,FALSE)` },
        nama: { formula: `VLOOKUP(A${excelRow},${refRange},3,FALSE)` },
        status: { formula: `VLOOKUP(A${excelRow},${refRange},4,FALSE)` },
        nominal: r.gjpokok + r.tjberas,
        pph: r.tjpph,
        tunjPph: r.tjpph,
        potpfk10: r.potpfk10,
        keterangan: batch.keterangan,
        spm: batch.noSPM
      });
      excelRow++;
      written++;
    }
  }
  return written;
}

export async function writePajakOutput(opts: WriteOptions): Promise<ProcessResult> {
  const { outputPath, pegawai, gajiRows } = opts;
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pajak App';
  wb.created = new Date();

  buildRefPegawaiSheet(wb, pegawai);
  const rowsWritten = buildGajiLedgerSheet(wb, gajiRows, pegawai.length);

  const tmp = outputPath + '.tmp';
  await wb.xlsx.writeFile(tmp);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  fs.renameSync(tmp, outputPath);

  return { outputPath, rowsWritten };
}

export interface EmptyWriteOptions {
  outputPath: string;
  pegawai: Pegawai[];
  periode: Periode;
}

export async function writeEmptyPajakOutput(opts: EmptyWriteOptions): Promise<ProcessResult> {
  return writePajakOutput({
    outputPath: opts.outputPath,
    pegawai: opts.pegawai,
    gajiRows: [],
    periode: opts.periode
  });
}
