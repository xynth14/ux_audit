// Capturas del documento de presentación para revisión visual.
import { chromium } from 'playwright';
import path from 'node:path';

const OUT = process.argv[2] ?? '.';
const file = 'file:///' + path.resolve('informes/m2-antes-despues.html').replace(/\\/g, '/');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1250 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(file, { waitUntil: 'load' });
await p.waitForTimeout(400);

await p.screenshot({ path: path.join(OUT, 'ad-1-portada.png') });
for (const [sel, name] of [['#c2', 'ad-2-columnas'], ['#c5', 'ad-3-paneles'], ['#c6', 'ad-4-reglas']]) {
  await p.locator(sel).scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
}
await b.close();
console.log('ok');
