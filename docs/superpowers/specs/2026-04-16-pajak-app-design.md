# Pajak App — Desktop Tool PPh21 Pegawai Pemerintah

**Status:** Draft — pending implementation plan
**Created:** 2026-04-16
**Scope:** MVP — Januari–November (TER method PMK 168/2023)

## Problem & Goal

User mengelola PPh21 pegawai pemerintah secara manual setiap bulan:
- Terima banyak file Excel SPM (Surat Perintah Membayar) dari sistem keuangan — Gaji, Tunjangan/Tukin, Uang Makan.
- Kategorikan tiap file, mapping kolom-kolomnya ke sheet ledger.
- Hitung pajak PPh21 pakai metode TER.
- Generate format upload untuk Coretax (BPMP).
- Semua dikerjakan manual di satu file Excel per periode dengan banyak sheet & VLOOKUP.

**Goal:** Desktop app yang otomatis melakukan langkah-langkah di atas — upload SPM, auto-kategorisasi, hitung pajak, tulis ke file PPh21 per periode. Data pegawai tetap di laptop (privacy), output Excel tetap kompatibel dengan proses manual saat ini.

## Non-Goals (MVP)

- Perhitungan PPh21 Desember (Pasal 17 progresif) — ditambahkan di v2.
- Multi-user / cloud sync — single-user, single-machine.
- Integrasi langsung ke Coretax API — output tetap Excel yang di-copy-paste.
- Support selain Windows — Electron build hanya untuk Windows untuk MVP.

## Tech Stack

- **Electron** (main process) + **React + TypeScript + Vite** (renderer) + **Tailwind CSS + shadcn/ui**
- **better-sqlite3** — master data pegawai lokal
- **exceljs** — baca/tulis Excel dengan formula preservation
- **zod** — validasi input
- **vitest** — unit & integration testing
- **electron-builder** — packaging ke `.exe`
- **electron-log** — structured logging

## Architecture

### Process split

- **Main process** — file I/O, SQLite access, Excel parsing/writing, workspace management. Semua yang sentuh disk/DB.
- **Renderer process** — UI React (upload zone, inline table editor, preview, pegawai CRUD, settings).
- **Komunikasi** — IPC via `contextBridge`, type-safe: renderer panggil `window.api.parseSPM(filePath)` dll.

### Folder struktur

```
pajak-app-electron/
├── src/
│   ├── main/              # Electron main process
│   │   ├── db/            # SQLite schema + queries
│   │   ├── excel/         # SPM parser, template writer, sheet builders
│   │   ├── tax/           # TER logic, perhitungan pajak
│   │   ├── workspace/     # workspace config, file discovery
│   │   └── ipc/           # IPC handler registry
│   ├── renderer/          # React UI
│   │   ├── screens/       # Workspace, Periode, Pegawai, Settings
│   │   ├── components/    # Table, Dialog, Toast, etc.
│   │   └── hooks/
│   └── shared/            # Types & constants dipakai main + renderer
├── resources/
│   └── template.xlsx      # Template PPh21 kosong dengan formula & sheet Ref TER
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/          # Sample SPM files (sanitized)
└── electron-builder.yml
```

### Kenapa struktur ini

- Excel parsing & tax logic berat → di main process supaya tidak blokir UI.
- Template `.xlsx` bundled sebagai resource → user langsung bisa pakai tanpa setup manual.
- Shared types di folder terpisah → kontrak main↔renderer jelas, dicek compiler.

## Data Model

### SQLite (`<userData>/pajak.db`)

```sql
CREATE TABLE pegawai (
  nip           TEXT PRIMARY KEY,
  nik           TEXT NOT NULL,
  nama          TEXT NOT NULL,
  status_ptkp   TEXT NOT NULL,
  golongan      TEXT,
  jenis_asn     TEXT NOT NULL CHECK (jenis_asn IN ('PNS','PPPK')),
  aktif         INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE process_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  periode      TEXT,         -- "2026-02"
  file_name    TEXT,
  kategori     TEXT,         -- gaji|tunjangan|uang_makan
  no_spm       TEXT,
  keterangan   TEXT,
  rows_count   INTEGER,
  processed_at TEXT DEFAULT (datetime('now'))
);
```

### Tabel TER

