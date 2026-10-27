/* Точка входа: вкладки, загрузка файлов, проверки, страницы позиций, отчёт */
import { parseContractPdf } from './pdf-contract.js';
import { parseActWorkbook } from './xlsx-act.js';
import { parseMarketWorkbook } from './xlsx-market.js';
import { compareAct } from './compare-act.js';
import { compareMarket } from './compare-market.js';
import { exportActReport, exportMarketReport } from './report-export.js';
import { kvSet, kvGet, historyAdd } from './store.js';

const $ = id => document.getElementById(id);
const SLICE = 200;

let state = {
  contract: null,   // { rows, meta, fileName }
  act: null,
  market: null,
  report: null,     // последний отчёт для вкладки «Отчет»: { kind, report, summary, tolerance }
  reportAct: null,  // сохранённые отчёты для статусов на страницах позиций
  reportMarket: null,
  showAll: { contract: false, act: false, market: false },
};

/* ── Тема ───────────────────────────────────────────────────── */

const savedTheme = localStorage.getItem('theme');
let theme = savedTheme || 'dark';
applyTheme(theme);
function applyTheme(t) {
  theme = t;
  document.documentElement.dataset.theme = t;
  $('theme-toggle').textContent = t === 'dark' ? 'Светлая тема' : 'Тёмная тема';
}
$('theme-toggle').addEventListener('click', () => {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
  localStorage.setItem('theme', theme);
});

/* ── Вкладки ────────────────────────────────────────────────── */

const tabs = $('tabs');
tabs.addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + btn.dataset.tab));
  renderPositionPages();
  if (btn.dataset.tab === 'report') renderReport();
});
function gotoTab(name) {
  tabs.querySelector(`[data-tab="${name}"]`).click();
}

function setStatus(id, text, cls) {
  const el = $(id);
  el.textContent = text || '';
  el.className = 'status' + (cls ? ' ' + cls : '');
}

function setProgress(id, frac) {
  const el = $(id);
  if (frac == null) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.firstElementChild.style.width = Math.round(frac * 100) + '%';
}

async function readFile(file) { return new Uint8Array(await file.arrayBuffer()); }

/* ── Статусная строка в шапке ───────────────────────────────── */

function renderStatusbar() {
  const el = $('statusbar');
  const parts = [];
  if (state.contract) {
    const m = state.contract.meta;
    parts.push(`ДОГОВОР: ${esc(state.contract.fileName)}`);
    parts.push(`${state.contract.rows.length} РАСЦЕНОК · СТР. ${m.startPage}–${m.endPage}`);
  }
  if (state.reportAct) parts.push(`<b class="${state.reportAct.summary.totalErrors ? 'bad' : 'good'}">КС-2: ${state.reportAct.summary.ok}/${state.reportAct.summary.ok + state.reportAct.summary.totalErrors}</b>`);
  if (state.reportMarket) parts.push(`<b class="${state.reportMarket.summary.totalErrors ? 'bad' : 'good'}">МАРКЕТ: ${state.reportMarket.summary.ok}/${state.reportMarket.summary.ok + state.reportMarket.summary.totalErrors}</b>`);
  if (!parts.length) { el.hidden = true; return; }
  el.innerHTML = parts.map(escKeepTags).join(' · ');
  el.hidden = false;
}
// статусы содержат безопасные теги <b>, остальное экранируем заранее
function escKeepTags(s) { return s; }

/* ── Бейджи статусов ────────────────────────────────────────── */

const BADGE_CLS = { 'ОК': 'ok', 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ': 'warn' };
function badgeHtml(status) {
  if (!status) return '<span class="badge dim">—</span>';
  return `<span class="badge ${BADGE_CLS[status] || 'err'}">${esc(status)}</span>`;
}
function rowCls(status) {
  return status === 'ОК' ? 'row-ok' : status === 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ' ? 'row-warn' : status ? 'row-err' : '';
}

/* ── Загрузка договора ──────────────────────────────────────── */

$('file-contract').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('contract-status', 'Разбор PDF...', '');
  setProgress('contract-progress', 0.02);
  try {
    const data = await readFile(file);
    const { rows, meta } = await parseContractPdf(data, (msg, frac) => {
      setStatus('contract-status', msg);
      if (frac != null) setProgress('contract-progress', frac);
    });
    state.contract = { rows, meta, fileName: file.name };
    await kvSet('contract', state.contract);
    setProgress('contract-progress', null);
    setStatus('contract-status', `Загружено ${rows.length} договорных расценок СМР (страницы ${meta.startPage}–${meta.endPage}).`, 'success');
    $('contract-meta').textContent = `Всего страниц PDF: ${meta.pages}`;
    renderPositionPages();
    renderStatusbar();
    gotoTab('contract');
  } catch (err) {
    setProgress('contract-progress', null);
    setStatus('contract-status', 'Не удалось загрузить договор из PDF.\n' + err.message, 'error');
  }
});

