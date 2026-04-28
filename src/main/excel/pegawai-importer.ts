import ExcelJS from 'exceljs';
import type { Pegawai, JenisASN } from '@shared/types';

const SHEET_NAME = 'Ref Pegawai';

function normalizeHeader(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/[\s/]+/g, '_');
}

function parseJenisAsn(raw: string): JenisASN {
  const s = raw.trim().toUpperCase();
  if (s === 'PPPK' || s === 'P3K') return 'PPPK';
  return 'PNS';
}

export async function importPegawaiFromPajakFile(filePath: string): Promise<Pegawai[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in ${filePath}`);

  const idx: Record<string, number> = {};
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    idx[normalizeHeader(cell.value)] = col;
  });

  const aliases = {
    nip: ['nip', 'nip_pegawai'],
    nik: ['nik', 'npwp'],
    nama: ['nama', 'nama_pegawai'],
    // 'status' wins over 'ptkp' because in observed templates the PTKP column
    // holds a numeric code (e.g. 1102) while the Status column holds the actual
    // PTKP status string (e.g. "K/2").
    statusPtkp: ['status', 'status_ptkp', 'ptkp'],
    golongan: ['golongan', 'gol', 'pangkat_golongan'],
    // 'column1' observed in the real PPh21 template — the header cell for the
    // jenis ASN column was left as the default Excel name.
    jenisAsn: ['jenis_asn', 'asn', 'status_pegawai', 'jenis', 'pns_pppk', 'column1']
  };

  function findCol(keys: string[]): number | null {
    for (const k of keys) if (idx[k]) return idx[k];
    return null;
  }

  const cNip = findCol(aliases.nip);
  const cNik = findCol(aliases.nik);
  const cNama = findCol(aliases.nama);
  const cStatus = findCol(aliases.statusPtkp);
  const cGol = findCol(aliases.golongan);
  const cJenis = findCol(aliases.jenisAsn);

  if (!cNip || !cNama || !cStatus) {
    throw new Error(
      `Ref Pegawai missing required columns. Found: ${Object.keys(idx).join(', ')}`
    );
  }

  const out: Pegawai[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nip = String(row.getCell(cNip).value ?? '').trim();
    if (!nip) continue;
    const nama = String(row.getCell(cNama).value ?? '').trim();
    const statusPtkp = String(row.getCell(cStatus).value ?? '').trim();
    const nik = cNik ? String(row.getCell(cNik).value ?? '').trim() : nip;
    const golongan = cGol ? String(row.getCell(cGol).value ?? '').trim() || null : null;
    const jenisRaw = cJenis ? String(row.getCell(cJenis).value ?? '').trim() : 'PNS';
    out.push({
      nip,
      nik: nik || nip,
      nama,
      statusPtkp: statusPtkp || 'TK/0',
      golongan,
      jenisAsn: parseJenisAsn(jenisRaw),
      aktif: true
    });
  }
  return out;
}
