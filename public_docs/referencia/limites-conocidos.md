---
id: limites-conocidos
title: "Límites conocidos de BPDF"
sidebar_label: "Límites conocidos"
sidebar_position: 5
slug: /referencia/limites-conocidos
description: "Tamaños máximos, funciones que BPDF no tiene y casos lentos conocidos de la versión 1.0.0, con qué hacer en cada uno."
keywords: [límites, tamaño máximo, rendimiento, ocr, formularios, tema claro]
tags: [referencia, limites]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: referencia
  intencion: "¿Qué no puede hacer BPDF y qué límites tiene?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: src/documents/limits.ts
---

**Respuesta corta.** BPDF abre PDF de hasta 512 MiB y Markdown de hasta 20 MiB, un documento
cada vez. No reconoce texto en escaneos, no rellena formularios de PDF ni tiene tema claro. Un
Markdown de alrededor de 1 MB tarda unos segundos en aparecer.

## Qué tamaños admite

| Qué | Máximo |
|---|---|
| PDF | 512 MiB |
| Markdown | 20 MiB |
| Imagen de un Markdown | 50 MiB |
| Carpeta abierta | 10 000 archivos, 32 niveles |
| Fórmula | 10 000 caracteres |
| Diagrama Mermaid | 50 000 caracteres |
| Posiciones de PDF recordadas | 50 (se borran las más antiguas) |

## Qué funciones no tiene

- **Un documento cada vez:** abrir otro sustituye al actual.
- **Sin OCR:** en un PDF escaneado no hay texto que buscar ni seleccionar.
- **Formularios de PDF:** se ven, pero no se pueden rellenar. BPDF no modifica PDF.
- **Imágenes del PDF en modo oscuro:** se quedan con sus colores, a propósito.
- **Sin tema claro** para la interfaz.
- **Sin imágenes, fuentes ni scripts de internet** en los documentos.
- **Enlaces a otros archivos** desde un Markdown: no se abren.
- **Exportar a PDF** pasa por el diálogo de impresión del navegador: el nombre del archivo
  lo escribes ahí (BPDF propone el que el navegador elija, normalmente «BPDF»), y no se
  exporta a otros formatos (Word, texto).
- **Un Markdown nuevo no tiene imágenes**: no se pueden insertar; se ven al abrirlo con sus
  imágenes o su carpeta.

## Qué casos son lentos

- **Un Markdown de alrededor de 1 MB** tarda unos segundos en mostrarse (aparece «Preparando el
  documento…»).
- **Escribir en «Dividido» con un Markdown muy grande lleno de fórmulas** puede ir lento. La
  vista previa se pausa y ofrece **Actualizar la vista previa**; en **Edición** se escribe
  fluido. En pruebas con el motor de Safari ese caso fue especialmente lento; no se ha medido
  en Safari real.
- **Un PDF muy grande en un equipo modesto** tarda más en pintar cada página; el resto de la
  app sigue respondiendo.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/referencia/limites-conocidos