/* ── Загрузка КС-2 ──────────────────────────────────────────── */

$('file-act').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('act-status', 'Разбор Excel...');
  try {
    const parsed = parseActWorkbook(await readFile(file));
    state.act = { ...parsed, fileName: file.name };
    await kvSet('act', state.act);
    setStatus('act-status', `Акт загружен: ${parsed.rows.length} позиций (лист «${parsed.meta.sheet}»), пропущено строк: ${parsed.meta.skipped}.`, 'success');
    $('act-meta').textContent = `Колонки: обоснование — ${parsed.meta.cols.code}, наименование — ${parsed.meta.cols.name}, ед.изм. — ${parsed.meta.cols.unit}, цена — ${parsed.meta.cols.price}; первая строка данных: ${parsed.meta.headerRow}`;
    renderPositionPages();
    renderStatusbar();
  } catch (err) {
    setStatus('act-status', 'Ошибка загрузки акта: ' + err.message, 'error');
  }
});

/* ── Загрузка МАРКЕТ ────────────────────────────────────────── */

$('file-market').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('market-status', 'Разбор Excel...');
  try {
    const parsed = parseMarketWorkbook(await readFile(file));
    state.market = { ...parsed, fileName: file.name };
    await kvSet('market', state.market);
    setStatus('market-status', `МАРКЕТ загружен: ${parsed.rows.length} позиций (лист «${parsed.meta.sheet}»), пропущено строк: ${parsed.meta.skipped}.`, 'success');
    renderPositionPages();
    renderStatusbar();
  } catch (err) {
    setStatus('market-status', 'Ошибка загрузки МАРКЕТ: ' + err.message, 'error');
  }
});

/* ── Проверки ───────────────────────────────────────────────── */

async function runCheck(kind) {
  if (!state.contract) { alert('Сначала загрузите договор из PDF.'); gotoTab('check'); return; }
  if (kind === 'act' && !state.act) { alert('Сначала загрузите файл КС-2.'); return; }
  if (kind === 'market' && !state.market) { alert('Сначала загрузите файл МАРКЕТ.'); return; }

  const tolerance = parseFloat($('tolerance').value) || 0;
  const res = kind === 'act'
    ? compareAct(state.contract.rows, state.act.rows, tolerance)
    : compareMarket(state.contract.rows, state.market.rows, tolerance);
  const stored = { kind, report: res.report, summary: res.summary, tolerance };
  state.report = stored;
  if (kind === 'act') { state.reportAct = stored; await kvSet('report-act', stored); }
  else { state.reportMarket = stored; await kvSet('report-market', stored); }
  await historyAdd({ kind, tolerance, ok: res.summary.ok, errors: res.summary.totalErrors, contract: state.contract.fileName });
  renderPositionPages();
  renderStatusbar();
  renderReport();
  gotoTab('report');
}
$('btn-check-act').addEventListener('click', () => runCheck('act'));
$('btn-check-market').addEventListener('click', () => runCheck('market'));

/* ── Вкладка «Отчет» ────────────────────────────────────────── */

const CHIP_KEYS_ACT = [
  ['ОК', 'ok'], ['Цена выше договорной', 'priceTooHigh'], ['Шифр не найден', 'codeNotFound'],
  ['Не совпадает ед. изм.', 'unitMismatch'], ['Цена не распознана', 'priceUnreadable'],
  ['Неоднозначный дубль', 'ambiguous'], ['Отсутствует шифр', 'missingCode'],
  ['Отсутствует ед. изм.', 'missingUnit'], ['Отсутствует наименование', 'missingName'], ['Всего ошибок', 'totalErrors'],
];
const CHIP_KEYS_MARKET = [
  ['ОК', 'ok'], ['Цена не равна договорной', 'priceNotEqual'], ['Шифр не найден', 'codeNotFound'],
  ['Цена не распознана', 'priceUnreadable'], ['Неоднозначный дубль', 'ambiguous'], ['Всего ошибок', 'totalErrors'],
];

