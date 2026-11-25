import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseContractPdf, extractRowsFromWideBands } from '../js/pdf-contract.js';

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

// The source document is local and must not be copied into the repository.
const fixture = process.env.KS2_WIDE_CONTRACT_PDF;
if (fixture) {
  const result = await parseContractPdf(new Uint8Array(fs.readFileSync(fixture)));
  assert.equal(result.meta.parserVersion, 6);
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
console.log('Wide contract geometry test passed.');
