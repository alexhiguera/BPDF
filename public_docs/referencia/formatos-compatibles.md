---
id: formatos-compatibles
title: "Formatos que abre BPDF"
sidebar_label: "Formatos compatibles"
sidebar_position: 1
slug: /referencia/formatos-compatibles
description: "BPDF abre PDF (.pdf) y Markdown (.md, .markdown) en UTF-8, y muestra imágenes PNG, JPEG, GIF, WebP y SVG de un Markdown. Tamaños máximos de cada uno."
keywords: [formatos, pdf, markdown, extensiones, imágenes, tamaño máximo]
tags: [referencia, formatos]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: referencia
  intencion: "¿Qué archivos puede abrir BPDF?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: src/documents/limits.ts
---

**Respuesta corta.** BPDF abre documentos **PDF** (`.pdf`, hasta 512 MiB) y **Markdown**
(`.md` y `.markdown`, en UTF-8, hasta 20 MiB). Con un Markdown muestra imágenes **PNG, JPEG,
GIF, WebP y SVG** de hasta 50 MiB cada una. Cualquier otro archivo se rechaza con un aviso.

## Qué documentos abre

| Tipo | Extensiones | Tamaño máximo | Notas |
|---|---|---|---|
| PDF | `.pdf` | 512 MiB | El contenido debe ser un PDF de verdad, no solo el nombre |
| Markdown | `.md`, `.markdown` | 20 MiB | Texto en UTF-8. Markdown con extensiones de GitHub (GFM), fórmulas y diagramas |

Un archivo vacío no se abre.

## Qué imágenes muestra en un Markdown

| Formato | Extensiones |
|---|---|
| PNG | `.png` |
| JPEG | `.jpg`, `.jpeg` |
| GIF | `.gif` |
| WebP | `.webp` |
| SVG | `.svg` (como imagen: sin scripts) |

Hasta 50 MiB cada una. Solo las que eliges con el documento o están en su carpeta; las de
internet no se cargan.

## Qué combinaciones se pueden abrir a la vez

- Un PDF, solo.
- Un Markdown, solo o con sus imágenes.
- Una carpeta con uno o varios Markdown: eliges cuál leer. Hasta 10 000 archivos y 32 niveles
  de subcarpetas; `.git` y `node_modules` no se recorren.

## A qué formatos guarda

- **Markdown (`.md`)**: con **Guardar** o **Guardar como…**.
- **PDF**: con **Guardar como… → PDF (.pdf)**, a través del diálogo de impresión del
  navegador, en claro u oscuro ([Exportar a PDF](../guias/markdown/exportar-a-pdf.md)).

Un PDF abierto no se modifica ni se vuelve a guardar.

## Qué no abre

Documentos de Word, hojas de cálculo, EPUB, texto plano (`.txt`), HTML ni imágenes sueltas.
Tampoco PDF desde una URL: solo archivos de tu equipo.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/referencia/formatos-compatibles
