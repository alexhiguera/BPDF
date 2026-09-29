# Fixtures de documentos

Documentos pequeños para los tests y los E2E. **Todos creados para BPDF**, sin contenido
de terceros; se publican bajo la licencia del repositorio (Apache-2.0). Regla: nunca un
documento de terceros sin licencia clara (`CLAUDE.md` §6).

No confundir con [`../_fixtures/`](../_fixtures/), que es un proyecto ficticio para
probar los validadores de `public_docs/`.

| Fichero | Qué es | Procedencia | Lo usa |
|---|---|---|---|
| `pdf/minimo.pdf` | PDF 1.4 válido, 1 página de 300×150 pt, una línea de texto («BPDF: PDF de prueba») en Helvetica sin incrustar. 626 bytes | Generado por [`pdf/generar.mjs`](pdf/generar.mjs) (`node tests/fixtures/pdf/generar.mjs`). Comprobado con pdf.js 6.3.289: 1 página y el texto extraído coincide | `e2e/specs/abrir.spec.ts` |
| `markdown/basico.md` | Markdown GFM pequeño en UTF-8: encabezados, lista, tabla, código y caracteres no ASCII | Escrito a mano | `e2e/specs/abrir.spec.ts` |
| `markdown/html-y-script.md` | Markdown con `<script>`, `<img onerror>`, `<svg onload>`, `<iframe>` remoto, un enlace `javascript:` y una imagen remota. Si algo se ejecutara, escribiría en `window.__bpdfXss` | Escrito a mano | `e2e/specs/abrir.spec.ts` (nada se ejecuta ni se pide a la red al abrirlo). Precursor del corpus de XSS de la Fase 7 ([SEGURIDAD.md](../../docs/SEGURIDAD.md) §3.3) |
| `otros/nota.txt` | Texto plano: un tipo que BPDF no admite | Escrito a mano | `e2e/specs/abrir.spec.ts` |

Los casos que no merecen un fichero en disco se construyen en el propio test: PDF falso
(bytes de PNG con extensión `.pdf`), ficheros vacíos, Markdown en UTF-16 o binario, y
nombres con `<`, `>`, comillas, Unicode o espacios (en disco darían problemas en algunos
sistemas de ficheros).

`*.pdf` está marcado como binario en `.gitattributes`: git no debe normalizar sus finales
de línea, porque la tabla `xref` guarda desplazamientos en bytes.
