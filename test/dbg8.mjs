import fs from 'fs';
import path from 'path';
const pdfjs = await import('../vendor/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const { linesFromItems } = await import('../js/pdf-contract.js');
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))) }).promise;
const page = await doc.getPage(138);
const tc = await page.getTextContent();
const lines = linesFromItems(tc.items);
lines.forEach((l, i) => {
  const cells = l.cells.map(c => `${c.text.trim()}@${c.x.toFixed(0)}`).join(' || ');
  if (/09-05-003|Постановка болтов/.test(cells)) console.log(`line#${i} y=${l.y.toFixed(0)}\n  ${cells}`);
});
