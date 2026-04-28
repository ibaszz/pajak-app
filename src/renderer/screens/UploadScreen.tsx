import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ParsedSPM, Periode, ProcessResult } from '@shared/types';

export default function UploadScreen({ workspacePath }: { workspacePath: string | null }) {
  const [parsed, setParsed] = useState<ParsedSPM | null>(null);
  const [periode, setPeriode] = useState<Periode[]>([]);
  const [selectedPeriodeIdx, setSelectedPeriodeIdx] = useState<number>(-1);
  const [keterangan, setKeterangan] = useState('');
  const [noSPM, setNoSPM] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspacePath) api.workspace.listPeriode().then(setPeriode);
  }, [workspacePath]);

  async function pickFile() {
    setError(null);
    setResult(null);
    try {
      const r = await api.spm.pickAndParse();
      if (r) setParsed(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runProcess() {
    if (!parsed || selectedPeriodeIdx < 0) return;
    setProcessing(true);
    setError(null);
    try {
      const r = await api.process.run({
        parsedSPM: parsed,
        keterangan,
        noSPM,
        periode: periode[selectedPeriodeIdx]
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  if (!workspacePath) {
    return <div className="text-slate-600">Pilih workspace folder dulu di menu Workspace.</div>;
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-semibold mb-4">Upload SPM</h2>

      <div className="bg-white rounded border p-4 mb-4">
        <div className="text-sm font-medium mb-2">1. Pilih file SPM (Gaji)</div>
        <button onClick={pickFile} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          Pilih file...
        </button>
        {parsed && (
          <div className="mt-3 text-sm">
            <div><span className="text-slate-500">File:</span> {parsed.fileName}</div>
            <div><span className="text-slate-500">Kategori:</span> {parsed.kategori}</div>
            <div><span className="text-slate-500">Jumlah baris:</span> {parsed.rowCount}</div>
          </div>
        )}
      </div>

      {parsed && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-medium mb-2">2. Pilih periode output</div>
          <select
            value={selectedPeriodeIdx}
            onChange={(e) => setSelectedPeriodeIdx(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm w-full"
          >
            <option value={-1}>-- Pilih periode --</option>
            {periode.map((p, i) => (
              <option key={p.nomorUrut} value={i}>{p.nomorUrut}. {p.label}</option>
            ))}
          </select>
          <div className="text-xs text-slate-500 mt-1">
            Output akan ditulis ke file "N. PPH21 - {'{Bulan}'} {'{Tahun}'}.xlsx" di workspace.
          </div>
        </div>
      )}

      {parsed && selectedPeriodeIdx >= 0 && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-medium mb-2">3. Input info SPM</div>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-slate-600">Keterangan</label>
              <input
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
                placeholder="misal: Gaji Januari PNS CPNS"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600">No SPM</label>
              <input
                value={noSPM}
                onChange={(e) => setNoSPM(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
                placeholder="misal: 00007A"
              />
            </div>
          </div>
        </div>
      )}

      {parsed && selectedPeriodeIdx >= 0 && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-medium mb-2">4. Preview ({parsed.rowCount} baris)</div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100"><tr>
                <th className="p-1 text-left">NIP</th>
                <th className="p-1 text-left">Nama</th>
                <th className="p-1 text-right">Gjpokok</th>
                <th className="p-1 text-right">Tjberas</th>
                <th className="p-1 text-right">Tjpph</th>
                <th className="p-1 text-right">potpfk10</th>
              </tr></thead>
              <tbody>
                {parsed.rows.slice(0, 50).map((r) => (
                  <tr key={r.nip} className="border-t">
                    <td className="p-1 font-mono">{r.nip}</td>
                    <td className="p-1">{r.nama}</td>
                    <td className="p-1 text-right">{r.gjpokok.toLocaleString('id-ID')}</td>
                    <td className="p-1 text-right">{r.tjberas.toLocaleString('id-ID')}</td>
                    <td className="p-1 text-right">{r.tjpph.toLocaleString('id-ID')}</td>
                    <td className="p-1 text-right">{r.potpfk10.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rowCount > 50 && <div className="text-xs text-slate-500 mt-1">...showing first 50 rows</div>}
        </div>
      )}

      {parsed && selectedPeriodeIdx >= 0 && (
        <button
          onClick={runProcess}
          disabled={processing || !keterangan || !noSPM}
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {processing ? 'Memproses...' : '5. Tulis ke Excel'}
        </button>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
          <div className="font-medium text-green-800 mb-1">Berhasil! {result.rowsWritten} baris ditulis.</div>
          <div className="font-mono text-xs break-all">{result.outputPath}</div>
          <button
            onClick={() => api.shell.revealInFolder(result.outputPath)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Buka folder
          </button>
        </div>
      )}
    </div>
  );
}
