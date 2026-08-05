// Investiga el visor de resultados (/index.html) y el enrutado del sidebar.
// Verifica: ¿cambia la URL al navegar? ¿funciona Atrás? ¿sobrevive un recargado?
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const OUT = path.join('out', 'visor');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

// Solo lectura.
await context.route('**/*', (route) => {
  const m = route.request().method();
  const u = route.request().url();
  const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
  const ok = /identitytoolkit|securetoken|auth|session|oauth|\/Listen\/|:runQuery|:batchGet/i.test(u);
  return write && !ok ? route.abort() : route.continue();
});

const page = await context.newPage();
await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
await page.fill('input[type=password]', APP_PASS);
await page.click('button[type=submit], input[type=submit]');
await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 20000 });
console.log('Login OK\n');

// --- 1. ¿Qué pasa al entrar directo a /index.html sin contexto? ---
await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2500);

const entry = await page.evaluate(() => ({
  href: location.href,
  title: document.title,
  h1: document.querySelector('h1, h2')?.textContent?.trim().slice(0, 80) ?? '(ninguno)',
  bodyStart: document.body.innerText.trim().slice(0, 220).replace(/\s+/g, ' '),
  histLen: history.length,
}));
console.log('=== 1. Entrada directa a /index.html sin parámetros ===');
console.log(JSON.stringify(entry, null, 1));
await page.screenshot({ path: path.join(OUT, 'index-sin-contexto.jpg'), type: 'jpeg', quality: 65, fullPage: true });

// --- 2. Inventario del sidebar ---
// El texto incluye el nombre de la ligadura del icono ("dashboard Resumen"),
// así que se busca la coincidencia en cualquier posición y se marca cada
// candidato con un atributo propio para poder clicarlo sin ambigüedad.
const nav = await page.evaluate(() => {
  const RE = /(Resumen|Módulo\s*\d+)/i;
  const items = [];
  let idx = 0;
  for (const el of document.querySelectorAll('a, button, [role=tab], [role=button], li, div')) {
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (!RE.test(t) || t.length > 70) continue;
    // Sólo el elemento más interno que aún contiene la etiqueta completa.
    if ([...el.children].some((c) => RE.test((c.innerText || '').replace(/\s+/g, ' ')))) continue;
    el.setAttribute('data-audit-idx', String(idx));
    items.push({
      idx,
      tag: el.tagName,
      text: t,
      label: t.replace(/^[a-z_]+\s+/, ''),   // quita la ligadura del icono
      ligature: (t.match(/^([a-z_]+)\s/) || [])[1] ?? null,
      href: el.getAttribute('href'),
      cls: String(el.className || '').slice(0, 46),
    });
    idx++;
  }
  return items;
});
console.log('\n=== 2. Elementos del sidebar ===');
console.log(`${nav.length} encontrados`);
for (const n of nav) {
  console.log(`  [${String(n.idx).padStart(2)}] <${n.tag}> "${n.label}" · icono="${n.ligature ?? '—'}" href=${n.href} class=${n.cls}`);
}
if (!nav.length) {
  console.log('  Nada reconocible: se aborta el resto de las pruebas.');
  await browser.close();
  process.exit(1);
}

// --- 3. ¿Cambia la URL al navegar entre módulos? ---
console.log('\n=== 3. Navegación por el sidebar ===');
const results = [];
for (const item of nav) {
  const before = page.url();
  const histBefore = await page.evaluate(() => history.length);
  try {
    await page.locator(`[data-audit-idx="${item.idx}"]`).click({ timeout: 5000 });
  } catch (e) {
    console.log(`  ${item.label}: no clicable (${e.message.split('\n')[0].slice(0, 50)})`);
    continue;
  }
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => ({
    href: location.href,
    hash: location.hash,
    histLen: history.length,
    heading: document.querySelector('main h1, main h2, h1, h2')?.textContent?.trim().slice(0, 70) ?? '',
    firstText: document.body.innerText.trim().slice(0, 90).replace(/\s+/g, ' '),
  }));
  const changed = after.href !== before;
  results.push({ item: item.label, urlChanged: changed, url: after.href, hash: after.hash, heading: after.heading, histDelta: after.histLen - histBefore });
  console.log(`  ${item.label.padEnd(28)} urlCambió=${changed ? 'SÍ' : 'NO '} hash="${after.hash}" histΔ=${after.histLen - histBefore} · "${after.firstText.slice(0, 58)}"`);
}

// --- 4. Prueba de Atrás y de recargado sobre el último módulo ---
console.log('\n=== 4. Atrás y recargado ===');
const last = nav[nav.length - 1];
await page.locator(`[data-audit-idx="${last.idx}"]`).click().catch(() => {});
await page.waitForTimeout(1200);
const beforeBack = await page.evaluate(() => ({ href: location.href, body: document.body.innerText.trim().slice(0, 70).replace(/\s+/g, ' ') }));
await page.screenshot({ path: path.join(OUT, 'modulo-abierto.jpg'), type: 'jpeg', quality: 65, fullPage: true });

await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(1800);
const afterBack = await page.evaluate(() => ({ href: location.href, body: document.body.innerText.trim().slice(0, 70).replace(/\s+/g, ' ') }));
console.log(`  Antes de Atrás: ${beforeBack.href}`);
console.log(`     "${beforeBack.body}"`);
console.log(`  Después de Atrás: ${afterBack.href}`);
console.log(`     "${afterBack.body}"`);
console.log(`  → Atrás ${afterBack.href === beforeBack.href ? 'NO cambió la URL' : 'salió del visor'}`);

// Recargado: ¿recuerda el módulo abierto?
await page.goto(beforeBack.href, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const afterReload = await page.evaluate(() => ({ href: location.href, body: document.body.innerText.trim().slice(0, 70).replace(/\s+/g, ' ') }));
console.log(`  Tras recargar esa misma URL: "${afterReload.body}"`);
console.log(`  → ${afterReload.body === beforeBack.body ? 'restauró el módulo' : 'PERDIÓ el módulo, volvió al inicio'}`);

await writeFile(path.join(OUT, 'sidebar.json'), JSON.stringify({ entry, nav, results, beforeBack, afterBack, afterReload }, null, 2));
console.log(`\nDetalle en ${path.join(OUT, 'sidebar.json')}`);
await browser.close();
