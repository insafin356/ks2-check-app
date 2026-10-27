import { parseContractPdf } from '../js/pdf-contract.js';
import fs from 'fs';
import path from 'path';
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const c = await parseContractPdf(new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))));
const idx = c.rows.findIndex(r => r.code.includes('0162') && r.code.startsWith('24.3'));
for (let i = idx - 3; i <= idx + 6; i++) console.log(JSON.stringify(c.rows[i]));
console.log('соединение codes:', ['ГЭСН24-02-002-02', 'ГЭСН24-02-001-06', 'ГЭСН24-02-007-02'].map(cd => c.rows.filter(r => r.code === cd).map(r => ({ unit: r.unit, price: r.price }))));
