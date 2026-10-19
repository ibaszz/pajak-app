import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import type {
  JenisASN,
  Pegawai,
  SPMGajiRow,
  SPMTunjanganRow,
  SPMUangMakanRow,
  Periode,
  ProcessResult
} from '@shared/types';

interface GajiBatch {
  rows: SPMGajiRow[];
  keterangan: string;
  noSPM: string;
}

interface TunjanganBatch {
  rows: SPMTunjanganRow[];
  keterangan: string;
  noSPM: string;
}

interface UangMakanBatch {
  rows: SPMUangMakanRow[];
  keterangan: string;
  noSPM: string;
}

export interface WriteOptions {
  outputPath: string;
  pegawai: Pegawai[];
  gajiRows: GajiBatch[];
  tunjanganRows: TunjanganBatch[];
  uangMakanRows: UangMakanBatch[];
  periode: Periode;
}

const REF_SHEET = 'Ref Pegawai';
const GAJI_LEDGER = 'Gaji Ledger';
const NON_GAJI_LEDGER = 'Non Gaji Ledger';

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

function buildGajiLedgerSheet(
  wb: ExcelJS.Workbook,
  gaji: GajiBatch[],
  tunjangan: TunjanganBatch[],
  refCount: number,
  jenisAsnByNip: Map<string, JenisASN>
): number {
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

  for (const batch of gaji) {
    for (const r of batch.rows) {
      ws.addRow({
        nip: r.nip,
        nik: { formula: `VLOOKUP(A${excelRow},${refRange},2,FALSE)` },
        nama: { formula: `VLOOKUP(A${excelRow},${refRange},3,FALSE)` },
        status: { formula: `VLOOKUP(A${excelRow},${refRange},4,FALSE)` },
        nominal:
          r.gjpokok + r.tjistri + r.tjanak + r.tjupns +
          r.tjstruk + r.tjfungs + r.pembul + r.tjberas,
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

  for (const batch of tunjangan) {
    for (const r of batch.rows) {
      const isPns = jenisAsnByNip.get(r.nip) === 'PNS';
      ws.addRow({
        nip: r.nip,
        nik: { formula: `VLOOKUP(A${excelRow},${refRange},2,FALSE)` },
        nama: { formula: `VLOOKUP(A${excelRow},${refRange},3,FALSE)` },
        status: { formula: `VLOOKUP(A${excelRow},${refRange},4,FALSE)` },
        nominal: r.bersih,
        pph: r.pajak,
        tunjPph: isPns ? r.pajak : 0,
        potpfk10: 0,
        keterangan: batch.keterangan,
        spm: batch.noSPM
      });
      excelRow++;
      written++;
    }
  }

  return written;
}

function buildNonGajiLedgerSheet(
  wb: ExcelJS.Workbook,
  uangMakan: UangMakanBatch[],
  refCount: number
): number {
  const ws = wb.addWorksheet(NON_GAJI_LEDGER);
  ws.columns = [
    { header: 'NIP', key: 'nip', width: 22 },
    { header: 'NIK', key: 'nik', width: 22 },
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Status', key: 'status', width: 8 },
    { header: 'PTKP', key: 'ptkp', width: 8 },
    { header: 'Golongan', key: 'golongan', width: 10 },
    { header: 'Kotor', key: 'kotor', width: 14 },
    { header: 'potongan', key: 'potongan', width: 14 },
    { header: 'bersih', key: 'bersih', width: 14 },
    { header: 'PPH', key: 'pph', width: 14 },
    { header: 'Keterangan', key: 'keterangan', width: 24 },
    { header: 'SPM', key: 'spm', width: 14 }
  ];
  ws.getRow(1).font = { bold: true };

  // Ref Pegawai columns: 1=NIP, 2=NIK, 3=Nama, 4=statusPtkp, 5=Golongan, 6=jenisAsn
  // Non Gaji Ledger maps: Status=jenisAsn (col 6), PTKP=statusPtkp (col 4), Golongan (col 5)
  const refRange = `'${REF_SHEET}'!$A$2:$F$${refCount + 1}`;
  let written = 0;
  let excelRow = 2;

  for (const batch of uangMakan) {
    for (const r of batch.rows) {
      ws.addRow({
        nip: r.nip,
        nik: { formula: `VLOOKUP(A${excelRow},${refRange},2,FALSE)` },
        nama: { formula: `VLOOKUP(A${excelRow},${refRange},3,FALSE)` },
        status: { formula: `VLOOKUP(A${excelRow},${refRange},6,FALSE)` },
        ptkp: { formula: `VLOOKUP(A${excelRow},${refRange},4,FALSE)` },
        golongan: { formula: `VLOOKUP(A${excelRow},${refRange},5,FALSE)` },
        kotor: r.kotor,
        potongan: r.potongan,
        bersih: r.bersih,
        pph: r.pph,
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
  const { outputPath, pegawai, gajiRows, tunjanganRows, uangMakanRows } = opts;
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pajak App';
  wb.created = new Date();

  const jenisAsnByNip = new Map(pegawai.map(p => [p.nip, p.jenisAsn] as const));

  buildRefPegawaiSheet(wb, pegawai);
  const gajiWritten = buildGajiLedgerSheet(wb, gajiRows, tunjanganRows, pegawai.length, jenisAsnByNip);
  const nonGajiWritten = buildNonGajiLedgerSheet(wb, uangMakanRows, pegawai.length);

  const tmp = outputPath + '.tmp';
  await wb.xlsx.writeFile(tmp);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  fs.renameSync(tmp, outputPath);

  return { outputPath, rowsWritten: gajiWritten + nonGajiWritten };
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
    tunjanganRows: [],
    uangMakanRows: [],
    periode: opts.periode
  });
}
