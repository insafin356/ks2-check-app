import assert from 'node:assert/strict';
import { compareAct } from '../js/compare-act.js';

const contract = [
  { row: 561, printedRow: 560, code: '01.4.03.01-0000-0009', name: 'Бентонит Bentolux Horizont UN+', unit: 'т', price: 48540.08 },
  { row: 562, printedRow: 561, code: '01.7.14.07-0000-0012', name: 'Биополимер XanFlex', unit: 'кг', price: 490.71 },
  { row: 778, printedRow: 775, code: 'КП-61', name: 'ГРПШ (газорегуляторный пункт шкафной) на базе 2-х регуляторов РДГ-80, с основной и резервной линиями редуцирования (Рвх= 0,28- 0,3 Мпа, Рвых= 0,003 Мпа, Q= 1000 м3/ч) (ГРПШ согласно опросного листа №4)', unit: 'шт', price: 1368125 },
  { row: 779, printedRow: 776, code: 'КП-62', name: 'ГРПШ (газорегуляторный пункт шкафной) на базе 2-х регуляторов РДГ-80, с основной и резервной линиями редуцирования (Рвх= 0,4-1,2 Мпа, Рвых= 0,3 Мпа, Q= 2000 м3/ч) (ГРПШ согласно опросного листа №3)', unit: 'шт', price: 1368125 },
];
const act = [
  { row: 37, code: '01.4.03.01-0000-0005', name: 'Гранулы бентонитовые (Письмо ПАО «Газпром»)', unit: 'кг', price: 32.77 },
  { row: 38, code: '01.4.03.03-0021', name: 'Полимер для стабилизации буровых скважин (Письмо ПАО «Газпром»)', unit: 'т', price: 332331.51 },
  { row: 142, code: 'КП-62', name: contract[2].name.replace('ГРПШ согласно', 'ГПШ согласно') + ' (Письмо ПАО «Газпром»)', unit: 'шт', price: 1368125 },
  { row: 143, code: 'КП-63', name: contract[3].name + ' (Письмо ПАО «Газпром»)', unit: 'шт', price: 1368125 },
];
const matched = compareAct(contract, act, 0.01);
assert.equal(matched.summary.ok, 4);
assert.equal(matched.summary.totalErrors, 0);
assert.deepEqual(matched.report.map(r => r.contractPrintedRow), [560, 561, 775, 776]);
assert.equal(matched.report[0].contractPrice, 48.54008);
assert.equal(matched.report[1].contractPrice, 490710);

const expensive = compareAct(contract, [{ ...act[0], price: 50 }], 0.01);
assert.equal(expensive.report[0].status, 'ЦЕНА ВЫШЕ ДОГОВОРНОЙ');
const multiple = compareAct([...contract, { ...contract[0], row: 600, name: 'Бентонит другой марки' }], [act[0]], 0.01);
assert.equal(multiple.report[0].status, 'ШИФР НЕ НАЙДЕН');
console.log('Material and commercial proposal matching regression tests passed.');
