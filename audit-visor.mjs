// Auditoría del visor de resultados, módulo por módulo.
// El sidebar no tiene URLs, así que cada vista se alcanza haciendo clic.
import { chromium, devices } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');
const { APP_URL, APP_USER, APP_PASS } = process.env;
const SAFE_MODE = process.env.SAFE_MODE !== 'false';

const OUT = path.join('out', 'visor');
const SHOTS = path.join(OUT, 'shots');
await mkdir(SHOTS, { recursive: true });

const BREAKPOINTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true },
  { name: 'tablet', width: 820, height: 1180, mobile: false },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
];

const slug = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function guard(context) {
  if (!SAFE_MODE) return;
  await context.route('**/*', (route) => {
    const m = route.request().method();
    const u = route.request().url();
    const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
    const ok = /identitytoolkit|securetoken|auth|session|oauth|\/Listen\/|:runQuery|:batchGet|:runAggregationQuery/i.test(u);
    return write && !ok ? route.abort() : route.continue();
  });
}

async function login(page) {
  await page.goto(new URL('/', APP_URL).href, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type=email], input[name*=user i], input[name*=email i]', APP_USER);
  await page.fill('input[type=password]', APP_PASS);
  await page.click('button[type=submit], input[type=submit]');
  await page.waitForSelector('input[type=password]', { state: 'detached', timeout: 25000 });
}

// Marca los ítems del sidebar para poder clicarlos sin ambigüedad.
const tagNav = async (page) =>
  page.evaluate(() => {
    const RE = /(Resumen|Módulo\s*\d+)/i;
    const out = [];
    let i = 0;
    for (const el of document.querySelectorAll('button, a, [role=tab]')) {
      const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (!RE.test(t) || t.length > 70) continue;
      if ([...el.children].some((c) => RE.test((c.innerText || '').replace(/\s+/g, ' ')))) continue;
      el.setAttribute('data-audit-idx', String(i));
      out.push({ idx: i, label: t.replace(/^[a-z_]+\s+/, ''), ligature: (t.match(/^([a-z_]+)\s/) || [])[1] ?? null });
      i++;
    }
    return out;
  });

// Espera a que el contenido esté cargado de verdad: la app muestra un spinner
// entre 1,5 y 3 s. Medir antes de que desaparezca da lecturas falsas de "vacío".
async function waitForContent(page) {
  const t0 = Date.now();
  try {
    await page.waitForFunction(
      () => {
        const sp = document.querySelector('.spinner, .loading, [class*=skelet]');
        const spinning = sp && sp.offsetParent !== null;
        const main = document.querySelector('main.content');
        return !spinning && main && (main.innerText || '').trim().length > 250;
      },
      { timeout: 20000 }
    );
  } catch {
    // Se agota: puede ser un módulo genuinamente vacío. Se registra como tal.
  }
  await page.waitForTimeout(400);
  return Date.now() - t0;
}

// Radiografía del contenido tras abrir un módulo. Mide main.content, no el body
// menos el sidebar: esa resta daba resultados inconsistentes.
const probe = (page) =>
  page.evaluate(() => {
    const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const main = document.querySelector('main.content') ?? document.body;
    const all = [...main.querySelectorAll('h1,h2,h3,h4')].map((h) => `${h.tagName}: ${clean(h.textContent).slice(0, 70)}`);
    const tables = [...main.querySelectorAll('table')].map((t) => ({
      rows: t.querySelectorAll('tbody tr').length,
      cols: t.querySelectorAll('thead th').length,
      headers: [...t.querySelectorAll('thead th')].map((th) => clean(th.textContent)).slice(0, 10),
    }));
    const text = clean(main.innerText);

    const sidebar = document.querySelector('aside.sidebar');
    const interactive = [...main.querySelectorAll('a,button,input,select,textarea,[role=button]')];
    const small = interactive.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
    }).length;

    const fonts = {};
    for (const el of main.querySelectorAll('p,span,li,td,label,div,h1,h2,h3')) {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px) fonts[px] = (fonts[px] ?? 0) + 1;
    }

    const imgs = [...main.querySelectorAll('img')];
    return {
      headings: all,
      tables,
      tableCount: tables.length,
      totalRows: tables.reduce((a, t) => a + t.rows, 0),
      contentText: text.slice(0, 700),
      contentLen: text.length,
      contentHeight: Math.round(main.getBoundingClientRect().height),
      // Vacío de verdad: poco contenido Y una frase de estado vacío.
      empty: text.length < 400 || (text.length < 3000 && /no hay|sin datos|sin resultados|todav[íi]a no|no se encontr/i.test(text)),
      interactive: interactive.length,
      tapUnder44: small,
      fontSizes: Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 8),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      canvases: main.querySelectorAll('canvas').length,
      images: imgs.length,
      imagesNoAlt: imgs.filter((i) => !i.alt).length,
      // El sidebar llega colapsado: sólo iconos, sin etiquetas.
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      sidebarCollapsed: document.body.classList.contains('sidebar-collapsed'),
      // ¿Los iconos ensucian el nombre accesible de la navegación?
      navAccessibleNames: [...document.querySelectorAll('button.nav')].slice(0, 3).map((b) => clean(b.innerText)),
    };
  });

