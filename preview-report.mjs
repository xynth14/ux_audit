// Revisa el informe generado: desbordes, errores de consola y capturas en ambos temas.
import { chromium } from 'playwright';
import path from 'node:path';

const file = 'file:///' + path.resolve('report.preview.html').replace(/\\/g, '/');
const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch();

for (const [name, w, h, scheme] of [
  ['light-desktop', 1440, 1000, 'light'],
  ['dark-desktop', 1440, 1000, 'dark'],
  ['light-mobile', 390, 844, 'light'],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(file, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const diag = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth + 2;
    const over = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > limit)
      .slice(0, 8)
      .map((el) => `${el.tagName}.${String(el.className || '').slice(0, 34)}`);
    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      over,
      display: getComputedStyle(document.querySelector('.cover h1')).fontFamily.split(',')[0],
      mono: getComputedStyle(document.querySelector('.eyebrow')).fontFamily.split(',')[0],
    };
  });
  console.log(`\n[${name}] scrollW=${diag.scrollW} clientW=${diag.clientW} display=${diag.display} mono=${diag.mono}`);
  if (diag.over.length) console.log('  DESBORDAN: ' + diag.over.join(', '));
  if (errs.length) console.log('  consola: ' + errs.join(' | '));

  await page.screenshot({ path: path.join(OUT, `rep-${name}.png`) });
  await page.locator('#rediseno').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `rep-${name}-plates.png`) });
  await ctx.close();
}
await browser.close();
