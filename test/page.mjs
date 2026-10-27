import fs from 'fs';
import path from 'path';
const pdfjs = await import('../vendor/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))) }).promise;
const page = await doc.getPage(Number(process.argv[2] || 112));
const tc = await page.getTextContent();
const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width, s: it.str }));
items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
let lastY = null, line = [];
const out = [];
for (const it of items) {
  if (lastY != null && Math.abs(it.y - lastY) > 5) { out.push(`y=${lastY.toFixed(0)} | ` + line.join(' || ')); line = []; }
  lastY = it.y; line.push(`${it.s}[@${it.x.toFixed(0)}]`);
}
out.push(`y=${lastY?.toFixed(0)} | ` + line.join(' || '));
console.log(out.join('\n'));
