// Тестовый прогон парсера договора (pdf-contract.js) и парсера КС-2/МАРКЕТ на реальных файлах
import fs from 'fs';
import path from 'path';
import { parseContractPdf } from '../js/pdf-contract.js';
import { parseActWorkbook } from '../js/xlsx-act.js';
import { parseMarketWorkbook } from '../js/xlsx-market.js';
import { compareAct } from '../js/compare-act.js';
import { compareMarket } from '../js/compare-market.js';

const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const pdf = path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf');
const act = path.join(dir, '18. КС-2.xlsx');
const market = path.join(dir, 'excel-exporter--518-26-s.xlsx');

const contract = await parseContractPdf(new Uint8Array(fs.readFileSync(pdf)));
console.log('=== ДОГОВОР ===', contract.meta);
console.log('строк:', contract.rows.length);
for (const r of contract.rows.slice(0, 8)) console.log(JSON.stringify(r));
const gesn = contract.rows.filter(r => r.code.toUpperCase().startsWith('ГЭСН'));
console.log('ГЭСН-строк:', gesn.length);

const actParsed = parseActWorkbook(fs.readFileSync(act));
console.log('=== КС-2 ===', JSON.stringify(actParsed.meta));
for (const r of actParsed.rows.slice(0, 5)) console.log(JSON.stringify(r));

const marketParsed = parseMarketWorkbook(fs.readFileSync(market));
console.log('=== МАРКЕТ ===', JSON.stringify(marketParsed.meta));
for (const r of marketParsed.rows.slice(0, 5)) console.log(JSON.stringify(r));

const resAct = compareAct(contract.rows, actParsed.rows, 0.01);
console.log('=== СВЕРКА КС-2 ===', JSON.stringify(resAct.summary));
for (const r of resAct.report.filter(r => r.status !== 'ОК').slice(0, 10)) console.log(JSON.stringify(r));

const resM = compareMarket(contract.rows, marketParsed.rows, 0.01);
console.log('=== СВЕРКА МАРКЕТ ===', JSON.stringify(resM.summary));
for (const r of resM.report.filter(r => r.status !== 'ОК').slice(0, 10)) console.log(JSON.stringify(r));
