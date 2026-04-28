import type Database from 'better-sqlite3';
import type { Pegawai } from '@shared/types';

interface PegawaiRow {
  nip: string;
  nik: string;
  nama: string;
  status_ptkp: string;
  golongan: string | null;
  jenis_asn: 'PNS' | 'PPPK';
  aktif: number;
}

function rowToPegawai(r: PegawaiRow): Pegawai {
  return {
    nip: r.nip,
    nik: r.nik,
    nama: r.nama,
    statusPtkp: r.status_ptkp,
    golongan: r.golongan,
    jenisAsn: r.jenis_asn,
    aktif: r.aktif === 1
  };
}

export function createPegawaiRepo(db: Database.Database) {
  const listStmt = db.prepare<[], PegawaiRow>(
    'SELECT nip, nik, nama, status_ptkp, golongan, jenis_asn, aktif FROM pegawai ORDER BY nama ASC'
  );
  const findStmt = db.prepare<[string], PegawaiRow>(
    'SELECT nip, nik, nama, status_ptkp, golongan, jenis_asn, aktif FROM pegawai WHERE nip = ?'
  );
  const upsertStmt = db.prepare<[string, string, string, string, string | null, string, number]>(`
    INSERT INTO pegawai (nip, nik, nama, status_ptkp, golongan, jenis_asn, aktif, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(nip) DO UPDATE SET
      nik = excluded.nik,
      nama = excluded.nama,
      status_ptkp = excluded.status_ptkp,
      golongan = excluded.golongan,
      jenis_asn = excluded.jenis_asn,
      aktif = excluded.aktif,
      updated_at = datetime('now')
  `);

  return {
    list(): Pegawai[] {
      return listStmt.all().map(rowToPegawai);
    },
    findByNip(nip: string): Pegawai | null {
      const row = findStmt.get(nip);
      return row ? rowToPegawai(row) : null;
    },
    upsert(p: Pegawai): void {
      upsertStmt.run(p.nip, p.nik, p.nama, p.statusPtkp, p.golongan, p.jenisAsn, p.aktif ? 1 : 0);
    }
  };
}

export type PegawaiRepo = ReturnType<typeof createPegawaiRepo>;
