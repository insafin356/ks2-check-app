/* Загрузка КС-2/акта из Excel — паритет FindActLayout/TryFindActLayout (Module1:2591–3609) */
import {
  normalizeText, cleanVisibleText, extractCodeFromCell, tryParseNumber, looksLikeCode, compactHeaderKey, max3,
} from './norm.js';

import * as XLSX from '../vendor/xlsx.mjs';

const HEADER_WINDOW = 10, MAX_SCAN_ROWS = 300, VALIDATION_ROWS = 150;
const MIN = { code: 80, name: 80, unit: 80, price: 65 };

// ScoreCodeHeader (Module1:3179)
function scoreCodeHeader(txt) {
  const k = compactHeaderKey(txt);
  if (k.includes('обоснование')) return 140;
  if (k.includes('шифррасценки') || k.includes('шифрнормы') || k.includes('кодрасценки')) return 130;
  if (k.includes('номерединичнойрасценки') || k.includes('номеррасценки') || k.includes('№расценки')) return 120;
  if (k.includes('шифр')) return 100;
  return 0;
}

// ScoreNameHeader (Module1:3227)
function scoreNameHeader(txt) {
  const k = compactHeaderKey(txt);
  if (k.includes('наименованиеработизатрат') || k.includes('наименованиеихарактеристикаработизатрат')) return 150;
  if (k.includes('наименованиеработ')) return 135;
  if (k.includes('наименованиезатрат')) return 125;
  if (k.includes('наименование') && (k.includes('работ') || k.includes('затрат'))) return 110;
  return 0;
}

// ScoreUnitHeader (Module1:3273)
function scoreUnitHeader(txt) {
  const k = compactHeaderKey(txt);
  if (k.includes('наединицу') || k.includes('стоимость') || k.includes('цена')) return 0;
  if (k.includes('единицаизмерения') || k.includes('единицыизмерения')) return 145;
  if (k.includes('едизм')) return 135;
  if (k.includes('измеритель')) return 115;
  return 0;
}

// ScorePriceHeader (Module1:3319)
function scorePriceHeader(txt) {
  let score = 0;
  const k = compactHeaderKey(txt);
  const hasPriceCtx = k.includes('стоимость') || k.includes('цена');
  const unitMarker = k.includes('наединицу') || k.includes('наед') || k.includes('заединицу');
  if (!hasPriceCtx) return 0;
  if (unitMarker) score = 170;
  else if (k.includes('стоимостьнаединицуизмерения') || k.includes('ценанаединицуизмерения') || k.includes('ценазаединицуизмерения')) score = 170;
  else if (k.includes('стоимостьединицыизмерения') || k.includes('стоимостьединицыработ') || k.includes('стоимостьединицы') || k.includes('единичнаястоимость')) score = 160;
  else if (k.includes('ценазаединицу') || k.includes('ценанаединицу') || k.includes('стоимостьзаединицу')) score = 150;
  else if (k.includes('ценаед') || k.includes('ценаруб') || k.includes('стоимостьруб')) score = 110;
  else if (k.includes('стоимость') || k.includes('цена')) score = 70;

  if (score > 0 && (k.includes('всего') || k.includes('итого') || k.includes('навесьобъем') || k.includes('общаястоимость')) &&
      !unitMarker && !k.includes('стоимостьединицы') && !k.includes('единичнаястоимость')) score = 0;
  if (score > 0) {
    if (k.includes('текущ') || k.includes('фактическ') || k.includes('выполненн')) score += 20;
    if (k.includes('базисн') || k.includes('базов')) score -= 15;
  }
  return score;
}

// BuildColumnHeaderText (Module1:3011): текст заголовка колонки в окне строк (объединённые ячейки учтены)
function buildColumnHeaderText(ws, r0, r1, c) {
  const parts = [];
  for (let r = r0; r <= r1; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) continue;
    const part = normalizeText(cell.v);
    if (part && !parts.includes(part)) parts.push(part);
  }
  return parts.join(' ');
}

// IsActDataRow (Module1:3575)
function isActDataRow(code, nm, unit, priceOk) {
  if (code && looksLikeCode(code)) return true;
  if (!code && nm && unit && priceOk) return true;
  return false;
}

function lastUsedRow(ws) {
  const ref = ws['!ref'];
  if (!ref) return 0;
  const end = XLSX.utils.decode_range(ref).e;
  return end.r; // 0-based
}
function lastUsedCol(ws) {
  const ref = ws['!ref'];
  if (!ref) return 0;
  return XLSX.utils.decode_range(ref).e.c;
}

