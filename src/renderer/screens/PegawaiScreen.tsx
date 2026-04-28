import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Pegawai } from '@shared/types';

export default function PegawaiScreen() {
  const [list, setList] = useState<Pegawai[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setList(await api.pegawai.list());
  }

  async function importFromFile() {
    setImporting(true);
    setMsg(null);
    try {
      const n = await api.pegawai.pickAndImport();
      if (n !== null) {
        setMsg(`Berhasil import ${n} pegawai.`);
        await refresh();
      }
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Pegawai ({list.length})</h2>
        <button
          onClick={importFromFile}
          disabled={importing}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import dari file PPh21'}
        </button>
      </div>
      {msg && <div className="mb-3 px-3 py-2 bg-slate-100 border rounded text-sm">{msg}</div>}
      <div className="bg-white rounded border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2">NIP</th>
              <th className="p-2">NIK</th>
              <th className="p-2">Nama</th>
              <th className="p-2">PTKP</th>
              <th className="p-2">Gol</th>
              <th className="p-2">ASN</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.nip} className="border-t">
                <td className="p-2 font-mono text-xs">{p.nip}</td>
                <td className="p-2 font-mono text-xs">{p.nik}</td>
                <td className="p-2">{p.nama}</td>
                <td className="p-2">{p.statusPtkp}</td>
                <td className="p-2">{p.golongan ?? '-'}</td>
                <td className="p-2">{p.jenisAsn}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">
                Belum ada pegawai. Klik "Import dari file PPh21" untuk seed dari file existing.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
