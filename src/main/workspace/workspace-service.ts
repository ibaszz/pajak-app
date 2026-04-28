import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Periode, CreatePeriodeInput } from '@shared/types';
import { BULAN_NAMES, formatPeriodeFileName, formatPeriodeFolderName } from '@shared/constants';

const KEY_WORKSPACE = 'workspace_path';

export function createWorkspaceService(db: Database.Database) {
  const getStmt = db.prepare<[string], { value: string }>(
    'SELECT value FROM settings WHERE key = ?'
  );
  const setStmt = db.prepare<[string, string]>(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  function getWorkspacePath(): string | null {
    const row = getStmt.get(KEY_WORKSPACE);
    return row?.value ?? null;
  }

  function setWorkspacePath(p: string): void {
    if (!fs.existsSync(p)) throw new Error(`Workspace path does not exist: ${p}`);
    if (!fs.statSync(p).isDirectory()) throw new Error(`Not a directory: ${p}`);
    setStmt.run(KEY_WORKSPACE, p);
  }

  function listPeriode(): Periode[] {
    const ws = getWorkspacePath();
    if (!ws || !fs.existsSync(ws)) return [];
    const entries = fs.readdirSync(ws);
    const out: Periode[] = [];
    const re = /^(\d+)\. PPH21 - (\w+) (\d{4})\.xlsx$/i;
    for (const name of entries) {
      const m = re.exec(name);
      if (!m) continue;
      const nomorUrut = parseInt(m[1], 10);
      const bulan = BULAN_NAMES.findIndex(b => b.toLowerCase() === m[2].toLowerCase()) + 1;
      if (bulan === 0) continue;
      const tahun = parseInt(m[3], 10);
      out.push({ nomorUrut, bulan, tahun, label: `${BULAN_NAMES[bulan - 1]} ${tahun}` });
    }
    out.sort((a, b) => a.nomorUrut - b.nomorUrut);
    return out;
  }

  function resolveOutputPath(p: Periode): string {
    const ws = getWorkspacePath();
    if (!ws) throw new Error('Workspace not set');
    return path.join(ws, formatPeriodeFileName(p.nomorUrut, p.bulan, p.tahun));
  }

  function nextNomorUrut(): number {
    const periodes = listPeriode();
    if (periodes.length === 0) return 1;
    return Math.max(...periodes.map(p => p.nomorUrut)) + 1;
  }

  function createPeriode(input: CreatePeriodeInput): Periode {
    const ws = getWorkspacePath();
    if (!ws) throw new Error('Workspace belum dipilih.');
    if (!Number.isInteger(input.bulan) || input.bulan < 1 || input.bulan > 12) {
      throw new Error(`Bulan tidak valid: ${input.bulan}`);
    }
    if (!Number.isInteger(input.tahun) || input.tahun < 2000 || input.tahun > 2100) {
      throw new Error(`Tahun tidak valid: ${input.tahun}`);
    }
    const existing = listPeriode();
    const dup = existing.find(p => p.bulan === input.bulan && p.tahun === input.tahun);
    if (dup) {
      throw new Error(`Periode ${BULAN_NAMES[input.bulan - 1]} ${input.tahun} sudah ada (no. ${dup.nomorUrut}).`);
    }
    const nomorUrut = input.nomorUrut ?? nextNomorUrut();
    if (existing.some(p => p.nomorUrut === nomorUrut)) {
      throw new Error(`Nomor urut ${nomorUrut} sudah dipakai.`);
    }
    const outputPath = path.join(ws, formatPeriodeFileName(nomorUrut, input.bulan, input.tahun));
    if (fs.existsSync(outputPath)) {
      throw new Error(`File output sudah ada: ${outputPath}`);
    }
    return {
      nomorUrut,
      bulan: input.bulan,
      tahun: input.tahun,
      label: `${BULAN_NAMES[input.bulan - 1]} ${input.tahun}`
    };
  }

  function ensurePeriodeFolder(p: Periode): string {
    const ws = getWorkspacePath();
    if (!ws) throw new Error('Workspace belum dipilih.');
    const folder = path.join(ws, formatPeriodeFolderName(p.nomorUrut, p.bulan));
    fs.mkdirSync(folder, { recursive: true });
    return folder;
  }

  return {
    getWorkspacePath,
    setWorkspacePath,
    listPeriode,
    resolveOutputPath,
    nextNomorUrut,
    createPeriode,
    ensurePeriodeFolder
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
