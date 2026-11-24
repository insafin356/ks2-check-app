import assert from 'node:assert/strict';
import { compareAct } from '../js/compare-act.js';

const contract = [{ row: 1, code: 'ГЭСН09-03-043-01', name: 'Монтаж металлоконструкций', unit: 'т металлоконс трукций', price: 86313.66 }];
const act = [{ row: 1, code: 'ГЭСН09-03-043-01', name: 'Монтаж металлоконструкций', unit: 'т металлоконструкций', price: 86313.66 }];
const matched = compareAct(contract, act, 0.01);
assert.equal(matched.report[0].status, 'ОК');
assert.equal(matched.report[0].contractRow, 1);
assert.equal(matched.report[0].contractPrice, 86313.66);

const different = compareAct(
  [{ ...contract[0], unit: '100 шт' }],
  [{ ...act[0], unit: '10 шт' }],
  0.01,
);
assert.equal(different.report[0].status, 'НЕ СОВПАДАЕТ ЕД. ИЗМ.');
assert.equal(different.summary.unitMismatch, 1);

const noContractUnit = compareAct(
  [{ row: 204, printedRow: 204, code: 'Цена, согласованная ООО "Газпром комплектация"', name: 'Труба ПЭ 63х5,8', unit: '', price: 309.93 }],
  [{ row: 1, code: 'Цена, согласованная ООО "Газпром комплектация"', name: 'Труба ПЭ 63х5,8', unit: 'м', price: 309.93 }],
  0.01,
);
assert.equal(noContractUnit.report[0].status, 'ОК');
assert.equal(noContractUnit.report[0].contractPrintedRow, 204);
assert.match(noContractUnit.report[0].note, /единица измерения не указана/);

const differentName = compareAct(
  [{ row: 204, code: 'Цена, согласованная ООО "Газпром комплектация"', name: 'Труба ПЭ 63х5,8', unit: '', price: 309.93 }],
  [{ row: 1, code: 'Цена, согласованная ООО "Газпром комплектация"', name: 'Труба ПЭ 110х10', unit: 'м', price: 309.93 }],
  0.01,
);
assert.equal(differentName.report[0].status, 'ШИФР НЕ НАЙДЕН');

console.log('Unit comparison tests passed.');
