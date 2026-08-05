// Inventario del panel de "Hallazgos técnicos" (tabla 2), en su propia sesión.
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

const b = page.locator('main.content table').nth(1).locator('tbody tr button[data-action="detail"]').first();
await b.scrollIntoViewIfNeeded();
await b.click();
await page.waitForSelector('.drawer-backdrop', { timeout: 15000 });
await page.waitForTimeout(1800);

// Sólo los tres acordeones conocidos, por su texto exacto de cabecera.
for (const titulo of ['Qué hacer', 'Detalle técnico', 'Todos los campos']) {
  await page.evaluate((t) => {
    const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const d = document.querySelector('.drawer-backdrop');
    const cand = [...d.querySelectorAll('*')]
      .filter((e) => clean(e.textContent).startsWith(t) && clean(e.textContent).length < 60)
      .sort((a, b2) => clean(a.textContent).length - clean(b2.textContent).length)[0];
    cand?.click?.();
  }, titulo);
  await page.waitForTimeout(900);
}

const r = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const d = document.querySelector('.drawer-backdrop');
  const etiquetas = [...d.querySelectorAll('*')].filter((e) => e.children.length === 0)
    .map((e) => clean(e.textContent))
    .filter((t) => t.length > 1 && t.length < 42 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t));
  const tablas = [...d.querySelectorAll('table')].map((t) => ({
    headers: [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent)),
    filas: [...t.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td,th')].map((c) => clean(c.textContent))),
  }));
  const secciones = [...d.querySelectorAll('*')]
    .filter((e) => e.children.length <= 6 && /^(QUÉ SE REVISÓ|QUÉ SIGNIFICA|Qué hacer|Detalle técnico|Todos los campos)/i.test(clean(e.textContent)))
    .map((e) => clean(e.textContent).slice(0, 70));
  return {
    secciones: [...new Set(secciones)],
    etiquetas: [...new Set(etiquetas)],
    tablas,
    botones: [...new Set([...d.querySelectorAll('button')].map((x) => clean(x.textContent).slice(0, 34)))],
    nodos: d.querySelectorAll('*').length,
    caracteres: clean(d.innerText).length,
    texto: clean(d.innerText).slice(0, 1400),
  };
});

console.log(`nodos=${r.nodos} caracteres=${r.caracteres}`);
console.log('\nSECCIONES:');
r.secciones.forEach((s) => console.log('  · ' + s));
console.log('\nETIQUETAS (mayúsculas):');
r.etiquetas.forEach((s) => console.log('  · ' + s));
r.tablas.forEach((t, i) => {
  console.log(`\nTABLA ${i + 1} [${t.headers.join(' | ')}] — ${t.filas.length} filas:`);
  t.filas.forEach((f) => console.log('    ' + f.map((c) => c.slice(0, 76)).join('  ⟶  ')));
});
console.log('\nBOTONES: ' + r.botones.join(' · '));
console.log('\nTEXTO:\n' + r.texto.replace(/(.{140})/g, '$1\n'));

await writeFile(path.join('out', 'm2', 'inventario-panel2.json'), JSON.stringify(r, null, 2));
await page.screenshot({ path: path.join('out', 'm2', 'inv-panel2-completo.jpg'), type: 'jpeg', quality: 60, fullPage: true });
await browser.close();
