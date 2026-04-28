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
