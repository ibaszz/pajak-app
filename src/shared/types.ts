export type Kategori = 'gaji' | 'tunjangan' | 'uang_makan';

export type JenisASN = 'PNS' | 'PPPK';

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
  tjberas: number;
  tjpph: number;
  potpfk10: number;
}

export interface ParsedSPM {
  filePath: string;
  fileName: string;
  kategori: Kategori;
  rowCount: number;
  rows: SPMGajiRow[];
}

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
