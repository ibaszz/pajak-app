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
    if (result.kategori !== 'gaji') throw new Error('expected gaji kategori');

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
