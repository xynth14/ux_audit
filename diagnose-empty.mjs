// ¿Los módulos "vacíos" lo están de verdad, o mi sonda los midió mal?
// Compara la estructura del DOM y espera mucho más antes de concluir.
import { chromium, devices } from 'playwright';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;

const browser = await chromium.launch();

for (const bp of [
  { name: 'tablet', width: 820, height: 1180, mobile: false },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]) {
  const context = await browser.newContext({
    ...(bp.mobile ? devices['iPhone 14'] : {}),
    viewport: { width: bp.width, height: bp.height },
  });
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
  await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 25000 });
  await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log(`\n########## ${bp.name} ##########`);

  // Estructura real: hijos directos del body y del contenedor principal.
  const outline = await page.evaluate(() => {
    const d = (el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 34)} [${Math.round(r.width)}×${Math.round(r.height)}] txt=${(el.innerText || '').trim().length}`;
    };
    const navBtn = document.querySelector('button.nav');
    const lines = ['BODY hijos:'];
    for (const c of document.body.children) lines.push('  ' + d(c));
    if (navBtn) {
      lines.push('CADENA del botón de nav hacia arriba:');
      for (let n = navBtn.parentElement, i = 0; n && i < 5; n = n.parentElement, i++) lines.push('  ' + d(n));
    }
    return lines.join('\n');
  });
  console.log(outline);

  // Ahora: clic en un módulo y espera larga, midiendo la evolución.
  await page.evaluate(() => {
    const RE = /(Resumen|Módulo\s*\d+)/i;
    let i = 0;
    for (const el of document.querySelectorAll('button, a, [role=tab]')) {
      const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (!RE.test(t) || t.length > 70) continue;
      if ([...el.children].some((c) => RE.test((c.innerText || '').replace(/\s+/g, ' ')))) continue;
      el.setAttribute('data-audit-idx', String(i++));
    }
  });

  for (const [idx, label] of [[3, 'Módulo 3 · SEO'], [2, 'Módulo 2 · Técnico']]) {
    await page.locator(`[data-audit-idx="${idx}"]`).click();
    console.log(`\n--- ${label} — evolución del contenido ---`);
    for (const wait of [500, 1500, 3000, 6000, 10000]) {
      await page.waitForTimeout(wait === 500 ? 500 : wait - (wait === 1500 ? 500 : wait === 3000 ? 1500 : wait === 6000 ? 3000 : 6000));
      const s = await page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('#content, .content, .panel, section');
        return {
          tablas: document.querySelectorAll('table').length,
          filas: document.querySelectorAll('table tbody tr').length,
          mainSel: main ? main.tagName.toLowerCase() + '.' + String(main.className || '').slice(0, 24) : 'NINGUNO',
          mainTxt: main ? (main.innerText || '').trim().length : 0,
          bodyTxt: document.body.innerText.trim().length,
          spinner: !!document.querySelector('.spinner, .loading, [class*=load], [class*=skelet]'),
        };
      });
      console.log(`  t=${String(wait).padStart(5)}ms  tablas=${s.tablas} filas=${String(s.filas).padStart(3)} bodyTxt=${String(s.bodyTxt).padStart(6)} main=${s.mainSel} mainTxt=${s.mainTxt} spinner=${s.spinner}`);
    }
  }
  await context.close();
}
await browser.close();
