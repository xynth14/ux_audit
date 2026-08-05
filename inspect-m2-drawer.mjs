// Accesibilidad del panel "Ver detalles" y redundancia de su contenido.
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

// Cuánto hay que desplazarse para ver el botón.
const scrollNecesario = await page.evaluate(() => {
  const t = document.querySelector('main.content table');
  const wrap = t.parentElement;
  const btn = t.querySelector('tbody tr button[data-action="detail"]');
  return {
    tabla: Math.round(t.getBoundingClientRect().width),
    contenedor: Math.round(wrap.getBoundingClientRect().width),
    scrollMax: Math.round(wrap.scrollWidth - wrap.clientWidth),
    botonVisibleSinScroll: btn ? btn.getBoundingClientRect().right <= wrap.getBoundingClientRect().right + 1 : null,
  };
});
console.log('=== Coste de llegar a "Ver detalles" ===');
console.log(`  tabla ${scrollNecesario.tabla}px en contenedor ${scrollNecesario.contenedor}px`);
console.log(`  desplazamiento horizontal máximo: ${scrollNecesario.scrollMax}px`);
console.log(`  ¿el botón se ve sin desplazar? ${scrollNecesario.botonVisibleSinScroll}`);

// Abrir el panel.
await page.evaluate(() => document.querySelector('main.content table tbody tr button[data-action="detail"]').setAttribute('data-open-me', '1'));
await page.locator('[data-open-me="1"]').click();
await page.waitForTimeout(1800);

const drawer = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  // El panel: elemento fijo grande y visible, sin filtrar por z-index.
  const cands = [...document.querySelectorAll('body *')].filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.height > 300 && r.width > 400 && /fixed|absolute/.test(cs.position);
  });
  const d = cands.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const cs = getComputedStyle(d);

  // ¿Hay velo/scrim detrás?
  const scrim = [...document.querySelectorAll('body *')].find((el) => {
    const s = getComputedStyle(el);
    const rr = el.getBoundingClientRect();
    return el !== d && el.offsetParent !== null && /fixed/.test(s.position) &&
      rr.width >= window.innerWidth * 0.9 && rr.height >= window.innerHeight * 0.9 &&
      s.backgroundColor !== 'rgba(0, 0, 0, 0)';
  });

  const focusables = d.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
  return {
    sel: `${d.tagName}.${String(d.className || '').slice(0, 50)}`,
    tam: `${Math.round(r.width)}×${Math.round(r.height)}`,
    pos: `x=${Math.round(r.left)} y=${Math.round(r.top)}`,
    position: cs.position,
    zIndex: cs.zIndex,
    role: d.getAttribute('role'),
    ariaModal: d.getAttribute('aria-modal'),
    ariaLabel: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby'),
    esDialog: d.tagName === 'DIALOG',
    scrim: scrim ? `${scrim.tagName}.${String(scrim.className || '').slice(0, 30)} bg=${getComputedStyle(scrim).backgroundColor}` : 'NINGUNO',
    bodyScrollBloqueado: getComputedStyle(document.body).overflow === 'hidden',
    focoActual: `${document.activeElement.tagName}.${String(document.activeElement.className || '').slice(0, 30)}`,
    focoDentroDelPanel: d.contains(document.activeElement),
    focusables: focusables.length,
    nodos: d.querySelectorAll('*').length,
    // Redundancia: comparar "Esperado" y "Actual".
    textoCompleto: clean(d.innerText).length,
    secciones: [...d.querySelectorAll('h2,h3,h4,summary,[class*=accordion],[class*=collapse]')].map((h) => clean(h.textContent).slice(0, 70)).slice(0, 10),
  };
});
console.log('\n=== El panel ===');
console.log(JSON.stringify(drawer, null, 1));

// Redundancia Esperado/Actual y repetición de la definición de regla.
const redundancia = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const txt = clean(document.body.innerText);
  const esperado = txt.match(/Esperado:\s*([^]{0,400}?)\s*·?\s*Actual:/)?.[1] ?? '';
  const actual = txt.match(/Actual:\s*([^]{0,400}?)(?=DÓNDE|Componente|$)/)?.[1] ?? '';
  // Prefijo común entre ambos.
  let i = 0; while (i < Math.min(esperado.length, actual.length) && esperado[i] === actual[i]) i++;
  const bloques = [...document.querySelectorAll('*')];
  const stack = 'jQuery.Deferred exception: Cannot read properties of null';
  const repeticiones = bloques.filter((el) => el.children.length === 0 && (el.textContent || '').includes(stack)).length;
  return { esperadoLen: esperado.length, actualLen: actual.length, prefijoComun: i, esperado: esperado.slice(0, 160), actual: actual.slice(0, 160), repeticionesStack: repeticiones };
});
console.log('\n=== Redundancia del contenido ===');
console.log(`  "Esperado" ${redundancia.esperadoLen} car · "Actual" ${redundancia.actualLen} car · prefijo común ${redundancia.prefijoComun} car`);
console.log(`  esperado: "${redundancia.esperado}"`);
console.log(`  actual:   "${redundancia.actual}"`);
console.log(`  veces que aparece el mismo stack trace en la pantalla: ${redundancia.repeticionesStack}`);

// ¿Cierra con Escape? ¿El fondo sigue desplazándose?
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
const trasEscape = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('body *')].filter((el) => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.height > 300 && r.width > 400 && /fixed|absolute/.test(cs.position);
  });
  return { sigueAbierto: cands.length > 0 };
});
console.log(`\n  ¿Escape cierra el panel? ${trasEscape.sigueAbierto ? 'NO' : 'sí'}`);

await writeFile(path.join(OUT, 'drawer.json'), JSON.stringify({ scrollNecesario, drawer, redundancia, trasEscape }, null, 2));
await browser.close();
