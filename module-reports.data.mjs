// Contenido redactado de los informes por módulo del visor.
// Las métricas NO se escriben aquí: las inyecta el maquetador desde
// out/visor/findings-visor.json, para que informe y evidencia no divergan.

// Severidades: 'critico' | 'grave' | 'moderado' | 'menor'

/** Hallazgos que afectan a los 11 módulos por igual. Se rinden en cada informe. */
export const COMUNES = [
  {
    sev: 'critico',
    id: 'V1',
    title: 'Ningún módulo tiene URL propia: no se puede enlazar, ni volver, ni recargar',
    evidence:
      'Los 11 ítems del sidebar son <code>&lt;button class="nav"&gt;</code> sin <code>href</code>. Al navegar, la URL se queda en <code>/index.html</code> en los 11 casos, no se añade ninguna entrada al historial (<code>history.length</code> no cambia) y <code>location.hash</code> permanece vacío.',
    impact:
      'Tres consecuencias medidas: el botón Atrás no vuelve al módulo anterior sino que <strong>sale del visor</strong> a <code>subdominios.html</code>; recargar la página <strong>pierde el módulo abierto</strong> y devuelve al Resumen; y no hay forma de enviar a un compañero un enlace a «Módulo 3 · SEO», ni de abrirlo en otra pestaña, ni de guardarlo en marcadores. Al ser botones y no enlaces, tampoco funcionan Ctrl+clic ni el clic central.',
    fix:
      'Dar a cada módulo una URL real: <code>/index.html#m3-seo</code> como mínimo, o rutas <code>/visor/seo</code>. Sincronizar con <code>history.pushState</code> al navegar y leer la URL al cargar para restaurar el módulo. Convertir los botones en <code>&lt;a href&gt;</code>: se gana enlazado, historial, pestaña nueva y foco por teclado sin escribir lógica adicional.',
  },
  {
    sev: 'critico',
    id: 'V2',
    title: 'Los desplegables de filtro no tienen etiqueta accesible',
    evidence:
      'Regla <code>select-name</code> incumplida en los 11 módulos (entre 1 y 4 <code>&lt;select&gt;</code> por módulo). Son los filtros «Severidad», «Dispositivo» y «Estrategia», que carecen de <code>&lt;label&gt;</code> asociado y de <code>aria-label</code>.',
    impact:
      'Quien usa lector de pantalla oye «cuadro combinado» sin saber qué filtra. Son el control principal de cada tabla, así que el módulo queda inoperable.',
    fix:
      'Un <code>&lt;label for&gt;</code> visible por cada <code>&lt;select&gt;</code>. El texto «Severidad:» que ya está impreso al lado sirve: basta asociarlo con <code>for</code>/<code>id</code>.',
  },
  {
    sev: 'grave',
    id: 'V3',
    title: 'Todos los elementos interactivos están por debajo de 44 px',
    evidence:
      'La proporción es del 100 % en los 11 módulos, sin una sola excepción: 137 de 137 en Sitemap, 172 de 172 en SEO, 198 de 198 en Imágenes. Se mide igual en móvil, donde el objetivo es el dedo.',
    impact:
      'Filtros, pestañas y acciones de fila exigen precisión de ratón. En tableta —el formato en que se revisa una auditoría en reunión— el error de pulsación es constante.',
    fix: 'Alto mínimo de 44 px en filtros, botones de acción y controles de tabla.',
  },
  {
    sev: 'grave',
    id: 'V4',
    title: 'El texto de los iconos forma parte del nombre accesible',
    evidence:
      'El sidebar usa ligaduras de Material Symbols sin aislar: el nombre accesible de los ítems es «dashboard Resumen», «account_tree Módulo 1 · Sitemap», «notifications_active Módulo 9 · Alertas». Lo mismo ocurre en las tarjetas de métrica, donde el texto incluye <code>link</code>, <code>fact_check</code>, <code>bug_report</code>, <code>schedule</code>.',
    impact:
      'Un lector de pantalla lee en voz alta el nombre técnico del icono antes de cada etiqueta. Y si la fuente de iconos no carga —red lenta, bloqueo de fuentes externas—, el usuario ve escrito «dashboard» en lugar de un icono.',
    fix:
      'Marcar el contenedor del icono con <code>aria-hidden="true"</code> y, si el control no tiene texto visible, darle <code>aria-label</code>. Es un cambio de una línea por icono.',
  },
  {
    sev: 'moderado',
    id: 'V5',
    title: 'El contenido queda fuera de regiones semánticas',
    evidence:
      'Regla <code>region</code> incumplida con 4 nodos en los 11 módulos. El visor sí tiene <code>&lt;main class="content"&gt;</code> —mejor que el resto de la plataforma, que no tiene ninguno—, pero parte del contenido cuelga fuera de él.',
    fix: 'Mover todo el contenido dentro de <code>main</code> y envolver la cabecera y el sidebar en <code>header</code> y <code>nav</code>.',
  },
  {
    sev: 'moderado',
    id: 'V6',
    title: 'El sidebar llega colapsado a 64 px incluso en pantallas anchas',
    evidence:
      'En un escritorio de 1440 px el <code>aside.sidebar</code> mide 64 px y el <code>body</code> tiene la clase <code>sidebar-collapsed</code>: sólo se ven iconos, sin etiquetas, para 11 destinos.',
    impact:
      'Once iconos sin texto obligan a adivinar o a expandir en cada visita. Sobra espacio horizontal: el área de trabajo ocupa 1 376 px.',
    fix:
      'Expandido por defecto a partir de 1200 px, y recordar la preferencia del usuario. Si se mantiene colapsado, añadir <code>title</code> y <code>aria-label</code> a cada icono.',
  },
  {
    sev: 'moderado',
    id: 'V7',
    title: 'Vocabulario de código mezclado con español en las cabeceras de tabla',
    evidence:
      'Conviven en la misma fila de encabezados: «URL», «normalized_url», «Ruta», «Tipo de página» (Sitemap); «LCP (MS)», <code>fcp_ms</code>, <code>speed_index_ms</code>, <code>total_blocking_time_ms</code> (Performance); «Selector», <code>css_selector</code>, <code>needs_human_review</code> (Links e Imágenes). Los filtros de dispositivo ofrecen «Todos / mobile / desktop», dos de los tres valores en inglés.',
    fix:
      'Un diccionario único de nombres de columna en español, resuelto desde la clave técnica en un solo punto. El nombre técnico puede quedar en un <code>title</code> para quien exporte datos.',
  },
  {
    sev: 'moderado',
    id: 'V8',
    title: 'Ocho tamaños de fuente por pantalla y jerarquía sin escala',
    evidence:
      'Se miden 11, 12, 13, 13,5, 14, 17, 20, 22, 28 y 32 px según el módulo, con 14 px como cuerpo dominante y hasta 2 965 nodos a ese tamaño en el Resumen.',
    fix: 'Reducir a cinco pasos y subir el mínimo a 12 px.',
  },
];

