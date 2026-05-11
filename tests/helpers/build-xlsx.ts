import ExcelJS from 'exceljs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function writeXlsxFixture(
  headers: string[],
  rows: Array<Array<string | number | null>>,
  fileName = 'fixture.xlsx'
): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pajak-fixture-'));
  const filePath = path.join(dir, fileName);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  await wb.xlsx.writeFile(filePath);
  return filePath;
}
