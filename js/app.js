/* РўРѕС‡РєР° РІС…РѕРґР°: РІРєР»Р°РґРєРё, Р·Р°РіСЂСѓР·РєР° С„Р°Р№Р»РѕРІ, РїСЂРѕРІРµСЂРєРё, СЃС‚СЂР°РЅРёС†С‹ РїРѕР·РёС†РёР№, РѕС‚С‡С‘С‚ */
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
  report: null,     // РїРѕСЃР»РµРґРЅРёР№ РѕС‚С‡С‘С‚ РґР»СЏ РІРєР»Р°РґРєРё В«РћС‚С‡РµС‚В»: { kind, report, summary, tolerance }
  reportAct: null,  // СЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РѕС‚С‡С‘С‚С‹ РґР»СЏ СЃС‚Р°С‚СѓСЃРѕРІ РЅР° СЃС‚СЂР°РЅРёС†Р°С… РїРѕР·РёС†РёР№
  reportMarket: null,
  showAll: { contract: false, act: false, market: false },
};

/* в”Ђв”Ђ РўРµРјР° в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

const savedTheme = localStorage.getItem('theme');
let theme = savedTheme || 'dark';
applyTheme(theme);
function applyTheme(t) {
  theme = t;
  document.documentElement.dataset.theme = t;
  $('theme-toggle').textContent = t === 'dark' ? 'РЎРІРµС‚Р»Р°СЏ С‚РµРјР°' : 'РўС‘РјРЅР°СЏ С‚РµРјР°';
}
$('theme-toggle').addEventListener('click', () => {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
  localStorage.setItem('theme', theme);
});

/* в”Ђв”Ђ Р’РєР»Р°РґРєРё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

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

/* в”Ђв”Ђ РЎС‚Р°С‚СѓСЃРЅР°СЏ СЃС‚СЂРѕРєР° РІ С€Р°РїРєРµ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

function renderStatusbar() {
  const el = $('statusbar');
  const parts = [];
  if (state.contract) {
    const m = state.contract.meta;
    parts.push(`Р”РћР“РћР’РћР : ${esc(state.contract.fileName)}`);
    parts.push(`${state.contract.rows.length} Р РђРЎР¦Р•РќРћРљ В· РЎРўР . ${m.startPage}вЂ“${m.endPage}`);
  }
  if (state.reportAct) parts.push(`<b class="${state.reportAct.summary.totalErrors ? 'bad' : 'good'}">РљРЎ-2: ${state.reportAct.summary.ok}/${state.reportAct.summary.ok + state.reportAct.summary.totalErrors}</b>`);
  if (state.reportMarket) parts.push(`<b class="${state.reportMarket.summary.totalErrors ? 'bad' : 'good'}">РњРђР РљР•Рў: ${state.reportMarket.summary.ok}/${state.reportMarket.summary.ok + state.reportMarket.summary.totalErrors}</b>`);
  if (!parts.length) { el.hidden = true; return; }
  el.innerHTML = parts.map(escKeepTags).join(' В· ');
  el.hidden = false;
}
// СЃС‚Р°С‚СѓСЃС‹ СЃРѕРґРµСЂР¶Р°С‚ Р±РµР·РѕРїР°СЃРЅС‹Рµ С‚РµРіРё <b>, РѕСЃС‚Р°Р»СЊРЅРѕРµ СЌРєСЂР°РЅРёСЂСѓРµРј Р·Р°СЂР°РЅРµРµ
function escKeepTags(s) { return s; }

/* в”Ђв”Ђ Р‘РµР№РґР¶Рё СЃС‚Р°С‚СѓСЃРѕРІ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

const BADGE_CLS = { 'РћРљ': 'ok', 'РўР Р•Р‘РЈР•Рў РџР РћР’Р•Р РљР Р”РЈР‘Р›РЇ': 'warn' };
function badgeHtml(status) {
  if (!status) return '<span class="badge dim">вЂ”</span>';
  return `<span class="badge ${BADGE_CLS[status] || 'err'}">${esc(status)}</span>`;
}
function rowCls(status) {
  return status === 'РћРљ' ? 'row-ok' : status === 'РўР Р•Р‘РЈР•Рў РџР РћР’Р•Р РљР Р”РЈР‘Р›РЇ' ? 'row-warn' : status ? 'row-err' : '';
}

/* в”Ђв”Ђ Р—Р°РіСЂСѓР·РєР° РґРѕРіРѕРІРѕСЂР° в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

$('file-contract').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('contract-status', 'Р Р°Р·Р±РѕСЂ PDF...', '');
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
    setStatus('contract-status', `Р—Р°РіСЂСѓР¶РµРЅРѕ ${rows.length} РґРѕРіРѕРІРѕСЂРЅС‹С… СЂР°СЃС†РµРЅРѕРє РЎРњР  (СЃС‚СЂР°РЅРёС†С‹ ${meta.startPage}вЂ“${meta.endPage}).`, 'success');
    $('contract-meta').textContent = `Р’СЃРµРіРѕ СЃС‚СЂР°РЅРёС† PDF: ${meta.pages}`;
    renderPositionPages();
    renderStatusbar();
    gotoTab('contract');
  } catch (err) {
    setProgress('contract-progress', null);
    setStatus('contract-status', 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґРѕРіРѕРІРѕСЂ РёР· PDF.\n' + err.message, 'error');
  }
});

/* в”Ђв”Ђ Р—Р°РіСЂСѓР·РєР° РљРЎ-2 в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

$('file-act').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('act-status', 'Р Р°Р·Р±РѕСЂ Excel...');
  try {
    const parsed = parseActWorkbook(await readFile(file));
    state.act = { ...parsed, fileName: file.name };
    await kvSet('act', state.act);
    setStatus('act-status', `РђРєС‚ Р·Р°РіСЂСѓР¶РµРЅ: ${parsed.rows.length} РїРѕР·РёС†РёР№ (Р»РёСЃС‚ В«${parsed.meta.sheet}В»), РїСЂРѕРїСѓС‰РµРЅРѕ СЃС‚СЂРѕРє: ${parsed.meta.skipped}.`, 'success');
    $('act-meta').textContent = `РљРѕР»РѕРЅРєРё: РѕР±РѕСЃРЅРѕРІР°РЅРёРµ вЂ” ${parsed.meta.cols.code}, РЅР°РёРјРµРЅРѕРІР°РЅРёРµ вЂ” ${parsed.meta.cols.name}, РµРґ.РёР·Рј. вЂ” ${parsed.meta.cols.unit}, С†РµРЅР° вЂ” ${parsed.meta.cols.price}; РїРµСЂРІР°СЏ СЃС‚СЂРѕРєР° РґР°РЅРЅС‹С…: ${parsed.meta.headerRow}`;
    renderPositionPages();
    renderStatusbar();
  } catch (err) {
    setStatus('act-status', 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё Р°РєС‚Р°: ' + err.message, 'error');
  }
});

/* в”Ђв”Ђ Р—Р°РіСЂСѓР·РєР° РњРђР РљР•Рў в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

$('file-market').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('market-status', 'Р Р°Р·Р±РѕСЂ Excel...');
  try {
    const parsed = parseMarketWorkbook(await readFile(file));
    state.market = { ...parsed, fileName: file.name };
    await kvSet('market', state.market);
    setStatus('market-status', `РњРђР РљР•Рў Р·Р°РіСЂСѓР¶РµРЅ: ${parsed.rows.length} РїРѕР·РёС†РёР№ (Р»РёСЃС‚ В«${parsed.meta.sheet}В»), РїСЂРѕРїСѓС‰РµРЅРѕ СЃС‚СЂРѕРє: ${parsed.meta.skipped}.`, 'success');
    renderPositionPages();
    renderStatusbar();
  } catch (err) {
    setStatus('market-status', 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РњРђР РљР•Рў: ' + err.message, 'error');
  }
});

/* в”Ђв”Ђ РџСЂРѕРІРµСЂРєРё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

async function runCheck(kind) {
  if (!state.contract) { alert('РЎРЅР°С‡Р°Р»Р° Р·Р°РіСЂСѓР·РёС‚Рµ РґРѕРіРѕРІРѕСЂ РёР· PDF.'); gotoTab('check'); return; }
  if (kind === 'act' && !state.act) { alert('РЎРЅР°С‡Р°Р»Р° Р·Р°РіСЂСѓР·РёС‚Рµ С„Р°Р№Р» РљРЎ-2.'); return; }
  if (kind === 'market' && !state.market) { alert('РЎРЅР°С‡Р°Р»Р° Р·Р°РіСЂСѓР·РёС‚Рµ С„Р°Р№Р» РњРђР РљР•Рў.'); return; }

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

/* в”Ђв”Ђ Р’РєР»Р°РґРєР° В«РћС‚С‡РµС‚В» в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

const CHIP_KEYS_ACT = [
  ['РћРљ', 'ok'], ['Р¦РµРЅР° РІС‹С€Рµ РґРѕРіРѕРІРѕСЂРЅРѕР№', 'priceTooHigh'], ['РЁРёС„СЂ РЅРµ РЅР°Р№РґРµРЅ', 'codeNotFound'],
  ['РќРµ СЃРѕРІРїР°РґР°РµС‚ РµРґ. РёР·Рј.', 'unitMismatch'], ['Р¦РµРЅР° РЅРµ СЂР°СЃРїРѕР·РЅР°РЅР°', 'priceUnreadable'],
  ['РќРµРѕРґРЅРѕР·РЅР°С‡РЅС‹Р№ РґСѓР±Р»СЊ', 'ambiguous'], ['РћС‚СЃСѓС‚СЃС‚РІСѓРµС‚ С€РёС„СЂ', 'missingCode'],
  ['РћС‚СЃСѓС‚СЃС‚РІСѓРµС‚ РµРґ. РёР·Рј.', 'missingUnit'], ['РћС‚СЃСѓС‚СЃС‚РІСѓРµС‚ РЅР°РёРјРµРЅРѕРІР°РЅРёРµ', 'missingName'], ['Р’СЃРµРіРѕ РѕС€РёР±РѕРє', 'totalErrors'],
];
const CHIP_KEYS_MARKET = [
  ['РћРљ', 'ok'], ['Р¦РµРЅР° РЅРµ СЂР°РІРЅР° РґРѕРіРѕРІРѕСЂРЅРѕР№', 'priceNotEqual'], ['РЁРёС„СЂ РЅРµ РЅР°Р№РґРµРЅ', 'codeNotFound'],
  ['Р¦РµРЅР° РЅРµ СЂР°СЃРїРѕР·РЅР°РЅР°', 'priceUnreadable'], ['РќРµРѕРґРЅРѕР·РЅР°С‡РЅС‹Р№ РґСѓР±Р»СЊ', 'ambiguous'], ['Р’СЃРµРіРѕ РѕС€РёР±РѕРє', 'totalErrors'],
];

function renderReport() {
  const rep = state.report;
  if (!rep) return;
  const { kind, report, summary, tolerance } = rep;
  $('empty-state').style.display = 'none';
  $('report-table').style.display = '';
  const chips = kind === 'act' ? CHIP_KEYS_ACT : CHIP_KEYS_MARKET;
  $('summary').innerHTML =
    `<span class="chip">РџСЂР°РІРёР»Рѕ С†РµРЅС‹: ${kind === 'act' ? 'С†РµРЅР° РІ Р°РєС‚Рµ &lt;= С†РµРЅР° РїРѕ РґРѕРіРѕРІРѕСЂСѓ' : 'С†РµРЅР° РњРђР РљР•Рў = С†РµРЅР° РїРѕ РґРѕРіРѕРІРѕСЂСѓ'}</span>` +
    `<span class="chip">Р”РѕРїСѓСЃРє: ${tolerance}</span>` +
    chips.map(([label, key]) => `<span class="chip ${key === 'ok' ? 'ok' : key === 'totalErrors' ? 'err' : ''}">${label}: ${summary[key] ?? 0}</span>`).join('');

  const filter = $('status-filter').value;
  const visible = report.filter(r => !filter || r.status === filter);
  const cols = kind === 'act'
    ? [['РЎС‚СЂРѕРєР° Р°РєС‚Р°', r => r.actRow], ['РЁРёС„СЂ', r => r.code], ['РќР°РёРјРµРЅРѕРІР°РЅРёРµ РІ Р°РєС‚Рµ', r => r.name], ['Р•Рґ. РёР·Рј.', r => r.unit],
       ['Р¦РµРЅР° РІ Р°РєС‚Рµ', r => fmtNum(r.actPrice), 'num'], ['РЎС‚Р°С‚СѓСЃ', r => r.status], ['РљРѕРјРјРµРЅС‚Р°СЂРёР№', r => r.note],
       ['РЎС‚СЂРѕРєР° РґРѕРіРѕРІРѕСЂР°', r => r.contractRow], ['Р¦РµРЅР° РїРѕ РґРѕРіРѕРІРѕСЂСѓ', r => fmtNum(r.contractPrice), 'num'],
       ['Р Р°Р·РЅРёС†Р°', r => fmtNum(r.diff), 'num'], ['Р”СѓР±Р»РµР№', r => r.duplicates]]
    : [['РЎС‚СЂРѕРєР° РњРђР РљР•Рў', r => r.marketRow], ['РЁРёС„СЂ', r => r.code], ['РќР°РёРјРµРЅРѕРІР°РЅРёРµ РњРђР РљР•Рў', r => r.name],
       ['Р¦РµРЅР° РњРђР РљР•Рў', r => fmtNum(r.marketPrice), 'num'], ['РЎС‚Р°С‚СѓСЃ', r => r.status], ['РљРѕРјРјРµРЅС‚Р°СЂРёР№', r => r.note],
       ['РЎС‚СЂРѕРєР° РґРѕРіРѕРІРѕСЂР°', r => r.contractRow], ['РќР°РёРјРµРЅРѕРІР°РЅРёРµ РІ РґРѕРіРѕРІРѕСЂРµ', r => r.contractName],
       ['Р¦РµРЅР° РїРѕ РґРѕРіРѕРІРѕСЂСѓ', r => fmtNum(r.contractPrice), 'num'], ['Р Р°Р·РЅРёС†Р°', r => fmtNum(r.diff), 'num'], ['Р”СѓР±Р»РµР№', r => r.duplicates]];

  const table = $('report-table');
  table.innerHTML = '<thead><tr>' + cols.map(([h]) => `<th>${h}</th>`).join('') + '</tr></thead>' +
    '<tbody>' + visible.map(r => {
      const cls = rowCls(r.status);
      return `<tr class="${cls}">` + cols.map(([h, get, cls2]) => {
        if (h === 'РЎС‚Р°С‚СѓСЃ') return `<td class="status-cell">${badgeHtml(r.status)}</td>`;
        if (h === 'РЁРёС„СЂ') return `<td class="code-cell">${esc(get(r))}</td>`;
        return `<td${cls2 ? ` class="${cls2}"` : ''}>${esc(get(r))}</td>`;
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
}
$('status-filter').addEventListener('change', renderReport);

/* в”Ђв”Ђ РЎС‚СЂР°РЅРёС†С‹ РїРѕР·РёС†РёР№: Р”РѕРіРѕРІРѕСЂ / РљРЎ-2 / РњРђР РљР•Рў в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

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
  $('contract-info').innerHTML = '<h3>РЎРІРµРґРµРЅРёСЏ Рѕ РґРѕРіРѕРІРѕСЂРµ</h3><dl>' +
    `<div><dt>Р¤Р°Р№Р»</dt><dd>${esc(c.fileName)}</dd></div>` +
    `<div><dt>Р’СЃРµРіРѕ СЃС‚СЂР°РЅРёС† PDF</dt><dd>${m.pages}</dd></div>` +
    `<div><dt>РЎС‚СЂР°РЅРёС†С‹ РїСЂРёР»РѕР¶РµРЅРёСЏ СЂР°СЃС†РµРЅРѕРє</dt><dd>${m.startPage}вЂ“${m.endPage}</dd></div>` +
    `<div><dt>Р Р°СЃРїРѕР·РЅР°РЅРѕ СЂР°СЃС†РµРЅРѕРє</dt><dd>${c.rows.length}</dd></div></dl>`;

  const actMap = statusMapOf(state.reportAct, 'contractRow');
  const mktMap = statusMapOf(state.reportMarket, 'contractRow');
  let actMentioned = 0, mktMentioned = 0;
  for (const r of c.rows) { if (actMap.has(r.row)) actMentioned++; if (mktMap.has(r.row)) mktMentioned++; }
  $('contract-chips').innerHTML = chipRow([
    ['Р’СЃРµРіРѕ СЃС‚СЂРѕРє', c.rows.length],
    ['РЈРїРѕРјСЏРЅСѓС‚С‹ РљРЎ-2', actMentioned, actMentioned ? 'ok' : ''],
    ['РЈРїРѕРјСЏРЅСѓС‚С‹ РњРђР РљР•Рў', mktMentioned, mktMentioned ? 'ok' : ''],
    ['Р‘РµР· СѓРїРѕРјРёРЅР°РЅРёР№', c.rows.length - new Set([...actMap.keys(), ...mktMap.keys()].filter(k => k != null)).size],
  ]);

  const rows = state.showAll.contract ? c.rows : c.rows.slice(0, SLICE);
  more.hidden = rows.length >= c.rows.length;
  more.textContent = `РџРѕРєР°Р·Р°С‚СЊ РІСЃРµ ${c.rows.length}`;
  table.innerHTML = '<thead><tr><th>в„–</th><th>РЁРёС„СЂ</th><th>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</th><th>Р•Рґ. РёР·Рј.</th><th>Р¦РµРЅР°, СЂСѓР±</th><th>РљРЎ-2</th><th>РњРђР РљР•Рў</th></tr></thead><tbody>' +
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
  $('act-info').innerHTML = '<h3>РЎРІРµРґРµРЅРёСЏ Рѕ РљРЎ-2</h3><dl>' +
    `<div><dt>Р¤Р°Р№Р»</dt><dd>${esc(a.fileName)}</dd></div>` +
    `<div><dt>Р›РёСЃС‚</dt><dd>${esc(m.sheet)}</dd></div>` +
    `<div><dt>РљРѕР»РѕРЅРєРё (РѕР±РѕСЃРЅРѕРІР°РЅРёРµ/РЅР°РёРјРµРЅРѕРІР°РЅРёРµ/РµРґ./С†РµРЅР°)</dt><dd>${m.cols.code} / ${m.cols.name} / ${m.cols.unit} / ${m.cols.price}</dd></div>` +
    `<div><dt>РџРµСЂРІР°СЏ СЃС‚СЂРѕРєР° РґР°РЅРЅС‹С…</dt><dd>${m.headerRow}</dd></div>` +
    `<div><dt>Р—Р°РіСЂСѓР¶РµРЅРѕ РїРѕР·РёС†РёР№</dt><dd>${a.rows.length}</dd></div>` +
    `<div><dt>РџСЂРѕРїСѓС‰РµРЅРѕ СЃС‚СЂРѕРє</dt><dd>${m.skipped}</dd></div></dl>`;

  const rep = state.reportAct;
  $('act-hint').hidden = !!rep;
  const map = statusMapOf(rep, 'actRow');
  let ok = 0, err = 0;
  if (rep) { ok = rep.summary.ok; err = rep.summary.totalErrors; }
  $('act-chips').innerHTML = rep ? chipRow([['РћРљ', ok, 'ok'], ['РћС€РёР±РѕРє', err, err ? 'err' : '']]) : '';

  const rows = state.showAll.act ? a.rows : a.rows.slice(0, SLICE);
  more.hidden = rows.length >= a.rows.length;
  more.textContent = `РџРѕРєР°Р·Р°С‚СЊ РІСЃРµ ${a.rows.length}`;
  table.innerHTML = '<thead><tr><th>в„–</th><th>РЁРёС„СЂ</th><th>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</th><th>Р•Рґ. РёР·Рј.</th><th>Р¦РµРЅР°, СЂСѓР±</th><th>РЎС‚Р°С‚СѓСЃ СЃРІРµСЂРєРё</th><th>РљРѕРјРјРµРЅС‚Р°СЂРёР№</th></tr></thead><tbody>' +
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
  $('market-info').innerHTML = '<h3>РЎРІРµРґРµРЅРёСЏ Рѕ РњРђР РљР•Рў</h3><dl>' +
    `<div><dt>Р¤Р°Р№Р»</dt><dd>${esc(mk.fileName)}</dd></div>` +
    `<div><dt>Р›РёСЃС‚</dt><dd>${esc(m.sheet)}</dd></div>` +
    `<div><dt>РљРѕР»РѕРЅРєРё (С€РёС„СЂ/РЅР°РёРјРµРЅРѕРІР°РЅРёРµ/С†РµРЅР°)</dt><dd>${m.cols.code} / ${m.cols.name} / ${m.cols.price}</dd></div>` +
    `<div><dt>Р—Р°РіСЂСѓР¶РµРЅРѕ РїРѕР·РёС†РёР№</dt><dd>${mk.rows.length}</dd></div>` +
    `<div><dt>РџСЂРѕРїСѓС‰РµРЅРѕ СЃС‚СЂРѕРє</dt><dd>${m.skipped}</dd></div></dl>`;

  const rep = state.reportMarket;
  $('market-hint').hidden = !!rep;
  const map = statusMapOf(rep, 'marketRow');
  let ok = 0, err = 0;
  if (rep) { ok = rep.summary.ok; err = rep.summary.totalErrors; }
  $('market-chips').innerHTML = rep ? chipRow([['РћРљ', ok, 'ok'], ['РћС€РёР±РѕРє', err, err ? 'err' : '']]) : '';

  const rows = state.showAll.market ? mk.rows : mk.rows.slice(0, SLICE);
  more.hidden = rows.length >= mk.rows.length;
  more.textContent = `РџРѕРєР°Р·Р°С‚СЊ РІСЃРµ ${mk.rows.length}`;
  table.innerHTML = '<thead><tr><th>в„–</th><th>РЁРёС„СЂ</th><th>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</th><th>Р¦РµРЅР°, СЂСѓР±</th><th>РЎС‚Р°С‚СѓСЃ СЃРІРµСЂРєРё</th><th>РљРѕРјРјРµРЅС‚Р°СЂРёР№</th></tr></thead><tbody>' +
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

/* в”Ђв”Ђ РЈС‚РёР»РёС‚С‹ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

function fmtNum(v) { return v == null ? '' : Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 2 }); }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

$('btn-export').addEventListener('click', () => {
  if (!state.report) { alert('РЎРЅР°С‡Р°Р»Р° РІС‹РїРѕР»РЅРёС‚Рµ РїСЂРѕРІРµСЂРєСѓ.'); return; }
  if (state.report.kind === 'act') exportActReport(state.report.report, state.report.summary, state.report.tolerance);
  else exportMarketReport(state.report.report, state.report.summary, state.report.tolerance);
});

/* в”Ђв”Ђ Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїРѕСЃР»РµРґРЅРµРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

(async () => {
  for (const key of ['contract', 'act', 'market']) {
    const v = await kvGet(key);
    if (v) {
      state[key] = v;
      const label = key === 'contract' ? 'contract-status' : key + '-status';
      setStatus(label, `Р—Р°РіСЂСѓР¶РµРЅРѕ СЂР°РЅРµРµ: ${v.fileName} (${v.rows.length} РїРѕР·РёС†РёР№).`, 'success');
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

