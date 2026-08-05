// Arnés de auditoría UX/UI.
// Uso: node audit.mjs
// Lee credenciales de .env (nunca las imprime) y config.json para rutas/flujos.

import { chromium, devices } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env');

const { APP_URL, APP_USER, APP_PASS } = process.env;
const SAFE_MODE = process.env.SAFE_MODE !== 'false';
if (!APP_URL || !APP_USER || !APP_PASS) {
  console.error('Falta APP_URL / APP_USER / APP_PASS en .env');
  process.exit(1);
}

const config = JSON.parse(await readFile('config.json', 'utf8'));
const OUT = 'out';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// En producción bloqueamos las escrituras a nivel de red: la auditoría observa, no muta.
// Ojo: en stacks tipo Firebase/GraphQL las LECTURAS también son POST, así que no basta
// con filtrar por método — hay que dejar pasar auth y consultas de lectura.
const ALLOW_POST = [
  /identitytoolkit\.googleapis\.com/i,      // Firebase Auth
  /securetoken\.googleapis\.com/i,          // refresh de token
  /log[-_]?in|sign[-_]?in|auth|session|oauth/i,
  /firestore\.googleapis\.com.*\/Listen\//i, // Firestore: canal de lectura
  /:runQuery|:batchGet|:listen|:runAggregationQuery/i,
];
const BLOCK_POST = [
  /firestore\.googleapis\.com.*\/Write\//i,  // Firestore: canal de escritura
  /:commit|:batchWrite|:deleteDocument|:createDocument/i,
];

async function guardWrites(context) {
  if (!SAFE_MODE) return;
  await context.route('**/*', (route) => {
    const method = route.request().method();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return route.continue();

    const url = route.request().url();
    const blocked = BLOCK_POST.some((re) => re.test(url)) || !ALLOW_POST.some((re) => re.test(url));
    if (blocked) {
      // Sin query string: puede contener tokens de sesión.
      console.log(`  [SAFE_MODE] bloqueado ${method} ${url.split('?')[0]}`);
      return route.abort();
    }
    return route.continue();
  });
}

async function login(page) {
  const { login: L } = config;
  await page.goto(new URL(L.path, APP_URL).href, { waitUntil: 'domcontentloaded' });
  await page.fill(L.user, APP_USER);
  await page.fill(L.pass, APP_PASS);
  await page.click(L.submit);

  // Firebase autentica por XHR: puede no haber navegación, así que esperamos a que
  // el campo de password desaparezca en lugar de a un load event.
  try {
    await page.waitForSelector(L.pass, { state: 'detached', timeout: 20000 });
  } catch {
    await mkdir(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, 'login-fallido.png'), fullPage: true });
    const visible = await page.locator('[role=alert], .error, .invalid-feedback').allInnerTexts();
    throw new Error(
      `El login no avanzó. Captura en ${OUT}/login-fallido.png` +
      (visible.length ? ` — mensaje en pantalla: ${visible.join(' | ')}` : '')
    );
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  console.log('Login OK');
}

const findings = [];

async function auditFlow(context, flow, bp) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  const url = new URL(flow.path, APP_URL).href;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  const loadMs = Date.now() - t0;

  // Pasos opcionales del flujo (clicks, escritura) definidos en config.json.
  for (const step of flow.steps ?? []) {
    try {
      if (step.click) await page.click(step.click, { timeout: 5000 });
      if (step.fill) await page.fill(step.fill.selector, step.fill.value, { timeout: 5000 });
      if (step.wait) await page.waitForTimeout(step.wait);
    } catch (e) {
      console.log(`  paso fallido (${JSON.stringify(step)}): ${e.message.split('\n')[0]}`);
    }
  }

  const dir = path.join(OUT, slug(flow.name));
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${bp.name}.png`), fullPage: true });

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();

  // Métricas de layout que las heurísticas UX suelen necesitar.
  const metrics = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const targets = [...document.querySelectorAll('a,button,[role=button],input,select,textarea')];
    const small = targets.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
    }).length;
    const fonts = {};
    for (const el of document.querySelectorAll('p,span,li,td,label,div')) {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px) fonts[px] = (fonts[px] ?? 0) + 1;
    }
    return {
      horizontalOverflow: overflow,
      tapTargetsUnder44px: small,
      totalInteractive: targets.length,
      fontSizes: Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 8),
      title: document.title,
      h1Count: document.querySelectorAll('h1').length,
      imagesWithoutAlt: [...document.images].filter((i) => !i.alt).length,
    };
  });

  findings.push({
    flow: flow.name,
    breakpoint: bp.name,
    url,
    loadMs,
    metrics,
    consoleErrors: consoleErrors.slice(0, 10),
    violations: axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes.slice(0, 3).map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  });

  const crit = axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).length;
  console.log(`  ${flow.name} @ ${bp.name}: ${axe.violations.length} hallazgos a11y (${crit} graves), ${loadMs}ms`);
  await page.close();
}

// Mapea la navegación disponible tras el login, para saber qué auditar.
async function dumpNavMap(page) {
  const map = await page.evaluate(() => {
    const txt = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return {
      landedOn: location.pathname + location.hash,
      links: [...document.querySelectorAll('a[href]')]
        .map((a) => ({ text: txt(a), href: a.getAttribute('href') }))
        .filter((l) => l.text || l.href),
      buttons: [...document.querySelectorAll('button, [role=button], [role=tab]')].map(txt).filter(Boolean),
      headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => `${h.tagName}: ${txt(h)}`),
    };
  });
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'nav-map.json'), JSON.stringify(map, null, 2));
  console.log(`  Mapa de navegación → ${OUT}/nav-map.json (${map.links.length} enlaces, ${map.buttons.length} botones)`);
}

const browser = await chromium.launch();
console.log(`Modo: ${SAFE_MODE ? 'PRODUCCIÓN (solo lectura)' : 'STAGING (navegación libre)'}`);

let first = true;
for (const bp of config.breakpoints) {
  console.log(`\n=== ${bp.name} (${bp.width}x${bp.height}) ===`);
  const context = await browser.newContext({
    ...(bp.mobile ? devices['iPhone 14'] : {}),
    viewport: { width: bp.width, height: bp.height },
    deviceScaleFactor: 2,
  });
  await guardWrites(context);

  // Firebase Auth guarda la sesión en IndexedDB, que storageState() no serializa:
  // hay que autenticarse dentro de cada contexto.
  const page = await context.newPage();
  await login(page);
  if (first) {
    await dumpNavMap(page);
    first = false;
  }
  await page.close();

  for (const flow of config.flows) await auditFlow(context, flow, bp);
  await context.close();
}

await browser.close();
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
console.log(`\nListo. Capturas y datos en ./${OUT}/ — findings.json tiene el detalle.`);
