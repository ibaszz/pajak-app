import fs from 'node:fs';
import path from 'node:path';
import type { Periode } from '@shared/types';
import { formatPeriodeFolderName, formatSpmFileName } from '@shared/constants';

export function spmDestPath(
  workspaceRoot: string,
  periode: Periode,
  noSPM: string,
  kategori: 'gaji'
): string {
  const folder = path.join(workspaceRoot, formatPeriodeFolderName(periode.nomorUrut, periode.bulan));
  const filename = formatSpmFileName(noSPM, kategori, periode.bulan, periode.tahun);
  return path.join(folder, filename);
}

export function copySpmFile(
  sourcePath: string,
  workspaceRoot: string,
  periode: Periode,
  noSPM: string,
  kategori: 'gaji'
): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File SPM source tidak ditemukan: ${sourcePath}`);
  }
  const dest = spmDestPath(workspaceRoot, periode, noSPM, kategori);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    throw new Error(`File arsip sudah ada: ${dest}`);
  }
  const tmp = dest + '.tmp';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  fs.copyFileSync(sourcePath, tmp);
  fs.renameSync(tmp, dest);
  return dest;
}

export function deleteSpmFile(storedFilePath: string | null | undefined): void {
  if (!storedFilePath) return;
  if (fs.existsSync(storedFilePath)) {
    fs.unlinkSync(storedFilePath);
  }
}
