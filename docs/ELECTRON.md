# BPDF — Versión de escritorio (Electron)

> **Estado: diseño objetivo** (Fase 0, *2026-09-29*). Nada de Electron existe todavía ni
> se instala antes de la Fase 14. Lo que sí afecta desde ya: la capa `src/platform/`
> (Fase 3), la regla de que el renderer nunca ve rutas de disco y la CSP de
> `src/config/security-headers.ts` (Fase 2), que el protocolo `app://` servirá tal cual.

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

## 3. Contrato `Platform` (nace en la Fase 3)

```ts
interface Platform {
  kind: "web" | "electron";
  /** Muestra el selector y devuelve los documentos elegidos (vacío si se cancela). */
  pickFiles(): Promise<OpenedDocument[]>;
  /** Convierte ficheros soltados en la ventana en documentos. */
  fromDroppedFiles(files: File[]): Promise<OpenedDocument[]>;
  /** Documentos que el sistema pide abrir (argv, «Abrir con…»). En web, nunca llama. */
  onExternalOpen(cb: (doc: OpenedDocument) => void): () => void;
  /** Guarda texto: en el mismo fichero si la plataforma puede, o «Guardar como». */
  saveText(doc: OpenedDocument, text: string, opts: { saveAs: boolean }): Promise<SaveResult>;
  /** Abre un enlace externo ya validado por la política de URLs. */
  openExternal(url: string): void;
}
```

`src/platform/index.ts` elige la implementación al arrancar según exista `window.bpdf`.
Los tests de componentes usan una implementación falsa en memoria.

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
