import fs from 'node:fs';
import path from 'node:path';
import type { Kategori, Pegawai, Periode, PnsSuffix, SPMRow } from '@shared/types';
import { formatPeriodeFolderName, formatSpmFileName } from '@shared/constants';

export function spmDestPath(
  workspaceRoot: string,
  periode: Periode,
  noSPM: string,
  kategori: Kategori,
  pnsSuffix: PnsSuffix
): string {
  const folder = path.join(workspaceRoot, formatPeriodeFolderName(periode.nomorUrut, periode.bulan));
  const filename = formatSpmFileName(noSPM, kategori, periode.bulan, periode.tahun, pnsSuffix);
  return path.join(folder, filename);
}

export function copySpmFile(
  sourcePath: string,
  workspaceRoot: string,
  periode: Periode,
  noSPM: string,
  kategori: Kategori,
  pnsSuffix: PnsSuffix
): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File SPM source tidak ditemukan: ${sourcePath}`);
  }
  const dest = spmDestPath(workspaceRoot, periode, noSPM, kategori, pnsSuffix);
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

export function determinePnsSuffix(rows: SPMRow[], pegawai: Pegawai[]): PnsSuffix {
  const byNip = new Map(pegawai.map(p => [p.nip, p.jenisAsn]));
  const set = new Set<string>();
  for (const r of rows) {
    const j = byNip.get(r.nip);
    if (j) set.add(j);
  }
  if (set.size === 0) return 'PNS';
  if (set.size === 1) return set.has('PNS') ? 'PNS' : 'PPPK';
  return 'MIX';
}
