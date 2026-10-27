/* Экспорт отчёта о расхождениях в Excel */
import * as XLSX from '../vendor/xlsx.mjs';

export function exportActReport(report, summary, tolerance) {
  const rows = report.map(r => ({
    'Строка акта': r.actRow,
    'Шифр / обоснование': r.code,
    'Наименование в акте': r.name,
    'Ед. изм. в акте': r.unit,
    'Цена в акте': r.actPrice,
    'Статус': r.status,
    'Комментарий': r.note,
    'Строка договора': r.contractRow,
    'Цена по договору': r.contractPrice,
    'Разница: договор - акт': r.diff,
    'Дублей сочетания шифр+ед.изм.': r.duplicates,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Отчет');
  const sum = XLSX.utils.aoa_to_sheet([
    ['Сводка'], ['Правило цены', 'Цена в акте <= цена по договору'], ['Допуск округления', tolerance],
    ['ОК', summary.ok], ['Цена выше договорной', summary.priceTooHigh], ['Шифр не найден', summary.codeNotFound],
    ['Не совпадает ед. изм.', summary.unitMismatch], ['Цена не распознана', summary.priceUnreadable],
    ['Неоднозначный дубль', summary.ambiguous], ['Отсутствует шифр', summary.missingCode],
    ['Отсутствует ед. изм.', summary.missingUnit], ['Отсутствует наименование', summary.missingName],
    ['Всего ошибок', summary.totalErrors],
  ]);
  XLSX.utils.book_append_sheet(wb, sum, 'Сводка');
  XLSX.writeFile(wb, 'отчет_КС2_проверка.xlsx');
}

export function exportMarketReport(report, summary, tolerance) {
  const rows = report.map(r => ({
    'Строка МАРКЕТ': r.marketRow,
    'Шифр / обоснование': r.code,
    'Наименование МАРКЕТ': r.name,
    'Цена МАРКЕТ': r.marketPrice,
    'Статус': r.status,
    'Комментарий': r.note,
    'Строка договора': r.contractRow,
    'Наименование в договоре': r.contractName,
    'Цена по договору': r.contractPrice,
    'Разница: договор - МАРКЕТ': r.diff,
    'Дублей шифра в договоре': r.duplicates,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Отчет');
  const sum = XLSX.utils.aoa_to_sheet([
    ['Сводка'], ['Тип проверки', 'МАРКЕТ'], ['Правило цены', 'Цена МАРКЕТ = цена по договору'], ['Допуск округления', tolerance],
    ['ОК', summary.ok], ['Цена не равна договорной', summary.priceNotEqual], ['Шифр не найден', summary.codeNotFound],
    ['Цена не распознана', summary.priceUnreadable], ['Неоднозначный дубль', summary.ambiguous], ['Всего ошибок', summary.totalErrors],
  ]);
  XLSX.utils.book_append_sheet(wb, sum, 'Сводка');
  XLSX.writeFile(wb, 'отчет_МАРКЕТ_проверка.xlsx');
}
