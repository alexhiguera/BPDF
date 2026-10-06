# Identidad visual de BPDF

Datos para que la documentación (`docs.r3zon.com/bpdf`) y cualquier material de BPDF se vean
como la app. **No se publica** (todo lo que empieza por `_` queda fuera). Todo sale del código;
si cambia allí, se cambia aquí en el mismo commit.

Fuentes: [`src/styles/globals.css`](../../src/styles/globals.css) (tokens),
[`public/favicon.svg`](../../public/favicon.svg) (icono),
[`src/app/LogoBpdf.tsx`](../../src/app/LogoBpdf.tsx) (uso del icono),
[`src/styles/markdown.css`](../../src/styles/markdown.css) (lector) y
[`docs/PLAN.md`](../../docs/PLAN.md) §9.2 (paleta y contrastes).

## Tema

**Solo oscuro** en v1 (D10: sin tema claro). El lector conserva su paleta neutra y la portada
añade una identidad azul y violeta sobre un fondo más profundo. Los colores son tripletes RGB
en `:root`, y un test calcula el contraste WCAG de cada par que se usa junto
(`tests/unit/tokens.test.ts`).

## Colores

| Token | Hex | Uso |
|---|---|---|
| `--rgb-app` | `#171717` | Cromo del lector: barra superior y paneles |
| `--rgb-reading` | `#212121` | Área de lectura, detrás de las páginas |
| `--rgb-page` | `#2b2b2b` | Página PDF en modo oscuro, hoja de Markdown |
| `--rgb-elevated` | `#303030` | Menús, diálogos, campos, bloques de código |
| `--rgb-border` | `#3d3d3d` | Bordes y separadores |
| `--rgb-fg` | `#ececec` | Texto principal; la hoja del icono |
| `--rgb-fg-muted` | `#b4b4b4` | Texto secundario (válido sobre los cuatro fondos) |
| `--rgb-fg-subtle` | `#8e8e8e` | Solo sobre `app` y `reading` |
| `--rgb-accent` | `#10a37f` | Foco, estado activo, progreso; la esquina del icono. **Nunca** de fondo con texto blanco (3,2:1) |
| `--rgb-primary` / `--rgb-primary-fg` | `#ececec` / `#0d0d0d` | Botón principal: claro con texto oscuro |
| `--rgb-danger` | `#f87171` | Errores |
| `--rgb-link` | `#80b6ff` | Enlaces de un Markdown |
| `--rgb-home-bg` | `#070b18` | Fondo de la portada y del icono |
| `--rgb-home-surface` / `--rgb-home-surface-strong` | `#0e1425` / `#12192e` | Tarjetas y acciones de la portada |
| `--rgb-home-border` | `#313b58` | Bordes sutiles de la portada |
| `--rgb-brand-violet` | `#7c3aed` | Acento violeta y extremo del degradado principal |
| `--rgb-brand-blue` | `#1d4ed8` | Acento azul y extremo del degradado principal |
| `--rgb-brand-soft` | `#c4b5fd` | Libro, foco y detalles claros |
| `--rgb-feature-green` / `pink` / `orange` | `#34d399` / `#e879f9` / `#fb923c` | Iconos de funciones y privacidad |

Selección: el acento al 35 %. Coincidencias de búsqueda en PDF: el acento al 30 % (la activa,
al 65 % con contorno).

Colores de código (resaltado de sintaxis, cada uno ≥ 4,5:1 sobre su fondo): palabra clave
`#c692ea`, cadena `#98c379`, número `#e5c07b`, comentario `#969696`, función `#61afef`, tipo
`#56b6c2`, etiqueta `#ef7c84`, atributo `#d19a66`.

## Contrastes (WCAG)

- `fg` sobre `page`: ≈ 12:1.
- `fg-muted` sobre `page`: ≈ 6,8:1.
- `accent` sobre `reading`: ≈ 5:1.
- `fg` sobre los dos extremos del degradado principal: ≥ 4,5:1.
- `fg` y `fg-muted` sobre las superficies de la portada: ≥ 4,5:1.

## Tipografía

- **Interfaz y lector:** la fuente del sistema (`system-ui, sans-serif`). BPDF no descarga
  fuentes de texto: solo las de KaTeX, del propio origen y cuando hay fórmulas.
- **Código:** `ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace`.
- **Lector de Markdown:** 17 px por defecto (1,0625 rem; de 15 a 22 px en Preferencias),
  interlineado 1,7, columna de 72 caracteres por defecto (60 o 90 en Preferencias).

## Radios

- Botones, campos y la mayoría de controles: `0.375rem` (6 px; `rounded-md` de Tailwind 4).
- Elementos pequeños: `0.25rem` (4 px). Paneles grandes: `0.5rem` (8 px).
- Portada: acciones `0.8rem`; tarjetas y panel de privacidad `1rem`.
- Icono: 7 de 32 (≈ 22 %).

## Icono

[`public/favicon.svg`](../../public/favicon.svg): un libro abierto blanco/lila dentro de un
cuadrado redondeado azul y violeta sobre `#070b18`. Es el único asset oficial y se usa como
favicon, en la cabecera y en el hero mediante
[`src/app/LogoBpdf.tsx`](../../src/app/LogoBpdf.tsx). SVG de 32 × 32, autónomo, sin texto,
scripts, imágenes ni dependencias externas; `tests/unit/favicon.test.ts` comprueba que sus
colores son tokens y que los degradados solo apuntan a fragmentos internos.

**Sirve también como icono del producto en la documentación.** No hay versión raster ni
logotipo de terceros. El nombre se escribe siempre **BPDF**, en mayúsculas.
