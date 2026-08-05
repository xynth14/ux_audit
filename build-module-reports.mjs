// Genera un informe HTML local por cada módulo del visor, más un índice.
// Las métricas vienen de out/visor/findings-visor.json; el texto, de
// module-reports.data.mjs. Nada se escribe a mano dos veces.
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { COMUNES, MODULOS, EQUIPO, CORRIDAS, PROPUESTAS_EQUIPO } from './module-reports.data.mjs';

const DEST = 'informes';
const CAPS = path.join(DEST, 'capturas');
const SHOTS = path.join('out', 'visor', 'shots');
await mkdir(CAPS, { recursive: true });

const data = JSON.parse(await readFile(path.join('out', 'visor', 'findings-visor.json'), 'utf8'));

const SEV = { critico: 'Crítico', grave: 'Grave', moderado: 'Moderado', menor: 'Menor' };
const SEV_ORDER = { critico: 0, grave: 1, moderado: 2, menor: 3 };
const esc = (s) => String(s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nf = (n) => new Intl.NumberFormat('es-PE').format(n);

const CSS = `
:root{
  --ink:#101820;--ink-soft:#2A323C;--muted:#5A6472;--paper:#F4F6F8;--surface:#FFF;
  --surface-2:#EDF1F5;--rule:#CFD7E0;--rule-soft:#E4E9EF;--blueprint:#1B4B7F;--blueprint-soft:#E3EAF2;
  --critico:#B3261E;--grave:#C2410C;--moderado:#8A5200;--menor:#5A6472;--ok:#14713D;
  --display:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
  --body:"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
  --mono:"Cascadia Mono","Cascadia Code",Consolas,"SF Mono",ui-monospace,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --ink:#E8ECF0;--ink-soft:#C6CFD9;--muted:#9AA5B2;--paper:#0E1319;--surface:#151B22;
  --surface-2:#1B222B;--rule:#2C353F;--rule-soft:#212932;--blueprint:#8FBDEC;--blueprint-soft:#16243A;
  --critico:#F09189;--grave:#F0A878;--moderado:#DFBE6E;--menor:#9AA5B2;--ok:#74CE9B;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);font-size:16.5px;line-height:1.6;-webkit-font-smoothing:antialiased}
*:focus-visible{outline:2px solid var(--blueprint);outline-offset:2px}
code{font-family:var(--mono);font-size:.86em;background:var(--surface-2);padding:.1em .35em;border-radius:2px;overflow-wrap:anywhere}
a{color:var(--blueprint)}
.wrap{max-width:1140px;margin:0 auto;padding:0 clamp(1.15rem,3.5vw,2.5rem)}

.top{border-bottom:1px solid var(--rule);padding:1.5rem 0 0}
.back{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;display:inline-block;margin-bottom:1.4rem}
.eyebrow{font-family:var(--mono);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--blueprint);margin:0 0 .6rem;display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap}
.eyebrow .lig{color:var(--muted);text-transform:none;letter-spacing:0}
h1{font-family:var(--display);font-weight:400;font-size:clamp(2rem,4.4vw,2.9rem);line-height:1.05;letter-spacing:-.015em;margin:0 0 .5rem;text-wrap:balance}
.purpose{max-width:64ch;color:var(--ink-soft);font-size:1.2rem;line-height:1.5;margin:0 0 1.75rem}

/* Filetes por celda, no fondo del contenedor: si la última fila queda
   incompleta, el hueco no se pinta de gris. */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule)}
.stat{padding:.75rem .85rem .85rem;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.stat dt{font-family:var(--mono);font-size:.68rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem}
.stat dd{margin:0;font-family:var(--display);font-size:1.45rem;line-height:1;font-variant-numeric:tabular-nums}
.stat dd small{font-family:var(--body);font-size:.76rem;color:var(--muted)}
.stat.warn dd{color:var(--critico)}

main{padding:2.75rem 0 4rem}
section{margin-bottom:3.25rem}
h2{font-family:var(--display);font-weight:400;font-size:1.9rem;line-height:1.15;margin:0 0 .2rem;letter-spacing:-.01em}
.sub{color:var(--muted);font-size:1rem;margin:0 0 1.6rem;padding-bottom:.9rem;border-bottom:2px solid var(--ink);max-width:68ch}

.good{border:1px solid var(--rule);border-left:3px solid var(--ok);background:var(--surface);padding:1rem 1.15rem;margin-bottom:2rem}
.good .lead{font-family:var(--mono);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ok);display:block;margin-bottom:.35rem}
.good p{margin:0;max-width:66ch}

.finds{border-top:1px solid var(--rule)}
.find{display:grid;grid-template-columns:104px minmax(0,1fr);gap:0 1.4rem;padding:1.4rem 0;border-bottom:1px solid var(--rule-soft)}
@media (max-width:640px){.find{grid-template-columns:1fr;gap:.7rem}.find__gut{flex-direction:row!important;align-items:center}}
.find__gut{display:flex;flex-direction:column;gap:.45rem;align-items:flex-start}
.tag{font-family:var(--mono);font-size:.64rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700;border:1px solid currentColor;padding:.16em .42em;white-space:nowrap}
.t-critico{color:var(--critico)}.t-grave{color:var(--grave)}.t-moderado{color:var(--moderado)}.t-menor{color:var(--menor)}
.find__id{font-family:var(--mono);font-size:.8rem;color:var(--muted);font-weight:700}
.find h3{font-size:1.06rem;font-weight:600;line-height:1.35;margin:0 0 .5rem;text-wrap:balance}
.find p{margin:0 0 .55rem;max-width:70ch;color:var(--ink-soft)}
.find p:last-child{margin-bottom:0}
.lbl{font-family:var(--mono);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:.45rem}
.find .fix{color:var(--ink)}
.find .nota{font-size:.9rem;color:var(--muted);border-left:2px solid var(--rule);padding-left:.7rem}

.tbl-scroll{overflow-x:auto;border:1px solid var(--rule);background:var(--surface)}
.tbl-scroll:focus-visible{outline:2px solid var(--blueprint);outline-offset:2px}
table{border-collapse:collapse;width:100%;font-size:.83rem;min-width:520px}
th,td{text-align:left;padding:.55rem .8rem;border-bottom:1px solid var(--rule-soft);vertical-align:top}
thead th{font-family:var(--mono);font-size:.68rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:600;border-bottom:1px solid var(--rule);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}

.shot{border:1px solid var(--rule);background:#fff;overflow:auto;max-height:560px}
.shot img{display:block;width:100%;height:auto}
.shot:focus-visible{outline:2px solid var(--blueprint);outline-offset:2px}
.shot-links{font-size:.85rem;color:var(--muted);margin:.6rem 0 0;display:flex;gap:1rem;flex-wrap:wrap}

details.comunes{border:1px solid var(--rule);background:var(--surface);padding:0}
details.comunes>summary{cursor:pointer;padding:.9rem 1.1rem;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:1rem;align-items:center}
details.comunes>summary::-webkit-details-marker{display:none}
details.comunes>summary::after{content:"desplegar";font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--blueprint)}
details.comunes[open]>summary::after{content:"plegar"}
details.comunes[open]>summary{border-bottom:1px solid var(--rule)}
.comunes__body{padding:.4rem 1.1rem 1.1rem}
.comunes__body .finds{border-top:0}
.comunes__body .find:last-child{border-bottom:0}

/* ---------- Observaciones del equipo (revisión manual) ---------- */
.eq{border:1px solid var(--rule);background:var(--surface)}
.eq__h{padding:.9rem 1.1rem;border-bottom:1px solid var(--rule);display:flex;gap:.75rem;align-items:baseline;flex-wrap:wrap}
.eq__h b{font-size:1rem;font-weight:600}
.eq__h .fuente{font-size:.85rem;color:var(--muted)}
.eq__h .run{font-family:var(--mono);font-size:.7rem;color:var(--muted);margin-left:auto;white-space:nowrap}
.eq__grupo{font-family:var(--mono);font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);padding:.85rem 1.1rem .2rem;display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap}
.eq__grupo.dato{color:var(--moderado)}
.eq__grupo span{letter-spacing:0;text-transform:none;font-family:var(--body);font-size:.82rem}
.eq-item{padding:.85rem 1.1rem 1rem;border-top:1px solid var(--rule-soft)}
.eq-item:first-of-type{border-top:0}
.eq-item__top{display:flex;gap:.55rem;align-items:baseline;flex-wrap:wrap;margin-bottom:.4rem}
.eq-item h4{margin:0;font-size:1rem;font-weight:600;line-height:1.35;flex:1 1 20ch;min-width:0;text-wrap:balance}
.eq-item p{margin:0 0 .5rem;max-width:72ch;font-size:.95rem;color:var(--ink-soft)}
.eq-item p:last-child{margin-bottom:0}
.eq-item .accion{color:var(--ink)}
.eq-ver{font-size:.88rem;color:var(--muted);border-left:2px solid var(--blueprint);background:var(--surface-2);padding:.55rem .75rem;margin-top:.5rem;max-width:74ch}
.eq-ver b{font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--blueprint);display:block;margin-bottom:.15rem}
.eq-pend{font-family:var(--mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--moderado);border:1px dashed currentColor;padding:.14em .4em;white-space:nowrap}
.eq-prop{padding:.9rem 1.1rem;border-top:1px solid var(--rule);background:var(--blueprint-soft)}
.eq-prop .lead{font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--blueprint);display:block;margin-bottom:.3rem}
.eq-prop p{margin:0;max-width:78ch;font-size:.93rem}

.idx-grid{display:grid;gap:1px;background:var(--rule);border:1px solid var(--rule)}
.idx-row{background:var(--surface);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem 1.5rem;padding:.9rem 1.1rem;text-decoration:none;color:inherit;align-items:center}
.idx-row:hover{background:var(--blueprint-soft)}
.idx-row__t{font-weight:600;font-size:1.02rem}
.idx-row__d{color:var(--muted);font-size:.88rem;margin-top:.15rem;max-width:70ch}
.idx-sev{display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end}
.pill{font-family:var(--mono);font-size:.68rem;font-weight:700;padding:.2em .45em;border:1px solid currentColor;white-space:nowrap}
`;

const page = (title, body) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;

// Bloque de observaciones del equipo, separado en interfaz y fiabilidad del dato.
const renderEquipo = (slug) => {
  const items = EQUIPO[slug] ?? [];
  const prop = PROPUESTAS_EQUIPO[slug];
  if (!items.length && !prop) return '';
  const run = CORRIDAS[slug];

  const grupo = (tipo, titulo, nota) => {
    const del = items.filter((i) => i.tipo === tipo);
    if (!del.length) return '';
    return `
      <p class="eq__grupo ${tipo === 'dato' ? 'dato' : ''}">${titulo} · ${del.length}<span>${nota}</span></p>
      ${del.map((i) => `
      <article class="eq-item">
        <div class="eq-item__top">
          <span class="tag t-${i.sev}">${SEV[i.sev]}</span>
          <h4>${i.titulo}</h4>
          ${i.pendiente ? '<span class="eq-pend">pendiente de confirmar</span>' : ''}
        </div>
        <p><span class="lbl">Observado</span>${i.observacion}</p>
        <p class="accion"><span class="lbl">Qué hacer</span>${i.accion}</p>
        ${i.verificado ? `<p class="eq-ver"><b>Comprobación instrumentada</b>${i.verificado}</p>` : ''}
      </article>`).join('')}`;
  };

  return `
  <section>
    <h2>Observaciones del equipo</h2>
    <p class="sub">Revisión manual recogida en «Auditoria_UX.docx». Se presentan aparte de los hallazgos medidos para que quede claro el origen de cada una.</p>
    <div class="eq">
      <div class="eq__h">
        <b>${items.length} ${items.length === 1 ? 'observación' : 'observaciones'}</b>
        <span class="fuente">documento del equipo, 12 capturas anotadas</span>
        ${run ? `<span class="run">corrida ${esc(run)}</span>` : ''}
      </div>
      ${grupo('ui', 'Interfaz', 'dueño: front-end')}
      ${grupo('dato', 'Fiabilidad del dato', 'dueño: datos · requiere confirmar el criterio de la regla antes de tratarlo como error')}
      ${prop ? `<div class="eq-prop"><span class="lead">Propuesta de rediseño aportada por el equipo</span><p>${prop}</p></div>` : ''}
    </div>
  </section>`;
};

const renderFind = (f, idx) => `
      <article class="find">
        <div class="find__gut">
          <span class="tag t-${f.sev}">${SEV[f.sev]}</span>
          <span class="find__id">${esc(f.id ?? idx)}</span>
        </div>
        <div>
          <h3>${f.title}</h3>
          <p><span class="lbl">Evidencia</span>${f.evidence}</p>
          ${f.impact ? `<p><span class="lbl">Impacto</span>${f.impact}</p>` : ''}
          <p class="fix"><span class="lbl">Corrección</span>${f.fix}</p>
          ${f.nota ? `<p class="nota">${f.nota}</p>` : ''}
        </div>
      </article>`;

// --- Copia de capturas usadas ---
const available = await readdir(SHOTS);
const built = [];

for (const [slug, mod] of Object.entries(MODULOS).sort((a, b) => a[1].orden - b[1].orden)) {
  const rows = data.filter((r) => r.slug === slug);
  if (!rows.length) { console.error(`Sin evidencia para ${slug}, se omite`); continue; }
  const d = rows.find((r) => r.breakpoint === 'desktop') ?? rows[0];
  const m = rows.find((r) => r.breakpoint === 'mobile') ?? d;

  // Unión de violaciones axe de los tres anchos.
  const axe = {};
  for (const r of rows) {
    for (const v of r.violations) {
      axe[v.id] ??= { impact: v.impact, help: v.help, nodes: 0 };
      axe[v.id].nodes = Math.max(axe[v.id].nodes, v.nodes);
    }
  }

  // Capturas.
  const shots = {};
  for (const bp of ['desktop', 'tablet', 'mobile']) {
    const f = `${slug}-${bp}.jpg`;
    if (available.includes(f)) {
      await copyFile(path.join(SHOTS, f), path.join(CAPS, f));
      shots[bp] = f;
    }
  }

  const finds = [...mod.hallazgos].sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  const counts = finds.reduce((a, f) => ((a[f.sev] = (a[f.sev] ?? 0) + 1), a), {});
  const maxCols = Math.max(0, ...d.tables.map((t) => t.cols));

  const body = `
<header class="top">
  <div class="wrap">
    <a class="back" href="index.html">← Índice de informes</a>
    <p class="eyebrow">
      <span>Auditoría UX/UI del visor · módulo ${mod.orden}</span>
      ${d.ligature ? `<span class="lig">icono: <code>${esc(d.ligature)}</code></span>` : ''}
    </p>
    <h1>${esc(mod.titulo)}</h1>
    <p class="purpose">${mod.proposito}</p>
    <dl class="stats">
      <div class="stat"><dt>Hallazgos</dt><dd>${finds.length}</dd></div>
      ${counts.critico ? `<div class="stat warn"><dt>Críticos</dt><dd>${counts.critico}</dd></div>` : ''}
      ${(EQUIPO[slug] ?? []).length ? `<div class="stat"><dt>Obs. del equipo</dt><dd>${EQUIPO[slug].length}</dd></div>` : ''}
      <div class="stat"><dt>Tablas</dt><dd>${d.tableCount} <small>${nf(d.totalRows)} filas</small></dd></div>
      <div class="stat"><dt>Columnas máx.</dt><dd>${maxCols}</dd></div>
      <div class="stat"><dt>Alto escritorio</dt><dd>${nf(d.contentHeight)}<small> px</small></dd></div>
      <div class="stat"><dt>Alto móvil</dt><dd>${nf(m.contentHeight)}<small> px</small></dd></div>
      <div class="stat"><dt>Interactivos</dt><dd>${d.interactive}</dd></div>
      <div class="stat ${d.tapUnder44 === d.interactive && d.interactive > 0 ? 'warn' : ''}"><dt>Bajo 44 px</dt><dd>${d.tapUnder44}<small> / ${d.interactive}</small></dd></div>
      <div class="stat"><dt>Hasta contenido</dt><dd>${nf(d.renderMs)}<small> ms</small></dd></div>
    </dl>
  </div>
</header>

<main class="wrap">
  <section>
    <h2>Hallazgos del módulo</h2>
    <p class="sub">Específicos de esta pantalla, ordenados por severidad. Los que afectan a los once módulos van al final.</p>
    ${mod.propuesta ? `<div class="good" style="border-left-color:var(--blueprint)"><span class="lead" style="color:var(--blueprint)">${esc(mod.propuesta.etiqueta ?? 'Propuesta de rediseño')}</span><p>${mod.propuesta.texto} <a href="${mod.propuesta.href}">Abrir el documento →</a></p></div>` : ''}
    ${mod.bien ? `<div class="good"><span class="lead">Lo que ya funciona</span><p>${mod.bien}</p></div>` : ''}
    <div class="finds">${finds.map((f, i) => renderFind(f, `H${i + 1}`)).join('')}</div>
  </section>

  <section>
    <h2>Evidencia medida</h2>
    <p class="sub">Reglas WCAG incumplidas y estructura de las tablas, tal como se midieron el 4 de agosto de 2026.</p>
    <div class="tbl-scroll" tabindex="0" role="region" aria-label="Reglas WCAG incumplidas, tabla desplazable">
      <table>
        <thead><tr><th>Regla axe</th><th>Impacto</th><th class="num">Nodos</th><th>Descripción</th></tr></thead>
        <tbody>
          ${Object.entries(axe).sort((a, b) => b[1].nodes - a[1].nodes).map(([id, v]) => `
          <tr><td><code>${esc(id)}</code></td><td>${esc(v.impact)}</td><td class="num">${v.nodes}</td><td>${esc(v.help)}</td></tr>`).join('') || '<tr><td colspan="4">Ninguna</td></tr>'}
        </tbody>
      </table>
    </div>
    ${d.tables.length ? `
    <div class="tbl-scroll" style="margin-top:1.25rem" tabindex="0" role="region" aria-label="Estructura de las tablas del módulo, tabla desplazable">
      <table>
        <thead><tr><th class="num">Tabla</th><th class="num">Filas</th><th class="num">Col.</th><th>Primeras cabeceras</th></tr></thead>
        <tbody>
          ${d.tables.map((t, i) => `
          <tr><td class="num">${i + 1}</td><td class="num">${nf(t.rows)}</td><td class="num">${t.cols}</td><td>${esc(t.headers.join(' · '))}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  </section>

  ${renderEquipo(slug)}

  ${shots.desktop ? `
  <section>
    <h2>Captura</h2>
    <p class="sub">Pantalla completa en escritorio de 1440 px. El marco se desplaza y admite foco por teclado.</p>
    <div class="shot" tabindex="0" role="region" aria-label="Captura desplazable de ${esc(mod.titulo)} en escritorio">
      <img src="capturas/${shots.desktop}" alt="${esc(mod.titulo)} en escritorio, página completa.">
    </div>
    <p class="shot-links">
      Ver a tamaño real:
      ${Object.entries(shots).map(([bp, f]) => `<a href="capturas/${f}" target="_blank" rel="noopener">${bp}</a>`).join(' · ')}
    </p>
  </section>` : ''}

  <section>
    <h2>Común a todo el visor</h2>
    <p class="sub">Ocho defectos que este módulo comparte con los otros diez. Se corrigen una vez y se arreglan en los once.</p>
    <details class="comunes">
      <summary>${COMUNES.length} hallazgos transversales · ${COMUNES.filter((c) => c.sev === 'critico').length} críticos</summary>
      <div class="comunes__body"><div class="finds">${COMUNES.map((f) => renderFind(f)).join('')}</div></div>
    </details>
  </section>
</main>`;

  const file = `${String(mod.orden).padStart(2, '0')}-${slug}.html`;
  await writeFile(path.join(DEST, file), page(`${mod.titulo} — Auditoría UX/UI`, body));
  built.push({ file, slug, mod, finds, counts, d });
  console.log(`${file.padEnd(34)} ${finds.length} hallazgos (${counts.critico ?? 0} críticos)`);
}

// --- Índice ---
const totalFinds = built.reduce((a, b) => a + b.finds.length, 0);
const totalCrit = built.reduce((a, b) => a + (b.counts.critico ?? 0), 0);

const indexBody = `
<header class="top">
  <div class="wrap">
    <p class="eyebrow"><span>Auditoría UX/UI · 4 de agosto de 2026</span></p>
    <h1>Visor de resultados — informe por módulo</h1>
    <p class="purpose">
      Un informe por cada ítem del sidebar de <code>/index.html</code>. Cada uno mide su propia pantalla;
      los defectos compartidos por los once se recogen al final de cada informe.
    </p>
    <dl class="stats">
      <div class="stat"><dt>Módulos</dt><dd>${built.length}</dd></div>
      <div class="stat"><dt>Hallazgos propios</dt><dd>${totalFinds}</dd></div>
      <div class="stat warn"><dt>Críticos</dt><dd>${totalCrit}</dd></div>
      <div class="stat"><dt>Transversales</dt><dd>${COMUNES.length}</dd></div>
      <div class="stat"><dt>Obs. del equipo</dt><dd>${Object.values(EQUIPO).reduce((a, b) => a + b.length, 0)}</dd></div>
      <div class="stat"><dt>Pasadas</dt><dd>${data.length}</dd></div>
    </dl>
  </div>
</header>

<main class="wrap">
  <section>
    <h2>Los once informes</h2>
    <p class="sub">Ordenados como en el sidebar. A la derecha, los hallazgos propios de cada módulo por severidad.</p>
    <div class="idx-grid">
      ${built.map((b) => `
      <a class="idx-row" href="${b.file}">
        <span>
          <span class="idx-row__t">${esc(b.mod.titulo)}</span>
          <span class="idx-row__d">${esc(b.mod.proposito)}${b.mod.propuesta ? ` <b style="color:var(--blueprint)">· ${esc(b.mod.propuesta.rotulo ?? 'incluye propuesta de rediseño')}</b>` : ''}</span>
        </span>
        <span class="idx-sev">
          ${['critico', 'grave', 'moderado', 'menor'].filter((s) => b.counts[s]).map((s) => `<span class="pill t-${s}">${b.counts[s]} ${SEV[s]}</span>`).join('')}
          ${(EQUIPO[b.slug] ?? []).length ? `<span class="pill" style="color:var(--blueprint)">${EQUIPO[b.slug].length} del equipo</span>` : ''}
        </span>
      </a>`).join('')}
    </div>
  </section>

  <section>
    <h2>Lo que atraviesa los once</h2>
    <p class="sub">Corregir esto arregla los once informes a la vez. Es el trabajo con mejor relación entre coste e impacto.</p>
    <div class="finds">${COMUNES.map((f) => renderFind(f)).join('')}</div>
  </section>

  <section>
    <h2>Comparativa</h2>
    <p class="sub">Las mismas métricas en los once módulos, para ver dónde está la carga.</p>
    <div class="tbl-scroll" tabindex="0" role="region" aria-label="Comparativa de los once módulos, tabla desplazable">
      <table>
        <thead><tr><th>Módulo</th><th class="num">Tablas</th><th class="num">Filas</th><th class="num">Col. máx.</th><th class="num">Alto escritorio</th><th class="num">Alto móvil</th><th class="num">Interactivos</th><th class="num">Bajo 44 px</th><th class="num">Hasta contenido</th></tr></thead>
        <tbody>
          ${built.map((b) => {
            const mob = data.find((r) => r.slug === b.slug && r.breakpoint === 'mobile') ?? b.d;
            const maxCols = Math.max(0, ...b.d.tables.map((t) => t.cols));
            return `
          <tr>
            <td><a href="${b.file}">${esc(b.mod.titulo)}</a></td>
            <td class="num">${b.d.tableCount}</td>
            <td class="num">${nf(b.d.totalRows)}</td>
            <td class="num">${maxCols}</td>
            <td class="num">${nf(b.d.contentHeight)} px</td>
            <td class="num">${nf(mob.contentHeight)} px</td>
            <td class="num">${b.d.interactive}</td>
            <td class="num">${b.d.tapUnder44}</td>
            <td class="num">${nf(b.d.renderMs)} ms</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </section>
</main>`;

await writeFile(path.join(DEST, 'index.html'), page('Visor de resultados — informes por módulo', indexBody));
console.log(`\nindex.html + ${built.length} informes en ./${DEST}/`);
console.log(`${totalFinds} hallazgos propios, ${totalCrit} críticos, ${COMUNES.length} transversales`);
