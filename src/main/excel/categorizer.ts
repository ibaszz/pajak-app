import path from 'node:path';
import type { Kategori } from '@shared/types';

const PATTERNS: Array<{ kategori: Kategori; regex: RegExp }> = [
  { kategori: 'uang_makan', regex: /(uangmakan|^um\s)/i },
  { kategori: 'tunjangan', regex: /(tukin|tunsus)/i },
  { kategori: 'gaji', regex: /(gaji_bank|lampiranspm)/i }
];

export function detectKategoriFromFilename(filePath: string): Kategori | null {
  if (!filePath) return null;
  const base = path.basename(filePath);
  for (const { kategori, regex } of PATTERNS) {
    if (regex.test(base)) return kategori;
  }
  return null;
}
