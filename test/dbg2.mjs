import { parseContractPdf } from '../js/pdf-contract.js';
import fs from 'fs';
import path from 'path';
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const c = await parseContractPdf(new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))));
for (const r of c.rows.filter(r => r.source.includes('126') && (r.name.includes('Мультипайп') || r.name.includes('ПЭ 100'))))
  console.log(JSON.stringify(r));
