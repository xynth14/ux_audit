// Radiografía del Módulo 2 · Técnico: columnas completas, duplicación entre
// las dos tablas, coste de carga y qué hay detrás de "Ver detalles".
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
const netLog = [];
page.on('response', (r) => {
  const u = r.url();
  if (/firestore|run\.app|googleapis/.test(u)) netLog.push({ status: r.status(), url: u.split('?')[0].slice(-90) });
});

await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
await page.fill('input[type=password]', APP_PASS);
await page.click('button[type=submit], input[type=submit]');
await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 25000 });
await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// --- Abrir Módulo 2 midiendo la aparición de cada tabla ---
await page.evaluate(() => {
  let i = 0;
  for (const el of document.querySelectorAll('button.nav')) el.setAttribute('data-audit-idx', String(i++));
});

const t0 = Date.now();
await page.locator('[data-audit-idx="2"]').click();

const hitos = [];
for (let n = 0; n < 60; n++) {
  const s = await page.evaluate(() => {
    const main = document.querySelector('main.content');
    const tablas = [...(main?.querySelectorAll('table') ?? [])];
    return {
      tablas: tablas.length,
      filas: tablas.map((t) => t.querySelectorAll('tbody tr').length),
      celdas: main ? main.querySelectorAll('td').length : 0,
      nodos: main ? main.querySelectorAll('*').length : 0,
      spinner: !!document.querySelector('.spinner, .loading, [class*=skelet]')?.offsetParent,
    };
  });
  const marca = `${s.tablas}t/${s.filas.join(',')}/${s.celdas}celdas`;
  if (!hitos.length || hitos.at(-1).marca !== marca) hitos.push({ ms: Date.now() - t0, marca, ...s });
  if (s.tablas >= 2 && !s.spinner && n > 6) break;
  await page.waitForTimeout(180);
}
console.log('=== Aparición del contenido ===');
for (const h of hitos) console.log(`  t=${String(h.ms).padStart(5)}ms  ${h.marca}  nodos=${h.nodos} spinner=${h.spinner}`);

await page.waitForTimeout(1200);

// --- Columnas completas de cada tabla y duplicación ---
const estructura = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const main = document.querySelector('main.content');
  const secciones = [...main.querySelectorAll('h2')].map((h) => clean(h.textContent));
  const tablas = [...main.querySelectorAll('table')].map((t) => {
    const headers = [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent));
    const filas = [...t.querySelectorAll('tbody tr')];
    // Título más cercano por encima.
    let titulo = '';
    for (let n = t.parentElement; n; n = n.parentElement) {
      const h = n.querySelector('h2, h3');
      if (h) { titulo = clean(h.textContent); break; }
    }
    return {
      titulo,
      headers,
      cols: headers.length,
      rows: filas.length,
      anchoPx: Math.round(t.getBoundingClientRect().width),
      contenedorPx: Math.round((t.parentElement?.getBoundingClientRect().width) ?? 0),
      primeraFila: filas[0] ? [...filas[0].querySelectorAll('td')].map((td) => clean(td.textContent).slice(0, 40)) : [],
      urlsUnicas: new Set(filas.map((r) => clean(r.querySelector('td')?.textContent))).size,
    };
  });
  // ¿Hay paginación o indicación de totales?
  const textoTotales = clean(main.innerText).match(/(mostrando|de\s+\d+|p[áa]gina|\d+\s*\/\s*\d+)[^.]{0,60}/gi) ?? [];
  return {
    secciones,
    tablas,
    textoTotales: textoTotales.slice(0, 8),
    totalCeldas: main.querySelectorAll('td').length,
    totalNodos: main.querySelectorAll('*').length,
    altoMain: Math.round(main.getBoundingClientRect().height),
  };
});

console.log('\n=== Secciones ===');
estructura.secciones.forEach((s) => console.log('  ' + s));
console.log(`\nDOM del módulo: ${estructura.totalNodos} nodos, ${estructura.totalCeldas} celdas, alto ${estructura.altoMain}px`);
console.log('Indicios de totales/paginación: ' + (estructura.textoTotales.join(' | ') || 'ninguno'));