function renderReport() {
  const rep = state.report;
  if (!rep) return;
  const { kind, report, summary, tolerance } = rep;
  $('empty-state').style.display = 'none';
  $('report-table').style.display = '';
  const chips = kind === 'act' ? CHIP_KEYS_ACT : CHIP_KEYS_MARKET;
  $('summary').innerHTML =
    `<span class="chip">Правило цены: ${kind === 'act' ? 'цена в акте &lt;= цена по договору' : 'цена МАРКЕТ = цена по договору'}</span>` +
    `<span class="chip">Допуск: ${tolerance}</span>` +
    chips.map(([label, key]) => `<span class="chip ${key === 'ok' ? 'ok' : key === 'totalErrors' ? 'err' : ''}">${label}: ${summary[key] ?? 0}</span>`).join('');

  const filter = $('status-filter').value;
  const visible = report.filter(r => !filter || r.status === filter);
  const cols = kind === 'act'
    ? [['Строка акта', r => r.actRow], ['Шифр', r => r.code], ['Наименование в акте', r => r.name], ['Ед. изм.', r => r.unit],
       ['Цена в акте', r => fmtNum(r.actPrice), 'num'], ['Статус', r => r.status], ['Комментарий', r => r.note],
       ['Строка договора', r => r.contractRow], ['Цена по договору', r => fmtNum(r.contractPrice), 'num'],
       ['Разница', r => fmtNum(r.diff), 'num'], ['Дублей', r => r.duplicates]]
    : [['Строка МАРКЕТ', r => r.marketRow], ['Шифр', r => r.code], ['Наименование МАРКЕТ', r => r.name],
       ['Цена МАРКЕТ', r => fmtNum(r.marketPrice), 'num'], ['Статус', r => r.status], ['Комментарий', r => r.note],
       ['Строка договора', r => r.contractRow], ['Наименование в договоре', r => r.contractName],
       ['Цена по договору', r => fmtNum(r.contractPrice), 'num'], ['Разница', r => fmtNum(r.diff), 'num'], ['Дублей', r => r.duplicates]];

  const table = $('report-table');
  table.innerHTML = '<thead><tr>' + cols.map(([h]) => `<th>${h}</th>`).join('') + '</tr></thead>' +
    '<tbody>' + visible.map(r => {
      const cls = rowCls(r.status);
      return `<tr class="${cls}">` + cols.map(([h, get, cls2]) => {
        if (h === 'Статус') return `<td class="status-cell">${badgeHtml(r.status)}</td>`;
        if (h === 'Шифр') return `<td class="code-cell">${esc(get(r))}</td>`;
        return `<td${cls2 ? ` class="${cls2}"` : ''}>${esc(get(r))}</td>`;
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
}
$('status-filter').addEventListener('change', renderReport);

/* ── Страницы позиций: Договор / КС-2 / МАРКЕТ ──────────────── */

function statusMapOf(rep, rowKey) {
  const map = new Map();
  if (rep) for (const r of rep.report) map.set(r[rowKey], r);
  return map;
}

function chipRow(items) {
  return items.map(([label, n, cls]) => `<span class="chip ${cls || ''}">${label}: ${n}</span>`).join('');
}

function renderContractPage() {
  const c = state.contract;
  const empty = $('contract-empty'), table = $('table-contract'), more = $('btn-contract-more');
  if (!c) { empty.style.display = ''; table.style.display = 'none'; more.hidden = true; $('contract-info').innerHTML = ''; $('contract-chips').innerHTML = ''; return; }
  empty.style.display = 'none'; table.style.display = '';

  const m = c.meta;
  $('contract-info').innerHTML = '<h3>Сведения о договоре</h3><dl>' +
    `<div><dt>Файл</dt><dd>${esc(c.fileName)}</dd></div>` +
    `<div><dt>Всего страниц PDF</dt><dd>${m.pages}</dd></div>` +
    `<div><dt>Страницы приложения расценок</dt><dd>${m.startPage}–${m.endPage}</dd></div>` +
    `<div><dt>Распознано расценок</dt><dd>${c.rows.length}</dd></div></dl>`;

  const actMap = statusMapOf(state.reportAct, 'contractRow');
  const mktMap = statusMapOf(state.reportMarket, 'contractRow');
  let actMentioned = 0, mktMentioned = 0;
  for (const r of c.rows) { if (actMap.has(r.row)) actMentioned++; if (mktMap.has(r.row)) mktMentioned++; }
  $('contract-chips').innerHTML = chipRow([
    ['Всего строк', c.rows.length],
    ['Упомянуты КС-2', actMentioned, actMentioned ? 'ok' : ''],
    ['Упомянуты МАРКЕТ', mktMentioned, mktMentioned ? 'ok' : ''],
    ['Без упоминаний', c.rows.length - new Set([...actMap.keys(), ...mktMap.keys()].filter(k => k != null)).size],
  ]);

  const rows = state.showAll.contract ? c.rows : c.rows.slice(0, SLICE);
  more.hidden = rows.length >= c.rows.length;
  more.textContent = `Показать все ${c.rows.length}`;
  table.innerHTML = '<thead><tr><th>№</th><th>Шифр</th><th>Наименование</th><th>Ед. изм.</th><th>Цена, руб</th><th>КС-2</th><th>МАРКЕТ</th></tr></thead><tbody>' +
    rows.map(r => {
      const a = actMap.get(r.row), mk = mktMap.get(r.row);
      const st = a ? a.status : (mk ? mk.status : '');
      return `<tr class="${rowCls(st)}"><td class="code-cell">${r.row}</td><td class="code-cell">${esc(r.code)}</td><td>${esc(r.name)}</td>` +
        `<td class="code-cell">${esc(r.unit)}</td><td class="num">${fmtNum(r.price)}</td>` +
        `<td class="status-cell">${badgeHtml(a ? a.status : '')}</td><td class="status-cell">${badgeHtml(mk ? mk.status : '')}</td></tr>`;
    }).join('') + '</tbody>';
}

function renderActPage() {
  const a = state.act;
  const empty = $('act-empty'), table = $('table-act'), more = $('btn-act-more');
  if (!a) { empty.style.display = ''; table.style.display = 'none'; more.hidden = true; $('act-info').innerHTML = ''; $('act-chips').innerHTML = ''; $('act-hint').hidden = true; return; }
  empty.style.display = 'none'; table.style.display = '';

  const m = a.meta;
  $('act-info').innerHTML = '<h3>Сведения о КС-2</h3><dl>' +
    `<div><dt>Файл</dt><dd>${esc(a.fileName)}</dd></div>` +
    `<div><dt>Лист</dt><dd>${esc(m.sheet)}</dd></div>` +
    `<div><dt>Колонки (обоснование/наименование/ед./цена)</dt><dd>${m.cols.code} / ${m.cols.name} / ${m.cols.unit} / ${m.cols.price}</dd></div>` +
    `<div><dt>Первая строка данных</dt><dd>${m.headerRow}</dd></div>` +
    `<div><dt>Загружено позиций</dt><dd>${a.rows.length}</dd></div>` +
    `<div><dt>Пропущено строк</dt><dd>${m.skipped}</dd></div></dl>`;

  const rep = state.reportAct;
  $('act-hint').hidden = !!rep;
  const map = statusMapOf(rep, 'actRow');
  let ok = 0, err = 0;
  if (rep) { ok = rep.summary.ok; err = rep.summary.totalErrors; }
  $('act-chips').innerHTML = rep ? chipRow([['ОК', ok, 'ok'], ['Ошибок', err, err ? 'err' : '']]) : '';

  const rows = state.showAll.act ? a.rows : a.rows.slice(0, SLICE);
  more.hidden = rows.length >= a.rows.length;
  more.textContent = `Показать все ${a.rows.length}`;
  table.innerHTML = '<thead><tr><th>№</th><th>Шифр</th><th>Наименование</th><th>Ед. изм.</th><th>Цена, руб</th><th>Статус сверки</th><th>Комментарий</th></tr></thead><tbody>' +
    rows.map(r => {
      const it = map.get(r.row);
      const st = it ? it.status : '';
      return `<tr class="${rowCls(st)}"><td class="code-cell">${r.row}</td><td class="code-cell">${esc(r.code)}</td><td>${esc(r.name)}</td>` +
        `<td class="code-cell">${esc(r.unit)}</td><td class="num">${fmtNum(r.price)}</td>` +
        `<td class="status-cell">${badgeHtml(it ? it.status : '')}</td><td>${it ? esc(it.note) : ''}</td></tr>`;
    }).join('') + '</tbody>';
}

function renderMarketPage() {
  const mk = state.market;
  const empty = $('market-empty'), table = $('table-market'), more = $('btn-market-more');
  if (!mk) { empty.style.display = ''; table.style.display = 'none'; more.hidden = true; $('market-info').innerHTML = ''; $('market-chips').innerHTML = ''; $('market-hint').hidden = true; return; }
  empty.style.display = 'none'; table.style.display = '';

  const m = mk.meta;
  $('market-info').innerHTML = '<h3>Сведения о МАРКЕТ</h3><dl>' +
    `<div><dt>Файл</dt><dd>${esc(mk.fileName)}</dd></div>` +
    `<div><dt>Лист</dt><dd>${esc(m.sheet)}</dd></div>` +
    `<div><dt>Колонки (шифр/наименование/цена)</dt><dd>${m.cols.code} / ${m.cols.name} / ${m.cols.price}</dd></div>` +
    `<div><dt>Загружено позиций</dt><dd>${mk.rows.length}</dd></div>` +
    `<div><dt>Пропущено строк</dt><dd>${m.skipped}</dd></div></dl>`;

  const rep = state.reportMarket;
  $('market-hint').hidden = !!rep;
  const map = statusMapOf(rep, 'marketRow');
  let ok = 0, err = 0;
  if (rep) { ok = rep.summary.ok; err = rep.summary.totalErrors; }
  $('market-chips').innerHTML = rep ? chipRow([['ОК', ok, 'ok'], ['Ошибок', err, err ? 'err' : '']]) : '';

  const rows = state.showAll.market ? mk.rows : mk.rows.slice(0, SLICE);
  more.hidden = rows.length >= mk.rows.length;
  more.textContent = `Показать все ${mk.rows.length}`;
  table.innerHTML = '<thead><tr><th>№</th><th>Шифр</th><th>Наименование</th><th>Цена, руб</th><th>Статус сверки</th><th>Комментарий</th></tr></thead><tbody>' +
    rows.map(r => {
      const it = map.get(r.row);
      const st = it ? it.status : '';
      return `<tr class="${rowCls(st)}"><td class="code-cell">${r.row}</td><td class="code-cell">${esc(r.code)}</td><td>${esc(r.name)}</td>` +
        `<td class="num">${fmtNum(r.price)}</td>` +
        `<td class="status-cell">${badgeHtml(it ? it.status : '')}</td><td>${it ? esc(it.note) : ''}</td></tr>`;
    }).join('') + '</tbody>';
}

function renderPositionPages() {
  renderContractPage();
  renderActPage();
  renderMarketPage();
}

$('btn-contract-more').addEventListener('click', () => { state.showAll.contract = true; renderContractPage(); });
$('btn-act-more').addEventListener('click', () => { state.showAll.act = true; renderActPage(); });
$('btn-market-more').addEventListener('click', () => { state.showAll.market = true; renderMarketPage(); });

/* ── Утилиты ────────────────────────────────────────────────── */

function fmtNum(v) { return v == null ? '' : Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 2 }); }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

$('btn-export').addEventListener('click', () => {
  if (!state.report) { alert('Сначала выполните проверку.'); return; }
  if (state.report.kind === 'act') exportActReport(state.report.report, state.report.summary, state.report.tolerance);
  else exportMarketReport(state.report.report, state.report.summary, state.report.tolerance);
});

/* ── Восстановление последнего состояния ────────────────────── */

(async () => {
  for (const key of ['contract', 'act', 'market']) {
    const v = await kvGet(key);
    if (v) {
      state[key] = v;
      const label = key === 'contract' ? 'contract-status' : key + '-status';
      setStatus(label, `Загружено ранее: ${v.fileName} (${v.rows.length} позиций).`, 'success');
    }
  }
  for (const key of ['report-act', 'report-market']) {
    const v = await kvGet(key);
    if (v) {
      if (key === 'report-act') state.reportAct = v; else state.reportMarket = v;
      if (!state.report) state.report = v;
    }
  }
  renderPositionPages();
  renderStatusbar();
  if (state.report) renderReport();
})();
