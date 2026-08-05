// Auditoría de calidad · dimensión seguridad de configuración, rendimiento de
// red y señales observables de mantenibilidad. Todo desde el cliente, sin tocar
// el código y sin pruebas intrusivas.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const OUT = path.join('out', 'calidad');
await mkdir(OUT, { recursive: true });

const CAB = ['strict-transport-security', 'content-security-policy', 'x-content-type-options',
  'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy',
  'cache-control', 'server'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const peticiones = [];
const consola = [];
await context.route('**/*', (route) => {
  const m = route.request().method(); const u = route.request().url();
  const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
  const ok = /identitytoolkit|securetoken|auth|session|oauth|\/Listen\/|:runQuery|:batchGet/i.test(u);
  return write && !ok ? route.abort() : route.continue();
});

const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && consola.push(m.text().slice(0, 160)));
page.on('pageerror', (e) => consola.push(String(e).slice(0, 160)));
page.on('response', async (r) => {
  let bytes = 0;
  try { bytes = (await r.body()).length; } catch {}
  const u = new URL(r.url());
  peticiones.push({
    host: u.host, ruta: u.pathname, metodo: r.request().method(), status: r.status(),
    tipo: r.request().resourceType(), bytes,
    cache: r.headers()['cache-control'] ?? null,
  });
});

// ---------- 1. Cabeceras de seguridad del documento principal ----------
const resp = await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded' });
const cabeceras = {};
const h = resp.headers();
for (const c of CAB) cabeceras[c] = h[c] ?? null;

console.log('=== 1. Cabeceras de seguridad del documento ===');
for (const c of CAB) {
  const v = cabeceras[c];
  const marca = ['strict-transport-security', 'content-security-policy', 'x-content-type-options',
    'x-frame-options', 'referrer-policy'].includes(c) ? (v ? 'ok   ' : 'FALTA') : '     ';
  console.log(`  ${marca} ${c.padEnd(30)} ${v ? String(v).slice(0, 78) : '—'}`);
}

// ---------- 2. Login y almacenamiento de la sesión ----------
await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
await page.fill('input[type=password]', APP_PASS);
await page.click('button[type=submit], input[type=submit]');
await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 25000 });
await page.waitForTimeout(1500);

