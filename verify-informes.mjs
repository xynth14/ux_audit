// Audita los informes generados: axe-core en ambos temas y desborde horizontal.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const DEST = 'informes';
const files = (await readdir(DEST)).filter((f) => f.endsWith('.html')).sort();
const browser = await chromium.launch();
let problemas = 0;

for (const f of files) {
  const url = 'file:///' + path.resolve(DEST, f).replace(/\\/g, '/');
  const linea = [];

  for (const [scheme, w] of [['light', 1440], ['dark', 1440], ['light', 390]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(250);

    // Desborde real de página (no el de contenedores con scroll propio).
    const over = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    if (res.violations.length || over.scrollW > over.clientW + 1 || errs.length) {
      problemas++;
      linea.push(`\n  [${scheme} ${w}px] scrollW=${over.scrollW}/${over.clientW}`);
      for (const v of res.violations) {
        linea.push(`    [${v.impact}] ${v.id} ×${v.nodes.length} — ${String(v.nodes[0]?.failureSummary).replace(/\s+/g, ' ').slice(0, 150)}`);
      }
      if (errs.length) linea.push(`    consola: ${errs.slice(0, 3).join(' | ').slice(0, 200)}`);
    }
    await ctx.close();
  }

  console.log(`${f.padEnd(34)} ${linea.length ? 'REVISAR' + linea.join('') : 'ok'}`);
}

await browser.close();
console.log(`\n${files.length} archivos comprobados · ${problemas} combinaciones con incidencias`);