Disimpan di **sheet `Ref TER`** dalam `template.xlsx` (user-editable via Excel). Kolom:
- `kategori_ptkp` — A, B, atau C
- `batas_bawah`, `batas_atas` — range penghasilan bulanan
- `tarif_persen` — tarif TER

Mapping PTKP → kategori TER dilakukan oleh `tax/ptkp-mapper.ts` sesuai PMK 168/2023 (TK/0, TK/1 → A; K/0, TK/2, TK/3 → B; K/1, K/2, K/3 → B/C sesuai regulasi).

### Workspace (filesystem)

```
{workspace-root}/
├── 1. PPH21 - Januari 2026.xlsx     ← output per periode
├── 1. Januari/                       ← folder SPM sumber
│   └── *.xlsx
├── 2. PPH21 - Febuari 2026.xlsx
└── 2. Febuari/
```

App menyimpan `workspace_path` di `settings`. Discovery periode pakai glob `{N}. PPH21 - {Bulan} {Tahun}.xlsx`. Nama bulan Indonesia.

### Types bersama (shared)

```ts
type Kategori = 'gaji' | 'tunjangan' | 'uang_makan';
type Periode = { bulan: number; tahun: number; nomorUrut: number; label: string };
type SPMRow = { nip: string; nama: string; nominal: number; pph: number; /* ... */ };
type SPMFile = {
  filePath: string;
  kategori: Kategori;
  keterangan: string;
  noSPM: string;
  noRefDok?: string;
  tglRefDok?: string;    // DD-MM-YYYY
  rows: SPMRow[];
};
```

### Source of truth

Sheet `Ref Pegawai` di output Excel dibuat-regenerate dari SQLite tiap proses. Kalau user edit langsung di Excel, perubahan tidak persist — satu-satunya cara edit adalah via UI Pegawai.

## Core Workflow

```
1. USER — drag-drop file SPM atau scan folder periode
   ↓
2. PARSE & DETECT (main) — per file:
   a. Baca xlsx → extract rows
   b. Kategorisasi: filename pattern → validate content
   c. Match NIP dengan DB → kumpulkan unknown NIPs
   ↓
3. INLINE TABLE EDITOR (renderer):
   Row per file: [Kategori▼] [Keterangan] [No SPM] [No Ref Dok] [Tgl Ref Dok]
   Pegawai baru → modal batch "Tambah pegawai: NIK, PTKP, Gol, PNS/PPPK"
   ↓
4. PREVIEW (opsional) — calculated totals per sheet
   ↓
5. WRITE OUTPUT (main):
   a. Open {N}. PPH21 - {Bulan} {Tahun}.xlsx (atau copy template)
   b. Append ke Gaji Ledger / Non Gaji Ledger (dedup key: NIP+kategori+no_spm)
   c. Regenerate Rekap Gaji, Pajak, BPMP, BPMP Non Gaji, MyIntress
   d. Sync Ref Pegawai dari SQLite
   e. Save atomically, write process_log
```

### Kategorisasi — 2 lapis

1. **Filename match** (primer): regex `/gaji_bank|lampiranspm/i` → gaji; `/tukin|tunsus/i` → tunjangan; `/uangmakan|^um /i` → uang_makan.
2. **Content validation** (sekunder): cek header sheet. `gjpokok`+`tjberas` konfirmasi gaji; `bersih`+`pajak`+`kotor` konfirmasi tunjangan/uang_makan. Mismatch → warning di UI, user bisa override.

### Append semantics

- **Dedup key**: `(NIP, kategori, no_spm)`. Kalau sudah ada → skip + warning "SPM XYZ sudah pernah diupload". Bisa override via checkbox "Replace existing".
- **Idempotent**: jalan 2x dengan input sama menghasilkan output yang sama.

### Sheet derivatif

Di-regenerate dari awal tiap proses (bukan incremental diff). Lebih simple & konsisten, trade-off minor untuk write time yang tetap <10 detik.

## Sheet & Formula Strategy

Mixed strategy — formula Excel dipertahankan di sheet yang user mau inspect/audit; static values untuk format output.

