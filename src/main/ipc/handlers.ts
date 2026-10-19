import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { createPegawaiRepo } from '../db/pegawai-repo';
import { createSpmBatchRepo, periodeKey, type SPMBatch } from '../db/spm-batch-repo';
import { createWorkspaceService } from '../workspace/workspace-service';
import { parseSPMByKategori } from '../excel/spm-parser';
import { detectKategoriFromFilename } from '../excel/categorizer';
import { importPegawaiFromPajakFile } from '../excel/pegawai-importer';
import { writePajakOutput, writeEmptyPajakOutput } from '../excel/output-writer';
import { copySpmFile, deleteSpmFile, determinePnsSuffix } from '../spm/spm-storage';
import type {
  ProcessInput,
  ProcessResult,
  Pegawai,
  Periode,
  SPMBatchSummary,
  SPMGajiRow,
  SPMTunjanganRow,
  SPMUangMakanRow,
  CreatePeriodeInput
} from '@shared/types';

function periodeFromKey(key: string, listed: Periode[]): Periode | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const tahun = parseInt(m[1], 10);
  const bulan = parseInt(m[2], 10);
  return listed.find(p => p.tahun === tahun && p.bulan === bulan) ?? null;
}

interface PartitionedBatches {
  gajiRows: { rows: SPMGajiRow[]; keterangan: string; noSPM: string }[];
  tunjanganRows: { rows: SPMTunjanganRow[]; keterangan: string; noSPM: string }[];
  uangMakanRows: { rows: SPMUangMakanRow[]; keterangan: string; noSPM: string }[];
}

function partitionBatches(batches: SPMBatch[]): PartitionedBatches {
  const gajiRows: PartitionedBatches['gajiRows'] = [];
  const tunjanganRows: PartitionedBatches['tunjanganRows'] = [];
  const uangMakanRows: PartitionedBatches['uangMakanRows'] = [];
  for (const b of batches) {
    const meta = { keterangan: b.keterangan, noSPM: b.noSPM };
    if (b.kategori === 'gaji') {
      gajiRows.push({ rows: b.rows as SPMGajiRow[], ...meta });
    } else if (b.kategori === 'tunjangan') {
      tunjanganRows.push({ rows: b.rows as SPMTunjanganRow[], ...meta });
    } else {
      uangMakanRows.push({ rows: b.rows as SPMUangMakanRow[], ...meta });
    }
  }
  return { gajiRows, tunjanganRows, uangMakanRows };
}

export function registerIpcHandlers(db: Database.Database): void {
  const pegawaiRepo = createPegawaiRepo(db);
  const spmBatchRepo = createSpmBatchRepo(db);
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

  ipcMain.handle('workspace:createPeriode', async (_e, input: CreatePeriodeInput): Promise<Periode> => {
    const periode = workspace.createPeriode(input);
    const outputPath = workspace.resolveOutputPath(periode);
    const pegawai = pegawaiRepo.list();
    await writeEmptyPajakOutput({ outputPath, pegawai, periode });
    workspace.ensurePeriodeFolder(periode);
    return periode;
  });

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
    if (kategori === null) {
      throw new Error(
        `Kategori tidak dikenal dari nama file. ` +
        `Gaji: gaji_bank|lampiranspm; Tunjangan: tukin|tunsus; Uang Makan: uangmakan|um <spasi>.`
      );
    }
    return await parseSPMByKategori(filePath, kategori);
  });

  ipcMain.handle('spm:listByPeriode', (_e, periode: Periode): SPMBatchSummary[] => {
    return spmBatchRepo.listSummariesByPeriode(periodeKey(periode));
  });

  ipcMain.handle('spm:delete', async (_e, batchId: number): Promise<void> => {
    const batch = spmBatchRepo.findById(batchId);
    if (!batch) throw new Error(`Batch ${batchId} tidak ditemukan.`);

    spmBatchRepo.delete(batchId);
    deleteSpmFile(batch.storedFile);

    const periode = periodeFromKey(batch.periode, workspace.listPeriode());
    if (!periode) return;
    const outputPath = workspace.resolveOutputPath(periode);
    const pegawai = pegawaiRepo.list();
    const remaining = spmBatchRepo.listByPeriode(batch.periode);
    const partitioned = partitionBatches(remaining);
    await writePajakOutput({ outputPath, pegawai, ...partitioned, periode });
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
    const pKey = periodeKey(input.periode);
    if (spmBatchRepo.has(pKey, input.noSPM)) {
      throw new Error(`No SPM "${input.noSPM}" sudah pernah diproses untuk periode ${input.periode.label}.`);
    }

    const workspacePath = workspace.getWorkspacePath();
    if (!workspacePath) throw new Error('Workspace belum dipilih.');

    const pnsSuffix = determinePnsSuffix(input.parsedSPM.rows, pegawai);

    let storedFile: string | null = null;
    try {
      storedFile = copySpmFile(
        input.parsedSPM.filePath,
        workspacePath,
        input.periode,
        input.noSPM,
        input.parsedSPM.kategori,
        pnsSuffix
      );
    } catch (e) {
      throw new Error(`Gagal arsip file SPM: ${(e as Error).message}`);
    }

    try {
      spmBatchRepo.insert(
        pKey,
        input.noSPM,
        input.keterangan,
        input.parsedSPM.kategori,
        storedFile,
        input.parsedSPM.rows
      );
    } catch (e) {
      deleteSpmFile(storedFile);
      throw e;
    }

    const batches = spmBatchRepo.listByPeriode(pKey);
    const partitioned = partitionBatches(batches);

    return await writePajakOutput({
      outputPath,
      pegawai,
      ...partitioned,
      periode: input.periode
    });
  });

  ipcMain.handle('shell:revealInFolder', (_e, filePath: string) => {
    if (fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  });
}
