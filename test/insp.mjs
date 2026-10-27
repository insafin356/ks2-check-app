import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfjs = await import('../vendor/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))) }).promise;
for (const p of [143, 105]) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  console.log(`=== PAGE ${p} ===`);
  const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width, s: it.str }));
  items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
  let lastY = null, line = [];
  for (const it of items) {
    if (lastY != null && Math.abs(it.y - lastY) > 5) { console.log(`y=${lastY.toFixed(0)} | ` + line.join(' || ')); line = []; }
    lastY = it.y;
    line.push(`${it.s}[@${it.x.toFixed(0)}]`);
  }
  if (line.length) console.log(`y=${lastY?.toFixed(0)} | ` + line.join(' || '));
}
