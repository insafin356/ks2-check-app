import fs from 'fs';
import path from 'path';
const pdfjs = await import('../vendor/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))) }).promise;
const page = await doc.getPage(138);
const tc = await page.getTextContent();
tc.items.filter(i => i.str && Math.abs(i.transform[5] - 136) < 6).forEach(i => console.log(JSON.stringify({ x: i.transform[4], s: i.str })));
