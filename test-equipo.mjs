// Verifica que cada observación del documento del equipo esté en el informe
// del módulo que le corresponde, buscando una frase distintiva de cada una.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EQUIPO, CORRIDAS, PROPUESTAS_EQUIPO } from './module-reports.data.mjs';

const ARCHIVO = {
  'resumen': '00-resumen.html',
  'modulo-1-sitemap': '01-modulo-1-sitemap.html',
  'modulo-4-tagging': '04-modulo-4-tagging.html',
  'modulo-5-links': '05-modulo-5-links.html',
  'modulo-6-content-ui': '06-modulo-6-content-ui.html',
};

// Frase textual del Word que debe poder rastrearse en cada informe.
const HUELLAS = {
  'resumen': ['topHeader', 'desplazamiento horizontal del sidebar', 'agrupar las filas por su estado de semáforo',
              'agrupe los hallazgos por la regla', '177 reglas', 'detalle de una regla concreta'],
  'modulo-1-sitemap': ['no tiene hallazgos, la tabla se dibuja igualmente', 'Tipo de página'],
  'modulo-4-tagging': ['directorio-de-abonados-fijos'],
  'modulo-5-links': ['42 enlaces rotos', 'iframe roto'],
  'modulo-6-content-ui': ['PDF_Obsoletos', 'Clase del elemento'],
};

let fallos = 0, total = 0;
for (const [slug, archivo] of Object.entries(ARCHIVO)) {
  const html = await readFile(path.join('informes', archivo), 'utf8');
  const items = EQUIPO[slug] ?? [];
  console.log(`\n### ${archivo} — ${items.length} observaciones`);

  // El bloque debe existir y llevar la corrida.
  const bloque = html.includes('Observaciones del equipo');
  console.log(`  ${bloque ? 'ok  ' : 'FALLA'} bloque «Observaciones del equipo»`);
  if (!bloque) fallos++;
  total++;

  if (CORRIDAS[slug]) {
    const run = html.includes(CORRIDAS[slug]);
    console.log(`  ${run ? 'ok  ' : 'FALLA'} run_id ${CORRIDAS[slug]}`);
    if (!run) fallos++;
    total++;
  }

  // Cada observación, por su título y por una huella textual.
  for (const i of items) {
    const t = html.includes(i.titulo);
    console.log(`  ${t ? 'ok  ' : 'FALLA'} [${i.tipo}/${i.sev}] ${i.titulo.slice(0, 58)}`);
    if (!t) fallos++;
    total++;
  }
  for (const h of HUELLAS[slug] ?? []) {
    const ok = html.includes(h);
    console.log(`  ${ok ? 'ok  ' : 'FALLA'} huella «${h.slice(0, 46)}»`);
    if (!ok) fallos++;
    total++;
  }

  // Las de dato deben ir marcadas como pendientes.
  const pend = items.filter((i) => i.pendiente).length;
  if (pend) {
    const n = (html.match(/pendiente de confirmar/g) || []).length;
    const ok = n >= pend;
    console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${pend} marcada(s) «pendiente de confirmar» (encontradas ${n})`);
    if (!ok) fallos++;
    total++;
  }

  if (PROPUESTAS_EQUIPO[slug]) {
    const ok = html.includes('Propuesta de rediseño aportada por el equipo');
    console.log(`  ${ok ? 'ok  ' : 'FALLA'} propuesta de rediseño del equipo`);
    if (!ok) fallos++;
    total++;
  }
}

// El índice debe contabilizarlas.
const idx = await readFile(path.join('informes', 'index.html'), 'utf8');
const suma = Object.values(EQUIPO).reduce((a, b) => a + b.length, 0);
console.log(`\n### index.html`);
for (const [n, c] of [['contador total', idx.includes(`<dd>${suma}</dd>`)], ['marcas «del equipo»', (idx.match(/del equipo<\/span>/g) || []).length === Object.keys(EQUIPO).length]]) {
  console.log(`  ${c ? 'ok  ' : 'FALLA'} ${n}`);
  if (!c) fallos++;
  total++;
}

console.log(`\n${total} comprobaciones · ${fallos === 0 ? 'TODO CORRECTO' : fallos + ' fallidas'}`);
console.log(`Observaciones integradas: ${suma} en ${Object.keys(EQUIPO).length} módulos`);
process.exit(fallos ? 1 : 0);
