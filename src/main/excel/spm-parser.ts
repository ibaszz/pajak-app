import ExcelJS from 'exceljs';
import path from 'node:path';
import type {
  Kategori,
  ParsedSPM,
  SPMGajiRow,
  SPMTunjanganRow,
  SPMUangMakanRow
} from '@shared/types';

/**
 * Header aliases for SPM files exported from the government finance system.
 *
 * The actual workbook uses internal column codes (e.g. `nmpeg`, `nama_pegawai`
 * for the employee name). We normalize these to canonical keys so downstream
 * code can rely on a stable shape. Add new entries here when a fixture uses
 * a different column code.
 */
const GAJI_ALIASES: Record<string, string> = {
  nmpeg: 'nama'
};

const TUNJANGAN_ALIASES: Record<string, string> = {
  nmpeg: 'nama',
  nama_pegawai: 'nama'
};

const UANG_MAKAN_ALIASES: Record<string, string> = {
  nmpeg: 'nama',
  nama_pegawai: 'nama'
};

const GAJI_REQUIRED = ['nip', 'nama', 'gjpokok', 'tjberas', 'tjpph', 'potpfk10'];
const TUNJANGAN_REQUIRED = ['nip', 'nama', 'bersih', 'pajak'];
const UANG_MAKAN_REQUIRED = ['nip', 'nama', 'kotor', 'potongan', 'bersih', 'pph'];

function normalizeHeader(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function numericValue(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'result' in v) {
    const result = (v as { result: unknown }).result;
    return typeof result === 'number' ? result : 0;
  }
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function optionalNumeric(
  row: ExcelJS.Row,
  headerIdx: Record<string, number>,
  key: string
): number {
  const col = headerIdx[key];
  if (col == null) return 0;
  return numericValue(row.getCell(col).value);
}

function stringValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v !== null && 'result' in v) {
    return String((v as { result: unknown }).result ?? '').trim();
  }
  return String(v).trim();
}

interface SheetWithHeaders {
  sheet: ExcelJS.Worksheet;
  headerIdx: Record<string, number>;
}

async function loadSheetWithHeaders(
  filePath: string,
  aliases: Record<string, string>,
  required: string[]
): Promise<SheetWithHeaders> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error(`No sheet in ${filePath}`);

  const rawHeaderIdx: Record<string, number> = {};
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    rawHeaderIdx[normalizeHeader(cell.value)] = colNumber;
  });

  const headerIdx: Record<string, number> = {};
  for (const [raw, col] of Object.entries(rawHeaderIdx)) {
    const key = aliases[raw] ?? raw;
    headerIdx[key] = col;
  }

  const missing = required.filter((k) => !(k in headerIdx));
  if (missing.length > 0) {
    throw new Error(
      `Missing columns in ${filePath}: ${missing.join(', ')}. ` +
        `Got: ${Object.keys(headerIdx).join(', ')}`
    );
  }

  return { sheet, headerIdx };
}

export async function parseGajiSPM(filePath: string): Promise<ParsedSPM> {
  const { sheet, headerIdx } = await loadSheetWithHeaders(
    filePath,
    GAJI_ALIASES,
    GAJI_REQUIRED
  );

  const rows: SPMGajiRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nip = stringValue(row.getCell(headerIdx.nip).value);
    if (!nip) continue;
    rows.push({
      nip,
      nama: stringValue(row.getCell(headerIdx.nama).value),
      gjpokok: numericValue(row.getCell(headerIdx.gjpokok).value),
      tjistri: optionalNumeric(row, headerIdx, 'tjistri'),
      tjanak: optionalNumeric(row, headerIdx, 'tjanak'),
      tjupns: optionalNumeric(row, headerIdx, 'tjupns'),
      tjstruk: optionalNumeric(row, headerIdx, 'tjstruk'),
      tjfungs: optionalNumeric(row, headerIdx, 'tjfungs'),
      pembul: optionalNumeric(row, headerIdx, 'pembul'),
      tjberas: numericValue(row.getCell(headerIdx.tjberas).value),
      tjpph: numericValue(row.getCell(headerIdx.tjpph).value),
      potpfk10: numericValue(row.getCell(headerIdx.potpfk10).value)
    });
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    kategori: 'gaji',
    rowCount: rows.length,
    rows
  };
}

export async function parseTunjanganSPM(filePath: string): Promise<ParsedSPM> {
  const { sheet, headerIdx } = await loadSheetWithHeaders(
    filePath,
    TUNJANGAN_ALIASES,
    TUNJANGAN_REQUIRED
  );

  const rows: SPMTunjanganRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nip = stringValue(row.getCell(headerIdx.nip).value);
    if (!nip) continue;
    rows.push({
      nip,
      nama: stringValue(row.getCell(headerIdx.nama).value),
      bersih: numericValue(row.getCell(headerIdx.bersih).value),
      pajak: numericValue(row.getCell(headerIdx.pajak).value)
    });
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    kategori: 'tunjangan',
    rowCount: rows.length,
    rows
  };
}

export async function parseUangMakanSPM(filePath: string): Promise<ParsedSPM> {
  const { sheet, headerIdx } = await loadSheetWithHeaders(
    filePath,
    UANG_MAKAN_ALIASES,
    UANG_MAKAN_REQUIRED
  );

  const rows: SPMUangMakanRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nip = stringValue(row.getCell(headerIdx.nip).value);
    if (!nip) continue;
    rows.push({
      nip,
      nama: stringValue(row.getCell(headerIdx.nama).value),
      kotor: numericValue(row.getCell(headerIdx.kotor).value),
      potongan: numericValue(row.getCell(headerIdx.potongan).value),
      bersih: numericValue(row.getCell(headerIdx.bersih).value),
      pph: numericValue(row.getCell(headerIdx.pph).value)
    });
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    kategori: 'uang_makan',
    rowCount: rows.length,
    rows
  };
}

export async function parseSPMByKategori(
  filePath: string,
  kategori: Kategori
): Promise<ParsedSPM> {
  switch (kategori) {
    case 'gaji':
      return parseGajiSPM(filePath);
    case 'tunjangan':
      return parseTunjanganSPM(filePath);
    case 'uang_makan':
      return parseUangMakanSPM(filePath);
  }
}