const cookies = await context.cookies();
const almacen = await page.evaluate(async () => {
  const claves = (s) => { try { return Object.keys(s); } catch { return ['(sin acceso)']; } };
  // ¿Hay algo con aspecto de token JWT accesible desde JavaScript?
  const pareceJwt = (v) => typeof v === 'string' && /^ey[A-Za-z0-9_-]{10,}\./.test(v);
  const ls = {}; const ss = {};
  try { for (const k of Object.keys(localStorage)) ls[k] = pareceJwt(localStorage[k]) || /^\{.*ey[A-Za-z0-9_-]{10,}\./.test(localStorage[k] || ''); } catch {}
  try { for (const k of Object.keys(sessionStorage)) ss[k] = pareceJwt(sessionStorage[k]); } catch {}
  let bases = [];
  try { bases = (await indexedDB.databases()).map((d) => d.name); } catch {}
  return { localStorage: claves(localStorage), sessionStorage: claves(sessionStorage), tokenEnLS: ls, tokenEnSS: ss, indexedDB: bases };
});

console.log('\n=== 2. Dónde vive la sesión ===');
console.log(`  cookies: ${cookies.length}`);
for (const c of cookies) console.log(`    ${c.name.padEnd(28)} httpOnly=${c.httpOnly} secure=${c.secure} sameSite=${c.sameSite}`);
console.log(`  localStorage: ${almacen.localStorage.join(', ') || '(vacío)'}`);
const conToken = Object.entries(almacen.tokenEnLS).filter(([, v]) => v).map(([k]) => k);
console.log(`  claves de localStorage con aspecto de token JWT: ${conToken.length ? conToken.join(', ') : 'ninguna'}`);
console.log(`  sessionStorage: ${almacen.sessionStorage.join(', ') || '(vacío)'}`);
console.log(`  IndexedDB: ${almacen.indexedDB.join(', ') || '(ninguna)'}`);

// ---------- 3. Abrir un módulo y medir la red ----------
peticiones.length = 0;
await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate(() => { let i = 0; for (const el of document.querySelectorAll('button.nav')) el.setAttribute('data-audit-idx', String(i++)); });
const t0 = Date.now();
await page.locator('[data-audit-idx="2"]').click();
await page.waitForFunction(() => {
  const h1 = document.querySelector('main.content h1');
  const sp = document.querySelector('.spinner, .loading');
  return h1 && /Módulo\s*2/i.test(h1.textContent || '') && !(sp && sp.offsetParent) && document.querySelectorAll('main.content table').length >= 2;
}, { timeout: 30000 });
const msContenido = Date.now() - t0;

const total = peticiones.reduce((a, b) => a + b.bytes, 0);
const porTipo = {};
for (const p of peticiones) { porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + p.bytes; }
const hosts = {};
for (const p of peticiones) { hosts[p.host] = (hosts[p.host] ?? 0) + 1; }
// Peticiones repetidas exactamente igual.
const repes = {};
for (const p of peticiones) { const k = p.metodo + ' ' + p.host + p.ruta; repes[k] = (repes[k] ?? 0) + 1; }
const duplicadas = Object.entries(repes).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

console.log('\n=== 3. Red al abrir un módulo ===');
console.log(`  ${peticiones.length} peticiones · ${(total / 1024).toFixed(0)} KB · contenido visible a los ${msContenido} ms`);
console.log('  por tipo: ' + Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)} KB`).join(' · '));
console.log('  orígenes distintos: ' + Object.keys(hosts).length);
for (const [k, v] of Object.entries(hosts)) console.log(`    ${k}  ${v} peticiones`);
console.log(`  peticiones duplicadas: ${duplicadas.length}`);
for (const [k, n] of duplicadas.slice(0, 6)) console.log(`    ×${n}  ${k.slice(0, 92)}`);

// ---------- 4. Contenido mixto y terceros ----------
const mixto = peticiones.filter((p) => p.host && p.ruta && p.status && p.host.startsWith('http:'));
const propio = new URL(APP_URL).host;
const terceros = [...new Set(peticiones.map((p) => p.host))].filter((hh) => hh !== propio);
console.log('\n=== 4. Terceros y contenido mixto ===');
console.log(`  contenido mixto (http en página https): ${mixto.length}`);
console.log(`  orígenes de terceros: ${terceros.length}`);
terceros.forEach((t) => console.log(`    ${t}`));

// ---------- 5. Señales de mantenibilidad en los activos ----------
const activos = peticiones.filter((p) => ['script', 'stylesheet'].includes(p.tipo) && p.host === propio);
const conHash = activos.filter((p) => /[.-][a-f0-9]{8,}\.(js|css)$/i.test(p.ruta)).length;
const sinCache = activos.filter((p) => !p.cache || /no-cache|no-store|max-age=0/i.test(p.cache)).length;
console.log('\n=== 5. Activos propios ===');
console.log(`  ${activos.length} archivos JS/CSS · ${(activos.reduce((a, b) => a + b.bytes, 0) / 1024).toFixed(0)} KB`);
console.log(`  con huella de versión en el nombre: ${conHash} de ${activos.length}`);
console.log(`  sin caché efectiva: ${sinCache} de ${activos.length}`);
for (const a of activos) console.log(`    ${a.ruta.padEnd(34)} ${String((a.bytes / 1024).toFixed(0)).padStart(5)} KB  cache-control: ${a.cache ?? '—'}`);

console.log(`\n=== 6. Errores de consola durante la sesión: ${consola.length} ===`);
[...new Set(consola)].slice(0, 8).forEach((e) => console.log('  ' + e));

// ---------- 7. ¿La API exige autenticación? Solo se registra el código ----------
const apis = [...new Set(peticiones.filter((p) => /\/api\//.test(p.ruta)).map((p) => p.host + p.ruta))];
let sinAuth = null;
if (apis.length) {
  const limpio = await browser.newContext();                 // sin sesión
  const p2 = await limpio.newPage();
  const url = 'https://' + apis[0];
  try {
    const r = await p2.request.get(url, { timeout: 15000 });
    sinAuth = { endpoint: apis[0].replace(/^[^/]+/, '(host)'), status: r.status() };
  } catch (e) {
    sinAuth = { endpoint: apis[0].replace(/^[^/]+/, '(host)'), status: 'error: ' + e.message.slice(0, 40) };
  }
  await limpio.close();
  console.log('\n=== 7. Un endpoint de la API sin token (solo se anota el código) ===');
  console.log(`  GET ${sinAuth.endpoint} → ${sinAuth.status}`);
  console.log(`  ${sinAuth.status === 200 ? 'ATENCIÓN: responde 200 sin autenticación' : 'exige autenticación o rechaza la petición'}`);
}

await writeFile(path.join(OUT, 'red.json'), JSON.stringify({
  cabeceras, cookies: cookies.map((c) => ({ name: c.name, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite })),
  almacen, msContenido, nPeticiones: peticiones.length, totalKB: Math.round(total / 1024),
  porTipo, hosts, duplicadas, terceros, activos, nConsola: consola.length, consola: [...new Set(consola)].slice(0, 10), sinAuth,
}, null, 2));
await browser.close();
console.log('\nGuardado en out/calidad/red.json');