function tryFindActLayout(ws) {
  const lastRow = Math.min(lastUsedRow(ws), MAX_SCAN_ROWS - 1);
  const scanLastCol = lastUsedCol(ws);
  if (lastRow < 0 || scanLastCol < 0) return null;
  let best = null;

  for (let bandBottom = 0; bandBottom <= lastRow; bandBottom++) {
    const bandTop = Math.max(0, bandBottom - HEADER_WINDOW + 1);
    let cur = { code: { col: 0, score: 0 }, name: { col: 0, score: 0 }, unit: { col: 0, score: 0 }, price: { col: 0, score: 0 } };
    for (let c = 0; c <= scanLastCol; c++) {
      const txt = buildColumnHeaderText(ws, bandTop, bandBottom, c);
      if (!txt) continue;
      let s = scoreCodeHeader(txt);
      if (s > cur.code.score) cur.code = { col: c, score: s };
      s = scoreNameHeader(txt);
      if (s > cur.name.score) cur.name = { col: c, score: s };
      s = scoreUnitHeader(txt);
      if (s > cur.unit.score) cur.unit = { col: c, score: s };
      s = scorePriceHeader(txt);
      if (s > cur.price.score || (s === cur.price.score && s > 0 && c > cur.price.col)) cur.price = { col: c, score: s };
    }
    const distinct = cur.code.col !== cur.name.col && cur.code.col !== cur.unit.col && cur.code.col !== cur.price.col &&
                     cur.name.col !== cur.unit.col && cur.name.col !== cur.price.col && cur.unit.col !== cur.price.col;
    if (cur.code.score >= MIN.code && cur.name.score >= MIN.name && cur.unit.score >= MIN.unit && cur.price.score >= MIN.price && distinct) {
      let matches = 0;
      for (let r = bandBottom + 1; r <= Math.min(lastUsedRow(ws), bandBottom + VALIDATION_ROWS); r++) {
        const code = extractCodeFromCell(ws[encode(r, cur.code.col)]?.v);
        const nm = cleanVisibleText(ws[encode(r, cur.name.col)]?.v);
        const unit = cleanVisibleText(ws[encode(r, cur.unit.col)]?.v);
        const p = tryParseNumber(ws[encode(r, cur.price.col)]?.v);
        if (code && nm && unit && looksLikeCode(code)) matches++;
      }
      if (matches > 0) {
        const total = cur.code.score + cur.name.score + cur.unit.score + cur.price.score + matches * 25;
        if (!best || total > best.total || (total === best.total && bandBottom < best.headerRow)) {
          best = { total, headerRow: bandBottom, cols: cur };
        }
      }
    }
  }
  return best;
}

function encode(r, c) { return XLSX.utils.encode_cell({ r, c }); }

// Возврат: { rows, sheet, cols, headerRow }
export function parseActWorkbook(data) {
  const wb = XLSX.read(data, { type: 'array', cellDates: false });
  let best = null, bestSheet = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const layout = tryFindActLayout(ws);
    if (layout && (!best || layout.total > best.total)) { best = layout; bestSheet = name; }
  }
  if (!best) throw new Error('Не удалось распознать структуру КС-2 / акта. Ожидаются колонки: Обоснование, Наименование работ и затрат, Единица измерения, Стоимость на единицу измерения.');

  const ws = wb.Sheets[bestSheet];
  const { col: colCode } = best.cols.code, { col: colName } = best.cols.name, { col: colUnit } = best.cols.unit, { col: colPrice } = best.cols.price;
  const rows = [];
  let outRow = 1, loaded = 0, skipped = 0;
  for (let r = best.headerRow + 1; r <= lastUsedRow(ws); r++) {
    const code = extractCodeFromCell(ws[encode(r, colCode)]?.v);
    const nm = cleanVisibleText(ws[encode(r, colName)]?.v);
    const unit = cleanVisibleText(ws[encode(r, colUnit)]?.v);
    const p = tryParseNumber(ws[encode(r, colPrice)]?.v);
    if (isActDataRow(code, nm, unit, p.ok)) {
      rows.push({ row: outRow, srcRow: r + 1, sheet: bestSheet, code, name: nm, unit, price: p.ok ? p.value : null });
      outRow++; loaded++;
    } else skipped++;
  }
  return { rows, meta: { sheet: bestSheet, cols: { code: colCode + 1, name: colName + 1, unit: colUnit + 1, price: colPrice + 1 }, headerRow: best.headerRow + 1, loaded, skipped } };
}
