/**
 * Parsers for the two government PDF formats (ported from the Python
 * scripts in ~/uangmakan-converter, which used pdfplumber's
 * extract_text()). Regex patterns are translated 1:1 from the Python
 * source so matching behaviour stays identical; only the text extraction
 * backend changed (pdfjs-dist + Y-axis clustering instead of pdfplumber).
 *
 * IMPORTANT: output field semantics follow the existing SPMUangMakanRow
 * contract used throughout pajak-app (see Struktur Excel.md):
 *   - kotor    = gross amount
 *   - bersih   = net amount received
 *   - potongan = nominal PPh amount withheld (rupiah)
 *   - pph      = PPh RATE in percent (5, 0, 15, ...) — used downstream to
 *                pick the "Kode Objek Pajak" for Coretax BPMP export, NOT
 *                a rupiah amount. Computed as potongan * 100 / kotor.
 */
import { extractPdfText } from './pdf-text-extractor';

export interface RawPdfRow {
  nama: string;
  kotor: number;
  potongan: number; // nominal PPh amount (rupiah)
  bersih: number;
  pph: number; // PPh rate in percent
}

function parseRupiah(s: string): number {
  const n = Number(s.replace(/\./g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pphRate(potongan: number, kotor: number): number {
  if (!kotor) return 0;
  return Math.round(((potongan * 100) / kotor) * 100) / 100;
}

// =====================================================================
// Uang Makan PDF ("Daftar Perhitungan Uang Makan")
// =====================================================================

// Ported from uangmakan-converter/convert_pdf.py. The NIP (last capture
// group) sits on the line below the rest of the row in the source PDF,
// and `\s` matches newlines, so this pattern spans two visual lines —
// matching the original pdfplumber-based behaviour exactly.
const UANG_MAKAN_ROW_REGEX =
  /\d+\.\s+([A-Za-z\s]+)\s+([IVX]+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+\d+\.\s+\.+\s*(\d+)/g;

export interface RawUangMakanRow extends RawPdfRow {
  nip: string;
}

export async function parseUangMakanPdfRaw(buffer: Buffer): Promise<RawUangMakanRow[]> {
  const text = await extractPdfText(buffer);
  const rows: RawUangMakanRow[] = [];
  let m: RegExpExecArray | null;
  UANG_MAKAN_ROW_REGEX.lastIndex = 0;
  while ((m = UANG_MAKAN_ROW_REGEX.exec(text)) !== null) {
    const nama = m[1].trim();
    const kotor = parseRupiah(m[5]);
    const potongan = parseRupiah(m[6]); // PDF's "PPh" nominal column
    const bersih = parseRupiah(m[7]);
    const nip = m[8];
    rows.push({
      nama,
      kotor,
      potongan,
      bersih,
      pph: pphRate(potongan, kotor),
      nip
    });
  }
  return rows;
}

// =====================================================================
// Honorarium PDF ("Daftar Pembayaran Honorarium ... KPA/PPK/PPSPM")
// =====================================================================

// Ported from uangmakan-converter/convert_honorarium.py. No NIP in this
// PDF at all — only nama + jabatan + pangkat. Caller must resolve nama
// to NIP via the nama-matcher against the master pegawai list.
const KNOWN_JABATAN = [
  'Staf Pengelola Keuangan KPA',
  'Bendahara Pengeluaran',
  'Pejabat Pengadaan',
  'PPSPM',
  'PPABP',
  'PPK',
  'KPA'
];

function buildHonorariumRowRegex(): RegExp {
  const jabatanAlt = KNOWN_JABATAN.map((j) => j.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(
    '^(\\d+)\\s+' + // no
      '(.+?)\\s+' + // nama (non-greedy)
      '(' +
      jabatanAlt +
      ')\\s+' + // jabatan (known list)
      '([IVX]+)\\s+' + // pangkat (golongan romawi)
      '(\\d+)\\s*X\\s*Rp\\.\\s*([\\d.]+)\\s+' + // jmlhari X tarif
      '([\\d.]+)\\s+' + // bruto
      '([\\d.]+)\\s+' + // pph (nominal)
      '([\\d.]+)\\s+' + // diterima
      '\\d+\\s*[.\u2026]+\\s*$' // signature number + dots/ellipsis
  );
}

export async function parseHonorariumPdfRaw(buffer: Buffer): Promise<RawPdfRow[]> {
  const text = await extractPdfText(buffer);
  const blocks = text.split(/(?=^DAFTAR PEMBAYARAN$)/m).filter((b) => b.trim());
  const rowRegex = buildHonorariumRowRegex();
  const rows: RawPdfRow[] = [];

  for (const block of blocks) {
    for (const line of block.split('\n')) {
      const m = rowRegex.exec(line.trim());
      if (!m) continue;
      const nama = m[2].trim();
      const bruto = parseRupiah(m[7]);
      const pphNominal = parseRupiah(m[8]);
      const diterima = parseRupiah(m[9]);
      rows.push({
        nama,
        kotor: bruto,
        potongan: pphNominal,
        bersih: diterima,
        pph: pphRate(pphNominal, bruto)
      });
    }
  }
  return rows;
}
