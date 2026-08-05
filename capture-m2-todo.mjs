// Totales reales de cada tabla y capturas de los DOS paneles de detalle.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const CAPS = path.join('informes', 'capturas');
await mkdir(CAPS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
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

// --- Totales por tabla ---
const totales = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const main = document.querySelector('main.content');
  return [...main.querySelectorAll('table')].map((t, i) => {
    // El texto "Mostrando X – Y de Z" más cercano por debajo de la tabla.
    let cont = t.closest('section, div');
    let txt = '';
    for (let n = 0; n < 4 && cont; n++, cont = cont.parentElement) {
      const m = clean(cont.innerText).match(/Mostrando\s+[\d.,]+\s*[–-]\s*[\d.,]+\s+de\s+[\d.,]+\s+resultados/gi);
      if (m) { txt = m[i] ?? m[m.length - 1] ?? m[0]; break; }
    }
    let titulo = '';
    for (let n = t.parentElement; n; n = n.parentElement) {
      const h = n.querySelector('h2'); if (h) { titulo = clean(h.textContent); break; }
    }
    return {
      titulo,
      cols: t.querySelectorAll('thead th').length,
      filasVisibles: t.querySelectorAll('tbody tr').length,
      anchoTabla: Math.round(t.getBoundingClientRect().width),
      anchoContenedor: Math.round(t.parentElement.getBoundingClientRect().width),
      total: txt,
    };
  });
});
// Y todos los textos "Mostrando ..." de la pantalla, en orden.
const mostrando = await page.evaluate(() => {
  const t = document.querySelector('main.content').innerText.replace(/\s+/g, ' ');
  return t.match(/Mostrando\s+[\d.,]+\s*[–-]\s*[\d.,]+\s+de\s+[\d.,]+\s+resultados/gi) ?? [];
});
console.log('=== Totales ===');
totales.forEach((t, i) => console.log(`  Tabla ${i + 1} «${t.titulo}»: ${t.cols} col · ${t.filasVisibles} filas visibles · ${t.anchoTabla}px en ${t.anchoContenedor}px`));
console.log('  Textos "Mostrando": ' + JSON.stringify(mostrando));

// --- Captura de la pantalla completa (las dos tablas) ---
await page.screenshot({ path: path.join(CAPS, 'm2-hoy-pantalla.jpg'), type: 'jpeg', quality: 60, fullPage: true });

// --- Panel de la TABLA 1, con Métricas desplegadas ---
const abrirDetalle = async (tablaIdx) => {
  const btn = page.locator('main.content table').nth(tablaIdx)
    .locator('tbody tr button[data-action="detail"]').first();
  await btn.waitFor({ state: 'attached', timeout: 15000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ timeout: 10000 });
  await page.waitForSelector('.drawer-backdrop', { timeout: 15000 });
  await page.waitForTimeout(1600);
};
const desplegar = async (texto) => {
  await page.evaluate((tx) => {
    const d = document.querySelector('.drawer-backdrop');
    if (!d) return;
    const el = [...d.querySelectorAll('*')].find((e) => new RegExp(tx, 'i').test((e.textContent || '').trim()) && e.children.length <= 4);
    el?.click?.();
  }, texto);
  await page.waitForTimeout(1100);
};
const cerrar = async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.drawer-backdrop', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
};

await abrirDetalle(0);
await desplegar('Métricas de esta URL');
await page.screenshot({ path: path.join(CAPS, 'm2-hoy-panel1-metricas.jpg'), type: 'jpeg', quality: 68 });
await desplegar('Problemas encontrados en esta URL');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(CAPS, 'm2-hoy-panel1-problemas.jpg'), type: 'jpeg', quality: 68 });
const panel1 = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const d = document.querySelector('.drawer-backdrop');
  return {
    secciones: [...d.querySelectorAll('*')].filter((e) => /^(Métricas de esta URL|Problemas encontrados|Datos del registro)/i.test(clean(e.textContent)) && e.children.length <= 4).map((e) => clean(e.textContent).slice(0, 60)),
    tarjetas: [...d.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^(REDIRECCIONES|ERRORES CONSOLA|ERRORES JS|RECURSOS FALLIDOS|MIXED CONTENT|ERRORES CORS|ERRORES CSP)$/i.test(clean(e.textContent))).length,
    nodos: d.querySelectorAll('*').length,
    caracteres: clean(d.innerText).length,
  };
});
console.log('\n=== Panel de la tabla 1 ===');
console.log('  ' + JSON.stringify(panel1));
await cerrar();

// --- Panel de la TABLA 2 ---
await abrirDetalle(1);
await page.screenshot({ path: path.join(CAPS, 'm2-hoy-panel2.jpg'), type: 'jpeg', quality: 68 });
const panel2 = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const d = document.querySelector('.drawer-backdrop');
  if (!d) return null;
  const texto = clean(d.innerText);
  return {
    secciones: [...d.querySelectorAll('*')].filter((e) => /^(QUÉ SE REVISÓ|QUÉ SIGNIFICA|Qué hacer|Detalle técnico|Todos los campos)/i.test(clean(e.textContent)) && e.children.length <= 4).map((e) => clean(e.textContent).slice(0, 46)),
    tarjetasCabecera: [...d.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^(URL \/ RECURSO|RULE ID|CÓDIGO HALLAZGO|SEVERIDAD)$/i.test(clean(e.textContent))).map((e) => clean(e.textContent)),
    camposTecnicos: [...d.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^(TIPO COMPONENTE|ID COMPONENTE|SELECTOR CSS|XPATH|SECCIÓN HTML|ARCHIVO ORIGEN|LÍNEA:COLUMNA|FAILED\/RESOURCE URL)$/i.test(clean(e.textContent))).map((e) => clean(e.textContent)),
    nodos: d.querySelectorAll('*').length,
    caracteres: texto.length,
    inicio: texto.slice(0, 320),
  };
});
console.log('\n=== Panel de la tabla 2 ===');
console.log(JSON.stringify(panel2, null, 1));

await writeFile(path.join('out', 'm2', 'todo.json'), JSON.stringify({ totales, mostrando, panel1, panel2 }, null, 2));
await browser.close();
console.log('\nCapturas en ' + CAPS);
