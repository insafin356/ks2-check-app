import { parseContractPdf } from '../js/pdf-contract.js';
import fs from 'fs';
import path from 'path';
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const c = await parseContractPdf(new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))));
const q = t => c.rows.filter(r => (r.name + ' ' + r.code).toLowerCase().includes(t));
for (const t of ['101-9410', '09-05-003', '24-02-005']) {
  const rs = q(t);
  console.log('###', t, rs.length);
  rs.slice(0, 6).forEach(r => console.log(' ', JSON.stringify({ row: r.row, code: r.code, unit: r.unit, price: r.price, name: r.name.slice(0, 90) })));
}