/**
 * Observaciones recogidas por el equipo en la revisión manual
 * (documento «Auditoria_UX.docx», 12 capturas anotadas).
 *
 * Se mantienen separadas de los hallazgos medidos para que quede claro qué
 * observó el equipo y qué se midió con instrumentación. Cada una lleva:
 *   tipo: 'ui'   → defecto de interfaz, dueño front-end
 *         'dato' → fiabilidad del dato, dueño datos/backend, requiere que el
 *                  equipo confirme el criterio de la regla antes de tratarlo
 *                  como error
 *   verificado: lo que se pudo comprobar con instrumentación, o null
 *
 * Los run_id proceden del bloque «Última ejecución por módulo» del propio
 * documento del equipo.
 */
export const CORRIDAS = {
  'resumen': null,
  'modulo-1-sitemap': 'sr_20260804_133452_7c9c8f',
  'modulo-2-tecnico': 'tc_20260717_165800_6127e9',
  'modulo-3-seo': 'seo_20260717_170237_be4ed7',
  'modulo-4-tagging': 'tag_20260717_170317_b39e7e',
  'modulo-5-links': 'link_20260717_170858_6f2bb7',
  'modulo-6-content-ui': 'content_0c3e9bd65d14416e',
  'modulo-7-performance': 'performance_0602c0286adb4976',
  'modulo-8-change-history': 'chg_20260717_181120_a6deb9',
  'modulo-9-alertas': 'alr_20260717_181131_37da56',
  'modulo-10-imagenes': 'image_84a797623d254168',
};

