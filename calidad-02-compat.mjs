// Auditoría de calidad · dimensión compatibilidad. Compara el visor en los tres
// motores de render: Chromium (Chrome/Edge), Firefox y WebKit (Safari).
import { chromium, firefox, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const OUT = path.join('out', 'calidad');
await mkdir(OUT, { recursive: true });

const MOTORES = [
  ['Chromium', chromium, 'Chrome y Edge'],
  ['Firefox', firefox, 'Firefox'],
  ['WebKit', webkit, 'Safari, iOS'],
];

const resultado = [];

for (const [nombre, motor, equivale] of MOTORES) {
  const r = { motor: nombre, equivale, errores: [], pasos: {} };
  let browser;
  try {
    browser = await motor.launch();
  } catch (e) {
    r.errores.push('no se pudo lanzar: ' + e.message.slice(0, 80));
    resultado.push(r);
    console.log(`\n${nombre}: no disponible`);
    continue;
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**/*', (route) => {
    const m = route.request().method(); const u = route.request().url();
    const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
    const ok = /identitytoolkit|securetoken|auth|session|oauth|\/Listen\/|:runQuery|:batchGet/i.test(u);
    return write && !ok ? route.abort() : route.continue();
  });
  const page = await context.newPage();
  const consola = [];
  page.on('console', (m) => m.type() === 'error' && consola.push(m.text().slice(0, 150)));
  page.on('pageerror', (e) => consola.push('pageerror: ' + String(e).slice(0, 150)));

  try {
    // Paso 1: cargar el login
    await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(1200);
    r.pasos.login = await page.locator('input[type=password]').count() > 0;

    // Paso 2: autenticarse
    await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
    await page.fill('input[type=password]', APP_PASS);
    await page.click('button[type=submit], input[type=submit]');
    await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 30000 });
    r.pasos.autenticacion = true;

    // Paso 3: abrir el visor
    await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(3000);
    r.pasos.visor = await page.locator('button.nav').count() >= 11;
    r.nav = await page.locator('button.nav').count();

    // Paso 4: abrir un módulo con datos
    await page.evaluate(() => { let i = 0; for (const el of document.querySelectorAll('button.nav')) el.setAttribute('data-audit-idx', String(i++)); });
    const t0 = Date.now();
    await page.locator('[data-audit-idx="2"]').click();
    await page.waitForFunction(() => {
      const h1 = document.querySelector('main.content h1');
      const sp = document.querySelector('.spinner, .loading');
      return h1 && /Módulo\s*2/i.test(h1.textContent || '') && !(sp && sp.offsetParent) && document.querySelectorAll('main.content table').length >= 2;
    }, { timeout: 40000 });
    r.msContenido = Date.now() - t0;
    r.pasos.modulo = true;

    // Paso 5: abrir el panel de detalle
    const btn = page.locator('main.content table').nth(0).locator('tbody tr button[data-action="detail"]').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForSelector('.drawer-backdrop', { timeout: 20000 });
    await page.waitForTimeout(1500);
    r.pasos.panel = true;

    // Medidas comparables de maquetación
    r.medidas = await page.evaluate(() => {
      const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
      const main = document.querySelector('main.content');
      const t = main?.querySelector('table');
      const aside = document.querySelector('aside.sidebar');
      const dw = document.querySelector('.drawer-backdrop');
      const p = dw ? [...dw.children].find((c) => c.getBoundingClientRect().width > 300) : null;
      // ¿Se renderizan los iconos como iconos o como palabras?
      const icono = document.querySelector('.material-symbols-outlined');
      const anchoIcono = icono ? Math.round(icono.getBoundingClientRect().width) : null;
      return {
        anchoTabla: t ? Math.round(t.getBoundingClientRect().width) : null,
        columnas: t ? t.querySelectorAll('thead th').length : null,
        filas: t ? t.querySelectorAll('tbody tr').length : null,
        anchoSidebar: aside ? Math.round(aside.getBoundingClientRect().width) : null,
        altoContenido: main ? Math.round(main.getBoundingClientRect().height) : null,
        anchoPanel: p ? Math.round(p.getBoundingClientRect().width) : null,
        textoPanel: dw ? clean(dw.innerText).length : 0,
        anchoIcono,
        desbordeH: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    await page.screenshot({ path: path.join(OUT, `compat-${nombre.toLowerCase()}.jpg`), type: 'jpeg', quality: 62 });
  } catch (e) {
    r.errores.push('flujo interrumpido: ' + e.message.split('\n')[0].slice(0, 110));
  }

  r.consola = [...new Set(consola)];
  resultado.push(r);

  console.log(`\n######## ${nombre} (${equivale}) ########`);
  console.log('  pasos: ' + Object.entries(r.pasos).map(([k, v]) => `${k}=${v ? 'ok' : 'FALLA'}`).join(' · '));
  if (r.msContenido) console.log(`  contenido visible a los ${r.msContenido} ms`);
  if (r.medidas) {
    const m = r.medidas;
    console.log(`  tabla ${m.anchoTabla}px · ${m.columnas} col · ${m.filas} filas · sidebar ${m.anchoSidebar}px · alto ${m.altoContenido}px`);
    console.log(`  panel ${m.anchoPanel}px con ${m.textoPanel} caracteres · icono ${m.anchoIcono}px · desborde horizontal: ${m.desbordeH ? 'SÍ' : 'no'}`);
  }
  console.log(`  errores de consola: ${r.consola.length}`);
  r.consola.slice(0, 4).forEach((e) => console.log('    ' + e));
  if (r.errores.length) r.errores.forEach((e) => console.log('  PROBLEMA: ' + e));

  await browser.close();
}

await writeFile(path.join(OUT, 'compat.json'), JSON.stringify(resultado, null, 2));

console.log('\n=== Comparativa ===');
const base = resultado.find((r) => r.motor === 'Chromium')?.medidas;
for (const r of resultado) {
  if (!r.medidas || !base) { console.log(`  ${r.motor.padEnd(10)} sin medidas comparables`); continue; }
  const dif = Object.keys(base).filter((k) => typeof base[k] === 'number' && r.medidas[k] !== base[k]);
  console.log(`  ${r.motor.padEnd(10)} ${dif.length ? 'difiere en: ' + dif.map((k) => `${k} ${r.medidas[k]} vs ${base[k]}`).join(', ') : 'idéntico a Chromium'}`);
}
console.log('\nGuardado en out/calidad/compat.json');
