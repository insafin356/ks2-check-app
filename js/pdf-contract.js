/* Парсинг договора из PDF через pdf.js — паритет BuildPdfPowerQueryFormula (Module1:3613) */
import { normalizeText, looksLikeCode, tryParseNumber, firstToken, cleanVisibleText } from './norm.js';

export const CONTRACT_PARSER_VERSION = 4;

const UNIT_RE = /^(?:\d+\s*)?(?:м3|м2|м|км|т|кг|шт|стык|соединение|узел|участок|компл|ед|усл|смена|чел-ч|маш-см|ч|м\.кб|м\.кв|т\.км)$/i;

function pageToText(items) {
  return items.map(it => normalizeText(it.str)).join('').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/g, '');
}

const hasRateTableHeaders = t => t.includes('обоснование') && t.includes('наименование') &&
  (t.includes('едизм') || t.includes('едизмер') || t.includes('единицаизмерения'));
const hasGesn = t => t.includes('гэсн') || t.includes('gesn');
const hasOtherSmr = t => t.includes('фссц') || t.includes('fssc') || t.includes('фсэм') || t.includes('fsem') ||
  /[0-9]/.test(t) && ['фер', 'тер'].some(pre => { for (let d = 0; d <= 9; d++) if (t.includes(pre + d)) return true; return false; });
const hasSmr = t => hasGesn(t) || hasOtherSmr(t);

// Разбивка элементов страницы на строки (по Y), строк — на кластеры-колонки (по X)
export function linesFromItems(items) {
  const arr = items
    .filter(it => it.str && it.str.trim())
    .map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || 10, s: it.str }));
  if (!arr.length) return [];
  arr.sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  let cur = null;
  for (const it of arr) {
    if (!cur || Math.abs(cur.y - it.y) > Math.max(5, (cur.h || 10) * 0.6)) {
      cur = { y: it.y, h: it.h, items: [it] };
      lines.push(cur);
    } else {
      cur.items.push(it);
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    const cells = [];
    let cell = null;
    let prevEnd = 0;
    for (const it of line.items) {
      const avgChar = it.s.length ? it.w / it.s.length : 4;
      const gap = cell == null ? Infinity : it.x - prevEnd;
      if (cell == null || gap > Math.max(5, avgChar * 1.6)) {
        cell = { x: it.x, text: it.s, items: [it] };
        cells.push(cell);
      } else {
        const needSpace = gap > avgChar * 0.35 && !/\s$/.test(cell.text) && !/^\s/.test(it.s);
        cell.text += (needSpace ? ' ' : '') + it.s;
        cell.items.push(it);
      }
      prevEnd = it.x + it.w;
    }
    line.cells = cells;
  }
  return lines;
}

function appendixNumberFromHeading(pageText) {
  const zone = pageText.slice(0, 1500);
  for (let n = 1; n <= 40; n++) {
    if (zone.includes('приложение' + n + 'кдоговор') || zone.includes('приложение' + n + 'кнастоящемудоговор')) return n;
  }
  return null;
}

// Разбивка строки на колонки по X-координатам (как раскладка PQ: обоснование, наименование,
// ед.изм., затем числовые колонки; цена без НДС = третья числовая = Column7)
function rowFromCells(cells, pageNumber, prevOpen) {
  const clusters = cells.map(c => ({ x: c.x, text: c.text.trim() })).filter(c => c.text);
  if (!clusters.length) return null;
  const code = clusters.filter(c => c.x < 150);
  const name = clusters.filter(c => c.x >= 150 && c.x < 390);
  const units = clusters.filter(c => c.x >= 390 && c.x < 445);
  const nums = clusters.filter(c => c.x >= 445).sort((a, b) => a.x - b.x);

  const codeCell = code.find(c => looksLikeCode(firstToken(c.text)));
  if (!codeCell) {
    // продолжение строки: дополняем наименование, ед.изм. и цену
    if (prevOpen) {
      if (name.length) prevOpen.name = (prevOpen.name + ' ' + name.map(c => c.text).join(' ')).trim();
      if (!prevOpen.unit && units.length) prevOpen.unit = units[0].text;
      if (prevOpen.price == null && nums[2]) {
        const p = tryParseNumber(nums[2].text);
        if (p.ok) prevOpen.price = p.value;
      }
    }
    return null;
  }
  const unitText = units.length ? units[0].text : '';
  // цена = третья числовая колонка (базовая, с НДС, без НДС, НДС, с НДС)
  const priceCell = nums[2];
  const price = priceCell ? tryParseNumber(priceCell.text) : { ok: false, value: 0 };
  return {
    code: firstToken(codeCell.text),
    name: name.map(c => c.text).join(' ').trim(),
    unit: unitText,
    price: price.ok ? price.value : null,
  };
}

