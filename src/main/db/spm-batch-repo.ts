import type Database from 'better-sqlite3';
import type { Kategori, Periode, SPMGajiRow, SPMBatchSummary } from '@shared/types';

export interface SPMBatch {
  id: number;
  periode: string;
  noSPM: string;
  keterangan: string;
  kategori: Kategori;
  storedFile: string | null;
  rows: SPMGajiRow[];
}

interface BatchRow {
  id: number;
  periode: string;
  no_spm: string;
  keterangan: string;
  kategori: Kategori;
  stored_file: string | null;
  created_at: string;
}

interface SpmRowRow {
  nip: string;
  nama: string;
  gjpokok: number;
  tjberas: number;
  tjpph: number;
  potpfk10: number;
}

interface BatchSummaryRow {
  id: number;
  no_spm: string;
  keterangan: string;
  kategori: Kategori;
  stored_file: string | null;
  created_at: string;
  row_count: number;
}

export function periodeKey(p: Periode): string {
  return `${p.tahun}-${String(p.bulan).padStart(2, '0')}`;
}

export function createSpmBatchRepo(db: Database.Database) {
  const insertBatchStmt = db.prepare<[string, string, string, string, string | null]>(
    `INSERT INTO spm_batch (periode, no_spm, keterangan, kategori, stored_file)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertRowStmt = db.prepare<[number, string, string, number, number, number, number, number]>(
    `INSERT INTO spm_row (batch_id, nip, nama, gjpokok, tjberas, tjpph, potpfk10, row_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const findByNoSpmStmt = db.prepare<[string, string], { id: number }>(
    `SELECT id FROM spm_batch WHERE periode = ? AND no_spm = ?`
  );
  const findByIdStmt = db.prepare<[number], BatchRow>(
    `SELECT id, periode, no_spm, keterangan, kategori, stored_file, created_at
     FROM spm_batch WHERE id = ?`
  );
  const listBatchesStmt = db.prepare<[string], BatchRow>(
    `SELECT id, periode, no_spm, keterangan, kategori, stored_file, created_at
     FROM spm_batch WHERE periode = ?
     ORDER BY created_at ASC, id ASC`
  );
  const listRowsStmt = db.prepare<[number], SpmRowRow>(
    `SELECT nip, nama, gjpokok, tjberas, tjpph, potpfk10
     FROM spm_row WHERE batch_id = ? ORDER BY row_order ASC`
  );
  const listSummariesStmt = db.prepare<[string], BatchSummaryRow>(
    `SELECT b.id, b.no_spm, b.keterangan, b.kategori, b.stored_file, b.created_at,
            (SELECT COUNT(*) FROM spm_row r WHERE r.batch_id = b.id) AS row_count
     FROM spm_batch b
     WHERE b.periode = ?
     ORDER BY b.created_at ASC, b.id ASC`
  );
  const deleteStmt = db.prepare<[number]>(`DELETE FROM spm_batch WHERE id = ?`);

  const insertTx = db.transaction(
    (
      periode: string,
      noSPM: string,
      keterangan: string,
      kategori: Kategori,
      storedFile: string | null,
      rows: SPMGajiRow[]
    ) => {
      const info = insertBatchStmt.run(periode, noSPM, keterangan, kategori, storedFile);
      const batchId = Number(info.lastInsertRowid);
      rows.forEach((r, i) => {
        insertRowStmt.run(batchId, r.nip, r.nama, r.gjpokok, r.tjberas, r.tjpph, r.potpfk10, i);
      });
      return batchId;
    }
  );

  function batchRowToBatch(b: BatchRow): SPMBatch {
    return {
      id: b.id,
      periode: b.periode,
      noSPM: b.no_spm,
      keterangan: b.keterangan,
      kategori: b.kategori,
      storedFile: b.stored_file,
      rows: listRowsStmt.all(b.id)
    };
  }

  return {
    has(periode: string, noSPM: string): boolean {
      return findByNoSpmStmt.get(periode, noSPM) !== undefined;
    },
    insert(
      periode: string,
      noSPM: string,
      keterangan: string,
      kategori: Kategori,
      storedFile: string | null,
      rows: SPMGajiRow[]
    ): number {
      return insertTx(periode, noSPM, keterangan, kategori, storedFile, rows);
    },
    findById(id: number): SPMBatch | null {
      const b = findByIdStmt.get(id);
      return b ? batchRowToBatch(b) : null;
    },
    listByPeriode(periode: string): SPMBatch[] {
      return listBatchesStmt.all(periode).map(batchRowToBatch);
    },
    listSummariesByPeriode(periode: string): SPMBatchSummary[] {
      return listSummariesStmt.all(periode).map(r => ({
        id: r.id,
        noSPM: r.no_spm,
        keterangan: r.keterangan,
        kategori: r.kategori,
        storedFile: r.stored_file,
        createdAt: r.created_at,
        rowCount: r.row_count
      }));
    },
    delete(id: number): void {
      deleteStmt.run(id);
    }
  };
}

export type SpmBatchRepo = ReturnType<typeof createSpmBatchRepo>;
