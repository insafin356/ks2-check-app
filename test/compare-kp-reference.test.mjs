import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compareAct } from '../js/compare-act.js';

const contract = [
  { row: 775, printedRow: 773, code: 'КП-59', name: 'ГРПШ (газорегуляторный пункт шкафной) на базе 2-х регуляторов РДГ-50, 400М, с основной и резевной линиями редуцирования (Рвх=0,28-0,3 МПА, Рвых=0,03МПА, Q=280 м3/ч) (ГРПШ согласно опросного листа №2)', unit: 'шт', price: 1044750 },
  { row: 776, printedRow: 774, code: 'КП-60', name: 'ГРПШ (газорегуляторный пункт шкафной) на базе 2-х регуляторов РДГ-50, 400М, с основной и резевной линиями редуцирования (Рвх=0,4-1,2 МПА, Рвых=0,3 МПА, Q=800м3/ч) (ГРПШ согласно опросного листа №1)', unit: 'шт', price: 1044750 },
  { row: 777, printedRow: 775, code: 'КП-61', name: 'ГРПШ (газорегуляторный пункт шкафной) на базе 2-х регуляторов РДГ-80, с основной и резервной линиями редуцирования (Рвх=0,28-0,3 МПА, Рвых=0,003 МПА, Q=1000 м3/ч) (ГРПШ согласно опросного листа №4)', unit: 'шт', price: 1368125 },
];
const act = { row: 71, code: 'КП-27', name: 'ГРПШ (газорегуляторный пункт шкафной) на базе 2-х регуляторов РДГ-50, 400 М, с основной и резервной линиями редуцирования (Рвх=0,28-0,3 МПА, рвых=0,03 МПА, Q=280 м 3/ч)', unit: 'шт', price: 1044750 };
const matched = compareAct(contract, [act], 0.01);
assert.equal(matched.summary.totalErrors, 0);
assert.equal(matched.report[0].status, 'ОК');
assert.equal(matched.report[0].contractPrintedRow, 773);
assert.equal(matched.report[0].contractPrice, 1044750);

const expensive = compareAct(contract, [{ ...act, price: 1044750.02 }], 0.01);
assert.equal(expensive.report[0].status, 'ЦЕНА ВЫШЕ ДОГОВОРНОЙ');
const otherModel = compareAct(contract, [{ ...act, name: act.name.replace('Q=280', 'Q=999') }], 0.01);
assert.equal(otherModel.report[0].status, 'ПОЗИЦИЯ КП НЕ НАЙДЕНА');

if (process.env.KS2_112_CONTRACT_PDF && process.env.KS2_KUKMOR_ACT_XLSX) {
  const { parseContractPdf } = await import('../js/pdf-contract.js');
  const { parseActWorkbook } = await import('../js/xlsx-act.js');
  const parsedContract = await parseContractPdf(new Uint8Array(fs.readFileSync(process.env.KS2_112_CONTRACT_PDF)));
  const parsedAct = parseActWorkbook(new Uint8Array(fs.readFileSync(process.env.KS2_KUKMOR_ACT_XLSX)));
  const checked = compareAct(parsedContract.rows, parsedAct.rows, 0.01);
  assert.equal(parsedContract.rows.length, 1011);
  assert.equal(parsedAct.rows.length, 106);
  assert.equal(checked.summary.ok, 106);
  assert.equal(checked.summary.totalErrors, 0);
  const target = checked.report.find(row => row.actRow === 71);
  assert.equal(target.status, 'ОК');
  assert.equal(target.contractPrintedRow, 773);
  assert.equal(target.contractPrice, 1044750);
}
console.log('Commercial proposal reference matching passed');
