import { chromium } from 'playwright';
import path from 'node:path';

const OUT = process.argv[2] ?? '.';
const file = 'file:///' + path.resolve('informes/m2-antes-despues.html').replace(/\\/g, '/');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1340, height: 1150 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(file, { waitUntil: 'load' });
await p.waitForTimeout(400);
await p.locator('#mk').scrollIntoViewIfNeeded();
await p.locator('[data-t="0"]').click();
await p.locator('[data-abrir]').first().click();
await p.waitForTimeout(600);
await p.screenshot({ path: path.join(OUT, 'panel-1-problemas.png') });

// Desplegar métricas y los campos del registro.
await p.evaluate(() => {
  const ds = [...document.querySelectorAll('#dwb details')];
  ds.forEach((d) => { d.open = false; });
  ds.find((d) => /Datos del registro/i.test(d.textContent)).open = true;
});
await p.waitForTimeout(400);
await p.locator('#dwb #cr').fill('count');
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(OUT, 'panel-2-campos.png') });
await b.close();
console.log('ok');
