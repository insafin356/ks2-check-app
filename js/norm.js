/* Нормализация и распознавание — паритет с Module1 VBA */

// NormalizeText (Module1:4287)
export function normalizeText(v) {
  let s = v == null ? '' : String(v);
  s = s.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\u00A0/g, ' ');
  s = s.trim().replace(/ {2,}/g, ' ');
  return s.toLowerCase();
}

// CleanVisibleText (Module1:4079)
export function cleanVisibleText(v) {
  let s = v == null ? '' : String(v);
  s = s.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\u00A0/g, ' ');
  s = s.trim().replace(/ {2,}/g, ' ');
  return s;
}

const COMPACT_STRIP = [' ', '.', ',', ':', ';', '-', '_', '/', '\\', '(', ')', '=', '"', "'", '№'];

// CompactMatchText (Module1:2475)
export function compactMatchText(v) {
  let s = normalizeText(v);
  for (const ch of COMPACT_STRIP) s = s.split(ch).join('');
  return s;
}

const HEADER_STRIP = [...COMPACT_STRIP, '[', ']', '–', '—'];

// CompactHeaderKey (Module1:3121)
export function compactHeaderKey(txt) {
  let s = normalizeText(txt);
  for (const ch of HEADER_STRIP) s = s.split(ch).join('');
  return s;
}

// LooksLikeCode (Module1:4029)
export function looksLikeCode(s) {
  const u = String(s || '').trim().toUpperCase();
  if (!u) return false;
  if (u.startsWith('ГЭСН') || u.startsWith('ФЕР') || u.startsWith('ТЕР')) return true;
  if (u.includes('-') || u.includes('.')) return true;
  return false;
}

// IsCommercialProposalCode (Module1:2533)
export function isCommercialProposalCode(v) {
  let s = normalizeText(v);
  s = s.split(' ').join('').split('.').join('').split('_').join('-');
  return s.startsWith('кп') || s.startsWith('kp') || s.includes('коммерческоепредлож');
}

// NormalizeComparisonCode (Module1:2563)
export function normalizeComparisonCode(v) {
  const s = normalizeText(v);
  return isCommercialProposalCode(s) ? 'кп' : s;
}

// ExtractCodeFromCell (Module1:3899): первая непустая строка; если первый токен похож
// на шифр — берём токен, иначе всю строку
export function extractCodeFromCell(v) {
  const s = String(v == null ? '' : v).replace(/\r/g, '\n').replace(/\u00A0/g, ' ');
  const lines = s.split('\n');
  for (const raw of lines) {
    const lineText = raw.trim();
    if (!lineText) continue;
    const sp = lineText.indexOf(' ');
    const token = sp > 0 ? lineText.slice(0, sp) : lineText;
    return looksLikeCode(token) ? token : lineText;
  }
  return s.trim();
}

// FirstToken (Module1:3967)
export function firstToken(s) {
  const p = s.indexOf(' ');
  return p > 0 ? s.slice(0, p) : s;
}

// TryParseNumber (Module1:4323): ru/en разделители, NBSP, скобки = минус
export function tryParseNumber(v) {
  if (typeof v === 'number' && isFinite(v)) return { ok: true, value: v };
  let s = String(v == null ? '' : v);
  s = s.replace(/\u00A0/g, '').replace(/ /g, '').replace(/\t/g, '').trim();
  if (!s) return { ok: false, value: 0 };
  if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
  const decimalSep = ',';
  const commaPos = s.lastIndexOf(',');
  const dotPos = s.lastIndexOf('.');
  if (commaPos > 0 && dotPos > 0) {
    if (commaPos > dotPos) { s = s.split('.').join(''); s = s.split(',').join(decimalSep); }
    else { s = s.split(',').join(''); }
  } else if (commaPos > 0) {
    const cnt = s.split(',').length - 1;
    if (cnt > 1) s = s.slice(0, commaPos).split(',').join('') + decimalSep + s.slice(commaPos + 1);
  } else if (dotPos > 0) {
    const cnt = s.split('.').length - 1;
    if (cnt > 1) s = s.slice(0, dotPos).split('.').join('') + decimalSep + s.slice(dotPos + 1);
    else s = s.split('.').join(decimalSep);
  }
  s = s.split(decimalSep).join('.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, value: 0 };
  const n = parseFloat(s);
  return isFinite(n) ? { ok: true, value: n } : { ok: false, value: 0 };
}

// PriceKey (Module1:2409)
export function priceKey(value) {
  return String(Number(value.toFixed(6)));
}

// Максимальный балл выбора листа/раскладки
export function max3(a, b, c) { return Math.max(a, b, c); }
