import assert from 'node:assert/strict';
import { compareAct } from '../js/compare-act.js';

const code = 'ГЭСН04-01-080-01';
const contract = [
  { row: 528, printedRow: 527, code, name: 'Демонтаж установки горизонтально направленного бурения: с тяговым усилием 12 тс (120 кН)', unit: 'шт', price: 3202.39 },
  { row: 530, printedRow: 529, code, name: 'Демонтаж установки горизонтально направленного бурения: с тяговым усилием 20 тс (200 кН)', unit: 'шт', price: 4511.64 },
];
const act = [{ row: 34, code, name: `${contract[1].name} (Письмо ПАО «Газпром» от 15.02.2024 № 06/47-894)`, unit: 'шт', price: 4511.63 }];

const matched = compareAct(contract, act, 0.01);
assert.equal(matched.report[0].status, 'ОК');
assert.equal(matched.report[0].contractRow, 530);
assert.equal(matched.report[0].contractPrintedRow, 529);
assert.equal(matched.report[0].contractPrice, 4511.64);
assert.equal(matched.report[0].duplicates, 1);
assert.equal(matched.summary.ambiguous, 0);

const uncertain = compareAct(contract, [{ ...act[0], name: 'Иная работа', price: 4000 }], 0.01);
assert.equal(uncertain.report[0].status, 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ');
assert.equal(uncertain.summary.ambiguous, 1);

const withinOneKopeck = compareAct([
  { row: 1, code: 'ГЭСН01-02-061-02', name: 'Засыпка вручную', unit: '100 м3', price: 7546.91 },
  { row: 2, code: 'ГЭСН01-02-061-02', name: 'Засыпка траншей вручную', unit: '100 м3', price: 34304.15 },
], [{ row: 1, code: 'ГЭСН01-02-061-02', name: 'Засыпка вручную траншей', unit: '100 м3', price: 34304.16 }], 0.01);
assert.equal(withinOneKopeck.report[0].status, 'ОК');
assert.equal(withinOneKopeck.summary.ambiguous, 0);

console.log('Duplicate matching regression tests passed.');
