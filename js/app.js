/* Точка входа: вкладки, загрузка файлов, проверки, отчёт */
import { parseContractPdf } from './pdf-contract.js';
import { parseActWorkbook } from './xlsx-act.js';
import { parseMarketWorkbook } from './xlsx-market.js';
import { compareAct } from './compare-act.js';
import { compareMarket } from './compare-market.js';
import { exportActReport, exportMarketReport } from './report-export.js';
import { kvSet, kvGet, historyAdd } from './store.js';

const $ = id => document.getElementById(id);

let state = {
  contract: null,   // { rows, meta, fileName }
  act: null,
  market: null,
  report: null,     // { kind: 'act'|'market', report, summary, tolerance }
};

const tabs = $('tabs');
tabs.addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + btn.dataset.tab));
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

/* Загрузка договора */
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
    await kvSet('contract', { rows, meta, fileName: file.name });
    setProgress('contract-progress', null);
    setStatus('contract-status', `Загружено ${rows.length} договорных расценок СМР (страницы ${meta.startPage}–${meta.endPage}${meta.appendix ? ', приложение ' + meta.appendix : ''}).`, 'success');
    $('contract-meta').textContent = `Файл: ${file.name}\nВсего страниц PDF: ${meta.pages}`;
    gotoTab('act');
  } catch (err) {
    setProgress('contract-progress', null);
    setStatus('contract-status', 'Не удалось загрузить договор из PDF.\n' + err.message, 'error');
  }
});

/* Загрузка КС-2 */
$('file-act').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('act-status', 'Разбор Excel...');
  try {
    const parsed = parseActWorkbook(await readFile(file));
    state.act = { ...parsed, fileName: file.name };
    await kvSet('act', state.act);
    setStatus('act-status', `Акт загружен: ${parsed.rows.length} позиций (лист «${parsed.meta.sheet}»), пропущено строк: ${parsed.meta.skipped}.`, 'success');
    $('act-meta').textContent = `Колонки: обоснование — ${parsed.meta.cols.code}, наименование — ${parsed.meta.cols.name}, ед.изм. — ${parsed.meta.cols.unit}, цена — ${parsed.meta.cols.price}; строка заголовков: ${parsed.meta.headerRow}`;
  } catch (err) {
    setStatus('act-status', 'Ошибка загрузки акта: ' + err.message, 'error');
  }
});

/* Загрузка МАРКЕТ */
$('file-market').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('market-status', 'Разбор Excel...');
  try {
    const parsed = parseMarketWorkbook(await readFile(file));
    state.market = { ...parsed, fileName: file.name };
    await kvSet('market', state.market);
    setStatus('market-status', `МАРКЕТ загружен: ${parsed.rows.length} позиций (лист «${parsed.meta.sheet}»), пропущено строк: ${parsed.meta.skipped}.`, 'success');
  } catch (err) {
    setStatus('market-status', 'Ошибка загрузки МАРКЕТ: ' + err.message, 'error');
  }
});

/* Проверки */
async function runCheck(kind) {
  if (kind === 'act' && !state.contract) { alert('Сначала загрузите договор из PDF.'); gotoTab('contract'); return; }
  if (kind === 'act' && !state.act) { alert('Сначала загрузите файл КС-2.'); return; }
  if (kind === 'market' && !state.contract) { alert('Сначала загрузите договор из PDF.'); gotoTab('contract'); return; }
  if (kind === 'market' && !state.market) { alert('Сначала загрузите файл МАРКЕТ.'); return; }

  const tolerance = parseFloat($('tolerance').value) || 0;
  const res = kind === 'act'
    ? compareAct(state.contract.rows, state.act.rows, tolerance)
    : compareMarket(state.contract.rows, state.market.rows, tolerance);
  state.report = { kind, ...res, tolerance };
  await historyAdd({ kind, tolerance, ok: res.summary.ok, errors: res.summary.totalErrors, contract: state.contract.fileName });
  renderReport();
  gotoTab('report');
}
$('btn-check-act').addEventListener('click', () => runCheck('act'));
$('btn-check-market').addEventListener('click', () => runCheck('market'));

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
  if (!state.report) return;
  const { kind, report, summary, tolerance } = state.report;
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
      const cls = r.status === 'ОК' ? 'status-ok' : r.status === 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ' ? 'status-warn' : 'status-err';
      return `<tr class="${cls}">` + cols.map(([, get, cls2]) => `<td${cls2 ? ` class="${cls2}"` : ''}>${esc(get(r))}</td>`).join('') + '</tr>';
    }).join('') + '</tbody>';
}
$('status-filter').addEventListener('change', renderReport);

function fmtNum(v) { return v == null ? '' : Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 2 }); }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

$('btn-export').addEventListener('click', () => {
  if (!state.report) { alert('Сначала выполните проверку.'); return; }
  if (state.report.kind === 'act') exportActReport(state.report.report, state.report.summary, state.report.tolerance);
  else exportMarketReport(state.report.report, state.report.summary, state.report.tolerance);
});

/* Восстановление последнего состояния */
(async () => {
  for (const key of ['contract', 'act', 'market']) {
    const v = await kvGet(key);
    if (v) { state[key] = v; setStatus(key + '-status', `Загружено ранее: ${v.fileName} (${v.rows.length} позиций).`, 'success'); }
  }
})();
