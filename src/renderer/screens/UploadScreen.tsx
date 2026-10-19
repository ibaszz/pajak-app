import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import type {
  Kategori,
  ParsedPdf,
  ParsedSPM,
  Periode,
  PdfRowOverrides,
  ProcessResult,
  SPMBatchSummary,
  SPMGajiRow,
  SPMTunjanganRow,
  SPMUangMakanRow
} from '@shared/types';
import ConfirmDialog from '../components/ConfirmDialog';

const KATEGORI_LABEL: Record<Kategori, string> = {
  gaji: 'Gaji',
  tunjangan: 'Tunjangan',
  uang_makan: 'Uang Makan'
};

const KATEGORI_COLOR: Record<Kategori, string> = {
  gaji: 'bg-blue-100 text-blue-700',
  tunjangan: 'bg-amber-100 text-amber-700',
  uang_makan: 'bg-emerald-100 text-emerald-700'
};

function KategoriBadge({ kategori }: { kategori: Kategori }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${KATEGORI_COLOR[kategori]}`}>
      {KATEGORI_LABEL[kategori]}
    </span>
  );
}

function GajiPreview({ rows }: { rows: SPMGajiRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-100"><tr>
        <th className="p-1 text-left">NIP</th>
        <th className="p-1 text-left">Nama</th>
        <th className="p-1 text-right">Gjpokok</th>
        <th className="p-1 text-right">Tjberas</th>
        <th className="p-1 text-right">Nominal</th>
        <th className="p-1 text-right">Tjpph</th>
        <th className="p-1 text-right">potpfk10</th>
      </tr></thead>
      <tbody>
        {rows.slice(0, 50).map((r) => {
          const nominal =
            r.gjpokok + r.tjistri + r.tjanak + r.tjupns +
            r.tjstruk + r.tjfungs + r.pembul + r.tjberas;
          return (
            <tr key={r.nip} className="border-t">
              <td className="p-1 font-mono">{r.nip}</td>
              <td className="p-1">{r.nama}</td>
              <td className="p-1 text-right">{r.gjpokok.toLocaleString('id-ID')}</td>
              <td className="p-1 text-right">{r.tjberas.toLocaleString('id-ID')}</td>
              <td className="p-1 text-right font-medium">{nominal.toLocaleString('id-ID')}</td>
              <td className="p-1 text-right">{r.tjpph.toLocaleString('id-ID')}</td>
              <td className="p-1 text-right">{r.potpfk10.toLocaleString('id-ID')}</td>
            </tr>
          );
        })}
        <tr key={"summary"} className="border-t">
          <td className="p-1 font-bold" colSpan={2}>
            Total
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.gjpokok, 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.tjberas, 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + (r.gjpokok + r.tjistri + r.tjanak + r.tjupns + r.tjstruk + r.tjfungs + r.pembul + r.tjberas), 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.tjpph, 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.potpfk10, 0).toLocaleString('id-ID')}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function TunjanganPreview({ rows }: { rows: SPMTunjanganRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-100"><tr>
        <th className="p-1 text-left">NIP</th>
        <th className="p-1 text-left">Nama</th>
        <th className="p-1 text-right">Bersih</th>
        <th className="p-1 text-right">Pajak</th>
      </tr></thead>
      <tbody>
        {rows.slice(0, 50).map((r) => (
          <tr key={r.nip} className="border-t">
            <td className="p-1 font-mono">{r.nip}</td>
            <td className="p-1">{r.nama}</td>
            <td className="p-1 text-right font-medium">{r.bersih.toLocaleString('id-ID')}</td>
            <td className="p-1 text-right">{r.pajak.toLocaleString('id-ID')}</td>
          </tr>
        ))}
        <tr key={"summary"} className="border-t">
          <td className="p-1 font-bold" colSpan={2}>
            Total
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.bersih, 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.pajak, 0).toLocaleString('id-ID')}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function UangMakanPreview({ rows }: { rows: SPMUangMakanRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-100"><tr>
        <th className="p-1 text-left">NIP</th>
        <th className="p-1 text-left">Nama</th>
        <th className="p-1 text-right">Kotor</th>
        <th className="p-1 text-right">Potongan</th>
        <th className="p-1 text-right">Bersih</th>
        <th className="p-1 text-right">PPH</th>
      </tr></thead>
      <tbody>
        {rows.slice(0, 50).map((r) => (
          <tr key={r.nip} className="border-t">
            <td className="p-1 font-mono">{r.nip}</td>
            <td className="p-1">{r.nama}</td>
            <td className="p-1 text-right">{r.kotor.toLocaleString('id-ID')}</td>
            <td className="p-1 text-right">{r.potongan.toLocaleString('id-ID')}</td>
            <td className="p-1 text-right font-medium">{r.bersih.toLocaleString('id-ID')}</td>
            <td className="p-1 text-right">{r.pph.toLocaleString('id-ID')}</td>
          </tr>
        ))}
        <tr key={"summary"} className="border-t">
          <td className="p-1 font-bold" colSpan={2}>
            Total
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.kotor, 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.potongan, 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + (r.bersih), 0).toLocaleString('id-ID')}
          </td>
          <td className="p-1 text-right font-bold">
            {rows?.reduce((sum, r) => sum + r.pph, 0).toLocaleString('id-ID')}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const PDF_SOURCE_LABEL: Record<ParsedPdf['sourceKind'], string> = {
  uang_makan_pdf: 'PDF Uang Makan',
  honorarium_pdf: 'PDF Honorarium'
};

function PdfRowReview({
  parsedPdf,
  overrides,
  onOverride
}: {
  parsedPdf: ParsedPdf;
  overrides: PdfRowOverrides;
  onOverride: (rowIdx: number, nip: string) => void;
}) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-100"><tr>
        <th className="p-1 text-left">Nama (dari PDF)</th>
        <th className="p-1 text-right">Kotor</th>
        <th className="p-1 text-right">Potongan</th>
        <th className="p-1 text-right">Bersih</th>
        <th className="p-1 text-right">PPh %</th>
        <th className="p-1 text-left">Status Match</th>
        <th className="p-1 text-left">NIP Terpilih</th>
      </tr></thead>
      <tbody>
        {parsedPdf.rows.map((r, i) => {
          const resolvedNip = r.nip ?? overrides[i] ?? '';
          const needsPick = r.matchStatus !== 'matched';
          return (
            <tr key={i} className={`border-t ${needsPick && !overrides[i] ? 'bg-amber-50' : ''}`}>
              <td className="p-1">{r.namaAsli}</td>
              <td className="p-1 text-right">{r.kotor.toLocaleString('id-ID')}</td>
              <td className="p-1 text-right">{r.potongan.toLocaleString('id-ID')}</td>
              <td className="p-1 text-right font-medium">{r.bersih.toLocaleString('id-ID')}</td>
              <td className="p-1 text-right">{r.pph}</td>
              <td className="p-1">
                {r.matchStatus === 'matched' && <span className="text-emerald-600">Cocok otomatis</span>}
                {r.matchStatus === 'ambiguous' && <span className="text-amber-600">Ambigu — pilih manual</span>}
                {r.matchStatus === 'unmatched' && <span className="text-red-600">Tidak ketemu — pilih manual</span>}
              </td>
              <td className="p-1">
                {needsPick ? (
                  <select
                    value={resolvedNip}
                    onChange={(e) => onOverride(i, e.target.value)}
                    className="border rounded px-1 py-0.5 text-xs w-full"
                  >
                    <option value="">-- pilih pegawai --</option>
                    {r.candidates.map((c) => (
                      <option key={c.nip} value={c.nip}>
                        {c.nama} ({(c.score * 100).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono">{resolvedNip}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


export default function UploadScreen({ workspacePath }: { workspacePath: string | null }) {
  const [parsed, setParsed] = useState<ParsedSPM | null>(null);
  const [parsedPdf, setParsedPdf] = useState<ParsedPdf | null>(null);
  const [pdfOverrides, setPdfOverrides] = useState<PdfRowOverrides>({});
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfPicking, setPdfPicking] = useState(false);
  const [periode, setPeriode] = useState<Periode[]>([]);
  const [selectedPeriodeIdx, setSelectedPeriodeIdx] = useState<number>(-1);
  const [keterangan, setKeterangan] = useState('');
  const [noSPM, setNoSPM] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<SPMBatchSummary[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<SPMBatchSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedPeriode = selectedPeriodeIdx >= 0 ? periode[selectedPeriodeIdx] : null;

  useEffect(() => {
    if (workspacePath) api.workspace.listPeriode().then(setPeriode);
  }, [workspacePath]);

  const refreshBatches = useCallback(async () => {
    if (!selectedPeriode) {
      setBatches([]);
      return;
    }
    const list = await api.spm.listByPeriode(selectedPeriode);
    setBatches(list);
  }, [selectedPeriode]);

  useEffect(() => {
    refreshBatches();
  }, [refreshBatches]);

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

  async function pickPdf() {
    setPdfError(null);
    setError(null);
    setResult(null);
    setPdfPicking(true);
    try {
      const r = await api.pdf.pickAndParse();
      if (r) {
        setParsedPdf(r);
        setPdfOverrides({});
        setParsed(null);
      }
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfPicking(false);
    }
  }

  function setPdfOverride(rowIdx: number, nip: string) {
    setPdfOverrides((prev) => ({ ...prev, [rowIdx]: nip }));
  }

  const pdfAllResolved =
    !!parsedPdf && parsedPdf.rows.every((r, i) => !!(r.nip ?? pdfOverrides[i]));

  async function confirmPdf() {
    if (!parsedPdf) return;
    setPdfError(null);
    try {
      const spm = await api.pdf.finalize(parsedPdf, pdfOverrides);
      setParsed(spm);
      setParsedPdf(null);
      setPdfOverrides({});
    } catch (e) {
      setPdfError((e as Error).message);
    }
  }

  function cancelPdf() {
    setParsedPdf(null);
    setPdfOverrides({});
    setPdfError(null);
  }

  async function runProcess() {
    if (!parsed || !selectedPeriode) return;
    setProcessing(true);
    setError(null);
    try {
      const r = await api.process.run({
        parsedSPM: parsed,
        keterangan,
        noSPM,
        periode: selectedPeriode
      });
      setResult(r);
      setParsed(null);
      setKeterangan('');
      setNoSPM('');
      await refreshBatches();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await api.spm.delete(confirmDelete.id);
      setConfirmDelete(null);
      await refreshBatches();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (!workspacePath) {
    return <div className="text-slate-600">Pilih workspace folder dulu di menu Workspace.</div>;
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-semibold mb-4">Upload SPM</h2>

      <div className="bg-white rounded border p-4 mb-4">
        <div className="text-sm font-medium mb-2">1. Pilih periode</div>
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
        {periode.length === 0 && (
          <div className="text-xs text-slate-500 mt-1">
            Belum ada periode. Buat periode dulu di menu Workspace.
          </div>
        )}
      </div>

      {selectedPeriode && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-medium mb-2">
            SPM yang sudah di-upload untuk {selectedPeriode.label} ({batches.length})
          </div>
          {batches.length === 0 ? (
            <div className="text-sm text-slate-500">Belum ada SPM di periode ini.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">No SPM</th>
                    <th className="p-2 text-left">Kategori</th>
                    <th className="p-2 text-left">Keterangan</th>
                    <th className="p-2 text-right">Baris</th>
                    <th className="p-2 text-left">Tanggal Upload</th>
                    <th className="p-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-2 font-mono">{b.noSPM}</td>
                      <td className="p-2"><KategoriBadge kategori={b.kategori} /></td>
                      <td className="p-2">{b.keterangan}</td>
                      <td className="p-2 text-right">{b.rowCount}</td>
                      <td className="p-2 text-slate-600">{b.createdAt}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => setConfirmDelete(b)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedPeriode && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-medium mb-2">2. Pilih file SPM (Gaji / Tunjangan / Uang Makan)</div>
          <button onClick={pickFile} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Pilih file Excel...
          </button>
          {parsed && (
            <div className="mt-3 text-sm">
              <div><span className="text-slate-500">File:</span> {parsed.fileName}</div>
              <div><span className="text-slate-500">Kategori:</span> <KategoriBadge kategori={parsed.kategori} /></div>
              <div><span className="text-slate-500">Jumlah baris:</span> {parsed.rowCount}</div>
            </div>
          )}
        </div>
      )}

      {selectedPeriode && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-medium mb-2">2b. Atau upload PDF Uang Makan / Honorarium</div>
          <div className="text-xs text-slate-500 mb-2">
            PPh21 non-pegawai. Honorarium PDF tidak punya NIP, nama akan dicocokkan otomatis
            ke master Pegawai — baris yang ambigu/tidak ketemu harus dipilih manual sebelum lanjut.
          </div>
          <button
            onClick={pickPdf}
            disabled={pdfPicking}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {pdfPicking ? 'Membaca PDF...' : 'Pilih file PDF...'}
          </button>
          {pdfError && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{pdfError}</div>
          )}
          {parsedPdf && (
            <div className="mt-3">
              <div className="text-sm mb-2">
                <span className="text-slate-500">File:</span> {parsedPdf.fileName}{' '}
                <span className="text-slate-500">({PDF_SOURCE_LABEL[parsedPdf.sourceKind]}, {parsedPdf.rowCount} baris)</span>
              </div>
              <div className="max-h-72 overflow-auto border rounded">
                <PdfRowReview parsedPdf={parsedPdf} overrides={pdfOverrides} onOverride={setPdfOverride} />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={confirmPdf}
                  disabled={!pdfAllResolved}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Lanjutkan ke Uang Makan
                </button>
                <button
                  onClick={cancelPdf}
                  className="px-4 py-2 border rounded text-sm text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
              </div>
              {!pdfAllResolved && (
                <div className="text-xs text-amber-600 mt-1">
                  Masih ada baris yang belum punya NIP terkonfirmasi — pilih pegawai di kolom "NIP Terpilih".
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {parsed && selectedPeriode && (
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

      {parsed && selectedPeriode && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-medium mb-2">4. Preview ({parsed.rowCount} baris)</div>
          <div className="max-h-64 overflow-auto">
            {parsed.kategori === 'gaji' && <GajiPreview rows={parsed.rows} />}
            {parsed.kategori === 'tunjangan' && <TunjanganPreview rows={parsed.rows} />}
            {parsed.kategori === 'uang_makan' && <UangMakanPreview rows={parsed.rows} />}
          </div>
          {parsed.rowCount > 50 && <div className="text-xs text-slate-500 mt-1">...showing first 50 rows</div>}
        </div>
      )}

      {parsed && selectedPeriode && (
        <button
          onClick={runProcess}
          disabled={processing || !keterangan || !noSPM}
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {processing ? 'Memproses...' : '5. Tambahkan SPM ke periode ini'}
        </button>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
          <div className="font-medium text-green-800 mb-1">Berhasil! {result.rowsWritten} baris di output.</div>
          <div className="font-mono text-xs break-all">{result.outputPath}</div>
          <button
            onClick={() => api.shell.revealInFolder(result.outputPath)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Buka folder
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus SPM?"
        message={
          confirmDelete
            ? `Hapus SPM ${confirmDelete.noSPM} (${confirmDelete.keterangan})?\nFile arsip dan datanya akan dihapus permanen, dan file output akan diregenerasi.`
            : ''
        }
        confirmLabel={deleting ? 'Menghapus...' : 'Hapus'}
        onConfirm={doDelete}
        onCancel={() => !deleting && setConfirmDelete(null)}
      />
    </div>
  );
}
