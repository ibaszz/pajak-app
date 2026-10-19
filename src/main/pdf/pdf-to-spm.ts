import path from 'node:path';
import type { Pegawai, ParsedPdf, ParsedSPM, PdfRowOverrides, SPMUangMakanRow } from '@shared/types';
import { parseUangMakanPdfRaw, parseHonorariumPdfRaw } from './pdf-parser';
import { matchNameToPegawai } from './nama-matcher';

export async function parsePdfFile(
  filePath: string,
  sourceKind: 'uang_makan_pdf' | 'honorarium_pdf',
  pegawai: Pegawai[],
  buffer: Buffer
): Promise<ParsedPdf> {
  if (sourceKind === 'uang_makan_pdf') {
    const raw = await parseUangMakanPdfRaw(buffer);
    return {
      filePath,
      fileName: path.basename(filePath),
      sourceKind,
      rowCount: raw.length,
      rows: raw.map((r) => {
        // NIP is printed directly on this PDF — no name matching needed.
        const byNip = pegawai.find((p) => p.nip === r.nip);
        return {
          namaAsli: r.nama,
          kotor: r.kotor,
          potongan: r.potongan,
          bersih: r.bersih,
          pph: r.pph,
          matchStatus: byNip ? 'matched' : 'unmatched',
          nip: byNip ? r.nip : null,
          candidates: byNip
            ? []
            : [{ nip: r.nip, nama: `(NIP ${r.nip} dari PDF, belum ada di master pegawai)`, score: 1 }]
        };
      })
    };
  }

  const raw = await parseHonorariumPdfRaw(buffer);
  return {
    filePath,
    fileName: path.basename(filePath),
    sourceKind,
    rowCount: raw.length,
    rows: raw.map((r) => {
      const match = matchNameToPegawai(r.nama, pegawai);
      return {
        namaAsli: r.nama,
        kotor: r.kotor,
        potongan: r.potongan,
        bersih: r.bersih,
        pph: r.pph,
        matchStatus: match.status,
        nip: match.pegawai?.nip ?? null,
        candidates: match.candidates.map((c) => ({
          nip: c.pegawai.nip,
          nama: c.pegawai.nama,
          score: c.score
        }))
      };
    })
  };
}

/**
 * Converts a ParsedPdf (after the UI has resolved any ambiguous/unmatched
 * rows via overrides) into a ParsedSPM of kategori 'uang_makan' — the same
 * shape produced by spm-parser.ts for Excel input. This lets PDF input
 * reuse the existing process:run / output-writer / Non Gaji Ledger pipeline
 * unchanged.
 *
 * Throws if any row still lacks a resolved NIP (caller must resolve or
 * drop those rows in the UI before finalizing).
 */
export function finalizePdfToSPM(parsed: ParsedPdf, overrides: PdfRowOverrides): ParsedSPM {
  const rows: SPMUangMakanRow[] = parsed.rows.map((r, i) => {
    const nip = r.nip ?? overrides[i] ?? null;
    if (!nip) {
      throw new Error(
        `Baris "${r.namaAsli}" belum punya NIP terkonfirmasi. Pilih pegawai secara manual dulu.`
      );
    }
    return {
      nip,
      nama: r.namaAsli,
      kotor: r.kotor,
      potongan: r.potongan,
      bersih: r.bersih,
      pph: r.pph
    };
  });

  return {
    filePath: parsed.filePath,
    fileName: parsed.fileName,
    kategori: 'uang_makan',
    rowCount: rows.length,
    rows
  };
}
