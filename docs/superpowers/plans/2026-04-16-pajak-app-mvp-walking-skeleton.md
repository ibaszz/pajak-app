# Pajak App MVP — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the minimum viable end-to-end flow: user picks workspace → uploads 1 Gaji SPM file → app parses + writes a PPh21 output Excel with `Ref Pegawai` and `Gaji Ledger` sheets. Proves the pipeline; later plans add Tunjangan, Uang Makan, Pajak, BPMP, and UI polish.

**Architecture:** Electron main process handles disk I/O (SQLite, Excel read/write). React renderer is the UI. Main↔renderer communicate via type-safe IPC bridge. Pegawai master data in SQLite. Output Excel has VLOOKUP formulas in `Gaji Ledger` pointing to `Ref Pegawai` — regenerated fresh each write.

**Tech Stack:** Electron 28+, TypeScript 5, Vite, React 18, Tailwind CSS, better-sqlite3, exceljs, vitest, zod.

**Scope (MVP walking skeleton):**
- ✅ Workspace picker + persistence
- ✅ Pegawai seed from existing `1. PPH21 - Januari 2026.xlsx`
- ✅ Pegawai list (read-only)
- ✅ Upload 1 Gaji SPM file (picker)
- ✅ Filename-based categorization (Gaji only for MVP)
- ✅ Form: Keterangan + No SPM
- ✅ Parse Gaji SPM → preview rows → write to `{N}. PPH21 - {Bulan} {Tahun}.xlsx`
- ✅ Output has `Ref Pegawai` + `Gaji Ledger` sheets with VLOOKUP formulas

**Out of scope (separate plans):**
- Tunjangan / Uang Makan parsers
- Pajak sheet (TER calculation)
- BPMP sheets (Coretax format)
- Rekap Gaji pivot
- MyIntress sheet
- Pegawai CRUD UI
- Batch upload / inline table editor
- Packaging to installer

---

## File Structure

```
pajak-app/
├── package.json                        # Electron + deps
├── tsconfig.json                       # TS config for shared + renderer
├── tsconfig.main.json                  # TS config for main process (CJS)
├── electron.vite.config.ts             # Build config for main/preload/renderer
├── tailwind.config.js
├── postcss.config.js
├── .gitignore                          # node_modules, dist, pajak.db
├── index.html                          # Renderer entry
├── scripts/
│   ├── inspect-spm.mjs                 # One-off: dump column headers
│   └── inspect-ref-pegawai.mjs         # One-off: dump Ref Pegawai headers
├── src/
│   ├── main/
│   │   ├── index.ts                    # Electron main entry
│   │   ├── preload.ts                  # contextBridge exposed API
│   │   ├── db/
│   │   │   ├── connection.ts           # better-sqlite3 connection + migration
│   │   │   └── pegawai-repo.ts         # list/upsert pegawai
│   │   ├── workspace/
│   │   │   └── workspace-service.ts    # get/set workspace path, resolve periode filename
│   │   ├── excel/
│   │   │   ├── spm-parser.ts           # parseGajiSPM()
│   │   │   ├── categorizer.ts          # detectKategoriFromFilename()
│   │   │   ├── pegawai-importer.ts     # import from existing PPH21 xlsx
│   │   │   └── output-writer.ts        # writePajakOutput()
│   │   └── ipc/
│   │       └── handlers.ts             # registerIpcHandlers()
│   ├── renderer/
│   │   ├── main.tsx                    # React entry
│   │   ├── App.tsx                     # Sidebar + screen switcher
│   │   ├── index.css                   # Tailwind directives
│   │   ├── env.d.ts                    # window.api type
│   │   ├── screens/
│   │   │   ├── WorkspaceScreen.tsx
│   │   │   ├── PegawaiScreen.tsx
│   │   │   └── UploadScreen.tsx
│   │   └── lib/
│   │       └── api.ts                  # typed wrapper around window.api
│   └── shared/
│       ├── types.ts                    # Kategori, Pegawai, SPMRow, Periode
│       └── constants.ts                # BULAN_NAMES etc.
└── tests/
    ├── unit/
    │   ├── categorizer.test.ts
    │   ├── spm-parser.test.ts
    │   ├── pegawai-repo.test.ts
    │   └── output-writer.test.ts
    └── fixtures/
        └── gaji-sample.xlsx            # copy of 1. SPM 0001A
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.main.json`, `electron.vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `index.html`

**Step 1: Create package.json**

```json
{
  "name": "pajak-app",
  "version": "0.1.0",
  "description": "PPh21 tax processing desktop tool",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.main.json"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "exceljs": "^4.4.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.16.10",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "electron": "^32.1.2",
    "electron-vite": "^2.3.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

**Step 2: Create tsconfig.json** (renderer + shared)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/renderer/**/*", "src/shared/**/*", "tests/**/*"]
}
```

**Step 3: Create tsconfig.main.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

**Step 4: Create electron.vite.config.ts**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } }
    },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { preload: resolve(__dirname, 'src/main/preload.ts') } }
    },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } }
  },
  renderer: {
    root: resolve(__dirname),
    plugins: [react()],
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'index.html') } }
    }
  }
});
```

**Step 5: Create index.html**

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pajak App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: []
};
```

**Step 7: Create postcss.config.js**

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

**Step 8: Create .gitignore**

```
node_modules/
out/
dist/
*.log
pajak.db
pajak.db-*
.DS_Store
```

**Step 9: Install dependencies**

Run: `npm install`
Expected: deps install, possibly a native-build warning for `better-sqlite3` on Windows — resolved by `electron-vite` rebuild step at dev time.

**Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig*.json electron.vite.config.ts tailwind.config.js postcss.config.js .gitignore index.html
git commit -m "chore: scaffold electron-vite + react + tailwind project"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/shared/types.ts`, `src/shared/constants.ts`

**Step 1: Create src/shared/types.ts**

