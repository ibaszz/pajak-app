import path from 'node:path';
import type { PdfSourceKind } from '@shared/types';

/**
 * Detect which PDF format a file is, from filename patterns observed in
 * real SAKTI/MyIntress exports (see uangmakan-converter repo):
 *   - Uang Makan:   "UM_Agust_2026_P3K.pdf", "uangmakan_...", "UM PNS - ..."
 *   - Honorarium:   "mei-agustus (2).pdf", "honorarium_...", "daftar pembayaran honorarium..."
 * Filename-only detection can be ambiguous (honorarium filenames in
 * particular are often just a date range with no distinctive keyword), so
 * callers should fall back to sniffing the PDF's own header text when this
 * returns null — see detectPdfKindFromText.
 */
export function detectPdfKindFromFilename(filePath: string): PdfSourceKind | null {
  const base = path.basename(filePath).toLowerCase();
  if (/honor/i.test(base)) return 'honorarium_pdf';
  if (/(^um[\s_]|uangmakan|uang_makan|uang-makan)/i.test(base)) return 'uang_makan_pdf';
  return null;
}

/**
 * Fallback detection by sniffing the first page's extracted text for each
 * format's distinctive header phrase. More reliable than filename matching
 * since these headers are fixed boilerplate printed by SAKTI/MyIntress.
 */
export function detectPdfKindFromText(text: string): PdfSourceKind | null {
  if (/daftar\s+perhitungan\s+uang\s+makan/i.test(text)) return 'uang_makan_pdf';
  if (/daftar\s+pembayaran\s+honorarium/i.test(text)) return 'honorarium_pdf';
  return null;
}
