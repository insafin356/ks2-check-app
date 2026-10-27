import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
globalThis.XLSX = require('../vendor/xlsx-js-style.js');
const { exportActReport, exportMarketReport } = await import('../js/report-export.js');

exportActReport([
  { actRow: 1, code: 'ГЭСН01', name: 'Тест 1', unit: 'м', actPrice: 100, status: 'ОК', note: 'ok', contractRow: 10, contractPrice: 110, diff: 10, duplicates: 1 },
  { actRow: 2, code: 'ГЭСН02', name: 'Тест 2', unit: 'м', actPrice: 200, status: 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ', note: 'w', contractRow: 20, contractPrice: 210, diff: 10, duplicates: 3 },
  { actRow: 3, code: 'ГЭСН03', name: 'Тест 3', unit: 'м', actPrice: 300, status: 'ЦЕНА ВЫШЕ ДОГОВОРНОЙ', note: 'e', contractRow: 30, contractPrice: 290, diff: -10, duplicates: 1 },
], { ok: 1, priceTooHigh: 1, codeNotFound: 0, unitMismatch: 0, priceUnreadable: 0, ambiguous: 1, missingCode: 0, missingUnit: 0, missingName: 0, totalErrors: 2 }, 0.01);
exportMarketReport([
  { marketRow: 1, code: 'ГЭСН01', name: 'Тест 1', marketPrice: 100, status: 'ОК', note: 'ok', contractRow: 10, contractName: 'n', contractPrice: 100, diff: 0, duplicates: 1 },
  { marketRow: 2, code: 'ГЭСН02', name: 'Тест 2', marketPrice: 200, status: 'ЦЕНА НЕ РАВНА ДОГОВОРНОЙ', note: 'e', contractRow: 20, contractName: 'n', contractPrice: 205, diff: 5, duplicates: 1 },
], { ok: 1, priceNotEqual: 1, codeNotFound: 0, priceUnreadable: 0, ambiguous: 0, totalErrors: 1 }, 0.01);
console.log('export done');
