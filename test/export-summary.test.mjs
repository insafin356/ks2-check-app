import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('../vendor/xlsx-js-style.js');
let workbook, exportedFileName;
XLSX.writeFile = (wb, fileName) => { workbook = wb; exportedFileName = fileName; };
globalThis.XLSX = XLSX;

const { actReportFileName, exportActReport, exportMarketReport } = await import('../js/report-export.js');
exportActReport([
  { actRow: 34, code: 'ГЭСН04-01-080-01', name: 'Демонтаж ГНБ', unit: 'шт', actPrice: 4511.63, status: 'ОК', note: '', contractRow: 530, contractPrintedRow: 529, contractPrice: 4511.64, diff: 0.01, duplicates: 1 },
], { ok: 1, priceTooHigh: 0, codeNotFound: 4, unitMismatch: 0, priceUnreadable: 0, ambiguous: 0, missingCode: 0, missingUnit: 0, missingName: 0, totalErrors: 4 }, 0.01, { fileName: '17. КС-2 (п. Опушка, ул. Зии Тазетдинова, д. 12).xlsx' });
let sheet = workbook.Sheets['Отчет'];
assert.equal(exportedFileName, 'КС-2 — п. Опушка, ул. Зии Тазетдинова, д. 12 — проверка.xlsx');
assert.equal(actReportFileName({ fileName: '18. КС-2.xlsx', meta: { objectName: 'Ответвление газопровода. Адрес: РТ, Балтасинский район, д. Новая Салаусь' } }), 'КС-2 — РТ, Балтасинский район, д. Новая Салаусь — проверка.xlsx');
assert.equal(actReportFileName({ fileName: '18. КС-2.xlsx', meta: { objectName: 'Объект: А/Б*В?' } }), 'КС-2 — Объект А Б В — проверка.xlsx');
assert.equal(actReportFileName({ fileName: '18. КС-2.xlsx' }), 'КС-2 — проверка.xlsx');
assert.equal(sheet.P1, undefined);
assert.equal(sheet.H2.v, 529);
assert.equal(sheet.O6.v, 'Не найдено в договоре');
assert.equal(sheet.P6.v, 4);
assert.equal(XLSX.utils.decode_range(sheet['!ref']).e.c, 15);

exportMarketReport([], { ok: 0, priceNotEqual: 0, codeNotFound: 0, priceUnreadable: 0, ambiguous: 0, totalErrors: 0 }, 0.01);
sheet = workbook.Sheets['Отчет'];
assert.equal(sheet.O1.v, 'Сводка');
assert.equal(XLSX.utils.decode_range(sheet['!ref']).e.c, 15);
console.log('Excel report summary regression tests passed.');
