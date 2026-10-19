import type Database from 'better-sqlite3';
import type {
  Kategori,
  Periode,
  SPMRow,
  SPMGajiRow,
  SPMTunjanganRow,
  SPMUangMakanRow,
  SPMBatchSummary
} from '@shared/types';

export interface SPMBatch {
  id: number;
  periode: string;
  noSPM: string;
  keterangan: string;
  kategori: Kategori;
  storedFile: string | null;
  rows: SPMRow[];
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
  tjistri: number;
  tjanak: number;
  tjupns: number;
  tjstruk: number;
  tjfungs: number;
  pembul: number;
  tjberas: number;
  tjpph: number;
  potpfk10: number;
  bersih: number | null;
  pajak: number | null;
  kotor: number | null;
  potongan: number | null;
  pph: number | null;
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

interface RowColumns {
  gjpokok: number;
  tjistri: number;
  tjanak: number;
  tjupns: number;
  tjstruk: number;
  tjfungs: number;
  pembul: number;
  tjberas: number;
  tjpph: number;
  potpfk10: number;
  bersih: number | null;
  pajak: number | null;
  kotor: number | null;
  potongan: number | null;
  pph: number | null;
}

const ZERO_GAJI = {
  gjpokok: 0, tjistri: 0, tjanak: 0, tjupns: 0, tjstruk: 0, tjfungs: 0,
  pembul: 0, tjberas: 0, tjpph: 0, potpfk10: 0
};

function rowToColumns(kategori: Kategori, r: SPMRow): RowColumns {
  if (kategori === 'gaji') {
    const g = r as SPMGajiRow;
    return {
      gjpokok: g.gjpokok, tjistri: g.tjistri, tjanak: g.tjanak, tjupns: g.tjupns,
      tjstruk: g.tjstruk, tjfungs: g.tjfungs, pembul: g.pembul,
      tjberas: g.tjberas, tjpph: g.tjpph, potpfk10: g.potpfk10,
      bersih: null, pajak: null, kotor: null, potongan: null, pph: null
    };
  }
  if (kategori === 'tunjangan') {
    const t = r as SPMTunjanganRow;
    return {
      ...ZERO_GAJI,
      bersih: t.bersih, pajak: t.pajak, kotor: null, potongan: null, pph: null
    };
  }
  const u = r as SPMUangMakanRow;
  return {
    ...ZERO_GAJI,
    bersih: u.bersih, pajak: null, kotor: u.kotor, potongan: u.potongan, pph: u.pph
  };
}

function rowFromColumns(kategori: Kategori, r: SpmRowRow): SPMRow {
  if (kategori === 'gaji') {
    return {
      nip: r.nip, nama: r.nama,
      gjpokok: r.gjpokok, tjistri: r.tjistri, tjanak: r.tjanak, tjupns: r.tjupns,
      tjstruk: r.tjstruk, tjfungs: r.tjfungs, pembul: r.pembul,
      tjberas: r.tjberas, tjpph: r.tjpph, potpfk10: r.potpfk10
    };
  }
  if (kategori === 'tunjangan') {
    return {
      nip: r.nip, nama: r.nama,
      bersih: r.bersih ?? 0,
      pajak: r.pajak ?? 0
    };
  }
  return {
    nip: r.nip, nama: r.nama,
    kotor: r.kotor ?? 0,
    potongan: r.potongan ?? 0,
    bersih: r.bersih ?? 0,
    pph: r.pph ?? 0
  };
}

export function periodeKey(p: Periode): string {
  return `${p.tahun}-${String(p.bulan).padStart(2, '0')}`;
}

export function createSpmBatchRepo(db: Database.Database) {
  const insertBatchStmt = db.prepare<[string, string, string, string, string | null]>(
    `INSERT INTO spm_batch (periode, no_spm, keterangan, kategori, stored_file)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertRowStmt = db.prepare<[
    number, string, string,
    number, number, number, number, number, number, number,
    number, number, number,
    number | null, number | null, number | null, number | null, number | null,
    number
  ]>(
    `INSERT INTO spm_row (
       batch_id, nip, nama,
       gjpokok, tjistri, tjanak, tjupns, tjstruk, tjfungs, pembul,
       tjberas, tjpph, potpfk10,
       bersih, pajak, kotor, potongan, pph,
       row_order
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    `SELECT nip, nama,
            gjpokok, tjistri, tjanak, tjupns, tjstruk, tjfungs, pembul,
            tjberas, tjpph, potpfk10,
            bersih, pajak, kotor, potongan, pph
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
      rows: SPMRow[]
    ) => {
      const info = insertBatchStmt.run(periode, noSPM, keterangan, kategori, storedFile);
      const batchId = Number(info.lastInsertRowid);
      rows.forEach((r, i) => {
        const c = rowToColumns(kategori, r);
        insertRowStmt.run(
          batchId, r.nip, r.nama,
          c.gjpokok, c.tjistri, c.tjanak, c.tjupns, c.tjstruk, c.tjfungs, c.pembul,
          c.tjberas, c.tjpph, c.potpfk10,
          c.bersih, c.pajak, c.kotor, c.potongan, c.pph,
          i
        );
      });
      return batchId;
    }
  );

  function batchRowToBatch(b: BatchRow): SPMBatch {
    const dbRows = listRowsStmt.all(b.id);
    return {
      id: b.id,
      periode: b.periode,
      noSPM: b.no_spm,
      keterangan: b.keterangan,
      kategori: b.kategori,
      storedFile: b.stored_file,
      rows: dbRows.map(r => rowFromColumns(b.kategori, r))
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
      rows: SPMRow[]
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
