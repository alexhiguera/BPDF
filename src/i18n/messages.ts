/**
 * Todos los textos visibles de la interfaz (D2: español en v1).
 *
 * Los componentes no escriben texto a mano: lo leen de aquí. Así, añadir otro
 * idioma es añadir otro objeto con la misma forma (el tipo `Messages` obliga a
 * traducirlo entero) y elegir cuál se usa; no hace falta buscar cadenas por
 * todo `src/`. `tests/unit/textos.test.ts` falla si aparece texto suelto en un
 * componente.
 *
 * El nombre y la descripción del producto no están aquí: son identidad y viven
 * en `src/config/project.ts`.
 */

/** Cómo se escriben los modificadores en la interfaz. */
const tecla = { ctrl: "Ctrl/⌘", mayus: "Mayús" } as const;

/**
 * Las teclas de cada atajo, tal como se ven: una sola tabla para la ayuda de
 * atajos (`pdf.help.rows`) y los tooltips de los botones (Fase 11). Los valores
 * de `aria-keyshortcuts` (no visibles) viven junto a la lógica, en
 * `src/app/pdf/atajos.ts` y en `App.tsx`.
 */
const teclas = {
  abrir: [tecla.ctrl, "O"],
  anterior: ["RePág"],
  siguiente: ["AvPág"],
  alejar: [tecla.ctrl, "−"],
  zoom100: [tecla.ctrl, "0"],
  acercar: [tecla.ctrl, "+"],
  buscar: [tecla.ctrl, "F"],
  irAPagina: [tecla.ctrl, "G"],
  coincidenciaSiguiente: ["F3"],
  coincidenciaAnterior: [tecla.mayus, "F3"],
  cerrarBusqueda: ["Esc"],
  miniaturas: ["T"],
  girarDerecha: ["R"],
  girarIzquierda: [tecla.mayus, "R"],
  pantallaCompleta: ["F"],
  ayuda: ["?"],
} as const;

