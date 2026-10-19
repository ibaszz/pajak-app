export type Kategori = 'gaji' | 'tunjangan' | 'uang_makan';

export type JenisASN = 'PNS' | 'PPPK';

export type PnsSuffix = 'PNS' | 'PPPK' | 'MIX';

export interface Pegawai {
  nip: string;
  nik: string;
  nama: string;
  statusPtkp: string;
  golongan: string | null;
  jenisAsn: JenisASN;
  aktif: boolean;
}

export interface Periode {
  nomorUrut: number;
  bulan: number;      // 1-12
  tahun: number;
  label: string;      // "Januari 2026"
}

export interface SPMGajiRow {
  nip: string;
  nama: string;
  gjpokok: number;
  tjistri: number;
  tjanak: number;
  tjupns: number;
  tjstruk: number;
  tjfungs: number;
  pembul: number;
  tjberas: number;
  tjpph: number;
  potpfk10: number;
}

export interface SPMTunjanganRow {
  nip: string;
  nama: string;
  bersih: number;
  pajak: number;
}

export interface SPMUangMakanRow {
  nip: string;
  nama: string;
  kotor: number;
  potongan: number;
  bersih: number;
  pph: number;
}

export type SPMRow = SPMGajiRow | SPMTunjanganRow | SPMUangMakanRow;

interface ParsedSPMBase {
  filePath: string;
  fileName: string;
  rowCount: number;
}

export type ParsedSPM =
  | (ParsedSPMBase & { kategori: 'gaji'; rows: SPMGajiRow[] })
  | (ParsedSPMBase & { kategori: 'tunjangan'; rows: SPMTunjanganRow[] })
  | (ParsedSPMBase & { kategori: 'uang_makan'; rows: SPMUangMakanRow[] });

// =====================================================================
// PDF input (Uang Makan & Honorarium) — pph21 non-pegawai
// =====================================================================
// Both PDF sources are converted into the SAME output category
// ('uang_makan') because both are taxed as PPh21 non-pegawai and share
// the exact Non Gaji Ledger column layout. The Honorarium PDF has no NIP
// printed at all (only Nama + Jabatan + Pangkat), so each row must be
// resolved to a NIP by matching against the master pegawai list before
// it can flow into the existing SPMUangMakanRow / process:run pipeline.

export type PdfSourceKind = 'uang_makan_pdf' | 'honorarium_pdf';

export type PdfRowMatchStatus = 'matched' | 'ambiguous' | 'unmatched';

export interface PdfRowCandidate {
  nip: string;
  nama: string;
  score: number;
}

export interface PdfRow {
  /** Name exactly as printed on the PDF (before any normalization). */
  namaAsli: string;
  kotor: number;
  potongan: number;
  bersih: number;
  /** PPh rate in percent (5, 0, 15, ...) — used for Kode Objek Pajak on BPMP export, not a rupiah amount. */
  pph: number;
  matchStatus: PdfRowMatchStatus;
  /** Resolved NIP. Non-null when matchStatus is 'matched' (uang_makan PDF rows always; honorarium rows when auto-match succeeded). Null when 'ambiguous'/'unmatched' and awaiting manual pick in the UI. */
  nip: string | null;
  /** Ranked candidate pegawai for manual resolution, best first (empty for uang_makan PDF rows since NIP is already known from the PDF). */
  candidates: PdfRowCandidate[];
}

export interface ParsedPdf {
  filePath: string;
  fileName: string;
  sourceKind: PdfSourceKind;
  rowCount: number;
  rows: PdfRow[];
}

/** User's manual NIP picks for rows left ambiguous/unmatched after auto-matching, keyed by row index into ParsedPdf.rows. */
export type PdfRowOverrides = Record<number, string>;

export interface ProcessInput {
  parsedSPM: ParsedSPM;
  keterangan: string;
  noSPM: string;
  periode: Periode;
}

export interface ProcessResult {
  outputPath: string;
  rowsWritten: number;
}

export interface SPMBatchSummary {
  id: number;
  noSPM: string;
  keterangan: string;
  kategori: Kategori;
  rowCount: number;
  createdAt: string;
  storedFile: string | null;
}

export interface CreatePeriodeInput {
  bulan: number;
  tahun: number;
  nomorUrut?: number;
}