estructura.tablas.forEach((t, i) => {
  console.log(`\n=== TABLA ${i + 1}: ${t.titulo} ===`);
  console.log(`  ${t.rows} filas · ${t.cols} columnas · ancho tabla ${t.anchoPx}px en contenedor de ${t.contenedorPx}px`);
  console.log(`  URLs distintas en la primera columna: ${t.urlsUnicas}`);
  console.log('  COLUMNAS:');
  t.headers.forEach((h, j) => console.log(`    ${String(j + 1).padStart(2)}. ${h}`));
});

// --- Solape de columnas entre las dos tablas ---
if (estructura.tablas.length >= 2) {
  const [a, b] = estructura.tablas;
  const comunes = a.headers.filter((h) => b.headers.includes(h));
  console.log(`\n=== Solape entre tabla 1 y 2 ===`);
  console.log(`  columnas comunes (${comunes.length}): ${comunes.join(' · ')}`);
}

// --- "Ver detalles": qué es y qué hace ---
console.log('\n=== "Ver detalles" ===');
const detalleInfo = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const cands = [...document.querySelectorAll('main.content *')].filter((el) =>
    /ver detalle/i.test(clean(el.textContent)) && el.children.length === 0
  );
  return {
    encontrados: cands.length,
    muestra: cands.slice(0, 3).map((el) => ({
      tag: el.tagName,
      cls: String(el.className || '').slice(0, 40),
      texto: clean(el.textContent),
      rect: (() => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; })(),
      padre: el.parentElement?.tagName + '.' + String(el.parentElement?.className || '').slice(0, 30),
    })),
  };
});
console.log(`  elementos "Ver detalles": ${detalleInfo.encontrados}`);
detalleInfo.muestra.forEach((d) => console.log(`    <${d.tag}> "${d.texto}" ${d.rect}px class=${d.cls} en ${d.padre}`));

if (detalleInfo.encontrados) {
  const antes = await page.evaluate(() => ({
    nodos: document.querySelectorAll('*').length,
    dialogos: document.querySelectorAll('dialog, [role=dialog], .modal, [class*=modal], [class*=drawer], [class*=panel]').length,
  }));
  const link = page.locator('main.content >> text=/Ver detalle/i').first();
  await link.scrollIntoViewIfNeeded();
  await link.click({ timeout: 8000 }).catch((e) => console.log('  clic falló: ' + e.message.split('\n')[0]));
  await page.waitForTimeout(2000);

  const despues = await page.evaluate(() => {
    const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const dlg = document.querySelector('dialog[open], [role=dialog], .modal.open, [class*=modal]:not([hidden]), [class*=drawer], [class*=panel]');
    return {
      nodos: document.querySelectorAll('*').length,
      url: location.href,
      dialogoVisible: dlg ? !!dlg.offsetParent : false,
      dialogoClase: dlg ? dlg.tagName + '.' + String(dlg.className || '').slice(0, 40) : null,
      dialogoTexto: dlg && dlg.offsetParent ? clean(dlg.innerText).slice(0, 700) : null,
      dialogoAlto: dlg && dlg.offsetParent ? Math.round(dlg.getBoundingClientRect().height) : 0,
      focoEn: document.activeElement ? document.activeElement.tagName + '.' + String(document.activeElement.className || '').slice(0, 30) : null,
    };
  });
  console.log(`  nodos antes=${antes.nodos} después=${despues.nodos} (Δ ${despues.nodos - antes.nodos})`);
  console.log(`  URL tras el clic: ${despues.url}`);
  console.log(`  ¿diálogo visible? ${despues.dialogoVisible} — ${despues.dialogoClase}`);
  console.log(`  alto del diálogo: ${despues.dialogoAlto}px · foco en ${despues.focoEn}`);
  if (despues.dialogoTexto) console.log(`  CONTENIDO:\n    ${despues.dialogoTexto.replace(/(.{110})/g, '$1\n    ')}`);
  await page.screenshot({ path: path.join(OUT, 'ver-detalles.jpg'), type: 'jpeg', quality: 70 });
  await page.screenshot({ path: path.join(OUT, 'ver-detalles-full.jpg'), type: 'jpeg', quality: 62, fullPage: true });
}

console.log('\n=== Peticiones de datos observadas ===');
const vistos = new Set();
for (const n of netLog) { if (!vistos.has(n.url)) { vistos.add(n.url); console.log(`  ${n.status} …${n.url}`); } }

await writeFile(path.join(OUT, 'm2.json'), JSON.stringify({ hitos, estructura, detalleInfo }, null, 2));
console.log(`\nDetalle en ${path.join(OUT, 'm2.json')}`);
await browser.close();