// Разбивка визуальной строки на части по X-колонкам
function partsFromCells(cells) {
  const clusters = cells.map(c => ({ x: c.x, text: c.text.trim() })).filter(c => c.text);
  if (!clusters.length) return null;
  const codeClusters = clusters.filter(c => c.x < 150);
  const nameClusters = clusters.filter(c => c.x >= 150 && c.x < 385);
  const unitClusters = clusters.filter(c => c.x >= 385 && c.x < 445);
  const nums = clusters.filter(c => c.x >= 445).sort((a, b) => a.x - b.x);
  const codeCell = codeClusters.find(c => looksLikeCode(firstToken(c.text)));
  const priceCell = nums[2];
  const price = priceCell ? tryParseNumber(priceCell.text) : { ok: false, value: null };
  return {
    code: codeCell ? firstToken(codeCell.text) : '',
    name: nameClusters.map(c => c.text).join(' ').trim(),
    unit: unitClusters.length ? unitClusters[0].text : '',
    price: price.ok ? price.value : null,
  };
}

// Извлечение строк расценок со страницы. В PDF одна строка таблицы часто разбита
// на две визуальные строки (данные выше, шифр ниже) — накапливаем части в буфере
// и выдаём строку, когда есть шифр и цена/ед.изм.
export function extractRowsFromLines(lines, pageNumber) {
  const rows = [];
  let buf = null;
  const flush = () => { if (buf && buf.code) rows.push(buf); buf = null; };
  for (const line of lines) {
    // строка-заголовок таблицы «1 2 3 4 5 6 7 8 9» — пропускаем
    if (line.cells.length && line.cells.every(c => /^[1-9]$/.test(c.text.trim()))) continue;
    const parts = partsFromCells(line.cells);
    if (!parts) continue;
    if (!buf) {
      buf = parts;
    } else {
      const strong = s => /гэсн|фер|тер/i.test(s);
      buf.code = !buf.code || (parts.code && strong(parts.code) && !strong(buf.code)) ? parts.code : buf.code;
      buf.name = (buf.name + ' ' + parts.name).trim();
      buf.unit = buf.unit || parts.unit;
      if (buf.price == null && parts.price != null) buf.price = parts.price;
    }
    if (buf.code && (buf.unit || buf.price != null)) flush();
  }
  flush();
  return rows;
}

// Table rules delimit logical rows; text baselines do not.
export function tableRowBoundaries(operatorList, OPS) {
  const ys=[], stack=[];
  let matrix=[1,0,0,1,0,0];
  const point=(x,y)=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
  const edge=(x,y,a,b)=>{const p=point(x,y),q=point(a,b);if(Math.abs(p[1]-q[1])<2&&Math.min(p[0],q[0])<160&&Math.max(p[0],q[0])>380)ys.push((p[1]+q[1])/2);};
  for(let i=0;i<operatorList.fnArray.length;i++){
    const fn=operatorList.fnArray[i],args=operatorList.argsArray[i];
    if(fn===OPS.save){stack.push([...matrix]);continue;}
    if(fn===OPS.restore){matrix=stack.pop()||[1,0,0,1,0,0];continue;}
    if(fn===OPS.transform){const [a,b,c,d,e,f]=matrix,[g,h,j,k,l,m]=args;matrix=[a*g+c*h,b*g+d*h,a*j+c*k,b*j+d*k,a*l+c*m+e,b*l+d*m+f];continue;}
    if(operatorList.fnArray[i]!==OPS.constructPath)continue;
    const [ops,coords]=operatorList.argsArray[i];let k=0,x=0,y=0;
    for(const op of ops){
      if(op===OPS.rectangle){const [a,b,w,h]=coords.slice(k,k+4);k+=4;if(Math.abs(h)<2)edge(a,b+h/2,a+w,b+h/2);}
      else if(op===OPS.moveTo){x=coords[k++];y=coords[k++];}
      else if(op===OPS.lineTo){const a=coords[k++],b=coords[k++];edge(x,y,a,b);x=a;y=b;}
      else if(op===OPS.curveTo)k+=6;
      else if(op===OPS.curveTo2||op===OPS.curveTo3)k+=4;
    }
  }
  return ys.sort((a,b)=>b-a).filter((v,i,a)=>!i||Math.abs(v-a[i-1])>2);
}
export function extractRowsFromBands(items,bounds){
  const rows=[];
  for(let i=0;i<bounds.length-1;i++){
    const inside=items.filter(it=>it.transform[5]<bounds[i]&&it.transform[5]>bounds[i+1]);
    const lines=linesFromItems(inside),parts=lines.map(l=>partsFromCells(l.cells)).filter(Boolean);
    const code=parts.find(p=>p.code);
    if(!code)continue;
    const codeItem=inside.find(it=>it.str.trim()===code.code);
    const printedRow=codeItem ? (inside.filter(it=>it.transform[4]>45&&it.transform[4]<75&&/^\d{1,4}$/.test(it.str.trim())&&Math.abs(it.transform[5]-codeItem.transform[5])<2)
      .map(it=>Number(it.str.trim()))[0] ?? null) : null;
    const name=parts.map(p=>p.name).filter(Boolean).join(' ');
    const unit=parts.map(p=>p.unit).filter(Boolean).join(' ');
    const prices=parts.filter(p=>p.price!=null);
    rows.push({code:code.code,name,unit,price:prices.length?prices[0].price:null,printedRow});
  }
  return rows;
}

