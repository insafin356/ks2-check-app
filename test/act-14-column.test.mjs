import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from '../vendor/xlsx.mjs';
import { parseActWorkbook } from '../js/xlsx-act.js';
import { cleanVisibleText, extractCodeFromCell, tryParseNumber } from '../js/norm.js';

const rows = Array.from({ length: 42 }, () => []);
rows[31][0] = '№ пп';
rows[31][1] = 'Обосно-\nвание';
rows[31][2] = 'Наименование';
rows[31][3] = 'Ед. изм.';
rows[31][6] = 'Сметная стоимость в текущих ценах, руб.';
rows[32][6] = 'на ед.';
rows[32][7] = 'общая';
for (let c = 0; c < 14; c++) rows[34][c] = c + 1;
rows[35][0] = 'Раздел 1. Работы';
rows[37] = [1, 'ГЭСН24-02-062-02', 'Монтаж газового ввода', 'шт', '', 2, '3 057,60', '6 115,20'];
rows[38] = [2, 'КП-01', 'Цокольный ввод', 'шт', '', 2, '13 896,12', '27 792,24'];
rows[40][0] = 'Итого по акту';
const book = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet(rows);
sheet['!merges'] = [{ s: { r: 31, c: 6 }, e: { r: 31, c: 11 } }];
XLSX.utils.book_append_sheet(book, sheet, 'КС2 14 граф');
const result = parseActWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }));
assert.equal(result.meta.sheet, 'КС2 14 граф');
assert.deepEqual(result.meta.cols, { code: 2, name: 3, unit: 4, price: 7, position: 1 });
assert.deepEqual(result.rows.map(row => [row.position, row.srcRow, row.code, row.name, row.unit, row.price]), [
  [1, 38, 'ГЭСН24-02-062-02', 'Монтаж газового ввода', 'шт', 3057.6],
  [2, 39, 'КП-01', 'Цокольный ввод', 'шт', 13896.12],
]);

if (process.env.KS2_NOVAYA_TURA_ACT) {
  const data = fs.readFileSync(process.env.KS2_NOVAYA_TURA_ACT);
  const parsed = parseActWorkbook(data);
  const source = XLSX.read(data, { type: 'buffer' }).Sheets['КС2 14 граф'];
  assert.equal(parsed.rows.length, 22);
  assert.deepEqual(parsed.meta.cols, { code: 2, name: 3, unit: 4, price: 7, position: 1 });
  for (const row of parsed.rows) {
    assert.equal(row.position, row.row);
    assert.equal(row.position, Number(source[`A${row.srcRow}`]?.v));
    assert.equal(row.code, extractCodeFromCell(source[`B${row.srcRow}`]?.v));
    assert.equal(row.name, cleanVisibleText(source[`C${row.srcRow}`]?.v));
    assert.equal(row.unit, cleanVisibleText(source[`D${row.srcRow}`]?.v));
    assert.equal(row.price, tryParseNumber(source[`G${row.srcRow}`]?.v).value);
  }
}
console.log('14-column KS-2 import passed');
