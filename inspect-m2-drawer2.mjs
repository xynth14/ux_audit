// Detección directa del panel: diferencia de hijos del body antes/después.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const OUT = path.join('out', 'm2');

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

// Marcar los hijos del body existentes.
await page.evaluate(() => [...document.body.children].forEach((c, i) => c.setAttribute('data-pre', String(i))));

await page.evaluate(() => document.querySelector('main.content table tbody tr button[data-action="detail"]').setAttribute('data-open-me', '1'));
await page.locator('[data-open-me="1"]').click();
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const nuevos = [...document.body.children].filter((c) => !c.hasAttribute('data-pre'));
  const dlg = document.querySelector('dialog');

  const describe = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const foc = el.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    return {
      sel: `${el.tagName}${el.id ? '#' + el.id : ''}.${String(el.className || '').slice(0, 46)}`,
      tam: `${Math.round(r.width)}×${Math.round(r.height)}`,
      pos: `x=${Math.round(r.left)} y=${Math.round(r.top)}`,
      position: cs.position, zIndex: cs.zIndex, display: cs.display, visibility: cs.visibility,
      offsetParentNull: el.offsetParent === null,
      abierto: el.hasAttribute('open'),
      role: el.getAttribute('role'), ariaModal: el.getAttribute('aria-modal'),
      etiqueta: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'),
      focusables: foc.length,
      nodos: el.querySelectorAll('*').length,
      textoLen: clean(el.innerText).length,
      encabezados: [...el.querySelectorAll('h1,h2,h3,h4,strong')].map((h) => clean(h.textContent).slice(0, 60)).slice(0, 12),
      botones: [...el.querySelectorAll('button')].map((b) => {
        const rr = b.getBoundingClientRect();
        return `"${clean(b.textContent).slice(0, 26)}" ${Math.round(rr.width)}×${Math.round(rr.height)}`;
      }).slice(0, 8),
    };
  };

  return {
    nuevosHijos: nuevos.map(describe),
    dialog: describe(dlg),
    hayDialog: !!dlg,
    dialogAbierto: dlg?.hasAttribute('open') ?? null,
    foco: `${document.activeElement.tagName}.${String(document.activeElement.className || '').slice(0, 34)}`,
    focoDentroDelDialog: dlg ? dlg.contains(document.activeElement) : null,
    bodyOverflow: getComputedStyle(document.body).overflow,
    // Redundancia real: bloques de texto largos repetidos dentro del panel.
    repetidos: (() => {
      const raiz = dlg ?? nuevos[0] ?? document.body;
      const hojas = [...raiz.querySelectorAll('*')].filter((e) => e.children.length === 0);
      const cuenta = {};
      for (const h of hojas) {
        const t = clean(h.textContent);
        if (t.length > 90) cuenta[t] = (cuenta[t] ?? 0) + 1;
      }
      return Object.entries(cuenta).filter(([, n]) => n > 1)
        .sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([t, n]) => ({ veces: n, chars: t.length, muestra: t.slice(0, 130) }));
    })(),
  };
});

console.log('=== Hijos nuevos del body tras pulsar "Ver detalles" ===');
console.log(JSON.stringify(info.nuevosHijos, null, 1));
console.log('\n=== ¿<dialog>? ===');
console.log(`  existe=${info.hayDialog} abierto=${info.dialogAbierto}`);
if (info.dialog) console.log(JSON.stringify(info.dialog, null, 1));
console.log('\n=== Accesibilidad ===');
console.log(`  foco tras abrir: ${info.foco}`);
console.log(`  ¿foco dentro del panel? ${info.focoDentroDelDialog}`);
console.log(`  overflow del body: ${info.bodyOverflow}`);
console.log('\n=== Texto repetido dentro del panel ===');
for (const r of info.repetidos) console.log(`  ×${r.veces} (${r.chars} car) "${r.muestra}"`);
if (!info.repetidos.length) console.log('  ninguno');

await page.screenshot({ path: path.join(OUT, 'drawer-abierto.jpg'), type: 'jpeg', quality: 72 });
await page.screenshot({ path: path.join(OUT, 'drawer-full.jpg'), type: 'jpeg', quality: 60, fullPage: true });
await writeFile(path.join(OUT, 'drawer2.json'), JSON.stringify(info, null, 2));
await browser.close();
