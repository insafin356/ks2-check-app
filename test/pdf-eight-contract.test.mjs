import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from '../vendor/xlsx.mjs';
import { offerPriceColumn, extractRowsFromBands, parseContractPdf } from '../js/pdf-contract.js';
import { parseActWorkbook } from '../js/xlsx-act.js';
import { compareAct } from '../js/compare-act.js';
import { compactMatchText, normalizeUnit } from '../js/norm.js';

const item = (str, x, y) => ({ str, transform: [8, 0, 0, 8, x, y], width: str.length * 3, height: 8 });
const header = [item('5', 472, 120), item('6', 615, 120), item('7', 678, 120), item('8', 741, 120)];
const column = offerPriceColumn(header);
assert.deepEqual(column, { left: 543.5, right: 646.5, column: 6 });
assert.equal(offerPriceColumn([...header, item('9', 800, 120)]).column, 7);

const rows = extractRowsFromBands([
  item('38', 55, 90), item('ГЭСН01-01-033-04', 69, 89),
  item('Грунт с перемещением', 180, 90), item('до 5 м', 180, 81),
  item('1000 м3', 398, 81), item('6566,532', 534, 81),
  item('5450,22', 624, 90), item('1090,04', 685, 90), item('6540,27', 750, 90),
  item('39', 55, 58), item('КП', 69, 58), item('прим.', 69, 49),
  item('Цокольный ввод', 180, 58), item('ПЭ 100', 180, 49), item('шт', 405, 54),
  item('13318,44', 624, 58), item('2663,69', 685, 58), item('15982,13', 750, 58),
], [100, 70, 40], column);
assert.deepEqual(rows, [
  { printedRow: 38, code: 'ГЭСН01-01-033-04', name: 'Грунт с перемещением до 5 м', unit: '1000 м3', price: 5450.22 },
  { printedRow: 39, code: 'КП', name: 'Цокольный ввод ПЭ 100', unit: 'шт', price: 13318.44 },
]);

// Optional local files verify every position against the existing check book.
// Source documents are never copied into the repository.
if (process.argv[2] && process.argv[3]) {
  const contract = await parseContractPdf(new Uint8Array(fs.readFileSync(process.argv[2])));
  const wb = XLSX.read(new Uint8Array(fs.readFileSync(process.argv[3])), { type: 'array' });
  const ws = wb.Sheets['Договор'];
  const expected = [];
  for (let row = 2; row <= 841; row++) {
    const code = ws[`A${row}`]?.v, price = ws[`D${row}`]?.v;
    if (code && typeof price === 'number') expected.push({
      code: String(code).trim(), name: String(ws[`B${row}`]?.v ?? ''),
      unit: String(ws[`C${row}`]?.v ?? ''), price,
    });
  }
  assert.equal(contract.meta.parserVersion, 6);
  assert.equal(contract.rows.length, 838);
  assert.equal(expected.length, 838);
  contract.rows.forEach((actual, index) => {
    const source = expected[index];
    assert.equal(actual.printedRow, index + 1, `position ${index + 1} number`);
    assert.equal(actual.code, source.code, `position ${index + 1} code`);
    assert.equal(compactMatchText(actual.name), compactMatchText(source.name), `position ${index + 1} name`);
    assert.equal(normalizeUnit(actual.unit), normalizeUnit(source.unit), `position ${index + 1} unit`);
    assert.equal(actual.price, source.price, `position ${index + 1} price`);
  });
  if (process.argv[4]) {
    const act = parseActWorkbook(new Uint8Array(fs.readFileSync(process.argv[4])));
    const result = compareAct(contract.rows, act.rows, 0.01);
    assert.equal(act.rows.length, 24);
    assert.equal(result.summary.ok, 24);
    assert.equal(result.summary.totalErrors, 0);
  }
  console.log('Eight-column contract: 838 positions and 24 act rows verified.');
}
console.log('Eight-column contract geometry test passed.');
