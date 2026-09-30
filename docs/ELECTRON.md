# BPDF — Versión de escritorio (Electron)

> **Estado: diseño objetivo** (Fase 0, *2026-09-29*). Nada de Electron existe todavía ni
> se instala antes de la Fase 14. Lo que sí afecta desde ya: la capa `src/platform/`
> (existe desde la Fase 3, con la implementación web), la regla de que el renderer nunca
> ve rutas de disco y la CSP de `src/config/security-headers.ts` (Fase 2), que el
> protocolo `app://` servirá tal cual.

Versión de referencia al planificar: Electron **44.4.5** (npm, 2026-09-29). Electron da
soporte a las tres últimas mayores (~8 semanas cada una): la Fase 14 toma la estable
vigente, no esta.

---

## 1. Estrategia: bundle local, no URL remota

La plantilla R3ZON recomendaba para `desktop-electron` una ventana sobre la URL remota del
producto (`modules/README.md`). **BPDF hace lo contrario**: empaqueta el `dist/` de la
web dentro de la app y lo sirve desde un protocolo propio.

Motivos: funciona sin conexión; ninguna petición de red al abrir documentos (privacidad);
la versión de la app y la del código que se ejecuta son la misma (sin depender de un
despliegue); y la superficie remota es nula.

Consecuencia: el **mismo build** de Vite sirve para web y escritorio. Nada de Next,
Server Actions ni rutas de servidor (ver D1 en [PLAN.md](PLAN.md) §3).

## 2. Procesos y responsabilidades

```text
┌ main (Node, privilegiado) ───────────────────────────────────────────────┐
│ ventana · protocolos app:// y bpdf-res:// · diálogos · lectura/escritura │
│ de ficheros elegidos por el usuario · argv/open-file · enlaces externos  │
└──────────────▲───────────────────────────────────────────────────────────┘
               │ IPC (ipcMain.handle), argumentos validados con zod
┌ preload (sandbox, sin Node salvo lo mínimo) ─────────────────────────────┐
│ contextBridge.exposeInMainWorld("bpdf", { …funciones con propósito… })   │
└──────────────▲───────────────────────────────────────────────────────────┘
               │
┌ renderer (la app web tal cual; sin Node) ────────────────────────────────┐
│ src/platform/electron.ts usa window.bpdf; el resto de la app no lo ve    │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. Contrato `Platform`

**Vigente desde la Fase 3**, con `openExternal` desde la Fase 5
([`src/platform/types.ts`](../src/platform/types.ts)), solo con lo que la app usa hoy (un
documento a la vez, D16):

```ts
interface Platform {
  /** Selector del sistema; `null` si se cancela; rechaza con DocumentError si no vale. */
  pickDocument(): Promise<OpenedDocument | null>;
  /** Un fichero soltado en la ventana (el DOM da un `File` en web y en Electron). */
  openDroppedFile(file: File): Promise<OpenedDocument>;
  /** Un enlace de un documento, fuera de BPDF. Solo http:, https: y mailto:; se revalida. */
  openExternal(url: string): void;
}
```

Devuelve documentos y no `File` porque en Electron el diálogo lo abre el main, que lee
el fichero y asigna un id ligado a su ruta. Las dos implementaciones terminan en
`readDocument(file, id?)` ([`src/documents/read.ts`](../src/documents/read.ts)): misma
validación (extensión, tamaño, contenido) y mismo modelo, y la de Electron pasa el id del
main. Cómo encaja la Fase 14:

- `pickDocument()` → `window.bpdf.openDialog()` → `{ id, name, bytes }` →
  `readDocument(new File([bytes], name), id)`. El main valida antes (§7), y el renderer
  vuelve a validar: no se fía de nadie.
- `openDroppedFile(file)` → `window.bpdf.registerDropped(file)` → `{ id }` →
  `readDocument(file, id)`.
- `openExternal(url)` → `window.bpdf.openExternal(url)` → el main revalida la URL con la
  misma política (`http:`, `https:`, `mailto:`) y llama a `shell.openExternal`. En web es
  `window.open(url, "_blank", "noopener,noreferrer")`; en Electron **nunca** una ventana
  nueva de la app (`setWindowOpenHandler` → `deny`, §6).

**Lo que añadirá cada fase** (y solo entonces): `saveText(doc, text, { saveAs })` (Fase 9), `onExternalOpen(cb)`
(«Abrir con…» y argv, Fase 14). Si la Fase 7 admite soltar un `.md` con sus imágenes,
`openDroppedFile` pasará a recibir varios ficheros.

`src/platform/index.ts` (`createPlatform()`) devuelve hoy la web; la Fase 14 añade la
rama de Electron según exista `window.bpdf`. No se simula antes: no hay preload que
detectar. `App` recibe la plataforma como propiedad desde `main.tsx`, y los tests de
componentes pasan una falsa (`tests/helpers/documentos.ts`) que usa la validación real.

### 3.1 El visor PDF en Electron (D17, D18)

El visor de la Fase 5 corre igual en Electron: es la misma build (`dist/`), sin rama
propia. Lo que la Fase 14 tiene que cuidar:

- **Build `legacy` de pdf.js (D18).** La web la necesita (la moderna exige navegadores de
  2025–2026). El Chromium de Electron es reciente y podría usar la moderna, pero BPDF no
  mantiene dos ramas: se usa la misma. Si algún día solo se publicara Electron, D18 se
  revisa (la moderna pesa menos y no lleva polyfills).
- **Workers como módulos ES** (el de pdf.js y el del modo oscuro) servidos por `app://`:
  el protocolo debe registrarse con `standard`, `secure` y `supportFetchAPI` para que
  `new Worker(url, { type: "module" })` y el `fetch` de los cmaps desde el worker de pdf.js
  funcionen, y servir `.mjs` y `.js` como `text/javascript`.
