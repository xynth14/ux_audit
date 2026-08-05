// ¿Qué hay en la columna "Acción" y qué abre? Y coste real de cada llamada.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const OUT = path.join('out', 'm2');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.route('**/*', (route) => {
  const m = route.request().method();
  const u = route.request().url();
  const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
  const ok = /identitytoolkit|securetoken|auth|session|oauth|\/Listen\/|:runQuery|:batchGet/i.test(u);
  return write && !ok ? route.abort() : route.continue();
});

const page = await context.newPage();
const api = [];
page.on('response', async (r) => {
  if (!/\/api\//.test(r.url())) return;
  let bytes = 0;
  try { bytes = (await r.body()).length; } catch {}
  api.push({ ep: r.url().replace(/^.*\/api\//, 'api/').split('?')[0], status: r.status(), kb: Math.round(bytes / 1024) });
});

await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
await page.fill('input[type=password]', APP_PASS);
await page.click('button[type=submit], input[type=submit]');
await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 25000 });
await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
api.length = 0;

await page.evaluate(() => { let i = 0; for (const el of document.querySelectorAll('button.nav')) el.setAttribute('data-audit-idx', String(i++)); });
await page.locator('[data-audit-idx="2"]').click();
// Esperar el TÍTULO del módulo, no sólo tablas: las del Resumen siguen en el
// DOM y satisfacen la condición antes de que el módulo se haya cargado.
await page.waitForFunction(
  () => {
    const h1 = document.querySelector('main.content h1');
    const ok = h1 && /Módulo\s*2/i.test(h1.textContent || '');
    const spinner = document.querySelector('.spinner, .loading, [class*=skelet]');
    return ok && !(spinner && spinner.offsetParent) && document.querySelectorAll('main.content table').length >= 2;
  },
  { timeout: 30000 }
);
await page.waitForTimeout(1500);
const titulo = await page.evaluate(() => document.querySelector('main.content h1')?.textContent?.trim());
console.log(`Pantalla medida: "${titulo}"\n`);

console.log('=== Llamadas a la API al abrir el módulo ===');
let total = 0;
for (const a of api) { total += a.kb; console.log(`  ${String(a.status)} ${String(a.kb).padStart(5)} KB  ${a.ep}`); }
console.log(`  ${'TOTAL'.padStart(9)} ${String(total).padStart(5)} KB en ${api.length} llamadas`);

// --- Contenido de la última columna de cada tabla ---
const acciones = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const main = document.querySelector('main.content');
  const out = [];
  [...main.querySelectorAll('table')].forEach((t, ti) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent));
    const idx = heads.findIndex((h) => /acci[óo]n/i.test(h));
    const filas = [...t.querySelectorAll('tbody tr')].slice(0, 3);
    out.push({
      tabla: ti + 1,
      columnaAccion: idx >= 0 ? idx + 1 : null,
      nombre: idx >= 0 ? heads[idx] : null,
      celdas: filas.map((r) => {
        const tds = [...r.querySelectorAll('td')];
        const td = idx >= 0 ? tds[idx] : tds.at(-1);
        if (!td) return null;
        const ctrl = td.querySelector('a,button,[role=button],[onclick]');
        const r2 = ctrl?.getBoundingClientRect();
        return {
          texto: clean(td.textContent),
          html: td.innerHTML.trim().slice(0, 200),
          control: ctrl ? `${ctrl.tagName}.${String(ctrl.className || '').slice(0, 30)}` : 'NINGUNO',
          href: ctrl?.getAttribute?.('href') ?? null,
          tam: r2 ? `${Math.round(r2.width)}×${Math.round(r2.height)}` : null,
        };
      }),
    });
  });
  return out;
});

console.log('\n=== Columna "Acción" ===');
for (const a of acciones) {
  console.log(`\n  TABLA ${a.tabla} — columna ${a.columnaAccion} «${a.nombre}»`);
  a.celdas.forEach((c, i) => {
    if (!c) return console.log(`    fila ${i + 1}: (sin celda)`);
    console.log(`    fila ${i + 1}: texto="${c.texto}" control=${c.control} href=${c.href} tam=${c.tam}`);
    console.log(`             html: ${c.html.replace(/\n/g, ' ')}`);
  });
}

// --- Intentar abrir el detalle ---
console.log('\n=== Apertura del detalle ===');
const antes = await page.evaluate(() => document.querySelectorAll('*').length);
const clicked = await page.evaluate(() => {
  const main = document.querySelector('main.content');
  const t = main.querySelector('table');
  const heads = [...t.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim());
  const idx = heads.findIndex((h) => /acci[óo]n/i.test(h));
  const row = t.querySelector('tbody tr');
  const td = [...row.querySelectorAll('td')][idx >= 0 ? idx : -1];
  const ctrl = td?.querySelector('a,button,[role=button]') ?? td;
  if (!ctrl) return null;
  ctrl.setAttribute('data-open-me', '1');
  return { tag: ctrl.tagName, texto: (ctrl.textContent || '').trim().slice(0, 40) };
});
console.log('  elemento a pulsar: ' + JSON.stringify(clicked));

if (clicked) {
  await page.locator('[data-open-me="1"]').scrollIntoViewIfNeeded();
  await page.locator('[data-open-me="1"]').click({ timeout: 8000 }).catch((e) => console.log('  clic falló: ' + e.message.split('\n')[0].slice(0, 80)));
  await page.waitForTimeout(2200);

  const despues = await page.evaluate(() => {
    const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
    // Cualquier cosa que haya aparecido y sea visible por encima del contenido.
    const flotantes = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return el.offsetParent !== null && r.height > 120 && r.width > 200 &&
        (cs.position === 'fixed' || cs.position === 'absolute' || el.tagName === 'DIALOG') &&
        Number(cs.zIndex || 0) >= 1;
    }).slice(0, 4);
    return {
      nodos: document.querySelectorAll('*').length,
      url: location.href,
      hash: location.hash,
      flotantes: flotantes.map((el) => ({
        sel: `${el.tagName}.${String(el.className || '').slice(0, 44)}`,
        tam: (() => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; })(),
        zIndex: getComputedStyle(el).zIndex,
        texto: clean(el.innerText).slice(0, 800),
      })),
      foco: document.activeElement ? `${document.activeElement.tagName}.${String(document.activeElement.className || '').slice(0, 30)}` : null,
      filaExpandida: document.querySelectorAll('main.content tbody tr').length,
    };
  });
  console.log(`  nodos ${antes} → ${despues.nodos} (Δ ${despues.nodos - antes})`);
  console.log(`  URL: ${despues.url}  hash="${despues.hash}"`);
  console.log(`  filas en tabla tras el clic: ${despues.filaExpandida}`);
  console.log(`  foco tras abrir: ${despues.foco}`);
  console.log(`  capas flotantes visibles: ${despues.flotantes.length}`);
  for (const f of despues.flotantes) {
    console.log(`\n   ── ${f.sel}  ${f.tam}px  z=${f.zIndex}`);
    console.log('      ' + f.texto.replace(/(.{100})/g, '$1\n      '));
  }
  await page.screenshot({ path: path.join(OUT, 'detalle.jpg'), type: 'jpeg', quality: 72 });
  await writeFile(path.join(OUT, 'accion.json'), JSON.stringify({ api, acciones, clicked, despues }, null, 2));
}

await browser.close();
