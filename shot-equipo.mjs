import { chromium } from 'playwright';
import path from 'node:path';

const OUT = process.argv[2] ?? '.';
const b = await chromium.launch();
for (const [f, name, scheme] of [
  ['informes/05-modulo-5-links.html', 'eq-links', 'light'],
  ['informes/00-resumen.html', 'eq-resumen', 'light'],
]) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 1250 }, colorScheme: scheme, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto('file:///' + path.resolve(f).replace(/\\/g, '/'), { waitUntil: 'load' });
  await p.waitForTimeout(350);
  await p.locator('.eq').scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
  await ctx.close();
}
await b.close();
console.log('ok');
