import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from '../vendor/xlsx.mjs';
import { parseContractPdf } from '../js/pdf-contract.js';
import { parseActWorkbook } from '../js/xlsx-act.js';
import { compareAct } from '../js/compare-act.js';

// Local source files are supplied as arguments and never stored in the repo.
const [pdfPath, workbookPath, actPath] = process.argv.slice(2);
if (pdfPath && workbookPath && actPath) {
  const contract = await parseContractPdf(new Uint8Array(fs.readFileSync(pdfPath)));
  assert.equal(contract.meta.parserVersion, 7);
  assert.equal(contract.rows.length, 907);
  assert.equal(contract.rows.filter(r => r.code === 'КП').length, 51);
  contract.rows.forEach((row, index) => assert.equal(row.printedRow, index + 1));

  const workbook = XLSX.read(new Uint8Array(fs.readFileSync(workbookPath)), { type: 'array' });
  const sourceRows = XLSX.utils.sheet_to_json(workbook.Sheets['Договор'], { header: 1, defval: '' })
    .filter(row => row[0] && row[0] !== 'Итого' && typeof row[3] === 'number');
  const count = rows => {
    const result = new Map();
    for (const row of rows) {
      const key = `${row.code}|${Number(row.price).toFixed(2)}`;
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  };
  const parsed = count(contract.rows);
  for (const row of sourceRows) {
    const key = `${String(row[0]).trim()}|${Number(row[3]).toFixed(2)}`;
    const available = parsed.get(key) ?? 0;
    assert.ok(available > 0, `Missing source rate ${key}`);
    parsed.set(key, available - 1);
  }

  const act = parseActWorkbook(new Uint8Array(fs.readFileSync(actPath)));
  const result = compareAct(contract.rows, act.rows, 0.01);
  assert.equal(act.rows.length, 18);
  assert.equal(result.summary.ok, 18);
  assert.equal(result.summary.totalErrors, 0);
  console.log('Bare-КП contract: 907 numbered rates and 18 act rows verified.');
}
