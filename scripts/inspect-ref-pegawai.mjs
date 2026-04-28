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
console.log('sample row 3:');
s.getRow(3).eachCell((c, n) => console.log(`  col ${n}:`, JSON.stringify(c.value)));
