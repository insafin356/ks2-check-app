/* Загрузка МАРКЕТ из Excel — паритет TryFindMarketLayout (Module1:2059) */
import { cleanVisibleText, extractCodeFromCell, tryParseNumber, looksLikeCode, normalizeText } from './norm.js';
import * as XLSX from '../vendor/xlsx.mjs';

function encode(r, c) { return XLSX.utils.encode_cell({ r, c }); }

// IsMarketDataRow (Module1:2183)
function isMarketDataRow(code, nm) {
  return !!(code && nm && looksLikeCode(code));
}

export function parseMarketWorkbook(data) {
  const wb = XLSX.read(data, { type: 'array', cellDates: false });
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const lastRow = Math.min(range.e.r, 49); // первые 50 строк
    const lastCol = Math.min(range.e.c, 199); // до 200 колонок
    let colCode = -1, colName = -1, colPrice = -1, codeRow = 0, nameRow = 0, priceRow = 0;

    for (let r = 0; r <= lastRow; r++) {
      for (let c = 0; c <= lastCol; c++) {
        const txt = normalizeText(ws[encode(r, c)]?.v);
        if (!txt) continue;
        if (colCode < 0 && txt.includes('технические регламенты')) { colCode = c; codeRow = r; }
        if (colName < 0 && txt.includes('наименование мастер-ассортимента')) { colName = c; nameRow = r; }
        if (colPrice < 0 && txt === 'цена без ндс') { colPrice = c; priceRow = r; }
      }
    }

    if (colCode >= 0 && colName >= 0 && colPrice >= 0) {
      const headerRow = Math.max(codeRow, nameRow, priceRow);
      const rows = [];
      let outRow = 1, loaded = 0, skipped = 0;
      for (let r = headerRow + 1; r <= range.e.r; r++) {
        const code = extractCodeFromCell(ws[encode(r, colCode)]?.v);
        const nm = cleanVisibleText(ws[encode(r, colName)]?.v);
        const p = tryParseNumber(ws[encode(r, colPrice)]?.v);
        if (isMarketDataRow(code, nm)) {
          rows.push({ row: outRow, srcRow: r + 1, sheet: name, code, name: nm, price: p.ok ? p.value : null });
          outRow++; loaded++;
        } else skipped++;
      }
      return { rows, meta: { sheet: name, cols: { code: colCode + 1, name: colName + 1, price: colPrice + 1 }, headerRow: headerRow + 1, loaded, skipped } };
    }
  }
  throw new Error('Не удалось распознать структуру файла МАРКЕТ. Ожидаются колонки: Технические регламенты, Наименование мастер-ассортимента, Цена без НДС.');
}