| Sheet | Cara isi | Formula? | Source |
|-------|----------|----------|--------|
| Ref Pegawai | App sync dari SQLite | — | DB |
| Ref TER | Bundled di template | — | template |
| Gaji Ledger | App tulis data + VLOOKUP | ✅ | SPM gaji+tunjangan |
| Non Gaji Ledger | App tulis data + VLOOKUP | ✅ | SPM uang makan |
| Rekap Gaji | App build pivot (static) | ❌ | Gaji Ledger |
| Pajak | Data + VLOOKUP + SUMIF + TER lookup | ✅ | Rekap Gaji + Ref TER |
| Untuk Copy BPMP | Format transform (static) | ❌ | Pajak |
| Untuk Copy BPMP Non Gaji | Format transform (static) | ❌ | Non Gaji Ledger |
| MyIntress | Aggregate dari process_log | ❌ | SPM inputs |

### Mapping kolom (ringkasan dari `Struktur Excel.md`)

**Gaji Ledger — kategori Gaji:**
- `Nominal` = `gjpokok + tjberas` (value)
- `PPH` = `tjpph` (value)
- `Tunjangan PPH` = `tjpph` (value)
- `potpfk10` = `potpfk10` (value)
- `Keterangan`, `SPM` = input user

**Gaji Ledger — kategori Tunjangan:**
- `Nominal` = `bersih`
- `PPH` = `pajak`
- `Tunjangan PPH` = `pajak` kalau PNS, `0` kalau PPPK (lookup Ref Pegawai)
- `potpfk10` = `0`

**Non Gaji Ledger — kategori Uang Makan:**
- `Kotor`, `potongan`, `bersih`, `PPH` dari file
- `Keterangan`, `SPM` input user

**Pajak:**
- `Total Penghasilan` = `SUMIF` dari Rekap Gaji per NIP
- `Total PPH Tercatat` = `SUMIF` dari Rekap Gaji
- `Ter` = formula `VLOOKUP` ke Ref TER berdasarkan kategori PTKP & penghasilan
- `PPH kena pajak` = `Total Penghasilan * Ter`
- `Tarif penyesuaian` = `Total PPH Tercatat / Total Penghasilan`

**Untuk Copy BPMP (format Coretax Gaji):**
- `Kode Objek Pajak` = `21-100-01`
- `NPWP` = NIK
- `Status Pegawai` = `Resident`
- `Posisi` = `PNS` atau `PPPK`
- `ID TKU` = `0000032284044000000000`
- `Tgl Pemotongan` = tanggal 1 masa pajak

**Untuk Copy BPMP Non Gaji:**
- `Kode Objek Pajak` — conditional: `pph=5 → 21-402-02`, `pph=0 → 21-402-04`, `pph=15 → 21-402-03`
- `ID TKU` = `{NIK}000000`
- `Deemed` = `100`
- `Jenis Dok` = `Other`
- `Nomor Referensi Dok`, `Tanggal Dok Referensi` = input user
- `ID TKU Pemotong` = `0000032284044000000000`
- `Tanggal Pemotongan` = Tanggal Dok Referensi

### Kenapa mixed strategy

- **Formula di Ledger & Pajak** → user akuntan bisa audit VLOOKUP, trace ke source, edit cell manual untuk koreksi khusus.
- **Static di BPMP & Rekap & MyIntress** → format output, tidak perlu user edit, formula bisa break kalau baris dipindah saat copy-paste ke Coretax.

## UI Screens

### Screen 1 — Workspace (home)

Landing page. List semua periode (discovered dari filesystem). Actions: Create periode baru, Open periode existing, Change workspace path.

### Screen 2 — Periode Detail

Inti kerja harian:
- Drop zone (drag-drop file) + tombol "Scan folder periode"
- Inline table editor untuk file ter-deteksi — kolom: File, Kategori (dropdown), Keterangan, No SPM, No Ref Dok, Tgl Ref Dok, Rows count, Status
- Modal batch "Review pegawai baru" kalau ada NIP yang belum dikenal
- Action: Preview, Proses & Tulis ke Excel

### Screen 3 — Pegawai (master data)

CRUD + search + filter (PNS/PPPK, aktif/tidak). Action: Tambah, Edit, Import dari Excel periode lama, Export ke CSV.

### Screen 4 — Settings

Path workspace, path template, versi app, buka log folder, link docs.

### Interaction patterns

- **Modal**: pegawai baru (batch review), confirm replace existing SPM, file output locked.
- **Toast**: sukses, warning kategori mismatch.
- **Progress bar**: saat write Excel (5–10 detik untuk banyak rows).
- **Hotkey minimal**: `Ctrl+S` proses, `Esc` cancel.

