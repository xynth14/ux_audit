// Inventario EXHAUSTIVO de los dos paneles de detalle: cada sección, cada
// acordeón y cada campo, para garantizar que la propuesta no pierde nada.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const OUT = path.join('out', 'm2');
await mkdir(OUT, { recursive: true });

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

const abrir = async (t) => {
  const b = page.locator('main.content table').nth(t).locator('tbody tr button[data-action="detail"]').first();
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForSelector('.drawer-backdrop', { timeout: 15000 });
  await page.waitForTimeout(1700);
};
const cerrar = async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.drawer-backdrop', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
};

// Abre TODOS los acordeones del panel, repitiendo hasta que no cambie nada.
const abrirTodo = async () => {
  for (let pase = 0; pase < 5; pase++) {
    const antes = await page.evaluate(() => document.querySelector('.drawer-backdrop')?.innerText.length ?? 0);
    await page.evaluate(() => {
      const d = document.querySelector('.drawer-backdrop');
      if (!d) return;
      // Cabeceras de acordeón: elementos con un icono expand_more/chevron y poco texto.
      for (const el of d.querySelectorAll('*')) {
        const t = (el.textContent || '').trim();
        if (el.children.length > 6 || t.length > 90) continue;
        if (/expand_more|chevron_right|keyboard_arrow_down/.test(t) ||
            /^(Métricas de esta URL|Problemas encontrados|Datos del registro|Qué hacer|Detalle técnico|Todos los campos)/i.test(t)) {
          el.click?.();
        }
      }
      d.querySelectorAll('details').forEach((x) => { x.open = true; });
    });
    await page.waitForTimeout(1000);
    const despues = await page.evaluate(() => document.querySelector('.drawer-backdrop')?.innerText.length ?? 0);
    if (despues === antes) break;
  }
};

const radiografia = () => page.evaluate(() => {
  const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const d = document.querySelector('.drawer-backdrop');
  if (!d) return null;

  // Etiquetas en MAYÚSCULAS = títulos de tarjeta / campo.
  const etiquetas = [...d.querySelectorAll('*')]
    .filter((e) => e.children.length === 0)
    .map((e) => clean(e.textContent))
    .filter((t) => t.length > 1 && t.length < 42 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t));

  // Secciones plegables reconocibles por su título.
  const secciones = [...d.querySelectorAll('*')]
    .filter((e) => e.children.length <= 6 && /^(Métricas de esta URL|Problemas encontrados|Datos del registro|Qué hacer|Detalle técnico|Todos los campos|QUÉ SE REVISÓ|QUÉ SIGNIFICA)/i.test(clean(e.textContent)))
    .map((e) => clean(e.textContent).slice(0, 60));

  // Tablas CAMPO / VALOR.
  const tablas = [...d.querySelectorAll('table')].map((t) => ({
    headers: [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent)),
    filas: [...t.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td,th')].map((c) => clean(c.textContent))),
  }));

  // Pares campo/valor fuera de tablas (rejillas de definición).
  const pares = [];
  for (const dl of d.querySelectorAll('dl')) {
    const dts = [...dl.querySelectorAll('dt')], dds = [...dl.querySelectorAll('dd')];
    dts.forEach((dt, i) => pares.push([clean(dt.textContent), clean(dds[i]?.textContent).slice(0, 90)]));
  }

  return {
    secciones: [...new Set(secciones)],
    etiquetas: [...new Set(etiquetas)],
    tablas,
    pares,
    botones: [...new Set([...d.querySelectorAll('button')].map((b) => clean(b.textContent).slice(0, 34)))],
    nodos: d.querySelectorAll('*').length,
    caracteres: clean(d.innerText).length,
  };
});

const salida = {};
for (const [idx, nombre] of [[0, 'panel1_resultados'], [1, 'panel2_hallazgos']]) {
  await abrir(idx);
  await abrirTodo();
  const r = await radiografia();
  salida[nombre] = r;

  console.log(`\n################ ${nombre} ################`);
  console.log(`nodos=${r.nodos} caracteres=${r.caracteres}`);
  console.log('\nSECCIONES / ACORDEONES:');
  r.secciones.forEach((s) => console.log('  · ' + s));
  console.log('\nETIQUETAS DE TARJETA / CAMPO (mayúsculas):');
  r.etiquetas.forEach((s) => console.log('  · ' + s));
  r.tablas.forEach((t, i) => {
    console.log(`\nTABLA ${i + 1} [${t.headers.join(' | ')}] — ${t.filas.length} filas:`);
    t.filas.forEach((f) => console.log('    ' + f.map((c) => c.slice(0, 70)).join('  ⟶  ')));
  });
  if (r.pares.length) {
    console.log('\nPARES CAMPO/VALOR:');
    r.pares.forEach(([k, v]) => console.log(`    ${k}  ⟶  ${v}`));
  }
  console.log('\nBOTONES: ' + r.botones.join(' · '));
  await page.screenshot({ path: path.join(OUT, `inv-${nombre}.jpg`), type: 'jpeg', quality: 60, fullPage: true });
  await cerrar();
}

await writeFile(path.join(OUT, 'inventario-paneles.json'), JSON.stringify(salida, null, 2));
console.log('\nGuardado en out/m2/inventario-paneles.json');
await browser.close();