```ts
export type Kategori = 'gaji' | 'tunjangan' | 'uang_makan';

export type JenisASN = 'PNS' | 'PPPK';

export interface Pegawai {
  nip: string;
  nik: string;
  nama: string;
  statusPtkp: string;
  golongan: string | null;
  jenisAsn: JenisASN;
  aktif: boolean;
}

export interface Periode {
  nomorUrut: number;
  bulan: number;      // 1-12
  tahun: number;
  label: string;      // "Januari 2026"
}

export interface SPMGajiRow {
  nip: string;
  nama: string;
  gjpokok: number;
  tjberas: number;
  tjpph: number;
  potpfk10: number;
}

export interface ParsedSPM {
  filePath: string;
  fileName: string;
  kategori: Kategori;
  rowCount: number;
  rows: SPMGajiRow[];
}

export interface ProcessInput {
  parsedSPM: ParsedSPM;
  keterangan: string;
  noSPM: string;
  periode: Periode;
}

export interface ProcessResult {
  outputPath: string;
  rowsWritten: number;
}
```

**Step 2: Create src/shared/constants.ts**

```ts
export const BULAN_NAMES = [
  'Januari', 'Febuari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
] as const;

export function formatPeriodeFileName(nomorUrut: number, bulan: number, tahun: number): string {
  return `${nomorUrut}. PPH21 - ${BULAN_NAMES[bulan - 1]} ${tahun}.xlsx`;
}

export function formatPeriodeFolderName(nomorUrut: number, bulan: number): string {
  return `${nomorUrut}. ${BULAN_NAMES[bulan - 1]}`;
}
```

Note: `Febuari` (typo) matches user's existing filename convention.

**Step 3: Commit**

```bash
git add src/shared/
git commit -m "feat: shared types and periode filename helpers"
```

---

## Task 3: SQLite Connection & Pegawai Repo (TDD)

**Files:**
- Create: `src/main/db/connection.ts`, `src/main/db/pegawai-repo.ts`
- Test: `tests/unit/pegawai-repo.test.ts`

**Step 1: Write the failing test** — `tests/unit/pegawai-repo.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations } from '../../src/main/db/connection';
import { createPegawaiRepo } from '../../src/main/db/pegawai-repo';

describe('pegawai-repo', () => {
  let db: Database.Database;
  let repo: ReturnType<typeof createPegawaiRepo>;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
    repo = createPegawaiRepo(db);
  });

  it('lists empty when no rows', () => {
    expect(repo.list()).toEqual([]);
  });

  it('upserts and lists pegawai', () => {
    repo.upsert({
      nip: '199001012020121001',
      nik: '3201012345678901',
      nama: 'Budi Santoso',
      statusPtkp: 'K/2',
      golongan: 'IIIa',
      jenisAsn: 'PNS',
      aktif: true
    });
    const all = repo.list();
    expect(all).toHaveLength(1);
    expect(all[0].nama).toBe('Budi Santoso');
    expect(all[0].jenisAsn).toBe('PNS');
  });

  it('upsert updates existing row', () => {
    const base = {
      nip: '1', nik: '11', nama: 'A', statusPtkp: 'TK/0',
      golongan: null, jenisAsn: 'PPPK' as const, aktif: true
    };
    repo.upsert(base);
    repo.upsert({ ...base, nama: 'A-updated' });
    expect(repo.list()[0].nama).toBe('A-updated');
  });

  it('findByNip returns null when not found', () => {
    expect(repo.findByNip('nonexistent')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pegawai-repo.test.ts`
Expected: FAIL — module not found

**Step 3: Implement src/main/db/connection.ts**

```ts
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pegawai (
  nip           TEXT PRIMARY KEY,
  nik           TEXT NOT NULL,
  nama          TEXT NOT NULL,
  status_ptkp   TEXT NOT NULL,
  golongan      TEXT,
  jenis_asn     TEXT NOT NULL CHECK (jenis_asn IN ('PNS','PPPK')),
  aktif         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS process_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  periode      TEXT,
  file_name    TEXT,
  kategori     TEXT,
  no_spm       TEXT,
  keterangan   TEXT,
  rows_count   INTEGER,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function applyMigrations(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}

export function openDatabase(userDataDir: string): Database.Database {
  fs.mkdirSync(userDataDir, { recursive: true });
  const dbPath = path.join(userDataDir, 'pajak.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applyMigrations(db);
  return db;
}
```

**Step 4: Implement src/main/db/pegawai-repo.ts**

```ts
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
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/pegawai-repo.test.ts`
Expected: PASS — all 4 tests green.

**Step 6: Commit**

```bash
git add src/main/db/ tests/unit/pegawai-repo.test.ts
git commit -m "feat: sqlite connection, schema migrations, pegawai repo"
```

---

## Task 4: Filename Categorizer (TDD)

**Files:**
- Create: `src/main/excel/categorizer.ts`
- Test: `tests/unit/categorizer.test.ts`

**Step 1: Write the failing test** — `tests/unit/categorizer.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { detectKategoriFromFilename } from '../../src/main/excel/categorizer';

describe('detectKategoriFromFilename', () => {
  it('detects gaji from Gaji_Bank filename', () => {
    expect(detectKategoriFromFilename('Gaji_Bank_41262000_1_000270.xlsx')).toBe('gaji');
  });

  it('detects gaji from lampiranspm filename', () => {
    expect(detectKategoriFromFilename('lampiranspm.xls')).toBe('gaji');
    expect(detectKategoriFromFilename('lampiranspm (1).xlsx')).toBe('gaji');
  });

  it('detects tunjangan from Tukin filename', () => {
    expect(detectKategoriFromFilename('Hasil_Excel_Detail_Tukin_export_1770601453523.xlsx')).toBe('tunjangan');
  });

  it('detects tunjangan from Tunsus filename', () => {
    expect(detectKategoriFromFilename('2. SPM 0005A - Tunsus CKO Desember PNS CPNS - foo.xlsx')).toBe('tunjangan');
  });

  it('detects uang_makan from Uangmakan filename', () => {
    expect(detectKategoriFromFilename('Uangmakan_202601_000044_export.xlsx')).toBe('uang_makan');
  });

  it('detects uang_makan case-insensitive', () => {
    expect(detectKategoriFromFilename('uangmakan_20-02-2026.xlsx')).toBe('uang_makan');
  });

  it('detects uang_makan from UM prefix', () => {
    expect(detectKategoriFromFilename('UM PNS - SPM 00053A - foo.xlsx')).toBe('uang_makan');
    expect(detectKategoriFromFilename('UM PPPK - SPM 00054A - bar.xlsx')).toBe('uang_makan');
  });

  it('returns null when no match', () => {
    expect(detectKategoriFromFilename('random_file.xlsx')).toBeNull();
    expect(detectKategoriFromFilename('')).toBeNull();
  });

  it('strips directory path', () => {
    expect(detectKategoriFromFilename('C:/path/to/Gaji_Bank_foo.xlsx')).toBe('gaji');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/categorizer.test.ts`
