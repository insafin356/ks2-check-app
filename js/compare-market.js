/* Сверка МАРКЕТ с договором — паритет INSAFIN_Проверить_МАРКЕТ_по_Договору (Module1:1455) */
import { normalizeText, normalizeComparisonCode, tryParseNumber, cleanVisibleText, priceKey } from './norm.js';
import { addContractGroup } from './compare-act.js';

const EPS = 1e-7;

function priceListContainsTolerance(prices, value, tolerance) {
  return prices.split('|').some(p => {
    if (!p) return false;
    const { ok, value: listed } = tryParseNumber(p);
    return ok && Math.abs(listed - value) <= tolerance + EPS;
  });
}

export function compareMarket(contractRows, marketRows, tolerance) {
  const dictCode = new Map(), dictCodeName = new Map();

  for (const c of contractRows) {
    const code = normalizeComparisonCode(c.code);
    const name = normalizeText(c.name);
    const p = tryParseNumber(c.price);
    if (code && p.ok) {
      addContractGroup(dictCode, code, c.row, p.value, cleanVisibleText(c.name));
      addContractGroup(dictCodeName, code + '|' + name, c.row, p.value, cleanVisibleText(c.name));
    }
  }

  const report = [];
  const sum = { ok: 0, priceNotEqual: 0, codeNotFound: 0, priceUnreadable: 0, ambiguous: 0, totalErrors: 0 };

  for (const m of marketRows) {
    const code = normalizeComparisonCode(m.code);
    const name = normalizeText(m.name);
    const p = tryParseNumber(m.price);

    let status = '', note = '', contract = null, nameMatched = false;

    if (code) {
      if (!dictCode.has(code)) {
        status = 'ШИФР НЕ НАЙДЕН'; note = 'Шифр из МАРКЕТ отсутствует в договорных единичных расценках.'; sum.codeNotFound++;
      } else {
        const codeInfo = dictCode.get(code);
        const keyCodeName = code + '|' + name;
        if (dictCodeName.has(keyCodeName)) { contract = dictCodeName.get(keyCodeName); nameMatched = true; }
        else { contract = codeInfo; note = 'Наименование отличается от договорного; '; }

        if (!p.ok) {
          status = 'НЕ УДАЛОСЬ ОПРЕДЕЛИТЬ ЦЕНУ'; note += 'Цена МАРКЕТ не распознана как число.'; sum.priceUnreadable++;
        } else if (priceListContainsTolerance(contract.prices, p.value, tolerance)) {
          status = 'ОК'; note += 'Цена МАРКЕТ равна договорной цене с учетом допуска округления.'; sum.ok++;
        } else if (contract.count > 1 && contract.maxPrice - contract.minPrice > tolerance + EPS) {
          status = 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ';
          note += 'Для подходящего шифра' + (nameMatched ? ' и наименования' : '') + ' в договоре найдено несколько разных цен; цена МАРКЕТ не совпадает ни с одной из них.';
          sum.ambiguous++;
        } else {
          status = 'ЦЕНА НЕ РАВНА ДОГОВОРНОЙ'; note += 'Цена МАРКЕТ не равна договорной цене.'; sum.priceNotEqual++;
        }
      }
    }

    if (status) {
      if (status !== 'ОК') sum.totalErrors++;
      report.push({
        marketRow: m.row, code: m.code, name: m.name, marketPrice: m.price, status, note,
        contractRow: contract ? contract.row : null,
        contractName: contract ? contract.name : null,
        contractPrice: contract ? contract.maxPrice : null,
        diff: contract && p.ok ? contract.maxPrice - p.value : null,
        duplicates: contract ? contract.count : null,
      });
    }
  }

  return { report, summary: sum, tolerance };
}
