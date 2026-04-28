import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Periode } from '@shared/types';

export default function WorkspaceScreen({ onChange }: { onChange: (p: string | null) => void }) {
  const [path, setPath] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode[]>([]);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const p = await api.workspace.get();
    setPath(p);
    onChange(p);
    if (p) setPeriode(await api.workspace.listPeriode());
  }

  async function pick() {
    const p = await api.workspace.pick();
    if (p) {
      setPath(p);
      onChange(p);
      setPeriode(await api.workspace.listPeriode());
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold mb-4">Workspace</h2>
      <div className="bg-white rounded border p-4 mb-4">
        <div className="text-sm text-slate-600 mb-1">Current workspace folder:</div>
        <div className="font-mono text-sm break-all">{path ?? '(belum dipilih)'}</div>
        <button
          onClick={pick}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          {path ? 'Ubah workspace' : 'Pilih workspace'}
        </button>
      </div>

      <h3 className="text-lg font-medium mb-2">Periode yang terdeteksi ({periode.length})</h3>
      <div className="bg-white rounded border divide-y">
        {periode.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            Tidak ada file pola "N. PPH21 - {'{Bulan}'} {'{Tahun}'}.xlsx" di folder ini.
          </div>
        ) : (
          periode.map((p) => (
            <div key={p.nomorUrut} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.nomorUrut}. {p.label}</div>
                <div className="text-xs text-slate-500">bulan={p.bulan}, tahun={p.tahun}</div>
              </div>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Ada</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