const findings = [];
const browser = await chromium.launch();
console.log(`Modo: ${SAFE_MODE ? 'PRODUCCIÓN (solo lectura)' : 'STAGING'}\n`);

for (const bp of BREAKPOINTS) {
  console.log(`=== ${bp.name} (${bp.width}×${bp.height}) ===`);
  const context = await browser.newContext({
    ...(bp.mobile ? devices['iPhone 14'] : {}),
    viewport: { width: bp.width, height: bp.height },
    deviceScaleFactor: 1,
  });
  await guard(context);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await login(page);
  await page.goto(new URL('/index.html', APP_URL).href, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);

  const items = await tagNav(page);
  if (!items.length) { console.log('  sidebar no encontrado'); await context.close(); continue; }

  for (const item of items) {
    const errBefore = consoleErrors.length;
    const t0 = Date.now();
    try {
      await page.locator(`[data-audit-idx="${item.idx}"]`).click({ timeout: 8000 });
    } catch {
      console.log(`  ${item.label}: no clicable`);
      continue;
    }
    await waitForContent(page);
    const ms = Date.now() - t0;

    const info = await probe(page);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    const file = `${slug(item.label)}-${bp.name}.jpg`;
    await page.screenshot({ path: path.join(SHOTS, file), fullPage: true, type: 'jpeg', quality: 62 });

    findings.push({
      module: item.label,
      slug: slug(item.label),
      ligature: item.ligature,
      breakpoint: bp.name,
      shot: file,
      renderMs: ms,
      ...info,
      consoleErrors: consoleErrors.slice(errBefore, errBefore + 6),
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        sample: v.nodes.slice(0, 3).map((n) => ({ target: n.target, summary: String(n.failureSummary).replace(/\s+/g, ' ').slice(0, 300) })),
      })),
    });

    const grave = axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).length;
    console.log(
      `  ${item.label.padEnd(26)} ${String(ms).padStart(5)}ms · ` +
      `${info.tableCount}tbl/${String(info.totalRows).padStart(3)}filas · ${String(info.contentLen).padStart(6)}car · ` +
      `alto ${String(info.contentHeight).padStart(5)}px` +
      `${info.empty ? ' · VACÍO' : ''} · axe ${axe.violations.length} (${grave} graves)`
    );
  }

  // Comprobación honesta del recargado: compara el CONTENIDO, no el sidebar.
  if (bp.name === 'desktop') {
    const target = items[items.length - 1];
    await page.locator(`[data-audit-idx="${target.idx}"]`).click().catch(() => {});
    await waitForContent(page);
    const before = (await probe(page)).contentText.slice(0, 160);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForContent(page);
    const after = (await probe(page)).contentText.slice(0, 160);
    console.log(`\n  Recargado con "${target.label}" abierto:`);
    console.log(`    antes:   "${before.slice(0, 90)}"`);
    console.log(`    después: "${after.slice(0, 90)}"`);
    console.log(`    → ${before === after ? 'conservó el módulo' : 'PERDIÓ el módulo, volvió al inicio'}`);
    await writeFile(path.join(OUT, 'reload-test.json'), JSON.stringify({ module: target.label, before, after, preserved: before === after }, null, 2));
  }
  console.log('');
  await context.close();
}

await browser.close();
await writeFile(path.join(OUT, 'findings-visor.json'), JSON.stringify(findings, null, 2));
console.log(`${findings.length} auditorías guardadas en ${path.join(OUT, 'findings-visor.json')}`);
