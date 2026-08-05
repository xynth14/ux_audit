// Prueba funcional de la maqueta: expansión, columnas, vistas, panel y teclado.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import path from 'node:path';

const file = 'file:///' + path.resolve('informes/propuesta-m2-tecnico.html').replace(/\\/g, '/');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(file, { waitUntil: 'load' });
await page.waitForTimeout(400);

const ok = (n, c) => console.log(`  ${c ? 'ok  ' : 'FALLA'} ${n}`);

console.log('=== Render inicial ===');
ok('4 filas de URL pintadas', (await page.locator('#mk-tbody tr[data-i]').count()) === 4);
ok('4 reglas en la vista por hallazgo', (await page.locator('#mk-tbody-hal tr').count()) === 4);
ok('columna URL es sticky', (await page.locator('#mk-tabla td.sticky').first().evaluate((e) => getComputedStyle(e).position)) === 'sticky');
ok('cabecera sticky', (await page.locator('#mk-tabla thead th').first().evaluate((e) => getComputedStyle(e).position)) === 'sticky');
// Se comprueba el texto RENDERIZADO, no el código fuente del script,
// donde "\n" es un escape legítimo.
await page.locator('[data-toggle="0"]').click();
await page.locator('[data-abrir]').first().click();
await page.waitForTimeout(400);
const traza = await page.locator('#mk-drawer-body pre.mk-trace').first().innerText();
ok('el volcado tiene saltos de línea reales', traza.includes('\n') && !traza.includes('\\n'));
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
await page.locator('[data-toggle="0"]').click();
await page.waitForTimeout(150);

console.log('\n=== Expandir fila ===');
await page.locator('[data-toggle="0"]').click();
await page.waitForTimeout(250);
ok('detalle visible', await page.locator('tr[data-detalle="0"]').isVisible());
ok('aria-expanded=true', (await page.locator('[data-toggle="0"]').getAttribute('aria-expanded')) === 'true');
ok('muestra las 6 métricas de runtime', (await page.locator('tr[data-detalle="0"] .mk-mini').count()) === 6);

console.log('\n=== Selector de columnas ===');
await page.locator('#mk-cols-btn').click();
await page.locator('#mk-cols-pop input[data-col="http"]').check();
await page.waitForTimeout(200);
ok('columna HTTP visible tras marcarla', await page.locator('#mk-tabla th[data-c="http"]').isVisible());
ok('el contador dice 4 de 17', (await page.locator('#mk-cols-btn').textContent()).includes('4 de 17'));
await page.locator('#mk-cols-pop input[data-col="http"]').uncheck();
await page.waitForTimeout(150);
ok('se vuelve a ocultar', !(await page.locator('#mk-tabla th[data-c="http"]').isVisible()));

console.log('\n=== Conmutador de vista ===');
await page.locator('#mk-v-hal').click();
await page.waitForTimeout(250);
ok('tabla por hallazgo visible', await page.locator('#mk-wrap-hal').isVisible());
ok('tabla por URL oculta', !(await page.locator('#mk-wrap-url').isVisible()));
ok('sólo una tabla renderizada a la vez', (await page.locator('.mk-tblwrap:visible').count()) === 1);
await page.locator('#mk-v-url').click();
await page.waitForTimeout(200);

console.log('\n=== Panel de detalle ===');
await page.locator('[data-abrir]').first().click();
await page.waitForTimeout(400);
ok('panel visible', await page.locator('#mk-drawer').isVisible());
ok('role=dialog', (await page.locator('#mk-drawer').getAttribute('role')) === 'dialog');
ok('aria-modal=true', (await page.locator('#mk-drawer').getAttribute('aria-modal')) === 'true');
const foco1 = await page.evaluate(() => document.activeElement.id);
ok(`el foco entra al panel (está en #${foco1})`, foco1 === 'mk-close');
ok('el foco está DENTRO del panel', await page.evaluate(() => document.querySelector('#mk-drawer').contains(document.activeElement)));
ok('cierre de 44×44', await page.locator('#mk-close').evaluate((e) => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }));
ok('definición impresa una sola vez por regla', (await page.locator('#mk-drawer-body .mk-def').count()) === (await page.locator('#mk-drawer-body details.mk-rule').count()) - 1);
ok('volcado en bloque enfocable', (await page.locator('#mk-drawer-body pre.mk-trace[tabindex="0"]').count()) >= 1);

console.log('\n=== Trampa de foco ===');
const dentro = [];
for (let i = 0; i < 26; i++) {
  await page.keyboard.press('Tab');
  dentro.push(await page.evaluate(() => document.querySelector('#mk-drawer').contains(document.activeElement)));
}
ok(`el tabulador no escapa en 26 pulsaciones (${dentro.filter(Boolean).length}/26 dentro)`, dentro.every(Boolean));

console.log('\n=== Escape y retorno de foco ===');
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
ok('panel cerrado', !(await page.locator('#mk-drawer').isVisible()));
const foco2 = await page.evaluate(() => document.activeElement?.dataset?.abrir ?? document.activeElement.tagName);
ok(`el foco vuelve al disparador (${foco2})`, typeof foco2 === 'string' && foco2.startsWith('/'));

console.log('\n=== Filtro ===');
await page.locator('#mk-q').fill('reset-router');
await page.waitForTimeout(250);
ok('1 fila visible', (await page.locator('#mk-tbody tr[data-i]:visible').count()) === 1);
ok('el contador lo refleja', (await page.locator('#mk-count').textContent()).includes('1 de 4'));
await page.locator('#mk-q').fill('');
await page.waitForTimeout(200);

console.log('\n=== axe-core sobre el documento ===');
for (const scheme of ['light', 'dark']) {
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const p2 = await c2.newPage();
  await p2.goto(file, { waitUntil: 'load' });
  await p2.waitForTimeout(350);
  // Con el panel abierto, que es el estado más exigente.
  await p2.locator('[data-toggle="0"]').click();
  await p2.locator('[data-abrir]').first().click();
  await p2.waitForTimeout(400);
  const res = await new AxeBuilder({ page: p2 }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  console.log(`  ${scheme}: ${res.violations.length} violaciones`);
  for (const v of res.violations) console.log(`    [${v.impact}] ${v.id} ×${v.nodes.length} — ${String(v.nodes[0]?.failureSummary).replace(/\s+/g, ' ').slice(0, 140)}`);
  const scroll = await p2.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  console.log(`  ${scheme}: scrollW=${scroll[0]}/${scroll[1]}`);
  await c2.close();
}

console.log(`\nErrores de consola: ${errs.length}`);
errs.slice(0, 5).forEach((e) => console.log('  ' + e.slice(0, 160)));
await browser.close();
