// Inyecta las capturas como data URI en la plantilla → report.html autocontenido.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const BEFORE = path.join('out', 'before');
const files = await readdir(BEFORE);
const template = await readFile('report.template.html', 'utf8');

let html = template;
let injected = 0;
for (const f of files) {
  const name = path.basename(f, path.extname(f));
  const token = `{{IMG:${name}}}`;
  if (!html.includes(token)) continue;
  const b64 = (await readFile(path.join(BEFORE, f))).toString('base64');
  html = html.replaceAll(token, `data:image/jpeg;base64,${b64}`);
  injected++;
}

const leftover = html.match(/\{\{IMG:[^}]+\}\}/g);
if (leftover) {
  console.error('Faltan capturas para: ' + [...new Set(leftover)].join(', '));
  process.exit(1);
}

await writeFile('report.html', html);

// El publicador envuelve el fragmento en <!doctype html><head>…</head><body>.
// Sin doctype el navegador entra en modo quirks (las tablas dejan de heredar
// color) y las pruebas locales mienten. Este archivo replica el envoltorio.
const preview = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
${html}
</body>
</html>
`;
await writeFile('report.preview.html', preview);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`report.html generado — ${injected} capturas incrustadas, ${kb} KB`);
console.log('report.preview.html generado (con doctype, para pruebas locales)');
