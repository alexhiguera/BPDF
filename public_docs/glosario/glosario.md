---
id: glosario
title: "Glosario de BPDF"
sidebar_label: "Glosario"
sidebar_position: 1
slug: /glosario/glosario
description: "Los términos de BPDF que necesitan explicación: Markdown, GFM, KaTeX, Mermaid, modo oscuro selectivo, modo dividido, huella, OCR y almacenamiento local."
keywords: [glosario, markdown, gfm, katex, mermaid, huella, ocr]
tags: [glosario]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: glosario
  intencion: "¿Qué significan los términos que usa BPDF?"
  app_url: /
  jsonld: DefinedTermSet
  estado: publicado
  origen: src/i18n/messages.ts
---

**Respuesta corta.** Los términos que aparecen en BPDF y en esta documentación y que no son
evidentes: los formatos que lee (Markdown, GFM), las herramientas que usa (KaTeX, Mermaid) y
cómo trata tus documentos (modo oscuro selectivo, huella, almacenamiento local).

## Markdown

Formato de texto con marcas sencillas (`#` para títulos, `**` para negrita) que se lee bien sin
formato y se convierte en un documento formateado. Archivos `.md` o `.markdown`.

## GFM

GitHub Flavored Markdown: las extensiones de Markdown que popularizó GitHub, como tablas,
listas de tareas, texto tachado, notas al pie y enlaces automáticos. BPDF las lee.

## KaTeX

Biblioteca que dibuja fórmulas matemáticas escritas en LaTeX. BPDF la usa para las fórmulas
entre `$` y `$$` de un Markdown.

## Mermaid

Lenguaje para describir diagramas (de flujo, de secuencia, de Gantt…) con texto. BPDF dibuja
los bloques de código `mermaid` como diagramas.

## Modo oscuro selectivo

Cómo oscurece BPDF un PDF: invierte el blanco y el negro de fondo, texto y gráficos, conserva
sus colores y deja intactas las imágenes, para que las fotos no queden en negativo.

## Modo dividido

Forma de editar un Markdown con el texto y su resultado lado a lado, sincronizados. En la app
se llama **Dividido**.

## Huella de un PDF

Identificador que pdf.js calcula a partir del propio archivo. BPDF lo usa para recordar la
página y el zoom de cada PDF sin guardar su nombre ni su contenido.

## OCR

Reconocimiento óptico de caracteres: convertir en texto la imagen de un texto. BPDF no lo hace,
así que un PDF escaneado no tiene texto que buscar.

## Almacenamiento local

Espacio que cada navegador da a una web para guardar datos en tu equipo. BPDF guarda ahí sus
preferencias y las posiciones de los PDF; nada sale de tu dispositivo.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/glosario/glosario