// Some contract appendices use a wider table: the description begins at x≈210,
// the unit at x≈565, and the four price columns begin after x≈610. PDF text
// may place the row number and code on one baseline, so use column geometry
// inside each ruled band instead of visual-line clusters.
export function extractRowsFromWideBands(items, bounds) {
  const rows = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const inside = items.filter(it => it.transform[5] < bounds[i] && it.transform[5] > bounds[i + 1]);
    const numberItem = inside.find(it => it.transform[4] >= 50 && it.transform[4] < 68 && /^\d{1,4}$/.test(it.str.trim()));
    if (!numberItem) continue;
    const column = (left, right) => linesFromItems(inside.filter(it => it.transform[4] >= left && it.transform[4] < right))
      .map(line => line.cells.map(cell => cell.text.trim()).filter(Boolean).join(' ')).filter(Boolean);
    const codeLines = column(69, 205);
    const nameLines = column(205, 555);
    const unitLines = column(555, 610);
    const prices = inside.filter(it => it.transform[4] >= 610)
      .map(it => ({ x: it.transform[4], text: it.str.trim(), parsed: tryParseNumber(it.str) }))
      .filter(it => it.parsed.ok && /[,\.]\d{2}$/.test(it.text))
      .sort((a, b) => a.x - b.x);
    // The source can leave the unit cell empty (for example pipe positions).
    if (!codeLines.length || !nameLines.length || prices.length < 2) continue;
    const firstCode = codeLines[0];
    // The repeated numbered header has "2" in the code column.
    if (/^\d$/.test(firstCode)) continue;
    const code = looksLikeCode(firstToken(firstCode)) ? firstToken(firstCode) : codeLines.join(' ');
    rows.push({ code, name: nameLines.join(' '), unit: unitLines.join(' '),
      price: prices[1].parsed.value, printedRow: Number(numberItem.str.trim()) });
  }
  return rows;
}

export async function parseContractPdf(data, onProgress) {
  const pdfjs = await import('../vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = typeof window !== 'undefined'
    ? 'vendor/pdf.worker.min.mjs'
    : new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    if (onProgress) onProgress(`Страница ${p} из ${doc.numPages}`, p / doc.numPages);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items;
    pages.push({ items, text: pageToText(items) });
  }

  const primary = pages.map((pg, i) => ({ n: i + 1, t: pg.text })).filter(x => hasRateTableHeaders(x.t) && hasGesn(x.t));
  const fallback = pages.map((pg, i) => ({ n: i + 1, t: pg.text })).filter(x => hasRateTableHeaders(x.t) && hasSmr(x.t));
  const cands = primary.length ? primary : fallback;
  if (!cands.length) throw new Error('Не найдена таблица с заголовками расценок и строительными шифрами ГЭСН / ФЕР / ТЕР.');
  const startPage = Math.min(...cands.map(x => x.n));
  const wideTable = pages[startPage - 1].items.some(it => it.transform[4] > 500 && /ед\.\s*изм/i.test(it.str));

  const startAppendix = appendixNumberFromHeading(pages[startPage - 1].text);
  const endCandidates = pages.map((pg, i) => ({ n: i + 1, app: appendixNumberFromHeading(pg.text) }))
    .filter(x => x.n > startPage && x.app != null && (startAppendix == null || x.app !== startAppendix));
  const codePagesAfter = pages.map((pg, i) => ({ n: i + 1, t: pg.text })).filter(x => x.n >= startPage && hasSmr(x.t));
  const lastCodePage = codePagesAfter.length ? Math.max(...codePagesAfter.map(x => x.n)) : startPage;
  const endPage = endCandidates.length
    ? Math.min(...endCandidates.map(x => x.n)) - 1
    : Math.min(doc.numPages, lastCodePage + 2);

  const rows = [];
  let rowIndex = 0;
  for (let p = startPage; p <= endPage && p <= doc.numPages; p++) {
    if (onProgress) onProgress(`Разбор таблиц договора, страница ${p}`, null);
    const lines = linesFromItems(pages[p - 1].items);
    const page = await doc.getPage(p);
    const boundaries = tableRowBoundaries(await page.getOperatorList(), pdfjs.OPS);
    const pageRows = boundaries.length >= 2
      ? (wideTable ? extractRowsFromWideBands(pages[p - 1].items, boundaries)
        : extractRowsFromBands(pages[p - 1].items, boundaries))
      : (wideTable ? [] : extractRowsFromLines(lines, p));
    for (const r of pageRows) {
      // Фильтр PQ: Обоснование не пустое и не "2"
      if (!r.code || r.code === '2') continue;
      rowIndex++;
      rows.push({ row: rowIndex, printedRow: r.printedRow ?? null, code: r.code, name: cleanVisibleText(r.name), unit: r.unit, price: r.price, source: `стр. ${p}` });
    }
  }

  const codes = rows.map(r => r.code.toLowerCase());
  if (!codes.some(c => hasSmr(c))) throw new Error('Найденная таблица не подтверждена строительными шифрами СМР.');
  return { rows, meta: { parserVersion: CONTRACT_PARSER_VERSION, startPage, endPage, pages: doc.numPages, appendix: startAppendix } };
}
