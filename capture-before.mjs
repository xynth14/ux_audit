// Captura los "antes" en JPEG ligero (scale 1) para incrustarlos en el informe.
import { chromium, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;

const SHOTS = [
  { name: 'salud-desktop', pathname: '/salud.html', w: 1440, h: 900, mobile: false },
  { name: 'alertas-desktop', pathname: '/alertas-config.html', w: 1440, h: 900, mobile: false },
  { name: 'subdominios-desktop', pathname: '/subdominios.html', w: 1440, h: 900, mobile: false },
  { name: 'bitacora-desktop', pathname: '/bitacora.html', w: 1440, h: 900, mobile: false },
  { name: 'usuarios-desktop', pathname: '/usuarios.html', w: 1440, h: 900, mobile: false },
  { name: 'salud-mobile', pathname: '/salud.html', w: 390, h: 844, mobile: true },
  { name: 'alertas-mobile', pathname: '/alertas-config.html', w: 390, h: 844, mobile: true },
];

const OUT = path.join('out', 'before');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const s of SHOTS) {
  const context = await browser.newContext({
    ...(s.mobile ? devices['iPhone 14'] : {}),
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 1,
  });
  // Solo lectura: nada de POST fuera de auth.
  await context.route('**/*', (route) => {
    const m = route.request().method();
    const u = route.request().url();
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
    const isAuthOrRead = /identitytoolkit|securetoken|auth|session|oauth|\/Listen\/|:runQuery|:batchGet/i.test(u);
    return isWrite && !isAuthOrRead ? route.abort() : route.continue();
  });

  const page = await context.newPage();
  await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
  await page.fill('input[type=password]', APP_PASS);
  await page.click('button[type=submit], input[type=submit]');
  await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 20000 });

  await page.goto(new URL(s.pathname, APP_URL).href, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 62 });
  await writeFile(path.join(OUT, `${s.name}.jpg`), buf);
  console.log(`${s.name}: ${(buf.length / 1024).toFixed(0)} KB`);
  await context.close();
}

await browser.close();
