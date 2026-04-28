import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Periode } from '@shared/types';
import { BULAN_NAMES } from '@shared/constants';

export default function WorkspaceScreen({ onChange }: { onChange: (p: string | null) => void }) {
  const [path, setPath] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode[]>([]);
  const [showAdd, setShowAdd] = useState(false);

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

  async function reloadPeriode() {
    setPeriode(await api.workspace.listPeriode());
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

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium">Periode yang terdeteksi ({periode.length})</h3>
        {path && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Tambah Periode
          </button>
        )}
      </div>
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

      {showAdd && (
        <AddPeriodeModal
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await reloadPeriode();
          }}
        />
      )}
    </div>
  );
}

function AddPeriodeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const now = new Date();
  const [bulan, setBulan] = useState<number>(now.getMonth() + 1);
  const [tahun, setTahun] = useState<number>(now.getFullYear());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.workspace.createPeriode({ bulan, tahun });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-5 mx-4">
        <h3 className="text-lg font-semibold mb-3">Tambah Periode</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Bulan</label>
            <select
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm w-full"
            >
              {BULAN_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Tahun</label>
            <input
              type="number"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm w-full"
              min={2000}
              max={2100}
            />
          </div>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded border border-slate-300 hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Membuat...' : 'Buat'}
          </button>
        </div>
      </div>
    </div>
  );
}
