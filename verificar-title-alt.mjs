// ¿Aparece el atributo title de las imágenes en algún módulo? Busca en las
// cabeceras de M4 Tagging y M10 Imágenes cualquier referencia a title / alt.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
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

const resultado = {};
for (const [idx, nombre, re] of [[4, 'Módulo 4 · Tagging', /Módulo\s*4/i], [10, 'Módulo 10 · Imágenes', /Módulo\s*10/i]]) {
  await page.locator(`[data-audit-idx="${idx}"]`).click();
  await page.waitForFunction((patron) => {
    const h1 = document.querySelector('main.content h1');
    const sp = document.querySelector('.spinner, .loading');
    return h1 && new RegExp(patron, 'i').test(h1.textContent || '') && !(sp && sp.offsetParent) &&
      document.querySelectorAll('main.content table').length >= 1;
  }, re.source, { timeout: 30000 });
  await page.waitForTimeout(1800);

  const r = await page.evaluate(() => {
    const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const main = document.querySelector('main.content');
    const cabeceras = [...main.querySelectorAll('table')].map((t, i) => ({
      tabla: i + 1,
      cols: [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent)),
    }));
    const texto = clean(main.innerText);
    return {
      cabeceras,
      menciones: {
        title: (texto.match(/\btitle\b/gi) || []).length,
        alt: (texto.match(/\balt\b/gi) || []).length,
        agregarAlt: /agregar alt/i.test(texto),
        ocr: (texto.match(/\bocr\b/gi) || []).length,
        clickedBanner: (texto.match(/clicked_banner_name/gi) || []).length,
        elementUrl: (texto.match(/element_url/gi) || []).length,
      },
    };
  });
  resultado[nombre] = r;

  console.log(`\n######## ${nombre} ########`);
  r.cabeceras.forEach((c) => console.log(`  Tabla ${c.tabla} (${c.cols.length} col): ${c.cols.join(' · ')}`));
  console.log(`  menciones → title: ${r.menciones.title} · alt: ${r.menciones.alt} · «Agregar ALT»: ${r.menciones.agregarAlt} · OCR: ${r.menciones.ocr} · clicked_banner_name: ${r.menciones.clickedBanner} · element_url: ${r.menciones.elementUrl}`);
  const conTitle = r.cabeceras.flatMap((c) => c.cols).filter((x) => /title|t[íi]tulo/i.test(x));
  const conAlt = r.cabeceras.flatMap((c) => c.cols).filter((x) => /\balt\b/i.test(x));
  console.log(`  columnas con «title/título»: ${conTitle.length ? conTitle.join(', ') : 'NINGUNA'}`);
  console.log(`  columnas con «alt»: ${conAlt.length ? conAlt.join(', ') : 'ninguna'}`);
}

await writeFile(path.join('out', 'm2', 'title-alt.json'), JSON.stringify(resultado, null, 2));
await browser.close();