- **La misma CSP**, también en las respuestas de `app://`, incluida `connect-src 'self'`
  (cmaps de las fuentes CID; SEGURIDAD §2.1): su ausencia no da error visible, hace
  desaparecer el texto CJK.
- **Enlaces externos** por `openExternal` (arriba). Los internos no salen del renderer.

### 3.2 El lector de Markdown en Electron (Fase 7)

También es la misma build. Sus enlaces externos ya pasan por `Platform.openExternal`
(el `<a>` lleva `target="_blank"` y `rel="noopener noreferrer"` solo como red): en
Electron llegarán al main sin cambiar el visor, y `setWindowOpenHandler` denegará
cualquier otro intento de abrir ventana. Un enlace a otro fichero (`otro.md`) hoy no se
sigue; abrirlo en BPDF, dentro de la raíz del documento, es posterior a v1. Las imágenes
locales llegarán por `bpdf-res://` (§5); la Fase 7 aún no carga ninguna. El portapapeles
(copiar código) necesita el permiso de escritura que `setPermissionRequestHandler` ya
prevé.

## 4. API del preload (`window.bpdf`)

Solo esto, y cada función con un único propósito:

| Función | IPC | Validación en main | Devuelve |
|---|---|---|---|
| `openDialog()` | `bpdf:open-dialog` | Sin argumentos | `{ id, name, kind, bytes }[]` |
| `registerDropped(file: File)` | `bpdf:register-dropped` | La ruta la obtiene el preload con `webUtils.getPathForFile(file)` (solo acepta `File` reales); main: `realpath`, fichero regular, extensión permitida, tamaño ≤ límite | `{ id }` |
| `save(id, text)` | `bpdf:save` | `id` existe en el mapa; `text` string ≤ límite; el fichero sigue siendo el mismo (inodo/tamaño/fecha) o se pide confirmación | `{ ok }` / error tipado |
| `saveAs(id, text)` | `bpdf:save-as` | Diálogo nativo; nueva ruta pasa al mapa | `{ ok, name }` |
| `openExternal(url)` | `bpdf:open-external` | `new URL()`; protocolo ∈ {`https:`, `http:`, `mailto:`} | — |
| `onOpenRequest(cb)` | `bpdf:open-request` (main → renderer) | El main ya validó la ruta de argv/`open-file` | Documento |

Reglas:

- **Nunca** se expone `ipcRenderer`, `send` genérico, `fs`, `path` ni `shell`.
- Cada `ipcMain.handle` comprueba que `event.senderFrame` es el marco principal de la
  ventana propia y su URL empieza por `app://bpdf/`.
- Los esquemas `zod` de IPC viven en un fichero compartido y se prueban con Vitest en
  `node` (entradas válidas, inválidas, límites, tipos inesperados, prototipos
  contaminados).
- El mapa `id → ruta` vive solo en el main y se limpia al cerrar el documento.

## 5. Protocolos

- **`app://bpdf/`** (`protocol.handle`), registrado antes de `ready` con
  `registerSchemesAsPrivileged({ standard: true, secure: true, supportFetchAPI: true })`.
  Sirve **solo** ficheros de `dist/` dentro del asar: normaliza la ruta, rechaza `..` y
  cualquier ruta que tras resolver no empiece por la raíz; tipos MIME por extensión; añade
  la CSP y demás cabeceras (misma fuente que la web). Al ser un origen estándar y seguro,
  `localStorage`, workers, WASM y portapapeles funcionan como en web: **las preferencias no
  necesitan IPC**.
