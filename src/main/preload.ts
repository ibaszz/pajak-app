import { contextBridge, ipcRenderer } from 'electron';
import type { ParsedSPM, Periode, Pegawai, ProcessInput, ProcessResult } from '@shared/types';

const api = {
  workspace: {
    get: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
    pick: (): Promise<string | null> => ipcRenderer.invoke('workspace:pick'),
    listPeriode: (): Promise<Periode[]> => ipcRenderer.invoke('workspace:listPeriode')
  },
  pegawai: {
    list: (): Promise<Pegawai[]> => ipcRenderer.invoke('pegawai:list'),
    pickAndImport: (): Promise<number | null> => ipcRenderer.invoke('pegawai:pickAndImport')
  },
  spm: {
    pickAndParse: (): Promise<ParsedSPM | null> => ipcRenderer.invoke('spm:pickAndParse')
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
