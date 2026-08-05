// Audita el propio informe: axe-core en ambos temas + color computado de las maquetas.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import path from 'node:path';

// Se prueba el envoltorio completo, no el fragmento: sin doctype los resultados mienten.
const file = 'file:///' + path.resolve('report.preview.html').replace(/\\/g, '/');
const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(file, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  console.log(`\n=== tema ${scheme}: ${res.violations.length} violaciones ===`);
  for (const v of res.violations) {
    console.log(`[${v.impact}] ${v.id} · ${v.nodes.length} nodos — ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) {
      console.log(`   ${JSON.stringify(n.target)}`);
      console.log(`   ${String(n.failureSummary).replace(/\n/g, ' ').slice(0, 190)}`);
    }
  }

  const colors = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return `${sel}: NO EXISTE`;
      const s = getComputedStyle(el);
      return `${sel}: color=${s.color} bg=${s.backgroundColor}`;
    };
    return [
      pick('.mk-tbl tbody td'),
      pick('.mk-tbl thead th'),
      pick('.mock'),
      pick('.mk-lede'),
      pick('.mk-mod__foot'),
    ];
  });
  console.log('  computados: ' + colors.join(' | '));
  await ctx.close();
}
await browser.close();
