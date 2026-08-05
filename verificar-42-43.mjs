// Verifica el hallazgo "42 vs 43" del documento: ¿es un error de dato o son
// dos métricas distintas? Filtra los hallazgos de Links por la URL y agrupa por regla.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const URL_OBJETIVO = 'triplica-tu-recarga';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
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

// Módulo 5 · Links es el índice 5 del sidebar.
await page.locator('[data-audit-idx="5"]').click();
await page.waitForFunction(() => {
  const h1 = document.querySelector('main.content h1');
  const sp = document.querySelector('.spinner, .loading');
  return h1 && /Módulo\s*5/i.test(h1.textContent || '') && !(sp && sp.offsetParent) && document.querySelectorAll('main.content table').length >= 3;
}, { timeout: 30000 });
await page.waitForTimeout(1800);

// 1. Fila de la URL en "Top páginas con links rotos".
const top = await page.evaluate((objetivo) => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  for (const t of document.querySelectorAll('main.content table')) {
    const heads = [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent).toLowerCase());
    if (!heads.some((h) => h.includes('links rotos'))) continue;
    const iRotos = heads.findIndex((h) => h.includes('links rotos'));
    const iTotal = heads.findIndex((h) => h.includes('total links'));
    for (const r of t.querySelectorAll('tbody tr')) {
      const c = [...r.querySelectorAll('td')].map((td) => clean(td.textContent));
      if (c[0]?.includes(objetivo)) return { url: c[0], rotos: c[iRotos], total: c[iTotal], tablaHeaders: heads };
    }
  }
  return null;
}, URL_OBJETIVO);
console.log('=== "Top páginas con links rotos" ===');
console.log(top ? `  ${top.url}  → LINKS ROTOS = ${top.rotos}, TOTAL LINKS = ${top.total}` : '  no encontrada en la página visible');

// 2. Filtrar los hallazgos por esa URL.
const inputs = await page.locator('main.content input[placeholder*="URL" i]').all();
console.log(`\nCampos de filtro por URL encontrados: ${inputs.length}`);
for (const inp of inputs) { await inp.fill(URL_OBJETIVO); await page.waitForTimeout(700); }
await page.waitForTimeout(2500);

// 3. Totales y reparto por regla en la tabla de hallazgos.
const res = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const main = document.querySelector('main.content');
  const mostrando = clean(main.innerText).match(/Mostrando\s+[\d.,]+\s*[–-]\s*[\d.,]+\s+de\s+([\d.,]+)\s+resultados/gi) ?? [];
  const salida = [];
  [...main.querySelectorAll('table')].forEach((t, i) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent));
    const iCod = heads.findIndex((h) => /^c[óo]digo$/i.test(h) || /id regla/i.test(h));
    const filas = [...t.querySelectorAll('tbody tr')];
    if (iCod < 0 || !filas.length) return;
    const porRegla = {};
    for (const r of filas) {
      const c = [...r.querySelectorAll('td')].map((td) => clean(td.textContent));
      const k = c[iCod] || '(sin código)';
      porRegla[k] = (porRegla[k] ?? 0) + 1;
    }
    salida.push({ tabla: i + 1, titulo: heads.slice(0, 5).join(' | '), filas: filas.length, porRegla });
  });
  return { mostrando, salida };
});

console.log('\n=== Totales declarados en pantalla ===');
res.mostrando.forEach((m) => console.log('  ' + m));
console.log('\n=== Reparto por regla en las tablas con código ===');
for (const s of res.salida) {
  console.log(`\n  Tabla ${s.tabla} [${s.titulo}] · ${s.filas} filas visibles`);
  for (const [k, v] of Object.entries(s.porRegla).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(4)}  ${k}`);
}

// 4. Subir el tamaño de página para ver el reparto completo.
const selects = await page.locator('main.content select').all();
for (const s of selects) {
  const opts = await s.locator('option').allTextContents();
  if (opts.includes('100')) { await s.selectOption('100'); await page.waitForTimeout(1600); }
}
await page.waitForTimeout(1500);
const completo = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const main = document.querySelector('main.content');
  const out = [];
  [...main.querySelectorAll('table')].forEach((t, i) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent));
    const iCod = heads.findIndex((h) => /^c[óo]digo$/i.test(h) || /id regla/i.test(h));
    const filas = [...t.querySelectorAll('tbody tr')];
    if (iCod < 0 || filas.length < 2) return;
    const porRegla = {};
    for (const r of filas) {
      const c = [...r.querySelectorAll('td')].map((td) => clean(td.textContent));
      const k = c[iCod] || '(sin código)';
      porRegla[k] = (porRegla[k] ?? 0) + 1;
    }
    out.push({ tabla: i + 1, filas: filas.length, porRegla });
  });
  return out;
});
console.log('\n=== Con 100 filas por página ===');
for (const s of completo) {
  const suma = Object.values(s.porRegla).reduce((a, b) => a + b, 0);
  console.log(`\n  Tabla ${s.tabla} · ${s.filas} filas (suma ${suma})`);
  for (const [k, v] of Object.entries(s.porRegla).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(4)}  ${k}`);
}

await page.screenshot({ path: path.join('out', 'm2', 'verif-42-43.jpg'), type: 'jpeg', quality: 62, fullPage: true });
await writeFile(path.join('out', 'm2', 'verif-42-43.json'), JSON.stringify({ top, res, completo }, null, 2));
await browser.close();
