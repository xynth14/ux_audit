// Recortes precisos del "antes" para la presentación: cada zona por separado.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const CAPS = path.join('informes', 'capturas');
await mkdir(CAPS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
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
await page.waitForTimeout(1600);

// Localiza cajas en coordenadas de documento.
const caja = (nombre, fn, alto) =>
  page.evaluate(({ fn, alto }) => {
    const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const buscar = new Function('clean', 'return ' + fn)(clean);
    if (!buscar) return null;
    const r = buscar.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round(r.left + scrollX) - 8),
      y: Math.round(r.top + scrollY) - 8,
      width: Math.min(1440, Math.round(r.width) + 16),
      height: alto ? alto : Math.round(r.height) + 16,
    };
  }, { fn, alto }).then((c) => (c ? { nombre, ...c } : null));

// El elemento MÁS PEQUEÑO que contiene el texto: si no, se coge un ancestro
// enorme y todos los recortes salen iguales.
const buscarPorTexto = (re, maxChars = 120) =>
  `[...document.querySelectorAll('main.content *')]
     .filter(e => /${re}/i.test(clean(e.textContent)) && clean(e.textContent).length <= ${maxChars})
     .sort((a,b) => clean(a.textContent).length - clean(b.textContent).length)[0]`;

const recortes = [
  await caja('m2-crop-kpis', `document.querySelector('main.content').querySelector('h1').parentElement.parentElement`, 320),
  await caja('m2-crop-leyenda', buscarPorTexto('Verde: bueno', 200), 170),
  await caja('m2-crop-tabla1', `document.querySelectorAll('main.content table')[0].parentElement`, 300),
  await caja('m2-crop-tabla1-pie', buscarPorTexto('de 200 resultados', 90), 110),
  await caja('m2-crop-tabla2', `document.querySelectorAll('main.content table')[1].parentElement`, 300),
  await caja('m2-crop-tabla2-pie', buscarPorTexto('de 3003 resultados', 90), 110),
].filter(Boolean);

for (const c of recortes) {
  try {
    await page.screenshot({
      path: path.join(CAPS, `${c.nombre}.jpg`), type: 'jpeg', quality: 78,
      fullPage: true, clip: { x: c.x, y: Math.max(0, c.y), width: c.width, height: c.height },
    });
    console.log(`  ${c.nombre.padEnd(24)} x=${c.x} y=${c.y} ${c.width}×${c.height}`);
  } catch (e) {
    console.log(`  ${c.nombre}: FALLA ${e.message.split('\n')[0].slice(0, 70)}`);
  }
}

// Paneles: recorte de la zona del panel dentro de la ventana.
const abrir = async (tablaIdx) => {
  const b = page.locator('main.content table').nth(tablaIdx).locator('tbody tr button[data-action="detail"]').first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForSelector('.drawer-backdrop', { timeout: 15000 });
  await page.waitForTimeout(1600);
};
const cerrar = async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.drawer-backdrop', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
};
const desplegar = async (tx) => {
  await page.evaluate((t) => {
    const d = document.querySelector('.drawer-backdrop');
    const el = [...d.querySelectorAll('*')].find((e) => new RegExp(t, 'i').test((e.textContent || '').trim()) && e.children.length <= 4);
    el?.click?.();
  }, tx);
  await page.waitForTimeout(1100);
};
const panelBox = () => page.evaluate(() => {
  const d = document.querySelector('.drawer-backdrop');
  const p = [...d.children].find((c) => c.getBoundingClientRect().width > 300) ?? d;
  const r = p.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(Math.max(0, r.top)), width: Math.round(r.width), height: Math.round(Math.min(r.height, innerHeight - Math.max(0, r.top))) };
});

await abrir(0);
await desplegar('Problemas encontrados en esta URL');
let b = await panelBox();
await page.screenshot({ path: path.join(CAPS, 'm2-crop-panel1.jpg'), type: 'jpeg', quality: 76, clip: b });
console.log(`  m2-crop-panel1           ${b.width}×${b.height}`);
await cerrar();

await abrir(1);
b = await panelBox();
await page.screenshot({ path: path.join(CAPS, 'm2-crop-panel2.jpg'), type: 'jpeg', quality: 76, clip: b });
console.log(`  m2-crop-panel2           ${b.width}×${b.height}`);

await browser.close();
