const XLSX = require('xlsx');
const wb = XLSX.readFile('Products.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

console.log('Gender values:', [...new Set(data.map(r => r.Gender))]);
console.log('In stock values:', [...new Set(data.map(r => r['In stock?']))]);

console.log('\n--- ALL PERFUMES WITH DESCRIPTIONS ---');
data.forEach(r => {
  console.log('[' + r.Gender + '] ' + r.Name + ': ' + r['Short description']);
  console.log('---');
});
