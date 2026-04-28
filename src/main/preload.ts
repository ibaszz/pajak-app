import { contextBridge, ipcRenderer } from 'electron';
import type {
  ParsedSPM,
  Periode,
  Pegawai,
  ProcessInput,
  ProcessResult,
  SPMBatchSummary,
  CreatePeriodeInput
} from '@shared/types';

const api = {
  workspace: {
    get: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
    pick: (): Promise<string | null> => ipcRenderer.invoke('workspace:pick'),
    listPeriode: (): Promise<Periode[]> => ipcRenderer.invoke('workspace:listPeriode'),
    createPeriode: (input: CreatePeriodeInput): Promise<Periode> =>
      ipcRenderer.invoke('workspace:createPeriode', input)
  },
  pegawai: {
    list: (): Promise<Pegawai[]> => ipcRenderer.invoke('pegawai:list'),
    pickAndImport: (): Promise<number | null> => ipcRenderer.invoke('pegawai:pickAndImport')
  },
  spm: {
    pickAndParse: (): Promise<ParsedSPM | null> => ipcRenderer.invoke('spm:pickAndParse'),
    listByPeriode: (periode: Periode): Promise<SPMBatchSummary[]> =>
      ipcRenderer.invoke('spm:listByPeriode', periode),
    delete: (batchId: number): Promise<void> => ipcRenderer.invoke('spm:delete', batchId)
  },
  process: {
    run: (input: ProcessInput): Promise<ProcessResult> => ipcRenderer.invoke('process:run', input)
  },
  shell: {
    revealInFolder: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:revealInFolder', filePath)
  }
};

contextBridge.exposeInMainWorld('api', api);

export type PajakAPI = typeof api;
