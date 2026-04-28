import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Periode } from '@shared/types';
import { BULAN_NAMES, formatPeriodeFileName } from '@shared/constants';

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

  return { getWorkspacePath, setWorkspacePath, listPeriode, resolveOutputPath };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
