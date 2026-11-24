/* Сверка КС-2 (Акт) с договором — паритет INSAFIN_Проверить_Акт_по_Договору (Module1:457) */
import { normalizeUnit, cleanVisibleText, normalizeComparisonCode, compactMatchText, tryParseNumber, isCommercialProposalCode, priceKey } from './norm.js?v=unit-compare-1';

const EPS = 1e-7;

// AddContractGroup (Module1:2335): [row, maxPrice, count, name, minPrice, prices]
export function addContractGroup(dict, key, row, price, displayName, displayRow = row) {
  const token = '|' + priceKey(price) + '|';
  if (!dict.has(key)) {
    dict.set(key, { row, displayRow, maxPrice: price, count: 1, name: displayName, minPrice: price, prices: token });
  } else {
    const g = dict.get(key);
    if (price > g.maxPrice) { g.row = row; g.displayRow = displayRow; g.maxPrice = price; g.name = displayName; }
    if (price < g.minPrice) g.minPrice = price;
    g.count += 1;
    if (!g.prices.includes(token)) g.prices += token.slice(1);
  }
}

function priceListContains(prices, value) {
  return prices.includes('|' + priceKey(value) + '|');
}

function priceListContainsTolerance(prices, value, tolerance) {
  return prices.split('|').some(p => {
    if (!p) return false;
    const { ok, value: listed } = tryParseNumber(p);
    return ok && Math.abs(listed - value) <= tolerance + EPS;
  });
}

function workNameKey(name) {
  // Пояснение об индексах в КС-2 добавлено к названию работы; в PDF его нет.
  return compactMatchText(name.replace(/\s*\(\s*письмо\s+пао.*$/i, ''));
}

function editDistanceWithin(a, b, limit = 2) {
  if (Math.abs(a.length - b.length) > limit) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let old = prev[0], best = prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, old + (a[i - 1] === b[j - 1] ? 0 : 1));
      old = current;
      best = Math.min(best, prev[j]);
    }
    if (best > limit) return false;
  }
  return prev[b.length] <= limit;
}

function materialKind(name) {
  const s = cleanVisibleText(name).toLowerCase();
  if (/^бентонит|^гранулы бентонитовые/u.test(s)) return 'бентонит';
  if (/^(?:био)?полимер/u.test(s)) return 'полимер';
  return null;
}

function unitFactor(from, to) {
  if (from === to) return 1;
  if (from === 'т' && to === 'кг') return 1 / 1000;
  if (from === 'кг' && to === 'т') return 1000;
  return null;
}

