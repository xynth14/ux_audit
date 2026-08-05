// Recaptura las 6 imágenes de report.html con los datos personales difuminados
// ANTES del disparo, de modo que el desenfoque queda horneado en los píxeles y
// no es recuperable. Un filter CSS en el informe publicado no serviría: el texto
// seguiría en el código fuente.
import { chromium, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;

const SHOTS = [
  { name: 'salud-desktop', pathname: '/salud.html', w: 1440, h: 900, mobile: false },
  { name: 'alertas-desktop', pathname: '/alertas-config.html', w: 1440, h: 900, mobile: false },
  { name: 'subdominios-desktop', pathname: '/subdominios.html', w: 1440, h: 900, mobile: false },
  { name: 'usuarios-desktop', pathname: '/usuarios.html', w: 1440, h: 900, mobile: false },
  { name: 'salud-mobile', pathname: '/salud.html', w: 390, h: 844, mobile: true },
  { name: 'alertas-mobile', pathname: '/alertas-config.html', w: 390, h: 844, mobile: true },
];

const OUT = path.join('out', 'before');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const informe = [];

for (const s of SHOTS) {
  const context = await browser.newContext({
    ...(s.mobile ? devices['iPhone 14'] : {}),
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 1,
  });
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
  await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 20000 });

  await page.goto(new URL(s.pathname, APP_URL).href, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1400);

  // Difuminado: se marca el elemento hoja más pequeño que contiene el dato.
  const marcados = await page.evaluate(() => {
    const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    // UID de Firebase: cadena alfanumérica larga sin espacios.
    const UID = /\b[A-Za-z0-9]{20,}\b/;
    // Nombres de persona visibles en la cabecera y en las tablas.
    const NOMBRES = /Kevin Callalli|Andrey Gamez|Franklin Putuquia|Alonso Aojalla|CSA-Havas|julio\.aojalla/i;

    const st = document.createElement('style');
    st.textContent = '.__rdct{filter:blur(5px)!important;-webkit-filter:blur(5px)!important}';
    document.head.appendChild(st);

    let n = 0;
    const tipos = { email: 0, uid: 0, nombre: 0 };
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length) continue;            // sólo hojas
      const t = (el.textContent || '').trim();
      if (!t || t.length > 120) continue;
      let hit = null;
      if (EMAIL.test(t)) hit = 'email';
      else if (NOMBRES.test(t)) hit = 'nombre';
      else if (UID.test(t) && !/^https?:/i.test(t)) hit = 'uid';
      if (!hit) continue;
      el.classList.add('__rdct');
      tipos[hit]++; n++;
    }
    return { n, tipos };
  });

  await page.waitForTimeout(350);
  const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 62 });
  await writeFile(path.join(OUT, `${s.name}.jpg`), buf);
  informe.push({ ...s, ...marcados, kb: Math.round(buf.length / 1024) });
  console.log(`${s.name.padEnd(22)} ${String(marcados.n).padStart(3)} elementos difuminados ` +
    `(correos ${marcados.tipos.email}, nombres ${marcados.tipos.nombre}, uid ${marcados.tipos.uid}) · ${Math.round(buf.length / 1024)} KB`);
  await context.close();
}

await browser.close();
const tot = informe.reduce((a, b) => a + b.n, 0);
console.log(`\n${tot} elementos difuminados en ${informe.length} capturas`);
if (!informe.every((i) => i.n > 0)) {
  console.error('AVISO: alguna captura no difuminó nada. Revisar antes de publicar.');
  process.exit(1);
}