Expected: FAIL — module not found

**Step 3: Implement src/main/excel/categorizer.ts**

```ts
import path from 'node:path';
import type { Kategori } from '@shared/types';

const PATTERNS: Array<{ kategori: Kategori; regex: RegExp }> = [
  { kategori: 'uang_makan', regex: /(uangmakan|^um\s)/i },
  { kategori: 'tunjangan', regex: /(tukin|tunsus)/i },
  { kategori: 'gaji', regex: /(gaji_bank|lampiranspm)/i }
];

export function detectKategoriFromFilename(filePath: string): Kategori | null {
  if (!filePath) return null;
  const base = path.basename(filePath);
  for (const { kategori, regex } of PATTERNS) {
    if (regex.test(base)) return kategori;
  }
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/categorizer.test.ts`
Expected: PASS — all 9 tests green.

**Step 5: Commit**

```bash
git add src/main/excel/categorizer.ts tests/unit/categorizer.test.ts
git commit -m "feat: filename-based kategori detector"
```

---

## Task 5: Gaji SPM Parser (TDD)

**Files:**
- Create: `src/main/excel/spm-parser.ts`, `tests/fixtures/gaji-sample.xlsx`, `scripts/inspect-spm.mjs`
- Test: `tests/unit/spm-parser.test.ts`

**Step 1: Create fixture — copy existing Gaji SPM as test data**

```bash
mkdir -p tests/fixtures scripts
cp "1. Januari/1. SPM 0001A - PNS CPNS - Gaji_Bank_41262000_1_000270.xlsx" "tests/fixtures/gaji-sample.xlsx"
```

**Step 2: Create inspector script** — `scripts/inspect-spm.mjs`

```js
import ExcelJS from 'exceljs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inspect-spm.mjs <path-to-xlsx>');
  process.exit(1);
}
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
for (const s of wb.worksheets) {
  console.log(`\n--- sheet: ${s.name} (rows: ${s.rowCount}) ---`);
  console.log('headers (row 1):');
  s.getRow(1).eachCell((c, n) => console.log(`  col ${n}:`, JSON.stringify(c.value)));
  console.log('sample row 2:');
  s.getRow(2).eachCell((c, n) => console.log(`  col ${n}:`, JSON.stringify(c.value)));
}
```

**Step 3: Inspect the fixture**

Run: `node scripts/inspect-spm.mjs tests/fixtures/gaji-sample.xlsx`
Expected: prints column headers like `NIP`, `NAMA`, `GJPOKOK`, `TJBERAS`, `TJPPH`, `POTPFK10` (and maybe others like `NO`, `GOL`, etc.).

**Note exact header names**; they drive the parser logic in Step 4.

**Step 4: Write the failing test** — `tests/unit/spm-parser.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parseGajiSPM } from '../../src/main/excel/spm-parser';

const FIXTURE = path.resolve(__dirname, '../fixtures/gaji-sample.xlsx');

describe('parseGajiSPM', () => {
  it('parses fixture and returns rows with numeric fields', async () => {
    const result = await parseGajiSPM(FIXTURE);

    expect(result.kategori).toBe('gaji');
    expect(result.fileName).toBe('gaji-sample.xlsx');
    expect(result.filePath).toBe(FIXTURE);
    expect(result.rowCount).toBeGreaterThan(0);
    expect(result.rows.length).toBe(result.rowCount);

    const first = result.rows[0];
    expect(typeof first.nip).toBe('string');
    expect(first.nip.length).toBeGreaterThan(0);
    expect(typeof first.nama).toBe('string');
    expect(typeof first.gjpokok).toBe('number');
    expect(typeof first.tjberas).toBe('number');
    expect(typeof first.tjpph).toBe('number');
    expect(typeof first.potpfk10).toBe('number');

    expect(first.gjpokok + first.tjberas).toBeGreaterThan(0);
  });

  it('throws on non-existent file', async () => {
    await expect(parseGajiSPM('/nonexistent/file.xlsx')).rejects.toThrow();
  });
});
```

**Step 5: Run test to verify it fails**

Run: `npx vitest run tests/unit/spm-parser.test.ts`
Expected: FAIL — module not found

**Step 6: Implement src/main/excel/spm-parser.ts**

