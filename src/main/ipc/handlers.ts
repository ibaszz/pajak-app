import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { createPegawaiRepo } from '../db/pegawai-repo';
import { createWorkspaceService } from '../workspace/workspace-service';
import { parseGajiSPM } from '../excel/spm-parser';
import { detectKategoriFromFilename } from '../excel/categorizer';
import { importPegawaiFromPajakFile } from '../excel/pegawai-importer';
import { writePajakOutput } from '../excel/output-writer';
import type { ProcessInput, ProcessResult, Pegawai, Periode } from '@shared/types';

export function registerIpcHandlers(db: Database.Database): void {
  const pegawaiRepo = createPegawaiRepo(db);
  const workspace = createWorkspaceService(db);

  ipcMain.handle('workspace:get', () => workspace.getWorkspacePath());

  ipcMain.handle('workspace:pick', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: 'Pilih folder workspace',
      properties: ['openDirectory']
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    workspace.setWorkspacePath(r.filePaths[0]);
    return r.filePaths[0];
  });

  ipcMain.handle('workspace:listPeriode', (): Periode[] => workspace.listPeriode());

  ipcMain.handle('pegawai:list', (): Pegawai[] => pegawaiRepo.list());

  ipcMain.handle('pegawai:pickAndImport', async (): Promise<number | null> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: 'Pilih file PPh21 periode sebelumnya',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile']
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    const pegawai = await importPegawaiFromPajakFile(r.filePaths[0]);
    for (const p of pegawai) pegawaiRepo.upsert(p);
    return pegawai.length;
  });

  ipcMain.handle('spm:pickAndParse', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: 'Pilih file SPM',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    const filePath = r.filePaths[0];
    const kategori = detectKategoriFromFilename(filePath);
    if (kategori !== 'gaji') {
      throw new Error(`MVP hanya support kategori Gaji. Terdeteksi: ${kategori ?? 'tidak dikenal'}`);
    }
    return await parseGajiSPM(filePath);
  });

  ipcMain.handle('process:run', async (_e, input: ProcessInput): Promise<ProcessResult> => {
    const outputPath = workspace.resolveOutputPath(input.periode);
    const pegawai = pegawaiRepo.list();
    if (pegawai.length === 0) {
      throw new Error('Pegawai kosong. Import dulu dari file PPh21 periode sebelumnya.');
    }
    const knownNips = new Set(pegawai.map(p => p.nip));
    const missing = input.parsedSPM.rows.map(r => r.nip).filter(nip => !knownNips.has(nip));
    if (missing.length > 0) {
      const preview = missing.slice(0, 3).join(', ');
      throw new Error(`${missing.length} NIP belum ada di master Pegawai: ${preview}${missing.length > 3 ? '...' : ''}`);
    }
    return await writePajakOutput({
      outputPath,
      pegawai,
      gajiRows: [{
        rows: input.parsedSPM.rows,
        keterangan: input.keterangan,
        noSPM: input.noSPM
      }],
      periode: input.periode
    });
  });

  ipcMain.handle('shell:revealInFolder', (_e, filePath: string) => {
    if (fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  });
}
