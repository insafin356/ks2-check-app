import { parseContractPdf } from '../js/pdf-contract.js';
import { parseActWorkbook } from '../js/xlsx-act.js';
import { parseMarketWorkbook } from '../js/xlsx-market.js';
import { compareAct } from '../js/compare-act.js';
import { compareMarket } from '../js/compare-market.js';
import fs from 'fs';
import path from 'path';

const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const c = await parseContractPdf(new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))));
const a = parseActWorkbook(new Uint8Array(fs.readFileSync(path.join(dir, '18. КС-2.xlsx'))));
console.log('--- КС-2 расхождения ---');
for (const r of compareAct(c.rows, a.rows, 0.01).report.filter(r => r.status !== 'ОК'))
  console.log(JSON.stringify({ code: r.code, unit: r.unit, price: r.actPrice, status: r.status, note: r.note, cRow: r.contractRow, cPrice: r.contractPrice }));

const m = parseMarketWorkbook(new Uint8Array(fs.readFileSync(path.join(dir, 'excel-exporter--518-26-s.xlsx'))));
console.log('--- МАРКЕТ расхождения (первые 15) ---');
const mr = compareMarket(c.rows, m.rows, 0.01).report.filter(r => r.status !== 'ОК');
for (const r of mr.slice(0, 15))
  console.log(JSON.stringify({ code: r.code, price: r.marketPrice, status: r.status, note: r.note, cPrice: r.contractPrice }));
console.log('всего расхождений МАРКЕТ:', mr.length);