### Design system

- Tailwind + shadcn/ui untuk komponen
- Font Inter untuk readability numerik
- Right-aligned numbers dengan `Intl.NumberFormat('id-ID')`
- Minimal decoration — tool internal, clarity > aesthetic

## Error Handling

Prinsip: **fail per-row/per-file, bukan per-batch**. User harus bisa proses 5 dari 6 file walaupun 1 bermasalah.

| Boundary | Error | Handling |
|----------|-------|----------|
| File I/O | Corrupt, password-protected, locked oleh Excel | Per-file error di row table; retry sekali untuk lock; prompt "Tutup file" |
| Parser SPM | Header tak dikenal, kolom hilang, tipe salah | Flag row warning + tooltip raw content; user bisa skip/fix |
| Kategorisasi | Filename/content mismatch | Warning kuning; kategori dari content detection; user bisa override |
| DB | Constraint violation (NIP dup, PTKP invalid) | Modal error dengan detail; rollback transaksi |
| Tax calc | PTKP tak bisa di-map ke TER, penghasilan 0 | Skip baris + log warning; total lain tetap dihitung |
| Excel write | Disk full, permission, corrupt mid-write | Write ke `.xlsx.tmp` lalu rename atomic; file asli aman |

**Logging**: `electron-log` ke `<userData>/logs/app.log`. Level INFO/WARN/ERROR. Settings → "Buka log folder".

## Testing Strategy

### Layer 1 — Unit tests (vitest)

- `tax/ter-lookup.ts` — lookup dari Ref TER, edge cases (boundary, invalid kategori)
- `tax/ptkp-mapper.ts` — mapping PTKP → A/B/C
- `excel/spm-parser.ts` — parse 3 jenis SPM dari fixture (sanitized dari Januari/Februari)
- `excel/categorizer.ts` — filename + content detection, kasus ambigu
- `excel/bpmp-builder.ts` — kode objek pajak conditional, format tanggal

### Layer 2 — Integration tests (vitest + tmpdir)

End-to-end tanpa UI: seed DB → load template → pipeline → write → assert:
- Row counts per sheet benar
- Formula VLOOKUP/SUMIF utuh di cell yang semestinya
- Nilai numeric match expected dengan toleransi ±0.01

### Layer 3 — Golden file test

Pakai `1. PPH21 - Januari 2026.xlsx` dan `2. PPH21 - Febuari 2026.xlsx` sebagai reference output. Pipeline input SPM → output → diff dengan reference. Ini safety net paling kritis — memastikan app menghasilkan hasil yang **persis sama** dengan proses manual user selama ini.

### Layer 4 — Manual smoke test

Checklist di `docs/smoke-test.md` sebelum tiap release:
- Workspace baru, tambah pegawai
- Upload 1 gaji, verify VLOOKUP di Excel
- Batch 6 file Februari, compare dengan reference
- Restart app, verify persist

### CI (post-MVP)

GitHub Actions: `npm test` di setiap commit, build installer di setiap tag `v*`.

## Open Questions (untuk implementasi)

- Format exact `Ref TER` di template — butuh nilai real dari PMK 168/2023 untuk di-seed.
- Mapping lengkap PTKP Indonesia → kategori TER A/B/C — butuh verifikasi regulasi.
- `MyIntress` — struktur kolom persis belum jelas di spec awal; akan di-reverse-engineer dari file Januari/Februari saat implementasi.
- Format `Rekap Gaji` (pivot) — sama, butuh inspect file existing.

## Milestones (untuk implementation plan)

1. **Foundation** — Electron skeleton, IPC, SQLite init, workspace config
2. **Master pegawai** — schema, CRUD UI, import dari Excel lama
3. **Parser SPM** — 3 jenis file, kategorizer, unit tests
4. **Template & writer** — template.xlsx bundling, sheet writers dengan formula
5. **Tax engine** — TER lookup, PTKP mapper, Pajak sheet generator
6. **BPMP builder** — format Coretax untuk Gaji & Non Gaji
7. **UI: Periode screen** — upload, inline table, preview, proses
8. **Golden file test** — compare dengan reference Januari/Februari
9. **Polish** — error handling, logging, packaging
