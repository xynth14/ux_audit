// Comprueba que la maqueta del panel no pierde NINGÚN contenido de los dos
// paneles actuales. Sirve para los dos documentos:
//   node test-cobertura-m2.mjs informes/m2-antes-despues.html
//   node test-cobertura-m2.mjs informes/propuesta-m2-tecnico.html
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET = process.argv[2] ?? 'informes/m2-antes-despues.html';
const esPresentacion = TARGET.includes('antes-despues');
const SEL = esPresentacion
  ? { body: '#dwb', toggle: '[data-t="0"]', demo: true }
  : { body: '#mk-drawer-body', toggle: '[data-toggle="0"]', demo: false };

const file = 'file:///' + path.resolve(TARGET).replace(/\\/g, '/');
const inv1 = JSON.parse(await readFile(path.join('out', 'm2', 'registro-fila1.json'), 'utf8'));
const inv2 = JSON.parse(await readFile(path.join('out', 'm2', 'inventario-panel2.json'), 'utf8'));
const camposRegistro = inv1.campos.map(([k]) => k);
const camposHallazgo = inv2.tablas[0].filas.map((f) => f[0]);

console.log(`### ${TARGET}\n`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(file, { waitUntil: 'load' });
await page.waitForTimeout(400);

let fallos = 0;
const chk = (n, c) => { console.log(`  ${c ? 'ok  ' : 'FALLA'} ${n}`); if (!c) fallos++; return c; };

await page.locator(SEL.toggle).click();
await page.locator('[data-abrir]').first().click();
await page.waitForTimeout(500);
await page.evaluate((b) => document.querySelectorAll(`${b} details`).forEach((d) => { d.open = true; }), SEL.body);
await page.waitForTimeout(300);

// innerText devuelve el texto RENDERIZADO: donde el CSS aplica
// text-transform:uppercase llega en mayúsculas. Se compara sin distinguir caja.
const crudo = await page.locator(SEL.body).innerText();
const tiene = (s) => crudo.toLowerCase().includes(s.toLowerCase());

console.log('=== Secciones de los dos paneles actuales ===');
for (const s of ['Problemas encontrados', 'Métricas de esta URL', 'Datos del registro',
                 'Datos del hallazgo', 'Qué se revisó', 'Qué significa', 'Qué hacer']) {
  chk(`sección «${s}»`, tiene(s));
}

console.log('\n=== Los 8 campos técnicos ===');
for (const c of ['Tipo componente', 'ID componente', 'Selector CSS', 'XPath', 'Sección HTML',
                 'Archivo origen', 'Línea:columna', 'Failed/resource URL']) {
  chk(`campo «${c}»`, tiene(c));
}

console.log(`\n=== Los ${camposRegistro.length} campos del registro ===`);
const faltanReg = camposRegistro.filter((c) => !tiene(c));
chk(`${camposRegistro.length} presentes`, faltanReg.length === 0);
if (faltanReg.length) console.log('       faltan: ' + faltanReg.join(', '));

console.log(`\n=== Los ${camposHallazgo.length} campos del hallazgo ===`);
const faltanHal = camposHallazgo.filter((c) => !tiene(c));
chk(`${camposHallazgo.length} presentes`, faltanHal.length === 0);
if (faltanHal.length) console.log('       faltan: ' + faltanHal.join(', '));

console.log('\n=== Métricas: las 7 de hoy más la nueva ===');
for (const m of ['Redirecciones', 'Errores consola', 'Errores JS', 'Recursos fallidos',
                 'Mixed content', 'Errores CORS', 'Errores CSP', 'Avisos de consola']) {
  chk(`métrica «${m}»`, tiene(m));
}
chk('desglose de recursos fallidos por tipo', /por tipo/i.test(crudo));

console.log('\n=== Contenido que hoy no se muestra ===');
chk('rule_name legible «Deprecated API» como título', tiene('Deprecated API'));
chk('los 5 campos redundantes señalados', (await page.locator(`${SEL.body} tr.dup`).count()) === 5);

console.log('\n=== Buscador de campos ===');
const antes = await page.locator(`${SEL.body} #cr-t tbody tr:visible`).count();
await page.locator(`${SEL.body} #cr`).fill('count');
await page.waitForTimeout(250);
const despues = await page.locator(`${SEL.body} #cr-t tbody tr:visible`).count();
chk(`filtra ${antes} → ${despues} filas con «count»`, despues > 0 && despues < antes);
await page.locator(`${SEL.body} #cr`).fill('');
await page.waitForTimeout(200);
chk('al limpiar vuelven todas', (await page.locator(`${SEL.body} #cr-t tbody tr:visible`).count()) === antes);

if (SEL.demo) {
  console.log('\n=== Demostración del cambio 10 ===');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('#c10').scrollIntoViewIfNeeded();
  chk('36 filas en la demo', (await page.locator('#demo-b tr').count()) === 36);
  await page.locator('#demo-f').fill('count');
  await page.waitForTimeout(250);
  const dv = await page.locator('#demo-b tr:visible').count();
  chk(`el buscador de la demo deja ${dv} contadores`, dv > 0 && dv < 36);
}

console.log('\n=== axe-core con el panel abierto ===');
for (const scheme of ['light', 'dark']) {
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const p2 = await c2.newPage();
  await p2.goto(file, { waitUntil: 'load' });
  await p2.waitForTimeout(350);
  await p2.locator(SEL.toggle).click();
  await p2.locator('[data-abrir]').first().click();
  await p2.waitForTimeout(400);
  await p2.evaluate((b) => document.querySelectorAll(`${b} details`).forEach((d) => { d.open = true; }), SEL.body);
  await p2.waitForTimeout(300);
  const res = await new AxeBuilder({ page: p2 }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  console.log(`  ${scheme}: ${res.violations.length} violaciones`);
  for (const v of res.violations) console.log(`    [${v.impact}] ${v.id} ×${v.nodes.length} — ${String(v.nodes[0]?.failureSummary).replace(/\s+/g, ' ').slice(0, 150)}`);
  if (res.violations.length) fallos++;
  const sw = await p2.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (sw[0] > sw[1] + 1) { console.log(`    desborde: ${sw[0]}/${sw[1]}`); fallos++; }
  await c2.close();
}

console.log(`\nErrores de consola: ${errs.length}`);
errs.slice(0, 4).forEach((e) => console.log('  ' + e.slice(0, 150)));
console.log(`\n${fallos === 0 ? 'TODO CORRECTO' : fallos + ' comprobaciones fallidas'}`);
await browser.close();
process.exit(fallos ? 1 : 0);
