// Valores reales de las primeras filas y de las métricas del panel,
// para que la maqueta de la propuesta use datos verdaderos.
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
await page.waitForTimeout(1200);

const filas = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const main = document.querySelector('main.content');
  const tablas = [...main.querySelectorAll('table')];
  const kpis = [...main.querySelectorAll('[class*=kpi], [class*=card], [class*=stat]')]
    .map((el) => clean(el.innerText)).filter((t) => t && t.length < 90).slice(0, 12);
  return {
    kpis,
    tabla1: {
      headers: [...tablas[0].querySelectorAll('thead th')].map((th) => clean(th.textContent)),
      filas: [...tablas[0].querySelectorAll('tbody tr')].slice(0, 4)
        .map((r) => [...r.querySelectorAll('td')].map((td) => clean(td.textContent).slice(0, 60))),
    },
    tabla2: {
      headers: [...tablas[1].querySelectorAll('thead th')].map((th) => clean(th.textContent)),
      filas: [...tablas[1].querySelectorAll('tbody tr')].slice(0, 4)
        .map((r) => [...r.querySelectorAll('td')].map((td) => clean(td.textContent).slice(0, 70))),
    },
    controles: clean([...main.querySelectorAll('[class*=filter], [class*=toolbar], select, input')]
      .map((e) => e.tagName + ':' + clean(e.textContent || e.getAttribute('placeholder') || '')).join(' | ')).slice(0, 400),
  };
});

console.log('=== KPIs ===');
filas.kpis.forEach((k) => console.log('  ' + k.replace(/\n/g, ' / ')));

console.log('\n=== TABLA 1 · Resultados técnicos ===');
filas.tabla1.headers.forEach((h, i) => {
  const vals = filas.tabla1.filas.map((f) => f[i] ?? '—');
  console.log(`  ${String(i + 1).padStart(2)}. ${h.padEnd(24)} | ${vals.join(' | ')}`);
});

console.log('\n=== TABLA 2 · Hallazgos técnicos ===');
filas.tabla2.headers.forEach((h, i) => {
  const vals = filas.tabla2.filas.map((f) => f[i] ?? '—');
  console.log(`  ${String(i + 1).padStart(2)}. ${h.padEnd(22)} | ${vals.join(' | ').slice(0, 190)}`);
});

console.log('\n=== Controles ===\n  ' + filas.controles);

// Métricas dentro del panel.
await page.evaluate(() => document.querySelector('main.content table tbody tr button[data-action="detail"]').setAttribute('data-open-me', '1'));
await page.locator('[data-open-me="1"]').click();
await page.waitForTimeout(1800);
const panel = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const d = document.querySelector('.drawer-backdrop');
  if (!d) return null;
  // Abrir el acordeón de métricas si está plegado.
  const acc = [...d.querySelectorAll('*')].find((e) => /Métricas de esta URL/i.test(clean(e.textContent)) && e.children.length < 4);
  acc?.click?.();
  const secciones = [...d.querySelectorAll('h2,h3,h4')].map((h) => clean(h.textContent));
  return {
    titulo: clean(d.querySelector('h2,h3')?.textContent),
    secciones: secciones.slice(0, 8),
    texto: clean(d.innerText).slice(0, 2600),
  };
});
console.log('\n=== Panel "Ver detalles" ===');
console.log('  secciones: ' + (panel?.secciones ?? []).join(' | '));
console.log('\n' + (panel?.texto ?? '').replace(/(.{150})/g, '$1\n'));

await writeFile(path.join('out', 'm2', 'filas.json'), JSON.stringify({ filas, panel }, null, 2));
await browser.close();
