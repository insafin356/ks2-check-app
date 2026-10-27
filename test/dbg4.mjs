import { parseContractPdf } from '../js/pdf-contract.js';
import fs from 'fs';
import path from 'path';
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const c = await parseContractPdf(new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))));
const show = cds => { for (const cd of cds) { const rs = c.rows.filter(r => r.code === cd); console.log(cd, '->', JSON.stringify(rs)); } };
show(['ГЭСН24-02-002-02', 'ГЭСН24-02-041-04', 'ГЭСН24-02-122-01', '23.8.04.08-0000-0427']);
const i = c.rows.findIndex(r => r.price === 7 && r.unit === 'шт');
if (i > 0) for (let k = i - 2; k <= i + 2; k++) console.log(JSON.stringify(c.rows[k]));