```ts
import ExcelJS from 'exceljs';
import path from 'node:path';
import type { ParsedSPM, SPMGajiRow } from '@shared/types';

function normalizeHeader(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function numericValue(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'result' in v) {
    const result = (v as { result: unknown }).result;
    return typeof result === 'number' ? result : 0;
  }
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function stringValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v !== null && 'result' in v) {
    return String((v as { result: unknown }).result ?? '').trim();
  }
  return String(v).trim();
}

export async function parseGajiSPM(filePath: string): Promise<ParsedSPM> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error(`No sheet in ${filePath}`);

  const headerIdx: Record<string, number> = {};
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headerIdx[normalizeHeader(cell.value)] = colNumber;
  });

  const required = ['nip', 'nama', 'gjpokok', 'tjberas', 'tjpph', 'potpfk10'];
  const missing = required.filter((k) => !(k in headerIdx));
  if (missing.length > 0) {
    throw new Error(`Missing columns in ${filePath}: ${missing.join(', ')}. Got: ${Object.keys(headerIdx).join(', ')}`);
  }

  const rows: SPMGajiRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nip = stringValue(row.getCell(headerIdx.nip).value);
    if (!nip) continue;
    rows.push({
      nip,
      nama: stringValue(row.getCell(headerIdx.nama).value),
      gjpokok: numericValue(row.getCell(headerIdx.gjpokok).value),
      tjberas: numericValue(row.getCell(headerIdx.tjberas).value),
      tjpph: numericValue(row.getCell(headerIdx.tjpph).value),
      potpfk10: numericValue(row.getCell(headerIdx.potpfk10).value)
    });
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    kategori: 'gaji',
    rowCount: rows.length,
    rows
  };
}
```

**Step 7: Run test to verify it passes**

Run: `npx vitest run tests/unit/spm-parser.test.ts`
Expected: PASS — both tests green.

If header names in the fixture differ (e.g., `Gaji Pokok` instead of `gjpokok`), add aliases: adjust `normalizeHeader` output or extend the `required` lookup with a mapping table. The test is the source of truth — whatever makes it pass with the real fixture is correct.

**Step 8: Commit**

```bash
git add src/main/excel/spm-parser.ts tests/unit/spm-parser.test.ts tests/fixtures/gaji-sample.xlsx scripts/inspect-spm.mjs
git commit -m "feat: parseGajiSPM with header-index lookup + fixture test"
```

---

## Task 6: Pegawai Importer from Existing PPh21 Excel

**Files:**
- Create: `src/main/excel/pegawai-importer.ts`, `scripts/inspect-ref-pegawai.mjs`

**Step 1: Create inspector script** — `scripts/inspect-ref-pegawai.mjs`

```js
import ExcelJS from 'exceljs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inspect-ref-pegawai.mjs <path-to-pph21.xlsx>');
  process.exit(1);
}
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const s = wb.getWorksheet('Ref Pegawai');
if (!s) {
  console.log('No "Ref Pegawai" sheet. Available:', wb.worksheets.map(x => x.name));
  process.exit(1);
}
console.log(`sheet: ${s.name} (rows: ${s.rowCount})`);
console.log('headers:');
s.getRow(1).eachCell((c, n) => console.log(`  col ${n}:`, JSON.stringify(c.value)));
console.log('sample row 2:');
s.getRow(2).eachCell((c, n) => console.log(`  col ${n}:`, JSON.stringify(c.value)));
```

**Step 2: Inspect the existing PPh21 file**

Run: `node scripts/inspect-ref-pegawai.mjs "1. PPH21 - Januari 2026.xlsx"`
Expected: dumps column names. Note them — likely `NIP`, `NIK`, `Nama`, `Status`, `Golongan`, `PNS/PPPK` (or similar).

**Step 3: Implement src/main/excel/pegawai-importer.ts**

```ts
import ExcelJS from 'exceljs';
import type { Pegawai, JenisASN } from '@shared/types';

const SHEET_NAME = 'Ref Pegawai';

function normalizeHeader(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/[\s/]+/g, '_');
}

function parseJenisAsn(raw: string): JenisASN {
  const s = raw.trim().toUpperCase();
  if (s === 'PPPK' || s === 'P3K') return 'PPPK';
  return 'PNS';
}

export async function importPegawaiFromPajakFile(filePath: string): Promise<Pegawai[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in ${filePath}`);

  const idx: Record<string, number> = {};
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    idx[normalizeHeader(cell.value)] = col;
  });

  const aliases = {
    nip: ['nip'],
    nik: ['nik', 'npwp'],
    nama: ['nama', 'nama_pegawai'],
    statusPtkp: ['status', 'ptkp', 'status_ptkp'],
    golongan: ['golongan', 'gol'],
    jenisAsn: ['jenis_asn', 'asn', 'status_pegawai', 'jenis', 'pns_pppk']
  };

  function findCol(keys: string[]): number | null {
    for (const k of keys) if (idx[k]) return idx[k];
    return null;
  }

  const cNip = findCol(aliases.nip);
  const cNik = findCol(aliases.nik);
  const cNama = findCol(aliases.nama);
  const cStatus = findCol(aliases.statusPtkp);
  const cGol = findCol(aliases.golongan);
  const cJenis = findCol(aliases.jenisAsn);

  if (!cNip || !cNama || !cStatus) {
    throw new Error(
      `Ref Pegawai missing required columns. Found: ${Object.keys(idx).join(', ')}`
    );
  }

  const out: Pegawai[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nip = String(row.getCell(cNip).value ?? '').trim();
    if (!nip) continue;
    const nama = String(row.getCell(cNama).value ?? '').trim();
    const statusPtkp = String(row.getCell(cStatus).value ?? '').trim();
    const nik = cNik ? String(row.getCell(cNik).value ?? '').trim() : nip;
    const golongan = cGol ? String(row.getCell(cGol).value ?? '').trim() || null : null;
    const jenisRaw = cJenis ? String(row.getCell(cJenis).value ?? '').trim() : 'PNS';
    out.push({
      nip,
      nik: nik || nip,
      nama,
      statusPtkp: statusPtkp || 'TK/0',
      golongan,
      jenisAsn: parseJenisAsn(jenisRaw),
      aktif: true
    });
  }
  return out;
}
```

**Step 4: Smoke-test the importer**

Create a throwaway test script at `scripts/smoke-import.mjs`:

```js
import { importPegawaiFromPajakFile } from '../out/main/excel/pegawai-importer.js';

