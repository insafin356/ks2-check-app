import fs from 'fs';
import * as XLSX from '../vendor/xlsx.mjs';
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const wb = XLSX.read(new Uint8Array(fs.readFileSync(dir + '\\18. КС-2.xlsx')), { type: 'array', cellDates: false });
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rng = XLSX.utils.decode_range(ws['!ref']);
  console.log('### sheet', name, 'rows', rng.e.r + 1, 'cols', rng.e.c + 1);
  for (let r = 16; r <= 27; r++) {
    const cells = [];
    for (let c = 0; c <= Math.min(rng.e.c, 15); c++) {
      const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
      if (v != null) cells.push(`c${c + 1}=${String(v).slice(0, 40).replace(/\n/g, ' ')}`);
    }
    console.log(`row${r + 1}:`, cells.join(' | ') || '(пусто)');
  }
}
