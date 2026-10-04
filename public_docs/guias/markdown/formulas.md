---
id: formulas
title: "Cómo escribir fórmulas matemáticas en un Markdown"
sidebar_label: "Fórmulas (KaTeX)"
sidebar_position: 5
slug: /guias/markdown/formulas
description: "BPDF muestra fórmulas LaTeX en un Markdown con KaTeX: entre $ en línea y entre $$ en bloque. Una fórmula no válida se muestra como código."
keywords: [fórmulas markdown, latex, katex, matemáticas, ecuaciones]
tags: [markdown, formulas, katex]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo escribo fórmulas en un Markdown para verlas en BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/markdown/matematicas.ts
---

**Respuesta corta.** Escribe LaTeX entre `$…$` para una fórmula dentro del texto y entre
`$$…$$` para una en bloque, centrada. BPDF las dibuja con KaTeX en tu dispositivo. Si una
fórmula no es válida, ves su código con el aviso «Fórmula no válida».

## Cómo escribir fórmulas, paso a paso

1. Para una fórmula en línea, escribe `$e^{i\pi} + 1 = 0$` dentro de un párrafo.
2. Para una en bloque, ponla sola entre dos líneas `$$`:
   `$$\int_0^1 x^2\,dx = \tfrac{1}{3}$$`.
3. Abre o actualiza el documento: la fórmula aparece dibujada.
4. Si ves «Fórmula no válida: se muestra su código», revisa la sintaxis LaTeX.

## Qué tener en cuenta

- KaTeX cubre la mayoría de LaTeX matemático, pero no todo: un comando que no conoce hace que
  la fórmula se muestre como código.
- Por seguridad, `\href`, `\url`, `\includegraphics` y los comandos que insertan HTML no
  funcionan: la fórmula se muestra como código.
- Una fórmula de más de 10 000 caracteres no se dibuja.

## Lo que no es evidente

- **Las fórmulas son accesibles:** además de verse, llevan una versión que leen los lectores
  de pantalla (MathML).
- **KaTeX solo se descarga si hace falta:** un Markdown sin fórmulas no lo carga, y sus
  fuentes vienen de la propia web de BPDF, nunca de terceros.
- **Una macro definida en una fórmula no afecta a las demás.**

## Qué leer después

- [Diagramas Mermaid](diagramas.md)
- [Límites conocidos](../../referencia/limites-conocidos.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/markdown/formulas