export const EQUIPO = {
  'resumen': [
    {
      tipo: 'ui', sev: 'moderado',
      titulo: 'Fijar el encabezado superior',
      observacion: 'El <em>topHeader</em> se desplaza con el contenido y desaparece al bajar. En una pantalla de 16 792 px de alto, eso deja al usuario sin la referencia de en qué corrida y en qué subdominio está trabajando.',
      accion: 'Encabezado fijo con <code>position: sticky</code>, conservando la ruta «Portal Claro › colección › corrida».',
      verificado: 'Coherente con la altura medida: 16 792 px en escritorio y 19 055 px en móvil, unas 21 pantallas de recorrido.',
    },
    {
      tipo: 'ui', sev: 'moderado',
      titulo: 'Quitar la barra de desplazamiento horizontal del sidebar',
      observacion: 'El sidebar muestra una barra de <em>scroll</em> horizontal en su base, señalada con flecha en el documento del equipo. Aparece porque el contenido del menú no cabe en los 64 px del sidebar colapsado.',
      accion: 'Eliminar el desbordamiento horizontal del contenedor del menú; se resuelve solo si el sidebar se muestra expandido en pantallas anchas.',
      verificado: 'Defecto no detectado por la auditoría instrumentada. Complementa el hallazgo transversal V6 sobre el sidebar colapsado a 64 px.',
    },
    {
      tipo: 'ui', sev: 'grave',
      titulo: 'Añadir paginación y agrupar por semáforo',
      observacion: 'Las tablas del Resumen se muestran completas y sin agrupación. El equipo propone paginarlas y agrupar las filas por su estado de semáforo.',
      accion: 'Paginación con tamaño de página seleccionable —como ya existe en los módulos de detalle— y agrupación por severidad, con los estados en alerta primero.',
      verificado: 'Confirma el hallazgo H4: 379 filas en tres tablas con sólo 4 elementos interactivos en toda la pantalla.',
    },
    {
      tipo: 'ui', sev: 'moderado',
      titulo: 'Vista de hallazgos por regla',
      observacion: 'Falta una vista que agrupe los hallazgos por la regla que los origina, en lugar de una fila por ocurrencia.',
      accion: 'Conmutador entre «por URL» y «por regla» sobre los mismos datos.',
      verificado: 'Es la misma solución propuesta para el Módulo 2, donde la tabla de hallazgos tiene 3 003 filas para 200 URLs.',
    },
    {
      tipo: 'ui', sev: 'grave',
      titulo: 'Catálogo de reglas como sección propia',
      observacion: 'Las 177 reglas de auditoría se listan dentro del Resumen. El equipo propone extraerlas a un catálogo con su propia pantalla.',
      accion: 'Sección «Catálogo de reglas» independiente, cargada por demanda.',
      verificado: 'Confirma el hallazgo H3 y explica el peso de la pantalla: la tabla de 177 filas es una de las tres que hacen del Resumen la vista más larga del visor. La llamada <code>api/rules/catalog</code> pesa 206 KB y hoy se descarga al abrir cualquier módulo.',
    },
    {
      tipo: 'ui', sev: 'moderado',
      titulo: 'Detalle por regla de auditoría',
      observacion: 'No existe una vista de detalle de una regla concreta: qué valida, en qué módulo aplica, cuántas URLs incumple y con qué severidad.',
      accion: 'Ficha por regla, alcanzable desde cualquier hallazgo que la cite. Los datos ya existen en la respuesta: <code>rule_name</code>, <code>business_description</code>, <code>assigned_module</code> y <code>recommendation_template</code>.',
      verificado: 'Los cuatro campos están en la respuesta de la API y hoy no tienen ninguna pantalla que los muestre agrupados por regla.',
    },
  ],

  'modulo-1-sitemap': [
    {
      tipo: 'ui', sev: 'moderado',
      titulo: 'No renderizar la tabla de hallazgos cuando está vacía',
      observacion: 'Si la URL no tiene hallazgos, la tabla se dibuja igualmente con su cabecera y sus filtros, sin filas.',
      accion: 'Sustituir la tabla por un estado vacío con texto explícito, como ya se hace en el panel de detalle: «Esta URL no tiene hallazgos en este módulo».',
      verificado: 'Relacionado con el hallazgo H5: la tabla de hallazgos se midió con 1 fila y 12 columnas. La observación del equipo es más precisa: con cero filas no debería renderizarse.',
    },
    {
      tipo: 'ui', sev: 'grave',
      titulo: 'La columna «tipo de página» navega a otro sitio',
      observacion: 'Al pulsar el valor de la columna «Tipo de página», la interfaz redirige al subdominio en lugar de filtrar o de abrir el detalle.',
      accion: 'Un valor de clasificación no debería ser un enlace de salida. Si debe ser accionable, que filtre la tabla por ese tipo; si no, que sea texto.',
      verificado: null,
    },
  ],

  'modulo-4-tagging': [
    {
      tipo: 'dato', sev: 'grave',
      titulo: 'Hallazgos de etiquetado en una página sin nada que etiquetar',
      observacion: 'En <code>/directorio-de-abonados-fijos/</code> no hay elementos etiquetables, y sin embargo el módulo reporta hallazgos.',
      accion: 'Confirmar el criterio de la regla. Si el crawler recorre el DOM y encuentra elementos que el usuario no ve, el hallazgo puede ser técnicamente correcto: en ese caso el problema es que la interfaz no lo explica, no el dato.',
      verificado: null,
      pendiente: true,
    },
  ],

  'modulo-5-links': [
    {
      tipo: 'dato', sev: 'grave',
      titulo: 'Los enlaces rotos de una URL no cuadran con sus hallazgos',
      observacion: '«Top páginas con links rotos» indica 42 enlaces rotos en <code>/personas/movil/prepago/triplica-tu-recarga/</code>, mientras la tabla de hallazgos filtrada por esa URL muestra 43 resultados.',
      accion: 'Etiquetar cada cifra con lo que cuenta, y permitir llegar desde «42 enlaces rotos» a la lista de esos 42. Hoy no existe ese camino.',
      verificado:
        'Comprobado con instrumentación. Los 43 hallazgos se reparten en 16 <code>LINK_002</code> (enlaces externos rotos críticos), 16 <code>LINK_005</code> (anchors internos inválidos), 9 <code>LINK_006</code>, 1 <code>IDX_012</code> y 1 <code>LINK_003</code>: ninguna combinación da 42. La tabla de resultados de esa misma URL declara 369 filas, que coincide exactamente con su «TOTAL LINKS 369», de modo que son unidades distintas —instancias de enlace frente a filas de hallazgo—. Consecuencia más grave que la observada: con 42 enlaces rotos y sólo 16 hallazgos <code>LINK_002</code>, la lista de los 42 no es obtenible desde la tabla de hallazgos.',
      pendiente: true,
    },
    {
      tipo: 'dato', sev: 'moderado',
      titulo: 'Hallazgos sobre contenido que el usuario no ve',
      observacion: 'En <code>/directorio-de-abonados-fijos/</code> lo único visible es un iframe roto, pero el módulo reporta hallazgos porque los enlaces están en el código fuente.',
      accion: 'Probablemente comportamiento correcto: el crawler analiza el DOM, no la representación visual. Documentar el criterio en la propia pantalla y marcar los hallazgos que provienen de contenido no renderizado.',
      verificado: 'No es un error mientras el criterio sea «analizar el DOM». Conviene resolverlo mostrando el criterio, no cambiando el dato.',
      pendiente: true,
    },
  ],

  'modulo-6-content-ui': [
    {
      tipo: 'dato', sev: 'grave',
      titulo: '«PDF obsoletos» en una página con un solo PDF',
      observacion: 'En <code>/protección-datos/</code> el módulo reporta <code>PDF_Obsoletos</code>, cuando el contenido de la URL sólo ofrece un PDF para descargar.',
      accion: 'Confirmar qué cuenta la regla: PDFs enlazados en el código, PDFs visibles, o ambos. Después, mostrar en el hallazgo la lista concreta de los PDFs considerados obsoletos y su fecha.',
      verificado: 'La tarjeta de cabecera del módulo declara «PDFS 79 · 52 obsoletos» para el conjunto medido, sin indicar el criterio de antigüedad.',
      pendiente: true,
    },
    {
      tipo: 'ui', sev: 'moderado',
      titulo: 'La Clase no aparece en el detalle del enlace',
      observacion: 'En el detalle de uno de los enlaces de <code>/protección-datos/</code> no se muestra la Clase del elemento.',
      accion: 'Incluir la clase CSS entre los campos técnicos del detalle, junto al selector y la sección HTML. Sin ella, localizar el elemento en la maqueta exige buscarlo a mano.',
      verificado: 'Coherente con el criterio aplicado en la propuesta del Módulo 2: los campos técnicos deben mostrarse siempre, marcando «sin dato» los que no tengan valor en lugar de omitirlos.',
    },
  ],
};

/** Propuestas de rediseño aportadas por el equipo en su documento. */
export const PROPUESTAS_EQUIPO = {
  'modulo-1-sitemap':
    'El documento del equipo incluye una <strong>propuesta de rediseño completa</strong> de esta pantalla, ' +
    'coherente con las correcciones planteadas en el resto del informe: sidebar expandido con etiquetas, ' +
    'ruta de navegación, búsqueda global, ocho columnas con selector de columnas y vistas guardadas, ' +
    'panel de filtros lateral, panel de detalle con pestañas, paginación conservada y gráficos de ' +
    'distribución por tipo de página, estado HTTP e indexabilidad.',
};

