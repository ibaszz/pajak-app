import ExcelJS from 'exceljs';

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