const file = process.argv[2];
const r = await importPegawaiFromPajakFile(file);
console.log('count:', r.length);
console.log('first 3:', JSON.stringify(r.slice(0, 3), null, 2));
```

Or, simpler: defer this to integration via the UI (Task 11). Skip scripts/smoke-import.mjs creation to avoid build-order issues.

**Step 5: Commit**

```bash
git add src/main/excel/pegawai-importer.ts scripts/inspect-ref-pegawai.mjs
git commit -m "feat: import pegawai from existing PPH21 Ref Pegawai sheet"
```

---

## Task 7: Workspace Service

**Files:**
- Create: `src/main/workspace/workspace-service.ts`

**Step 1: Implement src/main/workspace/workspace-service.ts**

```ts
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Periode } from '@shared/types';
import { BULAN_NAMES, formatPeriodeFileName } from '@shared/constants';

const KEY_WORKSPACE = 'workspace_path';

export function createWorkspaceService(db: Database.Database) {
  const getStmt = db.prepare<[string], { value: string }>(
    'SELECT value FROM settings WHERE key = ?'
  );
  const setStmt = db.prepare<[string, string]>(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  function getWorkspacePath(): string | null {
    const row = getStmt.get(KEY_WORKSPACE);
    return row?.value ?? null;
  }

  function setWorkspacePath(p: string): void {
    if (!fs.existsSync(p)) throw new Error(`Workspace path does not exist: ${p}`);
    if (!fs.statSync(p).isDirectory()) throw new Error(`Not a directory: ${p}`);
    setStmt.run(KEY_WORKSPACE, p);
  }

  function listPeriode(): Periode[] {
    const ws = getWorkspacePath();
    if (!ws || !fs.existsSync(ws)) return [];
    const entries = fs.readdirSync(ws);
    const out: Periode[] = [];
    const re = /^(\d+)\. PPH21 - (\w+) (\d{4})\.xlsx$/i;
    for (const name of entries) {
      const m = re.exec(name);
      if (!m) continue;
      const nomorUrut = parseInt(m[1], 10);
      const bulan = BULAN_NAMES.findIndex(b => b.toLowerCase() === m[2].toLowerCase()) + 1;
      if (bulan === 0) continue;
      const tahun = parseInt(m[3], 10);
      out.push({ nomorUrut, bulan, tahun, label: `${BULAN_NAMES[bulan - 1]} ${tahun}` });
    }
    out.sort((a, b) => a.nomorUrut - b.nomorUrut);
    return out;
  }

  function resolveOutputPath(p: Periode): string {
    const ws = getWorkspacePath();
    if (!ws) throw new Error('Workspace not set');
    return path.join(ws, formatPeriodeFileName(p.nomorUrut, p.bulan, p.tahun));
  }

  return { getWorkspacePath, setWorkspacePath, listPeriode, resolveOutputPath };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
```

**Step 2: Commit**

```bash
git add src/main/workspace/
git commit -m "feat: workspace service (path persist, periode discovery)"
```

---

## Task 8: Output Writer (TDD)

**Files:**
- Create: `src/main/excel/output-writer.ts`
- Test: `tests/unit/output-writer.test.ts`

Writes a new PPh21 Excel with `Ref Pegawai` + `Gaji Ledger` sheets. VLOOKUP formulas in `Gaji Ledger` point to `Ref Pegawai`.

**Step 1: Write the failing test** — `tests/unit/output-writer.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { writePajakOutput } from '../../src/main/excel/output-writer';
import type { Pegawai, SPMGajiRow, Periode } from '../../src/shared/types';

function tmpFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pajak-test-'));
  return path.join(dir, 'out.xlsx');
}

const PEGAWAI: Pegawai[] = [
  { nip: '1001', nik: '3201001', nama: 'Alice', statusPtkp: 'K/1', golongan: 'IIIa', jenisAsn: 'PNS', aktif: true },
  { nip: '1002', nik: '3201002', nama: 'Bob', statusPtkp: 'TK/0', golongan: 'IIb', jenisAsn: 'PPPK', aktif: true }
];

const ROWS: SPMGajiRow[] = [
  { nip: '1001', nama: 'Alice', gjpokok: 5_000_000, tjberas: 300_000, tjpph: 150_000, potpfk10: 50_000 },
  { nip: '1002', nama: 'Bob',   gjpokok: 3_500_000, tjberas: 200_000, tjpph:  80_000, potpfk10: 30_000 }
];

const PERIODE: Periode = { nomorUrut: 3, bulan: 3, tahun: 2026, label: 'Maret 2026' };

describe('writePajakOutput', () => {
  it('creates output xlsx with Ref Pegawai and Gaji Ledger sheets', async () => {
    const outPath = tmpFile();
    const result = await writePajakOutput({
      outputPath: outPath,
      pegawai: PEGAWAI,
      gajiRows: [{ rows: ROWS, keterangan: 'Gaji Maret', noSPM: '00001A' }],
      periode: PERIODE
    });

    expect(result.outputPath).toBe(outPath);
    expect(result.rowsWritten).toBe(2);
    expect(fs.existsSync(outPath)).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);

    const ref = wb.getWorksheet('Ref Pegawai');
    expect(ref).toBeDefined();
    expect(ref!.rowCount).toBeGreaterThanOrEqual(3);

    const ledger = wb.getWorksheet('Gaji Ledger');
    expect(ledger).toBeDefined();
    expect(ledger!.rowCount).toBeGreaterThanOrEqual(3);

    const headerRow = ledger!.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((c, i) => { headers[i] = String(c.value); });
    const nipCol = headers.findIndex(h => h.toLowerCase() === 'nip');
    const nominalCol = headers.findIndex(h => h.toLowerCase() === 'nominal');
    const ketCol = headers.findIndex(h => h.toLowerCase() === 'keterangan');
    const spmCol = headers.findIndex(h => h.toLowerCase() === 'spm');
    const namaCol = headers.findIndex(h => h.toLowerCase() === 'nama');
    expect(nipCol).toBeGreaterThan(0);
    expect(nominalCol).toBeGreaterThan(0);

    const row2 = ledger!.getRow(2);
    expect(String(row2.getCell(nipCol).value)).toBe('1001');
    expect(Number(row2.getCell(nominalCol).value)).toBe(5_300_000);
    expect(String(row2.getCell(ketCol).value)).toBe('Gaji Maret');
    expect(String(row2.getCell(spmCol).value)).toBe('00001A');

    const namaCell = row2.getCell(namaCol);
    expect(namaCell.formula).toMatch(/VLOOKUP.*Ref Pegawai/i);
  });

  it('overwrites existing output file', async () => {
    const outPath = tmpFile();
    fs.writeFileSync(outPath, 'old content');
    await writePajakOutput({
      outputPath: outPath,
      pegawai: PEGAWAI,
      gajiRows: [{ rows: ROWS, keterangan: 'X', noSPM: 'Y' }],
      periode: PERIODE
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outPath);
    expect(wb.getWorksheet('Ref Pegawai')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/output-writer.test.ts`
Expected: FAIL — module not found

**Step 3: Implement src/main/excel/output-writer.ts**

```ts
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import type { Pegawai, SPMGajiRow, Periode, ProcessResult } from '@shared/types';

interface GajiBatch {
  rows: SPMGajiRow[];
  keterangan: string;
  noSPM: string;
}

export interface WriteOptions {
  outputPath: string;
  pegawai: Pegawai[];
  gajiRows: GajiBatch[];
  periode: Periode;
}

const REF_SHEET = 'Ref Pegawai';
const GAJI_LEDGER = 'Gaji Ledger';

function buildRefPegawaiSheet(wb: ExcelJS.Workbook, pegawai: Pegawai[]): void {
  const ws = wb.addWorksheet(REF_SHEET);
  ws.columns = [
    { header: 'NIP', key: 'nip', width: 22 },
    { header: 'NIK', key: 'nik', width: 22 },
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Status', key: 'status', width: 8 },
    { header: 'Golongan', key: 'golongan', width: 10 },
    { header: 'Jenis ASN', key: 'jenisAsn', width: 10 }
  ];
  ws.getRow(1).font = { bold: true };
  for (const p of pegawai) {
    ws.addRow({
      nip: p.nip,
      nik: p.nik,
      nama: p.nama,
      status: p.statusPtkp,
      golongan: p.golongan ?? '',
      jenisAsn: p.jenisAsn
    });
  }
}

function buildGajiLedgerSheet(wb: ExcelJS.Workbook, batches: GajiBatch[], refCount: number): number {
  const ws = wb.addWorksheet(GAJI_LEDGER);
  ws.columns = [
    { header: 'NIP', key: 'nip', width: 22 },
    { header: 'NIK', key: 'nik', width: 22 },
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Status', key: 'status', width: 8 },
    { header: 'Nominal', key: 'nominal', width: 16 },
    { header: 'PPH', key: 'pph', width: 14 },
    { header: 'Tunjangan PPH', key: 'tunjPph', width: 16 },
    { header: 'potpfk10', key: 'potpfk10', width: 14 },
    { header: 'Keterangan', key: 'keterangan', width: 24 },
    { header: 'SPM', key: 'spm', width: 14 }
  ];
  ws.getRow(1).font = { bold: true };

  const refRange = `'${REF_SHEET}'!$A$2:$F$${refCount + 1}`;
  let written = 0;
  let excelRow = 2;
  for (const batch of batches) {
    for (const r of batch.rows) {
      ws.addRow({
        nip: r.nip,
        nominal: r.gjpokok + r.tjberas,
        pph: r.tjpph,
        tunjPph: r.tjpph,
        potpfk10: r.potpfk10,
        keterangan: batch.keterangan,
        spm: batch.noSPM
      });
      const row = ws.getRow(excelRow);
      row.getCell('nik').value = { formula: `VLOOKUP(A${excelRow},${refRange},2,FALSE)` };
      row.getCell('nama').value = { formula: `VLOOKUP(A${excelRow},${refRange},3,FALSE)` };
      row.getCell('status').value = { formula: `VLOOKUP(A${excelRow},${refRange},4,FALSE)` };
      excelRow++;
      written++;
    }
  }
  return written;
}

export async function writePajakOutput(opts: WriteOptions): Promise<ProcessResult> {
  const { outputPath, pegawai, gajiRows } = opts;
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pajak App';
  wb.created = new Date();

  buildRefPegawaiSheet(wb, pegawai);
  const rowsWritten = buildGajiLedgerSheet(wb, gajiRows, pegawai.length);

  const tmp = outputPath + '.tmp';
  await wb.xlsx.writeFile(tmp);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  fs.renameSync(tmp, outputPath);

  return { outputPath, rowsWritten };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/output-writer.test.ts`
Expected: PASS — both tests green.

**Step 5: Commit**

```bash
git add src/main/excel/output-writer.ts tests/unit/output-writer.test.ts
git commit -m "feat: write PPH21 output with Ref Pegawai + Gaji Ledger VLOOKUPs"
```

---

## Task 9: IPC Handlers

**Files:**
- Create: `src/main/ipc/handlers.ts`

**Step 1: Implement src/main/ipc/handlers.ts**

```ts
import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { createPegawaiRepo } from '../db/pegawai-repo';
import { createWorkspaceService } from '../workspace/workspace-service';
import { parseGajiSPM } from '../excel/spm-parser';
import { detectKategoriFromFilename } from '../excel/categorizer';
import { importPegawaiFromPajakFile } from '../excel/pegawai-importer';
import { writePajakOutput } from '../excel/output-writer';
import type { ProcessInput, ProcessResult, Pegawai, Periode } from '@shared/types';

export function registerIpcHandlers(db: Database.Database): void {
  const pegawaiRepo = createPegawaiRepo(db);
  const workspace = createWorkspaceService(db);

  ipcMain.handle('workspace:get', () => workspace.getWorkspacePath());

  ipcMain.handle('workspace:pick', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: 'Pilih folder workspace',
      properties: ['openDirectory']
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    workspace.setWorkspacePath(r.filePaths[0]);
    return r.filePaths[0];
  });

  ipcMain.handle('workspace:listPeriode', (): Periode[] => workspace.listPeriode());

  ipcMain.handle('pegawai:list', (): Pegawai[] => pegawaiRepo.list());

  ipcMain.handle('pegawai:pickAndImport', async (): Promise<number | null> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: 'Pilih file PPh21 periode sebelumnya',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile']
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    const pegawai = await importPegawaiFromPajakFile(r.filePaths[0]);
    for (const p of pegawai) pegawaiRepo.upsert(p);
    return pegawai.length;
  });

  ipcMain.handle('spm:pickAndParse', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title: 'Pilih file SPM',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    const filePath = r.filePaths[0];
    const kategori = detectKategoriFromFilename(filePath);
    if (kategori !== 'gaji') {
      throw new Error(`MVP hanya support kategori Gaji. Terdeteksi: ${kategori ?? 'tidak dikenal'}`);
    }
    return await parseGajiSPM(filePath);
  });

  ipcMain.handle('process:run', async (_e, input: ProcessInput): Promise<ProcessResult> => {
    const outputPath = workspace.resolveOutputPath(input.periode);
    const pegawai = pegawaiRepo.list();
    if (pegawai.length === 0) {
      throw new Error('Pegawai kosong. Import dulu dari file PPh21 periode sebelumnya.');
    }
    const knownNips = new Set(pegawai.map(p => p.nip));
    const missing = input.parsedSPM.rows.map(r => r.nip).filter(nip => !knownNips.has(nip));
    if (missing.length > 0) {
      const preview = missing.slice(0, 3).join(', ');
      throw new Error(`${missing.length} NIP belum ada di master Pegawai: ${preview}${missing.length > 3 ? '...' : ''}`);
    }
    return await writePajakOutput({
      outputPath,
      pegawai,
      gajiRows: [{
        rows: input.parsedSPM.rows,
        keterangan: input.keterangan,
        noSPM: input.noSPM
      }],
      periode: input.periode
    });
  });

  ipcMain.handle('shell:revealInFolder', (_e, filePath: string) => {
    if (fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  });
}
```

**Step 2: Commit**

```bash
git add src/main/ipc/
git commit -m "feat: ipc handlers for workspace, pegawai, spm, process"
```

---

## Task 10: Main Process Entry + Preload

**Files:**
- Create: `src/main/index.ts`, `src/main/preload.ts`, `src/renderer/env.d.ts`

**Step 1: Create src/main/preload.ts**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { ParsedSPM, Periode, Pegawai, ProcessInput, ProcessResult } from '@shared/types';

const api = {
  workspace: {
    get: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
    pick: (): Promise<string | null> => ipcRenderer.invoke('workspace:pick'),
    listPeriode: (): Promise<Periode[]> => ipcRenderer.invoke('workspace:listPeriode')
  },
  pegawai: {
    list: (): Promise<Pegawai[]> => ipcRenderer.invoke('pegawai:list'),
    pickAndImport: (): Promise<number | null> => ipcRenderer.invoke('pegawai:pickAndImport')
  },
  spm: {
    pickAndParse: (): Promise<ParsedSPM | null> => ipcRenderer.invoke('spm:pickAndParse')
  },
  process: {
    run: (input: ProcessInput): Promise<ProcessResult> => ipcRenderer.invoke('process:run', input)
  },
  shell: {
    revealInFolder: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:revealInFolder', filePath)
  }
};

contextBridge.exposeInMainWorld('api', api);

export type PajakAPI = typeof api;
```

**Step 2: Create src/main/index.ts**

```ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { openDatabase } from './db/connection';
import { registerIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  const db = openDatabase(app.getPath('userData'));
  registerIpcHandlers(db);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

**Step 3: Create src/renderer/env.d.ts**

```ts
/// <reference types="vite/client" />
import type { PajakAPI } from '../main/preload';

declare global {
  interface Window {
    api: PajakAPI;
  }
}

export {};
```

**Step 4: Commit**

```bash
git add src/main/index.ts src/main/preload.ts src/renderer/env.d.ts
git commit -m "feat: electron main entry, preload bridge, renderer types"
```

---

## Task 11: Renderer UI — All Screens

**Files:**
- Create: `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/index.css`, `src/renderer/lib/api.ts`, `src/renderer/screens/WorkspaceScreen.tsx`, `src/renderer/screens/PegawaiScreen.tsx`, `src/renderer/screens/UploadScreen.tsx`

**Step 1: Create src/renderer/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  @apply bg-slate-50 text-slate-900;
}
```

**Step 2: Create src/renderer/lib/api.ts**

```ts
export const api = window.api;
```

**Step 3: Create src/renderer/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 4: Create src/renderer/App.tsx**

```tsx
import { useEffect, useState } from 'react';
import WorkspaceScreen from './screens/WorkspaceScreen';
import PegawaiScreen from './screens/PegawaiScreen';
import UploadScreen from './screens/UploadScreen';
import { api } from './lib/api';

type Screen = 'workspace' | 'pegawai' | 'upload';

export default function App() {
  const [screen, setScreen] = useState<Screen>('workspace');
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  useEffect(() => {
    api.workspace.get().then(setWorkspacePath);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="w-56 bg-slate-900 text-slate-200 p-4 flex flex-col gap-2">
        <h1 className="text-lg font-bold mb-4">Pajak App</h1>
        <NavBtn active={screen === 'workspace'} onClick={() => setScreen('workspace')}>Workspace</NavBtn>
        <NavBtn active={screen === 'pegawai'} onClick={() => setScreen('pegawai')}>Pegawai</NavBtn>
        <NavBtn active={screen === 'upload'} onClick={() => setScreen('upload')}>Upload SPM</NavBtn>
        <div className="mt-auto text-xs text-slate-500 break-words">
          {workspacePath ?? 'No workspace'}
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        {screen === 'workspace' && <WorkspaceScreen onChange={setWorkspacePath} />}
        {screen === 'pegawai' && <PegawaiScreen />}
        {screen === 'upload' && <UploadScreen workspacePath={workspacePath} />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2 rounded text-sm ${active ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
    >
      {children}
    </button>
  );
}
```

**Step 5: Create src/renderer/screens/WorkspaceScreen.tsx**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Periode } from '@shared/types';

export default function WorkspaceScreen({ onChange }: { onChange: (p: string | null) => void }) {
  const [path, setPath] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode[]>([]);

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

      <h3 className="text-lg font-medium mb-2">Periode yang terdeteksi ({periode.length})</h3>
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
    </div>
  );
}
```

**Step 6: Create src/renderer/screens/PegawaiScreen.tsx**

```tsx
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
```

**Step 7: Create src/renderer/screens/UploadScreen.tsx**

```tsx
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
```

**Step 8: Run dev server to smoke-test**

Run: `npm run dev`
Expected: Electron window opens with sidebar + Workspace screen. No console errors.

**Step 9: Commit**

```bash
git add src/renderer/
git commit -m "feat: renderer UI (workspace, pegawai, upload screens)"
```

---

## Task 12: End-to-End Smoke Test (Manual)

**Step 1: Start the app**

Run: `npm run dev`

**Step 2: Walk through the flow**

- [ ] Click "Workspace" → "Pilih workspace" → pick `C:\Users\Axioo Pongo\repositories\pajak-app`
- [ ] See periode list show `1. Januari 2026` and `2. Febuari 2026`
- [ ] Click "Pegawai" → "Import dari file PPh21" → pick `1. PPH21 - Januari 2026.xlsx`
- [ ] Verify list populates with real pegawai (NIP, NIK, Nama, PTKP, Gol, ASN)
- [ ] Click "Upload SPM" → "Pilih file..." → pick `1. Januari/1. SPM 0001A - PNS CPNS - Gaji_Bank_...xlsx`
- [ ] See file metadata (kategori=gaji, rowCount > 0)
- [ ] Select a periode (pick one that doesn't overwrite existing — e.g. create a dummy `3. PPH21 - Maret 2026.xlsx` by letting app generate it)
- [ ] Enter Keterangan = "Test MVP", No SPM = "TEST001"
- [ ] Verify preview table shows NIP/Nama/numeric columns correctly
- [ ] Click "Tulis ke Excel"
- [ ] See success message with output path
- [ ] Click "Buka folder" → verify file exists at expected path

**⚠ Do NOT overwrite existing `1. PPH21 - Januari 2026.xlsx` or `2. PPH21 - Febuari 2026.xlsx`** — those are reference data for later golden-file tests. Test with a new periode (e.g., pick Maret/April that doesn't exist yet, or rename existing files temporarily).

**Step 3: Verify output file in Excel**

- [ ] Open output `.xlsx` in Excel
- [ ] Sheet `Ref Pegawai` populated with pegawai list
- [ ] Sheet `Gaji Ledger` has rows, VLOOKUP for NIK/Nama/Status shows actual names (not `#N/A`)
- [ ] Nominal column = gjpokok + tjberas (spot check 2-3 rows)
- [ ] Keterangan + SPM columns show the input values

**Step 4: Document smoke test result**

Create `docs/smoke-test.md`:

```md
# Smoke Test Results — MVP Walking Skeleton

Date: YYYY-MM-DD

## Flow tested
- [x] Workspace picker
- [x] Pegawai import from existing file
- [x] SPM upload & parse (Gaji)
- [x] Write output with Ref Pegawai + Gaji Ledger
- [x] VLOOKUP formulas resolve correctly in Excel

## Known issues / follow-ups
- (list any issues found)
```

**Step 5: Commit**

```bash
git add docs/smoke-test.md
git commit -m "docs: mvp walking skeleton smoke test results"
```

---

## Self-Review

**Spec coverage check (against `docs/superpowers/specs/2026-04-16-pajak-app-design.md`):**
- ✅ Electron + React + TypeScript stack (Task 1)
- ✅ SQLite for pegawai (Task 3)
- ✅ Workspace-based periode discovery (Task 7)
- ✅ Filename categorizer (Task 4)
- ✅ Gaji SPM parser (Task 5)
- ✅ Pegawai import from existing Excel (Task 6)
- ✅ Output writer with VLOOKUP (Task 8)
- ✅ IPC bridge (Tasks 9–10)
- ✅ UI screens — scaled down versions (Task 11)
- ✅ End-to-end smoke test (Task 12)

**Gaps vs full spec (intentional — deferred to next plans):**
- ❌ Tunjangan / Uang Makan parsers
- ❌ Pajak sheet with TER calculation
- ❌ BPMP sheet generation
- ❌ Rekap Gaji / MyIntress
- ❌ Pegawai CRUD UI (only read + bulk import)
- ❌ Inline table editor (only single-file upload)
- ❌ Packaging to installer
- ❌ Golden-file tests against existing Jan/Feb files
- ❌ Ref TER sheet bundled in template (no TER calc in MVP)

**Type consistency:** `Pegawai`, `ParsedSPM`, `SPMGajiRow`, `Periode` used consistently across all layers. Method names on repo: `list()`, `upsert()`, `findByNip()`. API namespaces in preload+renderer: `api.workspace.*`, `api.pegawai.*`, `api.spm.*`, `api.process.*`, `api.shell.*`.

**Placeholder scan:** No TBD/TODO/FIXME. Every task has concrete file paths, code, commands.

**Known assumptions to verify during implementation:**
- Task 5: exact column header names in Gaji SPM fixture — inspector script (Step 3) resolves this.
- Task 6: `Ref Pegawai` sheet column names in user's templates — inspector script (Step 2) + alias fallback.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-pajak-app-mvp-walking-skeleton.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
