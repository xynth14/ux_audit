// Convierte el document.xml extraído de un .docx a texto legible,
// conservando la estructura de párrafos, tablas y listas.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = process.argv[2];
const xml = await readFile(path.join(DIR, 'word_document.xml'), 'utf8');

// Estilo de cada párrafo, para reconocer títulos.
const parrafos = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map((m) => m[1]);

const texto = (p) => {
  let t = p
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return t.replace(/[ ]/g, ' ').replace(/ {2,}/g, ' ').trim();
};

const estilo = (p) => (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] ?? '';
const esLista = (p) => /<w:numPr>/.test(p);
const imagenes = (p) => (p.match(/<a:blip/g) || []).length;

const lineas = [];
let nImg = 0;
for (const p of parrafos) {
  const t = texto(p);
  const st = estilo(p);
  const img = imagenes(p);
  if (img) { nImg += img; lineas.push(`[IMAGEN ${nImg}]${t ? ' ' + t : ''}`); continue; }
  if (!t) continue;
  if (/^Heading1|^Ttulo1|^Title/i.test(st)) lineas.push(`\n# ${t}`);
  else if (/^Heading2|^Ttulo2/i.test(st)) lineas.push(`\n## ${t}`);
  else if (/^Heading3|^Ttulo3/i.test(st)) lineas.push(`\n### ${t}`);
  else if (/^Heading/i.test(st)) lineas.push(`\n#### ${t}`);
  else if (esLista(p)) lineas.push(`  - ${t}`);
  else lineas.push(t);
}

// Tablas: se recuperan aparte para no perder su estructura.
const tablas = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map((m, i) => {
  const filas = [...m[1].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map((f) =>
    [...f[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((c) => texto(c[1]).replace(/\n/g, ' ')));
  return { n: i + 1, filas };
});

const salida = [
  `IMÁGENES INCRUSTADAS: ${nImg}`,
  `TABLAS: ${tablas.length}`,
  `PÁRRAFOS CON TEXTO: ${lineas.length}`,
  '',
  '================ TEXTO ================',
  lineas.join('\n'),
  '',
  '================ TABLAS ================',
  ...tablas.map((t) => `\n--- Tabla ${t.n} (${t.filas.length} filas) ---\n` +
    t.filas.map((f) => f.join('  |  ')).join('\n')),
].join('\n');

const dest = path.join(DIR, 'auditoria_ux.txt');
await writeFile(dest, salida, 'utf8');
console.log(`${salida.length} caracteres → ${dest}`);
console.log(`imágenes=${nImg} tablas=${tablas.length} párrafos=${lineas.length}`);
