import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseContractPdf, extractRowsFromWideBands } from '../js/pdf-contract.js';
import { parseActWorkbook } from '../js/xlsx-act.js';
import { compareAct } from '../js/compare-act.js';

const item = (str, x, y) => ({ str, transform: [8, 0, 0, 8, x, y], width: str.length * 3, height: 8 });
const sample = [
  item('204', 56, 90), item('Цена, согласованная ООО "Газпром', 71, 90),
  item('комплектация"', 71, 84), item('Труба полиэтиленовая', 210, 90),
  item('380,02', 638, 90), item('309,93', 676, 84),
  item('68,19', 719, 84), item('378,12', 757, 84),
];
assert.deepEqual(extractRowsFromWideBands(sample, [100, 70]), [{
  printedRow: 204, code: 'Цена, согласованная ООО "Газпром комплектация"',
  name: 'Труба полиэтиленовая', unit: '', price: 309.93,
}]);

const shiftedUnit = [
  item('386', 55, 110), item('ГЭСН24-02-001-05', 71, 110),
  item('Сварка полиэтиленовых труб', 208, 110),
  item('соединение', 550, 110), item('324,46', 628, 110),
  item('270,11', 668, 104), item('54,02', 715, 104),
  item('600', 55, 80), item('Цена по прайс-листу завода изготовителя', 71, 80),
  item('Контрольно-измерительный пункт', 208, 80),
  item('шт', 563, 80), item('0,00', 676, 75),
];
assert.deepEqual(extractRowsFromWideBands(shiftedUnit, [120, 95, 65]), [
  { printedRow: 386, code: 'ГЭСН24-02-001-05', name: 'Сварка полиэтиленовых труб', unit: 'соединение', price: 270.11 },
  { printedRow: 600, code: 'Цена по прайс-листу завода изготовителя', name: 'Контрольно-измерительный пункт', unit: 'шт', price: 0 },
]);

// The source document is local and must not be copied into the repository.
const fixture = process.env.KS2_WIDE_CONTRACT_PDF;
if (fixture) {
  const result = await parseContractPdf(new Uint8Array(fs.readFileSync(fixture)));
  assert.equal(result.meta.parserVersion, 8);
  assert.equal(result.rows.length, 782);
  assert.equal(new Set(result.rows.map(r => r.printedRow)).size, 779);
  assert.equal(result.rows[0].price, 1117.15);
  assert.equal(result.rows.at(-1).printedRow, 779);
  assert.equal(result.rows.at(-1).price, 35149.54);
  assert.equal(result.rows.filter(r => !r.unit).length, 9);
  assert.equal(result.rows.filter(r => r.price == null).length, 0);
  for (const number of [520, 521, 522]) {
    const repeated = result.rows.filter(r => r.printedRow === number);
    assert.equal(repeated.length, 2);
    assert.notEqual(repeated[0].code, repeated[1].code);
  }
  console.log('Wide contract: all 782 entries, 779 printed numbers, prices and repeated numbers passed.');
}
if (process.env.KS2_795_CONTRACT_PDF) {
  const contract = await parseContractPdf(new Uint8Array(fs.readFileSync(process.env.KS2_795_CONTRACT_PDF)));
  assert.equal(contract.meta.parserVersion, 8);
  assert.equal(contract.rows.length, 782);
  assert.deepEqual(contract.rows.filter(r => r.printedRow === 600).map(r => r.price), [0]);
  assert.equal(contract.rows.find(r => r.printedRow === 386).unit, 'соединение');
  assert.equal(contract.rows.find(r => r.printedRow === 322).unit, '100 м трубы, уложенной в футляр');
  assert.equal(contract.rows.find(r => r.printedRow === 406).unit, 'км кабеля');
  if (process.env.KS2_TIMOSHKINO_ACT_XLSX) {
  const act = parseActWorkbook(new Uint8Array(fs.readFileSync(process.env.KS2_TIMOSHKINO_ACT_XLSX)));
  const result = compareAct(contract.rows, act.rows, 0.01);
  assert.equal(act.rows.length, 32);
  assert.equal(result.summary.ok, 32);
  assert.equal(result.summary.totalErrors, 0);
  }
}
console.log('Wide contract geometry test passed.');