export function compareAct(contractRows, actRows, tolerance) {
  const dictCodeUnit = new Map(), dictExactName = new Map(), dictNameUnit = new Map(), dictCode = new Map(), dictNoUnitExact = new Map(), candidatesByCodeUnit = new Map(), materialCandidates = [];

  for (const c of contractRows) {
    const code = normalizeComparisonCode(c.code);
    const name = cleanVisibleText(c.name);
    const unit = normalizeUnit(c.unit);
    const p = tryParseNumber(c.price);
    if (code && !unit && name && p.ok) {
      // Some source rows genuinely have an empty unit cell. Keep them available
      // for an exact code-and-name match, without guessing a unit.
      addContractGroup(dictNoUnitExact, code + '|' + compactMatchText(name), c.row, p.value, name, c.printedRow ?? c.row);
    }
    if (code && unit && p.ok) {
      const keyCodeUnit = code + '|' + unit;
      if (!candidatesByCodeUnit.has(keyCodeUnit)) candidatesByCodeUnit.set(keyCodeUnit, []);
      candidatesByCodeUnit.get(keyCodeUnit).push({
        key: workNameKey(name),
        group: { row: c.row, displayRow: c.printedRow ?? c.row, maxPrice: p.value, minPrice: p.value, count: 1, name, prices: '|' + priceKey(p.value) + '|' },
      });
      const kind = materialKind(name);
      if (kind) materialCandidates.push({ kind, unit, row: c.row, printedRow: c.printedRow ?? c.row, price: p.value, name });
      addContractGroup(dictCodeUnit, keyCodeUnit, c.row, p.value, name, c.printedRow ?? c.row);
      addContractGroup(dictExactName, code + '|' + compactMatchText(name) + '|' + unit, c.row, p.value, name, c.printedRow ?? c.row);
      const keyNameUnit = compactMatchText(name) + '|' + unit;
      if (keyNameUnit !== '|') addContractGroup(dictNameUnit, keyNameUnit, c.row, p.value, name, c.printedRow ?? c.row);
      if (!dictCode.has(code)) dictCode.set(code, { row: c.row, displayRow: c.printedRow ?? c.row, maxPrice: p.value, count: 1, name, minPrice: p.value, prices: '|' + priceKey(p.value) + '|' });
    }
  }

  const report = [];
  const sum = { ok: 0, priceTooHigh: 0, codeNotFound: 0, unitMismatch: 0, priceUnreadable: 0, ambiguous: 0, missingCode: 0, missingUnit: 0, missingName: 0, totalErrors: 0 };

  for (const a of actRows) {
    const code = normalizeComparisonCode(a.code);
    const name = cleanVisibleText(a.name);
    const unit = normalizeUnit(a.unit);
    const p = tryParseNumber(a.price);

    let status = '', note = '', contract = null, matchedByName = false, nameMismatch = false, matchedUniqueName = false;

    if (!code) {
      status = 'ОТСУТСТВУЕТ ШИФР'; note = 'В позиции акта не заполнено обоснование / шифр расценки.'; sum.missingCode++;
    } else if (!unit) {
      status = 'ОТСУТСТВУЕТ ЕД. ИЗМ.'; note = 'В позиции акта не заполнена единица измерения.'; sum.missingUnit++;
    } else if (!name) {
      status = 'ОТСУТСТВУЕТ НАИМЕНОВАНИЕ'; note = 'В позиции акта не заполнено наименование работ или затрат.'; sum.missingName++;
    } else {
      const keyCodeUnit = code + '|' + unit;
      const keyExact = code + '|' + compactMatchText(name) + '|' + unit;
      const exactCandidates = (candidatesByCodeUnit.get(keyCodeUnit) || []).filter(x => x.key === workNameKey(name));
      const pricedCandidates = p.ok ? exactCandidates.filter(x => Math.abs(x.group.maxPrice - p.value) <= tolerance + EPS) : [];

      if (isCommercialProposalCode(code)) {
        const keyNameUnit = compactMatchText(name) + '|' + unit;
        const kpRows = candidatesByCodeUnit.get(keyCodeUnit) || [];
        const normalizedName = workNameKey(name);
        const close = kpRows.filter(x => x.key === normalizedName ||
          (normalizedName.length >= 80 && x.key.length >= 80 && editDistanceWithin(normalizedName, x.key)));
        let g = close.length === 1 ? close[0].group : dictNameUnit.get(keyNameUnit);
        if (!g) {
          // Расширенный подбор КП: в акте к наименованию часто добавлен суффикс
          // вида «(Письмо ПАО "Газпром" …)», в договоре — технический префикс
          // переноса («мм …»). Ищем единственную договорную позицию с той же
          // ед.изм., чьё наименование целиком содержится в наименовании акта
          // (или наоборот).
          let core = name;
          for (let prev = null; prev !== core;) { prev = core; core = core.replace(/\([^()]*\)/g, ' '); }
          const actCompact = compactMatchText(core);
          const seen = new Set();
          let first = null;
          for (const [key, group] of dictNameUnit) {
            const parts = key.split('|');
            const u = parts.pop();
            const cn = parts.join('|');
            if (u !== unit || !cn) continue;
            if (actCompact.includes(cn) || cn.includes(actCompact)) {
              if (!first) first = group;
              seen.add(group);
            }
          }
          if (seen.size === 1) g = first;
          else if (seen.size > 1) {
            // несколько кандидатов допустимы, если у них одинаковые цены
            const ranges = new Set([...seen].map(x => priceKey(x.minPrice) + ':' + priceKey(x.maxPrice)));
            if (ranges.size === 1) g = first;
          }
        }
        if (g) { contract = g; matchedByName = true; }
        else { status = 'ПОЗИЦИЯ КП НЕ НАЙДЕНА'; note = 'Позиция КП не найдена по наименованию и единице измерения. Номер КП при проверке не учитывается.'; sum.codeNotFound++; }
      } else if (exactCandidates.length === 1 || pricedCandidates.length === 1) {
        contract = (exactCandidates.length === 1 ? exactCandidates[0] : pricedCandidates[0]).group;
        matchedUniqueName = true;
      } else if (dictExactName.has(keyExact)) {
        contract = dictExactName.get(keyExact);
      } else if (dictCodeUnit.has(keyCodeUnit)) {
        contract = dictCodeUnit.get(keyCodeUnit);
        nameMismatch = true;
      } else if (dictNoUnitExact.has(code + '|' + compactMatchText(name))) {
        contract = dictNoUnitExact.get(code + '|' + compactMatchText(name));
        note = 'В договоре единица измерения не указана; строка сопоставлена по шифру и наименованию; ';
      } else if (dictCode.has(code)) {
        status = 'НЕ СОВПАДАЕТ ЕД. ИЗМ.'; note = 'Шифр найден в договоре, но единица измерения не совпала.'; sum.unitMismatch++;
      } else {
        const kind = materialKind(name);
        const candidates = kind ? materialCandidates.filter(c => {
          const factor = unitFactor(c.unit, unit);
          return c.kind === kind && factor != null;
        }) : [];
        if (candidates.length === 1) {
          const c = candidates[0], converted = c.price * unitFactor(c.unit, unit);
          contract = { row: c.row, displayRow: c.printedRow, maxPrice: converted, minPrice: converted, count: 1, name: c.name, prices: '|' + priceKey(converted) + '|' };
          note = `Материал сопоставлен по виду и наименованию; шифр договора отличается; цена договора пересчитана из ${c.unit} в ${a.unit}; `;
        } else {
          status = 'ШИФР НЕ НАЙДЕН'; note = 'Шифр из акта отсутствует в договорных единичных расценках.'; sum.codeNotFound++;
        }
      }

      if (contract) {
        const duplicates = contract.count;
        if (matchedByName) note = 'Позиция КП сопоставлена по наименованию и единице измерения; номер КП не учитывается; ';
        else if (matchedUniqueName && (dictCodeUnit.get(keyCodeUnit)?.count || 0) > 1) note = 'Строка договора выбрана по шифру, наименованию и единице измерения; ';
        else if (nameMismatch) note = 'Наименование отличается от договорного; ';

        if (!p.ok) {
          status = 'НЕ УДАЛОСЬ ОПРЕДЕЛИТЬ ЦЕНУ'; note += 'Цена в акте отсутствует или не распознана как число.'; sum.priceUnreadable++;
        } else if (p.value > contract.maxPrice + tolerance + EPS) {
          status = 'ЦЕНА ВЫШЕ ДОГОВОРНОЙ'; note += 'Цена в акте превышает максимальную подходящую договорную цену.'; sum.priceTooHigh++;
        } else if (contract.maxPrice - contract.minPrice > tolerance + EPS && p.value > contract.minPrice + tolerance + EPS && !priceListContains(contract.prices, p.value)) {
          status = 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ';
          note += 'В договоре найдено несколько подходящих строк с разными ценами; цена акта не совпадает ни с одной из них.';
          sum.ambiguous++;
        } else {
          status = 'ОК';
          note += contract.maxPrice - contract.minPrice > tolerance + EPS
            ? 'Цена соответствует одной из договорных цен либо не превышает минимальную цену среди дублей.'
            : 'Цена в акте меньше либо равна договорной цене.';
          sum.ok++;
        }
        contract = { ...contract, duplicates };
      }
    }

    if (status) {
      if (status !== 'ОК') sum.totalErrors++;
      report.push({
        actRow: a.row, code: a.code, name: a.name, unit: a.unit, actPrice: a.price, status, note,
        contractRow: contract ? contract.row : null,
        contractPrintedRow: contract ? contract.displayRow : null,
        contractPrice: contract ? contract.maxPrice : null,
        diff: contract && p.ok ? contract.maxPrice - p.value : null,
        duplicates: contract ? contract.duplicates : null,
      });
    }
  }

  return { report, summary: sum, tolerance };
}
