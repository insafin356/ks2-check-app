/* Экспорт отчёта о расхождениях в Excel — вид как в VBA-макросе:
   заливка строки: ОК → RGB(226,239,218), ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ → RGB(255,235,156),
   прочее → RGB(255,230,230); сводка в столбцах O:P; шапка — синяя, жирная. */
const FILL_OK = 'E2EFDA';
const FILL_WARN = 'FFEB9C';
const FILL_ERR = 'FFE6E6';
const FILL_HEAD = 'DCE6F1';

function styleRow(ws, row, cols, fill) {
  for (let c = 1; c <= cols; c++) {
    const addr = XLSX.utils.encode_cell({ r: row, c: c - 1 });
    if (!ws[addr]) ws[addr] = { t: 'z' };
    ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: fill } } };
  }
}

function styleSummaryHead(ws) {
  for (let c = 14; c <= 15; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: FILL_HEAD } }, font: { bold: true }, alignment: { horizontal: 'center' } };
  }
}

function styleHeaderRow(ws, cols) {
  for (let c = 0; c < cols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: FILL_HEAD } }, font: { bold: true }, alignment: { horizontal: 'center' } };
  }
}

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

const PRICE_COLS_ACT = ['I', 'J'];
const PRICE_COLS_MARKET = ['I', 'J'];

function applyNumberFormat(ws, cols, rangeEnd) {
  for (const col of cols) {
    for (let r = 2; r <= rangeEnd; r++) {
      const addr = col + r;
      if (ws[addr] && ws[addr].t === 'n') ws[addr].z = '#,##0.00';
    }
  }
}

export function exportActReport(report, summary, tolerance) {
  const headers = ['Строка акта', 'Шифр / обоснование', 'Наименование в акте', 'Ед. изм. в акте', 'Цена в акте', 'Статус', 'Комментарий', 'Строка договора', 'Цена по договору', 'Разница: договор - акт', 'Дублей сочетания шифр+ед.изм.'];
  const data = report.map(r => [
    r.actRow, r.code, r.name, r.unit, r.actPrice, r.status, r.note,
    r.contractRow, r.contractPrice, r.diff, r.duplicates,
  ]);
  const aoa = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let i = 0; i < report.length; i++) {
    const st = report[i].status;
    const fill = st === 'ОК' ? FILL_OK : (st === 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ' ? FILL_WARN : FILL_ERR);
    styleRow(ws, i + 1, headers.length, fill);
  }

  const sumAoa = [
    ['Сводка', null],
    ['Правило цены', 'Цена в акте <= цена по договору'],
    ['Допуск округления', tolerance],
    ['ОК', summary.ok],
    ['Цена выше договорной', summary.priceTooHigh],
    ['Шифр не найден', summary.codeNotFound],
    ['Не совпадает ед. изм.', summary.unitMismatch],
    ['Цена не распознана', summary.priceUnreadable],
    ['Неоднозначный дубль', summary.ambiguous],
    ['Отсутствует шифр', summary.missingCode],
    ['Отсутствует ед. изм.', summary.missingUnit],
    ['Отсутствует наименование', summary.missingName],
    ['Всего ошибок', summary.totalErrors],
  ];
  for (let r = 0; r < sumAoa.length; r++) {
    for (let c = 0; c < 2; c++) {
      const v = sumAoa[r][c];
      if (v === undefined) continue;
      const addr = XLSX.utils.encode_cell({ r, c: c + 14 });
      ws[addr] = { t: typeof v === 'number' ? 'n' : 's', v };
    }
  }
  styleSummaryHead(ws);
  styleHeaderRow(ws, headers.length);
  setColWidths(ws, [10, 20, 60, 10, 14, 28, 48, 14, 16, 18, 12]);
  applyNumberFormat(ws, PRICE_COLS_ACT, data.length + 1);
  ws['!autofilter'] = { ref: 'A1:' + XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Отчет');
  XLSX.writeFile(wb, 'отчет_КС2_проверка.xlsx');
}

export function exportMarketReport(report, summary, tolerance) {
  const headers = ['Строка МАРКЕТ', 'Шифр / обоснование', 'Наименование МАРКЕТ', 'Цена МАРКЕТ', 'Статус', 'Комментарий', 'Строка договора', 'Наименование в договоре', 'Цена по договору', 'Разница: договор - МАРКЕТ', 'Дублей шифра в договоре'];
  const data = report.map(r => [
    r.marketRow, r.code, r.name, r.marketPrice, r.status, r.note,
    r.contractRow, r.contractName, r.contractPrice, r.diff, r.duplicates,
  ]);
  const aoa = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let i = 0; i < report.length; i++) {
    const st = report[i].status;
    const fill = st === 'ОК' ? FILL_OK : (st === 'ТРЕБУЕТ ПРОВЕРКИ ДУБЛЯ' ? FILL_WARN : FILL_ERR);
    styleRow(ws, i + 1, headers.length, fill);
  }

  const sumAoa = [
    ['Сводка', null],
    ['Тип проверки', 'МАРКЕТ'],
    ['Правило цены', 'Цена МАРКЕТ = цена по договору'],
    ['Допуск округления', tolerance],
    ['ОК', summary.ok],
    ['Цена не равна договорной', summary.priceNotEqual],
    ['Шифр не найден', summary.codeNotFound],
    ['Цена не распознана', summary.priceUnreadable],
    ['Неоднозначный дубль', summary.ambiguous],
    ['Всего ошибок', summary.totalErrors],
  ];
  for (let r = 0; r < sumAoa.length; r++) {
    for (let c = 0; c < 2; c++) {
      const v = sumAoa[r][c];
      if (v === undefined) continue;
      const addr = XLSX.utils.encode_cell({ r, c: c + 14 });
      ws[addr] = { t: typeof v === 'number' ? 'n' : 's', v };
    }
  }
  styleSummaryHead(ws);
  styleHeaderRow(ws, headers.length);
  setColWidths(ws, [13, 20, 60, 14, 28, 48, 14, 60, 16, 20, 12]);
  applyNumberFormat(ws, PRICE_COLS_MARKET, data.length + 1);
  ws['!autofilter'] = { ref: 'A1:' + XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Отчет');
  XLSX.writeFile(wb, 'отчет_МАРКЕТ_проверка.xlsx');
}