/** Contenido específico por módulo. La clave es el slug que genera el auditor. */
export const MODULOS = {
  'resumen': {
    orden: 0,
    titulo: 'Resumen',
    proposito: 'Vista de entrada del visor: debe responder en diez segundos si la última auditoría fue bien y qué mirar primero.',
    bien: 'Es la única pantalla del visor que ofrece una lectura transversal, y el bloque «Estado por módulo» con la última ejecución de cada uno es exactamente la información correcta para empezar.',
    hallazgos: [
      {
        sev: 'critico',
        title: 'Los contadores del Resumen dicen 0 hallazgos donde los módulos reportan miles',
        evidence:
          'Las tarjetas superiores muestran «HALLAZGOS TÉCNICOS 0», «HALLAZGOS SEO 0» y «HALLAZGOS TAGGING 0». Sin embargo el Módulo 3 · SEO informa 12 páginas sin H1, 12 con H1 múltiple, 13 títulos muy cortos, 50 muy largos y 25 metadescripciones cortas; el Módulo 7 · Performance informa 2 847 hallazgos; el Módulo 10 · Imágenes, 167.',
        impact:
          'Quien entra al visor y ve tres ceros concluye que la auditoría está limpia y no baja a los módulos. Es el peor error posible en una pantalla resumen: no informa de menos, informa lo contrario.',
        fix:
          'Verificar con el equipo si esos contadores miden otra cosa —por ejemplo sólo hallazgos de severidad alta de la última corrida— y, en cualquier caso, etiquetarlos con lo que realmente cuentan. Si el Resumen y los módulos usan criterios distintos, decirlo en la propia tarjeta.',
        nota: 'Contradicción observada entre pantallas, no verificada contra la base de datos. Es lo primero que conviene comprobar.',
      },
      {
        sev: 'critico',
        title: '2 886 URLs leídas y 8 auditables, sin ninguna explicación',
        evidence:
          'Las dos primeras tarjetas dicen «URLS LEÍDAS 2 886» y «URLS AUDITABLES 8». El Módulo 1 · Sitemap confirma 2 886 totales y 2 759 con estado 200 OK.',
        impact:
          'Un 0,3 % de cobertura auditable invalida cualquier conclusión del informe, y la pantalla lo presenta como un dato neutro más, con la misma tipografía y color que el resto.',
        fix:
          'Explicar el criterio junto al número, marcar la cobertura insuficiente como estado de alerta y enlazar a la lista de las URLs descartadas con el motivo.',
        nota: 'Puede tratarse de un límite de configuración de la corrida. Requiere confirmación del equipo.',
      },
      {
        sev: 'grave',
        title: 'La pantalla resumen es más larga que los detalles que resume',
        evidence:
          'Mide 16 792 px de alto en escritorio y 19 055 px en móvil —unas 21 pantallas—, con tres tablas de 96, 177 y 106 filas: 379 filas en total y 158 000 caracteres de texto visible. Es la pantalla más larga del visor: el Módulo 2 · Técnico, que sí es un detalle, mide 4 091 px.',
        impact: 'No cumple su función. Para encontrar algo hay que recorrer más contenido que en el módulo correspondiente.',
        fix:
          'Dejar arriba las tarjetas, el estado por módulo y un máximo de diez hallazgos prioritarios con enlace al módulo. Las tres tablas de referencia de reglas pertenecen a una sección propia de documentación, no al resumen.',
      },
      {
        sev: 'grave',
        title: '379 filas sin filtro, orden ni búsqueda',
        evidence: 'La pantalla tiene 4 elementos interactivos en total para 379 filas repartidas en tres tablas de 7, 7 y 9 columnas.',
        fix: 'Filtro por módulo y severidad, orden por columna y buscador. Los mismos controles que ya existen en los módulos de detalle.',
      },
      {
        sev: 'moderado',
        title: 'Jerarquía de encabezados inválida y títulos duplicados',
        evidence:
          'Regla <code>heading-order</code> incumplida. El texto «Cobertura de auditoría» aparece dos veces seguidas, primero como <code>h3</code> y después como <code>h2</code>; el mismo patrón se repite con «Estado por módulo» / «Última ejecución por módulo».',
        fix: 'Un solo título por sección, en el nivel que le corresponde por anidamiento.',
      },
      {
        sev: 'moderado',
        title: 'Dos formatos de fecha en la misma lista',
        evidence:
          'El estado por módulo mezcla «hace 8h» para M1 con «17/07/26, 12:02 p. m.» para M2, en filas contiguas. El encabezado usa «4/08/26, 9:07 a. m.», con año de dos cifras y orden día/mes ambiguo.',
        fix: 'Tiempo relativo para todo lo reciente y fecha absoluta en <code>title</code>; año de cuatro cifras y mes abreviado cuando se muestre completa.',
      },
    ],
  },

  'modulo-1-sitemap': {
    orden: 1,
    titulo: 'Módulo 1 · Sitemap',
    proposito: 'Inventario de URLs y estado de indexación: la base sobre la que se apoyan los diez módulos siguientes.',
    bien: 'Las tarjetas de cabecera eligen bien las métricas —total, 200 OK, bloqueadas por robots, sitemap desactualizado, errores 4xx/5xx— y el módulo es el único que declara explícitamente el universo de URLs.',
    hallazgos: [
      {
        sev: 'grave',
        title: '122 URLs no aparecen en ninguna categoría',
        evidence:
          'Las tarjetas dicen «TOTAL URLS 2 886», «URLS 200 OK 2 759», «ROBOTS BLOQUEADAS 0», «SITEMAP DESACTUALIZADO 0», «ERRORES 4XX/5XX 5» y «PROBLEMAS DE INDEXACIÓN 0». La diferencia entre el total y las correctas es de 127, y sólo 5 están explicadas.',
        impact: 'El desglose no suma, así que no se puede confiar en él ni saber qué pasó con esas URLs.',
        fix:
          'Que las categorías sumen el total, con una categoría «otros» explícita y enlazable. Si el desglose se calcula sobre subconjuntos distintos, indicar el denominador en cada tarjeta.',
        nota: 'Diferencia aritmética entre tarjetas de la misma pantalla; no se verificó contra la base de datos.',
      },
      {
        sev: 'grave',
        title: 'El único texto en inglés de toda la plataforma',
        evidence:
          'El subtítulo del módulo dice «Review and manage the foundational URL structure for the audit process.». Los otros diez módulos tienen su descripción en español.',
        fix: 'Traducirlo. Es una línea, y es la primera que se lee al entrar.',
      },
      {
        sev: 'grave',
        title: 'Tabla de 18 columnas con desplazamiento no alcanzable por teclado',
        evidence:
          'La tabla principal tiene 18 columnas y muestra 25 de las 2 886 filas. La regla <code>scrollable-region-focusable</code> falla: el contenedor con desplazamiento horizontal no recibe foco.',
        fix:
          'Dar <code>tabindex="0"</code>, <code>role="region"</code> y <code>aria-label</code> al contenedor. Además, permitir elegir columnas visibles: 18 a la vez no son legibles en ningún ancho.',
      },
      {
        sev: 'moderado',
        title: 'Verde de estado a 3,31:1',
        evidence: 'El verde <code>#409F5B</code> usado para marcar estado correcto no alcanza el 4,5:1 exigido.',
        fix: 'Sustituir por <code>#14713D</code>, que da 5,35:1 sobre fondo verde claro y mantiene la lectura de «correcto».',
      },
      {
        sev: 'moderado',
        title: 'La tabla de hallazgos tiene una sola fila y 12 columnas',
        evidence: 'La segunda tabla, «Hallazgos Sitemap / Indexación», presenta 1 fila con 12 columnas.',
        fix: 'Con un solo hallazgo, una ficha describe mejor que una tabla de 12 columnas que obliga a desplazarse en horizontal para leer un registro.',
      },
    ],
  },

  'modulo-2-tecnico': {
    orden: 2,
    titulo: 'Módulo 2 · Técnico',
    proposito: 'Códigos de estado, latencia y arquitectura de servidor por URL y dispositivo.',
    propuesta: {
      href: 'propuesta-m2-tecnico.html',
      texto:
        'Este módulo tiene además una <strong>propuesta de rediseño completa</strong> con maqueta ' +
        'interactiva: inventario de las 17 columnas una por una, tabla reducida a 6 columnas con ' +
        'la URL fija, las dos tablas convertidas en dos lentes de una sola, y el panel «Ver detalles» ' +
        'rehecho como diálogo accesible.',
    },
    bien: 'Cuatro métricas claras arriba y una tabla de hallazgos con recomendación, componente y selector: quien tenga que corregir sabe dónde tocar.',
    hallazgos: [
      {
        sev: 'grave',
        title: 'La leyenda de color es la única forma de leer el estado, y ese color no cumple contraste',
        evidence:
          'La leyenda dice «Verde: bueno · Amarillo: medio · Rojo: alerta». El verde <code>#409F5B</code> da 3,31:1, por debajo del 4,5:1 exigido, y la regla <code>color-contrast</code> falla en 52 nodos de este módulo.',
        impact:
          'Codificar el estado sólo con color excluye a quien no distingue rojo y verde —en torno al 8 % de los hombres—, y aquí además el color elegido es de bajo contraste para todos.',
        fix:
          'Añadir texto o icono junto al color en cada celda de estado y subir el verde a <code>#14713D</code>. El componente de estado propuesto en el informe de plataforma sirve tal cual.',
      },
      {
        sev: 'moderado',
        title: '«SALUD TÉCNICA 100 %» sin decir cómo se calcula',
        evidence: 'Las tarjetas muestran «URLS PROCESADAS 200», «STATUS OK 200», «ERRORES HTTP 0» y «SALUD TÉCNICA 100 %».',
        impact:
          'Un 100 % invita a cerrar el módulo. Como sólo se procesaron 200 de las 2 886 URLs del inventario, el porcentaje describe la muestra, no el sitio.',
        fix: 'Escribir el denominador en la tarjeta («100 % de 200 URLs medidas, de 2 886 del inventario») y enlazar a la definición de la métrica.',
      },
      {
        sev: 'moderado',
        title: 'Tabla de 17 columnas con dos filtros sin etiqueta',
        evidence:
          'La tabla principal tiene 17 columnas y 25 filas visibles. Sobre ella, los filtros «Dispositivo: Todos / mobile / desktop» y «Severidad: Todas / Alta / Media / Baja» son <code>&lt;select&gt;</code> sin etiqueta asociada, con los valores de dispositivo en inglés.',
        fix: 'Etiquetar los dos filtros, traducir los valores y permitir ocultar columnas.',
      },
    ],
  },

  'modulo-3-seo': {
    orden: 3,
    titulo: 'Módulo 3 · SEO',
    proposito: 'Etiquetas meta, directivas de indexación y estructura de encabezados.',
    bien: 'Diez métricas bien elegidas que cubren el problema real —H1 ausentes o múltiples, títulos y metadescripciones fuera de rango— y una tabla de hallazgos con selector CSS.',
    hallazgos: [
      {
        sev: 'critico',
        title: '«SEO SCORE 97 %» contradice las diez tarjetas que tiene al lado',
        evidence:
          'La primera tarjeta marca 97 %. Las siguientes, en la misma fila: 12 páginas sin H1, 12 con H1 múltiple, 13 títulos muy cortos, 50 muy largos, 25 metadescripciones cortas y 9 largas. Sobre 200 páginas, eso supone que al menos la mitad tiene algún defecto declarado.',
        impact:
          'La cifra grande es la que se lee y la que se lleva a la reunión. Un 97 % junto a 121 defectos hace que el resto de la pantalla parezca irrelevante.',
        fix:
          'Publicar la fórmula del score junto al número, ponderarlo por severidad y, si mide otra cosa, renombrarlo. Un score que no baja cuando hay 50 títulos fuera de rango no sirve como indicador.',
        nota: 'No se pudo verificar la fórmula del score: no está documentada en la interfaz.',
      },
      {
        sev: 'grave',
        title: '77 nodos por debajo del contraste mínimo',
        evidence: 'La regla <code>color-contrast</code> falla en 77 nodos, el segundo peor recuento del visor, con el mismo verde <code>#409F5B</code> a 3,31:1.',
        fix: 'Sustitución del verde por <code>#14713D</code>.',
      },
      {
        sev: 'grave',
        title: '172 controles interactivos, todos por debajo de 44 px',
        evidence: 'Es el segundo módulo con más elementos interactivos —172— y ninguno alcanza el tamaño mínimo.',
        fix: 'Alto mínimo de 44 px; agrupar acciones repetidas de fila en un menú.',
      },
      {
        sev: 'moderado',
        title: 'Diecisiete columnas para un problema que se explica con cinco',
        evidence:
          'La tabla «Registro de URLs auditadas» reparte en 17 columnas datos que responden a una pregunta simple: qué le falta a cada URL. Incluye a la vez «Canonical», «Estado canonical», «URL canónica» y «Canonical esperado».',
        fix:
          'Vista por defecto con URL, problema, valor esperado y valor detectado; el resto de columnas, opcionales. Las cuatro columnas de canonical se resumen en una de estado más un detalle desplegable.',
      },
    ],
  },

  'modulo-4-tagging': {
    orden: 4,
    titulo: 'Módulo 4 · Tagging',
    proposito: 'Implementación de GTM, GA4, dataLayer y píxeles de terceros por URL.',
    propuesta: {
      href: 'm4-tagging-title-imagen.html',
      etiqueta: 'Solicitud técnica',
      rotulo: 'incluye solicitud técnica',
      texto:
        'Este módulo tiene además una <strong>solicitud técnica</strong> sobre un defecto de origen: ' +
        'el crawler no lee el atributo <code>title</code> de las imágenes, que es la única fuente del ' +
        'parámetro <code>clicked_banner_name</code> en los banners de una sola imagen. Sin él, la ' +
        'validación produce falsos positivos y falsos negativos indistinguibles.',
    },
    bien: 'Distingue detección de correcta implementación, y detecta doble etiquetado, que es el error más costoso de este ámbito.',
    hallazgos: [
      {
        sev: 'grave',
        title: 'El peor recuento de contraste del visor: 101 nodos',
        evidence:
          'La regla <code>color-contrast</code> falla en 101 nodos, más que en cualquier otro módulo. La causa es la misma —el verde <code>#409F5B</code> a 3,31:1— multiplicada por la cantidad de celdas de estado que tiene la tabla.',
        fix: 'Un solo cambio de token corrige los 101 nodos.',
      },
      {
        sev: 'grave',
        title: 'Tres representaciones distintas del mismo score en una pantalla',
        evidence:
          'Arriba, tarjetas con «GTM DETECTADO 100 %», «GA4 DETECTADO 92 %», «DATALAYER DETECTADO 100 %». Debajo, un encabezado «Tagging Score 99 %». Y a continuación, otro bloque titulado «Estado de implementación».',
        impact:
          'No se sabe cuál manda. El 99 % global convive con un 92 % de GA4 y con 2 casos de doble etiquetado sin que la relación entre las tres cifras esté explicada.',
        fix: 'Un solo indicador principal con su desglose debajo, y el criterio de cálculo a la vista.',
      },
      {
        sev: 'moderado',
        title: '«DOBLE ETIQUETADO 2» tiene el mismo peso visual que las métricas correctas',
        evidence: 'La tarjeta que informa del único defecto real de la pantalla se presenta igual que las tres que informan de 100 %.',
        fix: 'Las tarjetas con valor problemático deben leerse como alerta: color de estado, orden primero y enlace al detalle filtrado.',
      },
      {
        sev: 'moderado',
        title: 'Diecisiete columnas con nombres de píxeles crudos',
        evidence:
          'Cabeceras como «FB PIXEL», «TIKTOK PIXEL», «DUPLICADO FB PIXEL», «ERRORES CONSOLA PIXEL» junto a «GENERA LEAD» y «WHATSAPP», sin agrupación ni jerarquía.',
        fix: 'Agrupar columnas por familia —etiquetado propio, píxeles de terceros, conversiones— con cabeceras de dos niveles.',
      },
    ],
  },

  'modulo-5-links': {
    orden: 5,
    titulo: 'Módulo 5 · Links',
    proposito: 'Validación de enlaces internos, externos, recursos y anclas.',
    bien: 'Es el módulo mejor estructurado del visor: resumen de reglas, ranking de páginas peores, detalle y hallazgos, en ese orden. Ese orden es el correcto y debería ser el patrón de los demás.',
    hallazgos: [
      {
        sev: 'critico',
        title: '6 399 enlaces rotos de 51 648 presentados como un dato neutro',
        evidence:
          'Las tarjetas dicen «LINKS PROCESADOS 51 648», «LINKS ROTOS 6 399», «EXTERNOS 15 689», «ANCLAS INVÁLIDAS 0», «PÁGINAS HUÉRFANAS 20», «PÁGINAS POCO ENLAZADAS 5». El 12,4 % de los enlaces del sitio está roto, y la tarjeta que lo dice tiene el mismo color, tamaño y posición que «EXTERNOS 15 689», que es un dato descriptivo.',
        impact:
          'Es la cifra más grave de toda la plataforma y la pantalla no la distingue de un recuento inocuo. Nada indica que 6 399 sea mucho ni con qué se compara.',
        fix:
          'Expresarlo como porcentaje además del absoluto, en color de alerta, primero en el orden, con enlace al detalle ya filtrado por roto y con la evolución respecto a la corrida anterior.',
      },
      {
        sev: 'grave',
        title: 'Párrafos de definición de regla dentro de celdas de tabla',
        evidence:
          'La columna «Significado regla» contiene textos como «Valida anchors internos inválidos en las URLs auditadas. Criterio de cumplimiento: broken_anchors = 0. Impacto si falla: puede afectar la navegación, transferencia de autoridad SEO y continuidad…», repetidos en cada fila.',
        impact: 'Convierte una tabla escaneable en un muro de texto y multiplica el alto de la página: 5 927 px en escritorio, 7 273 px en móvil.',
        fix:
          'Dejar en la celda el nombre corto de la regla y mover la definición a un panel lateral o a un desplegable. La definición es la misma para todas las filas de esa regla: no pertenece a la fila.',
      },
      {
        sev: 'grave',
        title: 'Dos contenedores con desplazamiento sin acceso por teclado',
        evidence: 'La regla <code>scrollable-region-focusable</code> falla en 2 nodos, sobre cuatro tablas con 69 filas en total.',
        fix: '<code>tabindex="0"</code>, <code>role="region"</code> y <code>aria-label</code> en cada contenedor con desplazamiento.',
      },
      {
        sev: 'moderado',
        title: '«PÁGINAS HUÉRFANAS 20» sin definición ni acceso al listado',
        evidence: 'La tarjeta da el número pero no explica el criterio ni permite ver cuáles son.',
        fix: 'Definición al pasar el cursor y enlace al detalle filtrado.',
      },
    ],
  },

  'modulo-6-content-ui': {
    orden: 6,
    titulo: 'Módulo 6 · Content/UI',
    proposito: 'Cumplimiento de contenido: palabras prohibidas, campañas vencidas, disclaimers, tipografía y accesibilidad.',
    bien: 'Cubre riesgos de cumplimiento que ninguna herramienta genérica detecta —campaña vencida, competidores mencionados, condiciones de promoción ausentes—, y eso es valor propio de la plataforma.',
    hallazgos: [
      {
        sev: 'grave',
        title: 'Once tarjetas con unidades incompatibles y ningún umbral',
        evidence:
          'En la misma fila: «URLS PROCESADAS 100», «HALLAZGOS 25», «FUENTES INVÁLIDAS 2 613», «FUENTES CAÍDAS 11», «TIPOGRAFÍA (V/A/R) 0/2 519/94», «CONDICIONES FALTANTES 100», «ACCESIBILIDAD 2 028», «IFRAMES 27 · 2 rotos», «PDFS 79 · 52 obsoletos».',
        impact:
          'Se mezclan páginas, ocurrencias, recursos y una terna sin explicar. «ACCESIBILIDAD 2 028» no dice si son fallos o comprobaciones superadas. «CONDICIONES FALTANTES 100» coincide con el total de URLs procesadas, lo que sugiere que falla en todas, pero la tarjeta no lo dice.',
        fix:
          'Unidad explícita en cada tarjeta, umbral que justifique el color y agrupación por tipo de riesgo. Cuando una métrica afecta al 100 % del universo medido, decirlo con palabras.',
      },
      {
        sev: 'grave',
        title: '«TIPOGRAFÍA (V/A/R)» es indescifrable',
        evidence: 'La tarjeta muestra «0/2 519/94» bajo la etiqueta «TIPOGRAFÍA (V/A/R)», sin leyenda en ninguna parte de la pantalla.',
        impact: 'Nadie que no haya escrito el código sabe qué son V, A y R, ni en qué orden.',
        fix: 'Tres cifras etiquetadas —válidas, en aviso, rechazadas— o una barra apilada con leyenda.',
      },
      {
        sev: 'grave',
        title: 'La pantalla más larga del visor después del Resumen',
        evidence: '7 917 px en escritorio y 10 669 px en móvil, con tres tablas de 25, 25 y 25 filas y una de 21 columnas.',
        fix: 'Paginación real, columnas seleccionables y secciones plegables.',
      },
      {
        sev: 'moderado',
        title: 'Verde de estado a 3,31:1 en 51 nodos',
        evidence: 'Mismo token <code>#409F5B</code>, 51 nodos afectados.',
        fix: 'Sustitución por <code>#14713D</code>.',
      },
    ],
  },

  'modulo-7-performance': {
    orden: 7,
    titulo: 'Módulo 7 · Performance',
    proposito: 'Core Web Vitals y score de rendimiento por URL y estrategia.',
    bien: 'Es el único módulo sin ningún fallo de contraste, y usa las métricas estándar —LCP, CLS, INP, TTFB—, lo que permite comparar con cualquier herramienta externa.',
    hallazgos: [
      {
        sev: 'critico',
        title: 'El peor resultado de la plataforma, presentado sin ninguna jerarquía',
        evidence:
          'Tres tarjetas: «MEDICIONES 400», «SCORE PROMEDIO 41 %», «HALLAZGOS 2 847». Un 41 % es un rendimiento malo y 2 847 hallazgos es el mayor recuento del visor; ambas cifras se muestran en negro sobre blanco, sin color de estado, sin umbral y sin comparación.',
        impact:
          'El módulo que más trabajo destapa es también el que menos lo comunica. Junto a un «SEO SCORE 97 %» en la pantalla vecina, un 41 % parece un dato más.',
        fix:
          'Color de estado según umbral —Core Web Vitals ya define bueno, mejorable y malo—, orden por impacto y las tres URLs peores destacadas arriba con su métrica dominante.',
      },
      {
        sev: 'grave',
        title: 'Nombres de campo internos como cabeceras de columna',
        evidence:
          'La tabla principal alterna «LCP (MS)» y «CLS» con <code>fcp_ms</code>, <code>speed_index_ms</code> y <code>total_blocking_time_ms</code>, en la misma fila de encabezados y con 21 columnas.',
        impact: 'La inconsistencia sugiere que unas columnas se etiquetaron a mano y otras se volcaron desde la base de datos.',
        fix: 'Traducir las tres restantes a su nombre estándar —FCP, Speed Index, TBT— con la unidad entre paréntesis, como ya se hace con LCP.',
      },
      {
        sev: 'moderado',
        title: 'Ninguna referencia al umbral en las métricas de Core Web Vitals',
        evidence: 'Las columnas de LCP, CLS, INP y TTFB muestran el valor sin indicar el límite recomendado.',
        fix:
          'Umbral visible por columna y celda coloreada según el valor. Son métricas con límites publicados: LCP 2,5 s, CLS 0,1, INP 200 ms.',
      },
      {
        sev: 'moderado',
        title: 'El filtro «Estrategia» ofrece valores en inglés y no tiene etiqueta',
        evidence: '«Estrategia: Todos / mobile / desktop», en un <code>&lt;select&gt;</code> sin <code>label</code>.',
        fix: 'Etiquetar el control y traducir a «Móvil» y «Escritorio», como ya hace la propia tabla en la columna «ESTRATEGIA», que sí dice «Móvil».',
      },
    ],
  },

  'modulo-8-change-history': {
    orden: 8,
    titulo: 'Módulo 8 · Change History',
    proposito: 'Diferencias detectadas entre dos corridas consecutivas: qué cambió en el sitio desde la última auditoría.',
    bien: 'El módulo existe, y comparar corridas es justo lo que convierte una auditoría puntual en monitoreo. La estructura está lista para cuando haya datos.',
    hallazgos: [
      {
        sev: 'grave',
        title: 'Vacío, y sin decir por qué ni qué hacer',
        evidence:
          'Es el único módulo genuinamente vacío: 398 caracteres de contenido, 826 px de alto en escritorio, cuatro tarjetas a cero —«CAMBIOS DETECTADOS 0», «URLS NUEVAS 0», «URLS ELIMINADAS 0», «METADATOS CAMBIADOS 0»— y dos mensajes distintos de ausencia en la misma pantalla: «Sin resumen · No hay resumen de hallazgos disponible» y «Sin datos para mostrar».',
        impact:
          'Un módulo comparativo vacío casi siempre significa que aún no hay dos corridas comparables, no que no haya cambios. Tal como está, el usuario no puede distinguir «el sitio no cambió» de «esto todavía no funciona», y son conclusiones opuestas.',
        fix:
          'Un solo estado vacío que explique la causa y ofrezca la acción: «Se necesitan dos auditorías de la misma colección para comparar. La última fue el 17 jul; lanza una nueva para ver los cambios», con el botón al lado. Si sí hubo comparación y no hubo cambios, decirlo con esas palabras: «Sin cambios respecto a la corrida del 17 jul».',
      },
      {
        sev: 'moderado',
        title: 'El título en inglés en un menú por lo demás en español',
        evidence: 'El sidebar y el encabezado dicen «Módulo 8 · Change History», frente a «Módulo 1 · Sitemap», «Módulo 2 · Técnico» o «Módulo 6 · Content/UI».',
        fix: '«Historial de cambios». Es el único de los once cuyo nombre propio está íntegramente en inglés.',
      },
      {
        sev: 'moderado',
        title: 'Tabla de 5 columnas y filtro de severidad sobre una pantalla sin datos',
        evidence: 'Se renderizan la cabecera de la tabla y el filtro «Severidad: Todas / Alta / Media / Baja» —sin etiqueta— aunque no hay ninguna fila.',
        fix: 'Ocultar los controles que no operan sobre nada y dejar sólo el estado vacío con su acción.',
      },
    ],
  },

  'modulo-9-alertas': {
    orden: 9,
    titulo: 'Módulo 9 · Alertas',
    proposito: 'Eventos de alerta operativa con su umbral y su valor actual.',
    bien: 'La tabla de eventos trae umbral y valor actual en columnas propias, que es exactamente lo que hace accionable una alerta.',
    hallazgos: [
      {
        sev: 'grave',
        title: '200 alertas idénticas listadas una por una',
        evidence:
          'Las tarjetas dicen «ALERTAS TOTALES 200», «ALTA 200», «MEDIA 0», «BAJA 0». El resumen revela que las 200 son la misma regla: <code>SECURITY_HTTPS_SECURITY_HEADERS</code>, «Faltan headers de seguridad HTTP/HTTPS», con el mismo valor detectado <code>strict-transport-security</code>. La tabla las repite fila a fila, una por URL.',
        impact:
          'No hay 200 problemas, hay uno que afecta a 200 URLs, y probablemente se corrige en un único punto de configuración del servidor. Presentarlo como 200 alertas de severidad alta infla la percepción del trabajo y entierra cualquier otra alerta futura.',
        fix:
          'Agrupar por regla: «Faltan cabeceras de seguridad — 200 URLs afectadas», desplegable al listado. La cuenta principal debe ser de problemas distintos, con las URLs afectadas como detalle.',
      },
      {
        sev: 'grave',
        title: 'La constante de código es el nombre visible de la alerta',
        evidence: 'La columna «TIPO DE ALERTA» muestra <code>SECURITY_HTTPS_SECURITY_HEADERS</code>, y el resumen usa esa misma cadena como etiqueta de fila.',
        fix: 'Nombre legible —«Cabeceras de seguridad ausentes»— con la constante disponible para soporte en un <code>title</code>.',
      },
      {
        sev: 'moderado',
        title: 'La numeración de módulos de la alerta no coincide con la del sidebar',
        evidence:
          'La columna «MÓDULO» dice «M2 Technical Crawler / M9 Security Alerts». En el sidebar, M2 es «Técnico» y M9 es «Alertas». Aparecen tres vocabularios para los mismos módulos: el del sidebar, el de esta columna en inglés y el de la pantalla de Alertas por correo de la plataforma.',
        fix: 'El diccionario único de nombres de módulo, aplicado también a los datos de alerta.',
      },
      {
        sev: 'moderado',
        title: 'Mensaje de alerta truncado sin posibilidad de leerlo completo',
        evidence: 'La celda muestra «Sin hallazgos de…» cortado, sin <code>title</code> ni forma de expandir.',
        fix: 'Truncado con <code>title</code> completo y fila expandible.',
      },
    ],
  },

  'modulo-10-imagenes': {
    orden: 10,
    titulo: 'Módulo 10 · Imágenes',
    proposito: 'Tipografía dentro de imágenes, OCR, intención comercial, CTA y coherencia con la página que las contiene.',
    bien:
      'Tiene la mejor idea de información de todo el visor: la sección «Prioridades de imágenes (qué arreglar primero)», numerada y ordenada por severidad. Es el único sitio de la plataforma que responde «¿por dónde empiezo?» y debería replicarse en los otros diez módulos.',
    hallazgos: [
      {
        sev: 'grave',
        title: 'Once tarjetas de métrica entierran el peor dato del módulo',
        evidence:
          'La fila de tarjetas incluye «IMÁGENES ANALIZADAS 50», «ÚNICAS 50», «CONTEXTO NO COINCIDE 7», «CON CTA 12», «PROMOCIONES 15», «OBSOLETAS >180D 24», «ENVEJECIENDO 60-180D 11», «SCORE VISUAL 78 %», «SCORE MARCA 46 %», «TIPOGRAFÍA (V/A/R) 25/0/0», «HALLAZGOS 167». El «SCORE MARCA 46 %» —el peor indicador del módulo— queda en novena posición, con el mismo formato que «ÚNICAS 50».',
        impact:
          'Además, 24 obsoletas más 11 envejeciendo son 35 de 50 imágenes con problema de vigencia: el 70 %. Ese titular no está en ninguna parte.',
        fix: 'Un máximo de cuatro tarjetas, elegidas por criticidad, con las demás en una segunda línea plegable y color de estado según umbral.',
      },
      {
        sev: 'grave',
        title: 'El módulo más pesado y más largo de recorrer',
        evidence:
          '10 976 px de alto en escritorio y 14 811 px en móvil, cuatro tablas con 89 filas, 50 imágenes cargadas y 198 elementos interactivos, todos por debajo de 44 px. Es el mayor recuento de controles del visor.',
        fix:
          'Carga diferida de las miniaturas, paginación de las cuatro tablas y secciones plegables. Con 50 imágenes ya cuesta; con 500 no abre.',
      },
      {
        sev: 'moderado',
        title: 'Emoji en un encabezado, el único de la plataforma',
        evidence: 'El <code>h2</code> dice «🎯 Prioridades de imágenes (qué arreglar primero)». Ningún otro encabezado del visor usa emoji.',
        fix:
          'Sustituir por el mismo sistema de iconos que el resto de la interfaz. El emoji lo lee el lector de pantalla como «dardo» antes del título.',
      },
      {
        sev: 'moderado',
        title: '«needs_human_review» como cabecera de columna',
        evidence: 'La tabla de análisis tipográfico incluye la columna <code>needs_human_review</code> junto a «Confianza» y «Recomendación», ambas en español.',
        fix: '«Requiere revisión manual», y que además sea filtrable: es la columna que decide el trabajo de una persona.',
      },
      {
        sev: 'moderado',
        title: 'Dos scores sin escala ni criterio',
        evidence: '«SCORE VISUAL 78 %» y «SCORE MARCA 46 %» aparecen sin indicar qué se considera aceptable ni cómo se calculan.',
        fix: 'Umbral visible y enlace a la definición, igual que en los scores de SEO y Tagging.',
      },
    ],
  },
};
