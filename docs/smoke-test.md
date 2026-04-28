# Smoke Test — MVP Walking Skeleton

**Date:** 2026-04-16
**Build status:** ✅ `npm run build` succeeded (main 16kB, preload 0.79kB, renderer 232kB)
**Native modules:** ✅ `better-sqlite3` rebuilt for Electron 32.3.3 ABI
**Unit tests:** ✅ 17/17 passing (categorizer 9, pegawai-repo 4, spm-parser 2, output-writer 2)
**Typecheck:** ✅ clean (main + renderer + tests)

## How to run

```bash
cd "C:/Users/Axioo Pongo/repositories/pajak-app"
npm run dev
```

Expected: Electron window opens (1200×800) with sidebar on the left, Workspace screen showing.

If you see "Error: The module ... was compiled against a different Node.js version" — run this then retry `npm run dev`:

```bash
npx electron-rebuild -f -w better-sqlite3
```

## Manual flow checklist

- [ ] **Workspace screen**
  - Click "Pilih workspace" → pick `C:\Users\Axioo Pongo\repositories\pajak-app`
  - Periode list shows `1. Januari 2026` and `2. Febuari 2026` (detected from existing xlsx files)
- [ ] **Pegawai screen**
  - Click "Import dari file PPh21" → pick `1. PPH21 - Januari 2026.xlsx`
  - Table populates (~34 pegawai with NIP, NIK, Nama, PTKP, Gol, ASN)
- [ ] **Upload SPM screen**
  - Click "Pilih file..." → pick `1. Januari/1. SPM 0001A - PNS CPNS - Gaji_Bank_41262000_1_000270.xlsx`
  - Metadata shows: kategori=`gaji`, jumlah baris ≈ 26
  - Pilih periode → for safe testing, pick a **non-existent periode** (e.g., create `3. PPH21 - Maret 2026.xlsx` by letting the app write it) — **do NOT overwrite `1. PPH21 - Januari 2026.xlsx` or `2. PPH21 - Febuari 2026.xlsx`** (they're reference data for future golden-file tests)

  **Workaround for MVP:** Since periode list is built from existing files, and we don't want to overwrite those, the cleanest MVP test is:
  1. Make a temp copy of the workspace somewhere else and test there, OR
  2. Temporarily rename existing `1. PPH21 - Januari 2026.xlsx` → `1. PPH21 - Januari 2026.backup.xlsx` before running, then restore after
  - Enter **Keterangan** = "Smoke test MVP", **No SPM** = "TEST001"
  - Preview table shows rows with NIP/Nama/numeric columns formatted with thousand separators (Indonesian locale)
  - Click "Tulis ke Excel"
  - Success message appears with output path
  - Click "Buka folder" → Explorer opens to the output file

- [ ] **Verify in Excel**
  - Open the generated `.xlsx` in Microsoft Excel
  - Sheet `Ref Pegawai`: populated with pegawai master data
  - Sheet `Gaji Ledger`: rows present, **NIK/Nama/Status columns show real names** (VLOOKUP resolves — not `#N/A`)
  - Spot check 2-3 rows: `Nominal = gjpokok + tjberas`
  - `Keterangan` and `SPM` columns show the values you entered

## Known limitations (by design for MVP walking skeleton)

- Only Gaji kategori supported — Tunjangan/Uang Makan will error
- No Pajak sheet (TER calculation) yet
- No BPMP format sheets yet
- No Rekap Gaji pivot yet
- No Pegawai CRUD UI — only bulk import + read
- Only single-file upload (no batch/inline-table editor)
- Pegawai data that doesn't exist in master will cause `process:run` to throw with a list of missing NIPs

## Known issues / follow-ups

(Fill in after testing)

## Next plans

- Tunjangan + Uang Makan parsers
- Pajak sheet with TER calculation (PMK 168/2023)
- BPMP Coretax format sheets
- Rekap Gaji pivot
- Pegawai CRUD UI
- Batch upload with inline table editor
