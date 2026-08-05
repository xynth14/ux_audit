# Auditoría UX/UI — PAIN (Plataforma de Auditoría INteligente)

Auditoría de interfaz, accesibilidad y fiabilidad del dato sobre la plataforma
PAIN, ejecutada con instrumentación real sobre el entorno productivo en modo de
**solo lectura**: ninguna petición de escritura salió del navegador.

## Leer los informes

**→ https://xynth14.github.io/ux_audit/**

Ese enlace es la portada. No hace falta descargar nada.

| Documento | Contenido |
|---|---|
| [Informes del visor](https://xynth14.github.io/ux_audit/informes/) | **Portada.** Los 11 informes del visor con su recuento de severidad, los 8 hallazgos transversales, las observaciones del equipo y una tabla comparativa |
| [Módulo 2 · antes y después](https://xynth14.github.io/ux_audit/informes/m2-antes-despues.html) | **Para presentar.** Los 10 cambios propuestos, cada uno con su «hoy» y su «después», y una maqueta navegable |
| [Informe de plataforma](https://xynth14.github.io/ux_audit/report.html) | Las 6 secciones del menú principal: 14 hallazgos y 3 láminas de rediseño |

Alternativa sin conexión: **Code → Download ZIP**, descomprimir y doble clic en
`index.html`. Los archivos son autónomos y no necesitan servidor. `informes/` es
portable como carpeta completa —las capturas van enlazadas, no incrustadas—, así
que conviene mover o comprimir la carpeta entera.

Los informes se adaptan al tema claro u oscuro del sistema y funcionan con
teclado: los marcos de captura y las tablas anchas admiten foco y desplazamiento.

## Datos personales

Este repositorio es público. Los nombres de usuario y las direcciones de correo
aparecen **difuminados en las capturas**, con el desenfoque aplicado sobre los
píxeles antes de guardar la imagen —no por CSS, que sería recuperable desde el
código fuente— y **sustituidos por genéricos** en las maquetas y en el texto. El
identificador de Firebase se muestra abreviado. Ninguna cifra ni conclusión del
informe se ha modificado.

Regenerar las capturas difuminadas: `node capture-before-difuminado.mjs`.

## Contenido

```
informes/
  index.html                     portada e índice
  00-resumen.html … 10-….html    un informe por ítem del sidebar del visor
  m2-antes-despues.html          propuesta de M2 para presentación
  propuesta-m2-tecnico.html      la misma propuesta con detalle técnico y
                                 especificación para desarrollo
  m4-tagging-title-imagen.html   solicitud técnica: el crawler no lee img[title]
  capturas/                      evidencia enlazada por los informes
report.html                      informe de plataforma (6 secciones)
audit_ux/Auditoria_UX.docx       revisión manual del equipo, ya integrada en
                                 los informes como «Observaciones del equipo»
```

## Alcance

- **6 secciones** del menú principal: Subdominios, Estado, Bitácora, Usuarios,
  Alertas, Categorías.
- **11 ítems** del sidebar del visor: Resumen y Módulos 1 a 10.
- **3 anchos**: 390, 820 y 1440 px.
- Accesibilidad con **axe-core** contra WCAG 2.1 niveles A y AA.
- Métricas por pantalla: tiempo hasta contenido, alto de página, número de
  columnas y filas, tamaño de las áreas táctiles, jerarquía de encabezados,
  desbordamiento horizontal y errores de consola.

Los hallazgos se presentan en tres grupos, con dueños distintos:

- **Hallazgos medidos** — instrumentación propia, front-end.
- **Observaciones del equipo** — revisión manual del documento
  `Auditoria_UX.docx`, separadas en interfaz y fiabilidad del dato.
- **Pendientes de confirmar** — casos donde el criterio de la regla debe
  validarlo el equipo de datos antes de tratarlos como error.

## Reproducir la auditoría

Requiere Node 20 o superior.

```bash
npm install
npx playwright install chromium

cp .env.example .env      # y rellenar con credenciales propias
```

| Comando | Qué hace |
|---|---|
| `node audit.mjs` | Audita las 6 secciones del menú principal |
| `node audit-visor.mjs` | Audita los 11 módulos del visor |
| `node build-report.mjs` | Genera `report.html` |
| `node build-module-reports.mjs` | Genera los 12 archivos de `informes/` |
| `node verify-informes.mjs` | axe-core y desbordes sobre todos los informes |
| `node test-equipo.mjs` | Comprueba que las observaciones del equipo estén integradas |
| `node test-cobertura-m2.mjs` | Comprueba que la propuesta de M2 no pierda contenido |

El contenido redactado de los informes por módulo vive en
`module-reports.data.mjs`; las métricas se inyectan desde
`out/visor/findings-visor.json`. Informe y evidencia no pueden divergir.

## Seguridad

- Las credenciales se leen de `.env`, que **no** está versionado.
- Todas las pasadas bloquean a nivel de red cualquier `POST`, `PUT`, `PATCH` o
  `DELETE` ajeno a la autenticación (`SAFE_MODE=true`, valor por defecto).
- La evidencia cruda (`out/`, 28 MB) no se versiona: se regenera con los
  comandos de arriba.
