export const BULAN_NAMES = [
  'Januari', 'Febuari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
] as const;

export function formatPeriodeFileName(nomorUrut: number, bulan: number, tahun: number): string {
  return `${nomorUrut}. PPH21 - ${BULAN_NAMES[bulan - 1]} ${tahun}.xlsx`;
}

export function formatPeriodeFolderName(nomorUrut: number, bulan: number): string {
  return `${nomorUrut}. ${BULAN_NAMES[bulan - 1]}`;
}

export function sanitizeForFileName(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

import type { Kategori, PnsSuffix } from './types';

export function formatSpmFileName(
  noSPM: string,
  kategori: Kategori,
  bulan: number,
  tahun: number,
  pnsSuffix: PnsSuffix
): string {
  const noSafe = sanitizeForFileName(noSPM);
  const bulanName = BULAN_NAMES[bulan - 1].toUpperCase();
  const kat = kategori.toUpperCase();
  return `SPM_${noSafe}_${kat}_${bulanName}_${tahun}_${pnsSuffix}.xlsx`;
}