- **`bpdf-res://<id>/<ruta-relativa>`**: imágenes de un Markdown abierto. El main resuelve
  contra el **directorio del documento** `id`, aplica `realpath`, exige que el resultado
  esté dentro de ese directorio (sin seguir enlaces simbólicos hacia fuera), solo
  extensiones de imagen, tamaño máximo, y sirve con `Content-Type` fijo por extensión y
  `X-Content-Type-Options: nosniff`. `img-src` de la CSP de escritorio añade
  `bpdf-res:`. SVG solo como `<img>` (igual que en web).
- Sin `file://` en ningún caso.
- **pdf.js** (Fase 4, [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) §3): su worker, las
  fuentes estándar, los cmaps y los decodificadores en JavaScript están en `dist/pdfjs/` y
  los sirve `app://` como cualquier otro fichero. Con `worker-src 'self'` y
  `font-src 'self'` basta, igual que en web. `useWasm: false`: nada de WebAssembly ni de
  `'wasm-unsafe-eval'`. El Chromium de Electron es reciente, así que la build moderna de
  pdf.js funcionaría (D18).

## 6. Ventana y sesión

```ts
new BrowserWindow({
  backgroundColor: "#171717",          // --rgb-app: sin destello blanco al abrir
  webPreferences: {
    preload,                           // ruta absoluta dentro del asar
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    webviewTag: false,
    spellcheck: false,
    navigateOnDragDrop: false,         // soltar un fichero no navega la ventana
  },
});
```

- `webContents.on("will-navigate", e => e.preventDefault())` salvo recargas de
  `app://bpdf/`; `setWindowOpenHandler(() => ({ action: "deny" }))` y, si la URL es
  externa y válida, `shell.openExternal`.
- `app.on("web-contents-created")` aplica lo mismo a cualquier `webContents` y bloquea
  `will-attach-webview`.
- `session.defaultSession.setPermissionRequestHandler` y `setPermissionCheckHandler`:
  denegar todo salvo `fullscreen` y `clipboard-sanitized-write`.
- Sin menús con `role: "toggleDevTools"` en producción; DevTools solo en desarrollo.
- Instancia única (`requestSingleInstanceLock`); `second-instance` y `open-file` entregan
  la ruta al flujo de apertura del main.

## 7. Apertura por argumentos y «Abrir con…»

1. El main recibe una ruta (argv en Windows/Linux al arrancar o en `second-instance`;
   `open-file` en macOS, que puede llegar **antes** de `ready`: se encola).
2. Valida: `realpath`, existe, fichero regular, extensión `.pdf`/`.md`/`.markdown`,
   tamaño ≤ límite, legible.
3. Lee los bytes, registra `id → ruta` y envía el documento por `bpdf:open-request`.
4. El renderer lo trata exactamente igual que uno del selector.

Asociación de tipos de fichero: la declara el empaquetador (Fase 15), opcional para el
usuario en el instalador.

## 8. Build y distribución (Fase 15)

- **Estructura:** `electron/main.ts`, `electron/preload.ts`, `electron/protocol.ts`,
  `electron/ipc.ts`, `electron/validation.ts`, compilados aparte del renderer (TypeScript
  → CommonJS o ESM según lo que exija la versión de Electron para el preload con
  sandbox, que hoy no admite ESM).
- **Empaquetador (T-5):** Electron Forge (oficial, plugin de fuses) o electron-builder
  (más opciones de instaladores). Se decide en la Fase 15 con una prueba de los dos
  artefactos.
- **Fuses:** `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off,
  `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on,
  `OnlyLoadAppFromAsar` on, `EnableCookieEncryption` on.
- **Firma y notarización** (D11): sin firma, Windows SmartScreen y macOS Gatekeeper
  avisan o bloquean. Firma = certificados de pago (Authenticode; Apple Developer Program).
- **Auto-actualización:** no en v1 (D11). Releases en GitHub con checksums SHA-256; si se
  añade después, solo por HTTPS contra GitHub Releases y con firma verificada.
- **CI:** un workflow de release por plataforma (matriz), disparado por etiqueta, con
  Actions fijadas por SHA.
- `allowScripts`: `electron` descarga su binario en `postinstall` y necesita aprobación
  (CLAUDE.md §11 bis).

## 9. Tests (Fase 14)

- Vitest (`node`): esquemas IPC, resolución de rutas de `bpdf-res://` (traversal,
  enlaces simbólicos, mayúsculas en Windows, rutas UNC), mapa `id → ruta`, validación de
  URLs externas.
- Playwright `_electron`: la app arranca y muestra el estado vacío; en el renderer
  `typeof require === "undefined"` y `typeof process === "undefined"`; `window.open`
  devuelve `null`; navegar a una URL externa no cambia la ventana; `app://bpdf/../`
  devuelve 404; abrir un PDF de fixture por argumento lo muestra; la CSP está presente.
- Revisión con la checklist oficial de seguridad de Electron, registrada en
  [auditoria.md](auditoria.md).