export const messages = {
  app: {
    skipToContent: "Saltar al contenido",
    noscript: "BPDF necesita JavaScript para funcionar.",
  },
  emptyState: {
    title: "Tu lector de PDF y Markdown",
    body: "Abre archivos PDF o Markdown, o arrástralos a esta ventana.",
    local: "Tus documentos se mantienen en tu dispositivo, de forma privada y segura.",
    privacy: "Tus documentos no salen de este dispositivo.",
    privacyDetail: "BPDF funciona de forma local. Tus archivos permanecen siempre en tu equipo.",
    decorations: {
      pdf: "PDF",
      markdown: "M↓",
    },
    features: {
      title: "Funciones de BPDF",
      dark: {
        title: "Modo oscuro",
        body: "Interfaz moderna y cómoda",
      },
      privacy: {
        title: "Privacidad local",
        body: "Todo en tu dispositivo, sin subir archivos",
      },
      katex: {
        title: "KaTeX",
        body: "Fórmulas matemáticas en tus documentos",
      },
      mermaid: {
        title: "Mermaid",
        body: "Diagramas y gráficos desde Markdown",
      },
      edit: {
        title: "Editar Markdown",
        body: "Escribe y visualiza al instante",
      },
      export: {
        title: "Exportar PDF",
        body: "Convierte tu Markdown a PDF fácilmente",
      },
    },
  },
  /** Un botón con su atajo, para `title` (Fase 11). */
  withShortcut: (etiqueta: string, combinacion: readonly string[]) =>
    `${etiqueta} (${combinacion.join(" ")})`,
  keys: teclas,
  open: {
    button: "Abrir archivo",
    folder: "Abrir carpeta",
    /** Un Markdown nuevo, vacío, en «Dividido» (Fase 17). */
    create: "Crear Markdown",
    /** Las mismas teclas que la ayuda y los tooltips (Fase 11). */
    shortcut: `Atajo: ${teclas.abrir.join(" ")}`,
  },
  /** Mención discreta al pie del estado vacío (Fase 11). Los nombres salen de project.ts. */
  credits: {
    free: "Gratis y open source",
    createdBy: "Creado por",
    withLove: "con ❤️",
    organizationTitle: (url: string) => `${url}, en una pestaña nueva`,
  },
  dropZone: {
    hint: "Suelta el archivo para abrirlo (o un Markdown con sus imágenes, o su carpeta)",
  },
  document: {
    /** Nombre que se muestra si el fichero no trae uno utilizable. */
    untitled: "Sin nombre",
    /** Nombre visible de un Markdown creado con «Crear Markdown» (Fase 17). No se guarda. */
    newUntitled: "Sin título",
  },
  /** Carpeta con varios Markdown (Fase 7 bis): el usuario elige el principal. */
  chooseMarkdown: {
    title: "¿Qué Markdown quieres abrir?",
    body: (total: number) =>
      `La carpeta tiene ${total} archivos Markdown. Elige el que quieres leer; sus imágenes se buscarán en la misma carpeta.`,
    list: "Markdown de la carpeta",
    cancel: "Cancelar",
  },
  documentError: {
    title: (fileName: string) => `No se ha podido abrir «${fileName}»`,
    titleNoFile: "No se ha podido abrir el archivo",
    dismiss: "Descartar aviso",
    unsupported: "BPDF abre archivos PDF (.pdf) y Markdown (.md, .markdown).",
    noMarkdown:
      "Entre los archivos elegidos no hay ningún Markdown (.md). Para ver un Markdown con sus imágenes, elige el .md junto con ellas.",
    severalMarkdown:
      "Has elegido varios Markdown. BPDF abre un documento cada vez: elige un solo .md junto con sus imágenes.",
    incompatible:
      "Ese archivo no puede acompañar a un Markdown. Un PDF se abre solo; un Markdown, solo o con sus imágenes (PNG, JPEG, GIF, WebP o SVG).",
    folderNoMarkdown:
      "La carpeta no contiene ningún Markdown (.md). Para abrir un PDF, usa «Abrir archivo».",
    mixedDrop: "Suelta una sola carpeta, o archivos sueltos, pero no las dos cosas a la vez.",
    folderTooLarge: (max: string) =>
      `La carpeta tiene demasiados archivos (más de ${max}). Abre una carpeta más pequeña, o el Markdown junto con sus imágenes.`,
    empty: "El archivo está vacío.",
    tooLarge: (max: string) => `El archivo supera el tamaño máximo para este tipo (${max}).`,
    notPdf: "El archivo se llama .pdf, pero su contenido no es un PDF.",
    notUtf8:
      "El archivo no es texto en UTF-8. Si es un Markdown, guárdalo con esa codificación y vuelve a abrirlo.",
    unreadable:
      "No se ha podido leer el archivo. Comprueba que sigue existiendo y que tienes permiso para abrirlo.",
  },
  /** Visor PDF (Fases 5 y 6). Los atajos están en docs/ARCHITECTURE.md → visor PDF. */
  pdf: {
    loading: "Abriendo el PDF…",
    rendering: "Pintando páginas…",
    errors: {
      unreadable: "BPDF no ha podido leer este PDF: está dañado o no es un PDF válido.",
      page: "No se ha podido mostrar esta página.",
    },
    toolbar: "Herramientas del documento",
    tools: "Herramientas",
    toolsTitle: "Herramientas del PDF",
    closeTools: "Cerrar herramientas",
    groups: {
      navigation: "Navegación",
      view: "Vista y zoom",
      tools: "Herramientas",
      document: "Documento",
      page: "Página",
      zoom: "Zoom",
      appearance: "Vista",
      actions: "Acciones",
    },
    thumbnails: "Miniaturas",
    showThumbnails: "Mostrar miniaturas",
    hideThumbnails: "Ocultar miniaturas",
    previous: "Página anterior",
    next: "Página siguiente",
    pageInput: "Número de página",
    pageTotal: (total: number) => `de ${total}`,
    invalidPage: (total: number) => `Escribe un número de página entre 1 y ${total}.`,
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    zoomReset: (porcentaje: number) => `Zoom ${porcentaje} %. Pulsa para volver al 100 %`,
    zoomPercent: (porcentaje: number) => `${porcentaje} %`,
    fitWidth: "Ajustar al ancho",
    fitPage: "Ajustar a la página",
    rotate: "Girar 90° a la derecha",
    rotateLeft: "Girar 90° a la izquierda",
    fullscreen: "Pantalla completa",
    shortcuts: "Atajos de teclado",
    view: "Vista",
    viewContinuous: "Continua",
    viewSingle: "Página a página",
    colors: "Colores de la página",
    modeDark: "Oscuro",
    modeOriginal: "Original",
    search: "Buscar",
    searchLabel: "Buscar en el documento",
    searchNext: "Coincidencia siguiente",
    searchPrevious: "Coincidencia anterior",
    searchClose: "Cerrar la búsqueda",
    searchMatchCase: "Distinguir mayúsculas",
    searchWholeWord: "Palabra completa",
    searchCount: (actual: number, total: number) => `${actual} de ${total}`,
    searchNone: "Sin resultados",
    searching: (revisadas: number, total: number) => `Buscando… ${revisadas} de ${total} páginas`,
    searchNoText:
      "Este documento no tiene texto que buscar: sus páginas son imágenes (quizá un escaneo). BPDF no reconoce texto en imágenes.",
    close: "Cerrar documento",
    document: "Documento",
    page: (numero: number, total: number) => `Página ${numero} de ${total}`,
    thumbnail: (numero: number) => `Página ${numero}`,
    status: {
      page: (numero: number, total: number) => `Página ${numero}/${total}`,
      zoom: (porcentaje: number) => `Zoom ${porcentaje} %`,
      rotation: (grados: number) => `Girado ${grados}°`,
    },
    announce: {
      zoom: (porcentaje: number) => `Zoom ${porcentaje} %`,
      rotation: (grados: number) => `Página girada ${grados}°`,
      mode: (modo: string) => `Colores: ${modo}`,
      view: (vista: string) => `Vista: ${vista}`,
      results: (total: number) => (total === 1 ? "1 coincidencia" : `${total} coincidencias`),
      externalLink: (url: string) => `Abriendo ${url} fuera de BPDF`,
      fullscreen: (activa: boolean) =>
        activa ? "Pantalla completa. Esc para salir" : "Fuera de pantalla completa",
    },
    /** Diálogo de ayuda de atajos (Fase 6). */
    help: {
      title: "Atajos de teclado",
      close: "Cerrar la ayuda",
      table: "Atajos del visor PDF",
      keys: "Teclas",
      action: "Acción",
      singleKey: "Atajos de una tecla (F, T, R, Mayús+R y ?)",
      singleKeyHint:
        "Desactívalos si chocan con tu lector de pantalla o con tu forma de usar el teclado. Mientras estén desactivados, esta ayuda se abre con el botón de la barra.",
      singleKeyMark: "una tecla",
      rows: [
        {
          keys: teclas.pantallaCompleta,
          action: "Entrar o salir de pantalla completa (Esc también sale)",
          single: true,
        },
        { keys: teclas.miniaturas, action: "Mostrar u ocultar las miniaturas", single: true },
        { keys: teclas.girarDerecha, action: "Girar 90° a la derecha", single: true },
        { keys: teclas.girarIzquierda, action: "Girar 90° a la izquierda", single: true },
        { keys: teclas.ayuda, action: "Abrir esta ayuda", single: true },
        { keys: teclas.siguiente, action: "Página siguiente" },
        { keys: teclas.anterior, action: "Página anterior" },
        { keys: ["Espacio"], action: "Página siguiente" },
        { keys: ["Mayús", "Espacio"], action: "Página anterior" },
        { keys: ["→"], action: "Página siguiente (en «Página a página»)" },
        { keys: ["←"], action: "Página anterior (en «Página a página»)" },
        { keys: ["Inicio"], action: "Primera página" },
        { keys: ["Fin"], action: "Última página" },
        { keys: ["↓"], action: "Bajar (en «Página a página», al final pasa de página)" },
        { keys: ["↑"], action: "Subir (en «Página a página», al principio vuelve de página)" },
        { keys: teclas.irAPagina, action: "Ir al número de página" },
        { keys: teclas.acercar, action: "Acercar" },
        { keys: teclas.alejar, action: "Alejar" },
        { keys: teclas.zoom100, action: "Zoom al 100 %" },
        { keys: teclas.buscar, action: "Buscar en el documento" },
        { keys: ["Intro"], action: "En la búsqueda: coincidencia siguiente" },
        { keys: ["Mayús", "Intro"], action: "En la búsqueda: coincidencia anterior" },
        {
          keys: teclas.coincidenciaSiguiente,
          action: "Con la búsqueda abierta: coincidencia siguiente",
        },
        {
          keys: teclas.coincidenciaAnterior,
          action: "Con la búsqueda abierta: coincidencia anterior",
        },
        { keys: ["Esc"], action: "Cerrar la búsqueda, esta ayuda o la pantalla completa" },
        { keys: teclas.abrir, action: "Abrir otro archivo" },
      ],
    },
    /** Diálogo de contraseña (Fase 6, D13). La contraseña no se guarda. */
    password: {
      title: "PDF protegido con contraseña",
      body: "Escribe la contraseña para abrirlo. BPDF no la guarda.",
      label: "Contraseña",
      open: "Abrir",
      checking: "Comprobando…",
      cancel: "Cancelar",
      wrong: "La contraseña no es correcta. Inténtalo de nuevo.",
    },
    link: {
      internal: (numero: number) => `Ir a la página ${numero}`,
      external: (url: string) => `Abrir ${url} en el navegador`,
    },
  },
  /** Diálogo de preferencias (Fase 10, docs/PLAN.md §8). */
  preferences: {
    open: "Preferencias",
    title: "Preferencias",
    close: "Cerrar las preferencias",
    intro:
      "Se guardan solo en este navegador. BPDF nunca guarda nombres de archivo, contenido ni contraseñas.",
    pdf: "PDF: al abrir un documento",
    pdfHint:
      "Se aplican al siguiente PDF que abras; los botones del visor cambian solo el abierto.",
    mode: "Colores de la página",
    zoom: "Zoom",
    zoomFixed: (porcentaje: number) => `${porcentaje} %`,
    view: "Vista",
    markdown: "Markdown",
    fontSize: "Tamaño de letra",
    fontSizeValue: (px: number) => `${px} px`,
    width: "Ancho de la columna",
    widths: {
      estrecho: "Estrecho (60 caracteres)",
      normal: "Normal (72 caracteres)",
      ancho: "Ancho (90 caracteres)",
    },
    keyboard: "Teclado",
    singleKey: "Atajos de una tecla en el visor PDF (F, T, R, Mayús+R y ?)",
    position: "Posición de lectura",
    remember: "Recordar la página y el zoom de cada PDF",
    rememberHint:
      "Se guarda una huella del archivo, no su nombre. Desactivarlo no borra las posiciones ya guardadas.",
    forget: "Olvidar posiciones guardadas",
    forgotten: "Posiciones guardadas olvidadas.",
    reset: "Restablecer preferencias",
    resetDone: "Preferencias restablecidas.",
    /** «Acerca de», al final del diálogo (Fase 11; enlace al repositorio desde la Fase 16). */
    about: {
      title: (nombre: string) => `Acerca de ${nombre}`,
      version: (version: string) => `Versión ${version}`,
      license: (licencia: string) => `Software libre con licencia ${licencia}`,
      creator: (nombre: string, organizacion: string) =>
        `${nombre} es una herramienta gratuita y open source creada por ${organizacion} con ❤️.`,
      repository: "Código fuente en GitHub",
      repositoryTitle: (url: string) => `${url}, en una pestaña nueva`,
    },
  },
  /** Cambios sin guardar al sustituir o cerrar un documento (Fase 9). */
  discard: {
    title: "Hay cambios sin guardar",
    body: (nombre: string) =>
      `Si continúas, se perderán los cambios de «${nombre}». BPDF no guarda nada por su cuenta.`,
    cancel: "Seguir editando",
    confirm: "Descartar los cambios",
  },
  /** Visor Markdown (Fase 7). Comportamiento en docs/ARCHITECTURE.md → visor Markdown. */
  markdown: {
    loading: "Preparando el documento…",
    toolbar: "Herramientas del documento",
    tools: "Herramientas",
    toolsTitle: "Herramientas de Markdown",
    closeTools: "Cerrar herramientas",
    close: "Cerrar documento",
    /** Edición (Fase 9). */
    mode: {
      label: "Modo",
      lectura: "Lectura",
      edicion: "Edición",
      dividido: "Dividido",
    },
    split: {
      separator: "Ancho del editor",
      value: (porcentaje: number) => `Editor al ${porcentaje} %`,
      mobileLabel: "Vista del modo dividido",
      mobileEditor: "Editar",
      mobilePreview: "Vista previa",
    },
    editor: {
      label: "Texto Markdown. Esc y después Tab para salir del editor",
      loading: "Cargando el editor…",
      failed: "No se ha podido cargar el editor.",
    },
    save: "Guardar",
    saveShortcut: "Guardar (Ctrl+S, ⌘S en Mac)",
    /** «Guardar como…» (Fase 17): Markdown en otro destino, o PDF por la impresión del navegador. */
    saveAs: {
      button: "Guardar como…",
      title: "Guardar como",
      format: "Formato",
      markdown: "Markdown (.md)",
      pdf: "PDF (.pdf)",
      theme: "Colores del PDF",
      light: "Claro",
      dark: "Oscuro",
      markdownHint: "Elige dónde guardarlo; en Firefox y Safari se descarga una copia.",
      pdfHint:
        "Se abre el diálogo de impresión del navegador: elige «Guardar como PDF». El PDF lleva solo el documento, sin nada de BPDF.",
      confirm: "Guardar",
      cancel: "Cancelar",
    },
    /** Exportar a PDF (Fase 17). */
    pdf: {
      preparing: "Preparando PDF…",
      failed:
        "No se ha podido preparar el PDF: algo del documento no terminó de dibujarse. Inténtalo de nuevo.",
      unavailable:
        "Este navegador no permite imprimir desde BPDF, así que no puede guardar el PDF.",
    },
    saving: "Guardando…",
    saved: "Guardado.",
    downloaded: "Descargado como copia en la carpeta de descargas.",
    saveFailed: "No se ha podido guardar. Los cambios siguen aquí; inténtalo de nuevo.",
    modified: "Sin guardar",
    previewPaused:
      "Vista previa en pausa: el documento es grande y actualizarla mientras escribes lo interrumpiría.",
    previewRefresh: "Actualizar la vista previa",
    toc: "Índice",
    showToc: "Mostrar el índice",
    hideToc: "Ocultar el índice",
    tocLabel: "Índice del documento",
    footnotes: "Notas al pie",
    footnoteBack: (numero: number, repeticion: number) =>
      repeticion > 1
        ? `Volver a la llamada ${numero} (${repeticion})`
        : `Volver a la llamada ${numero}`,
    code: {
      copy: "Copiar código",
      copied: "Copiado",
      copyFailed: "No se ha podido copiar",
      announceCopied: "Código copiado al portapapeles.",
      announceFailed:
        "No se ha podido copiar el código: este navegador no deja a BPDF usar el portapapeles.",
      noLanguage: "Texto",
    },
    link: {
      external: (url: string) => `Abrir ${url} en el navegador`,
      local: "Enlace a otro archivo: BPDF no abre archivos enlazados desde un Markdown",
      blocked: "Enlace bloqueado por seguridad",
      announceExternal: (url: string) => `Abriendo ${url} fuera de BPDF`,
    },
    image: {
      noAlt: "Imagen sin descripción",
      remote: "imagen de internet no cargada",
      remoteHint:
        "BPDF no descarga imágenes de internet: la petición revelaría a un tercero que estás leyendo este documento.",
      openRemote: "Abrir la imagen en el navegador",
      blocked: "imagen bloqueada por seguridad",
      /** Imágenes locales (Fase 7 bis): por qué no se muestra una. */
      local: {
        "no-encontrado": "imagen local no incluida",
        fuera: "imagen fuera de los archivos elegidos",
        "no-soportado": "formato de imagen no admitido",
        "demasiado-grande": "imagen demasiado grande",
        ambiguo: "imagen ambigua",
        invalido: "ruta de imagen no válida",
        rota: "no se ha podido mostrar la imagen",
      },
      localHint: {
        "no-encontrado":
          "No está entre los archivos que elegiste. Para verla, abre el Markdown junto con sus imágenes, o abre su carpeta.",
        fuera:
          "La ruta sale de la carpeta o de los archivos elegidos. BPDF no busca archivos en tu equipo.",
        "no-soportado": "BPDF muestra imágenes PNG, JPEG, GIF, WebP y SVG.",
        "demasiado-grande": (max: string) => `La imagen supera el tamaño máximo (${max}).`,
        ambiguo: "Hay más de un archivo elegido que corresponde a esta ruta.",
        invalido: "La ruta de la imagen no se puede interpretar.",
        rota: "El archivo está dañado o no es la imagen que dice ser.",
      },
    },
    task: {
      done: "Tarea hecha",
      pending: "Tarea pendiente",
    },
    /** Fórmulas (Fase 8). */
    math: {
      invalid: "Fórmula no válida: se muestra su código",
    },
    /** Diagramas Mermaid (Fase 8). */
    diagram: {
      alt: (tipo: string) => (tipo ? `Diagrama Mermaid (${tipo})` : "Diagrama Mermaid"),
      source: "Código del diagrama",
      /** Título del iframe (oculto) donde se dibujan. */
      frame: "Marco aislado para dibujar diagramas",
      drawing: "Dibujando el diagrama…",
      errors: {
        invalid:
          "No se ha podido dibujar este diagrama: su sintaxis no es válida. Se muestra su código.",
        tooLarge: "Este diagrama es demasiado grande para dibujarlo. Se muestra su código.",
        images:
          "Este diagrama usa imágenes, que BPDF no carga (podrían pedirse a internet). Se muestra su código.",
      },
    },
  },
  error: {
    title: "Algo ha fallado",
    body: "Puedes volver a intentarlo.",
    retry: "Reintentar",
  },
} as const;

/**
 * La forma de los textos, con cualquier cadena: lo que tendrá que cumplir otro
 * idioma. Los textos con datos (un nombre, un tamaño) son funciones que
 * devuelven la cadena; otro idioma las traduce con los mismos parámetros.
 */
type Forma<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : Forma<T[K]>;
};
export type Messages = Forma<typeof messages>;
