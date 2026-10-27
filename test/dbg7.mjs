import fs from 'fs';
import path from 'path';
const pdfjs = await import('../vendor/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const dir = String.raw`C:\Users\Инсаф\OneDrive\Desktop\РТ, Балтасинский район, д.Новая Салаусь, ул.Братьев Файзрахмановых, д.1`;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, 'Договор на СМР № 518-26-с от 07.08.26.pdf'))) }).promise;
for (const needle of ['005-05', '101-9410', '09-05-003']) {
  const hits = [];
  for (let p = 104; p <= 154; p++) {
    const page = await doc.getPage(p);
    const t = (await page.getTextContent()).items.map(i => i.str).join(' ');
    if (t.includes(needle)) hits.push(p);
  }
  console.log(needle, 'pages:', hits.join(','));
}
