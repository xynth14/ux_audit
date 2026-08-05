// Los 36 campos del registro de la PRIMERA fila de "Resultados técnicos",
// sin tocar la navegación del panel, para poblar la maqueta con datos reales.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route('**/*', (route) => {
  const m = route.request().method(); const u = route.request().url();
  const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
  const ok = /identitytoolkit|securetoken|auth|session|oauth|\/Listen\/|:runQuery|:batchGet/i.test(u);
  return write && !ok ? route.abort() : route.continue();
});
const page = await context.newPage();
await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
await page.fill('input[type=password]', APP_PASS);
await page.click('button[type=submit], input[type=submit]');
await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 25000 });
await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate(() => { let i = 0; for (const el of document.querySelectorAll('button.nav')) el.setAttribute('data-audit-idx', String(i++)); });
await page.locator('[data-audit-idx="2"]').click();
await page.waitForFunction(() => {
  const h1 = document.querySelector('main.content h1');
  const sp = document.querySelector('.spinner, .loading');
  return h1 && /Módulo\s*2/i.test(h1.textContent || '') && !(sp && sp.offsetParent) && document.querySelectorAll('main.content table').length >= 2;
}, { timeout: 30000 });
await page.waitForTimeout(1500);

const b = page.locator('main.content table').nth(0).locator('tbody tr button[data-action="detail"]').first();
await b.scrollIntoViewIfNeeded();
await b.click();
await page.waitForSelector('.drawer-backdrop', { timeout: 15000 });
await page.waitForTimeout(1800);

// Sólo el acordeón de campos y el de métricas. Nada de Anterior/Siguiente.
for (const t of ['Métricas de esta URL', 'Datos del registro']) {
  await page.evaluate((tx) => {
    const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const d = document.querySelector('.drawer-backdrop');
    const c = [...d.querySelectorAll('*')]
      .filter((e) => clean(e.textContent).startsWith(tx) && clean(e.textContent).length < 60)
      .sort((a, b2) => clean(a.textContent).length - clean(b2.textContent).length)[0];
    c?.click?.();
  }, t);
  await page.waitForTimeout(1000);
}

const r = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const d = document.querySelector('.drawer-backdrop');
  const tabla = d.querySelector('table');
  const campos = tabla ? [...tabla.querySelectorAll('tbody tr')].map((row) => {
    const c = [...row.querySelectorAll('td,th')];
    return [clean(c[0]?.textContent), clean(c[1]?.textContent)];
  }) : [];
  // Tarjetas de métricas: etiqueta en mayúsculas + número.
  const metricas = [...d.querySelectorAll('*')].filter((e) => e.children.length === 0)
    .map((e) => clean(e.textContent))
    .filter((t) => /^(REDIRECCIONES|ERRORES CONSOLA|ERRORES JS|RECURSOS FALLIDOS|MIXED CONTENT|ERRORES CORS|ERRORES CSP)$/i.test(t));
  const nota = clean(d.innerText).match(/Recursos fallidos[^·]*por tipo:[^\n]{0,80}/i)?.[0] ?? null;
  const cabecera = clean(d.innerText).slice(0, 300);
  return { campos, metricas, nota, cabecera };
});

console.log(`URL del registro: ${r.campos.find((c) => c[0] === 'page_url')?.[1]}`);
console.log(`\nMÉTRICAS mostradas (${r.metricas.length}): ${r.metricas.join(' · ')}`);
console.log(`NOTA: ${r.nota}`);
console.log(`\nCAMPOS (${r.campos.length}):`);
r.campos.forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${String(v).slice(0, 88)}`));

await writeFile(path.join('out', 'm2', 'registro-fila1.json'), JSON.stringify(r, null, 2));
await browser.close();
