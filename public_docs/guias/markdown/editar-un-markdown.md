---
id: editar-un-markdown
title: "Cómo editar y guardar un Markdown"
sidebar_label: "Editar"
sidebar_position: 2
slug: /guias/markdown/editar-un-markdown
description: "Edita un Markdown en BPDF con el modo Edición y guárdalo con Ctrl/⌘+S: en Chrome y Edge eliges dónde; en Firefox y Safari se descarga una copia."
keywords: [editar markdown, guardar markdown, ctrl+s, editor]
tags: [markdown, edicion]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo edito y guardo un archivo Markdown con BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/platform/guardar-web.ts
---

**Respuesta corta.** Con el Markdown abierto, elige **Edición** en **Modo**, escribe y pulsa
**Guardar** (Ctrl/⌘+S). En Chrome y Edge eliges dónde guardarlo; en Firefox y Safari se
descarga una copia. Si cierras con cambios sin guardar, BPDF te avisa antes.

## Cómo editar y guardar un Markdown, paso a paso

1. Abre el Markdown.
2. En **Modo**, elige **Edición** (solo el texto) o **Dividido** (texto y resultado a la vez).
3. Escribe. Mientras haya cambios sin guardar, la barra dice **Sin guardar**.
4. Pulsa **Guardar** o Ctrl+S (⌘+S en Mac).
5. En Chrome y Edge, elige dónde guardar la primera vez; las siguientes se guarda en el mismo
   archivo mientras siga abierto. En Firefox y Safari, cada guardado descarga una copia.

## Qué tener en cuenta

- BPDF **no escribe en el archivo que abriste** sin que lo elijas: el navegador no le da
  permiso. En Chrome y Edge puedes elegir ese mismo archivo para sobrescribirlo.
- BPDF no guarda nada por su cuenta: sin pulsar **Guardar**, los cambios se pierden al cerrar
  la pestaña. Si cierras el documento o abres otro, te avisa: **Seguir editando** o
  **Descartar los cambios**.

## Lo que no es evidente

- **Para salir del editor con el teclado**, pulsa Esc y después Tab: dentro del editor, Tab
  sangra el texto.
- **Deshacer y rehacer** funcionan como en cualquier editor (Ctrl/⌘+Z y Ctrl/⌘+Mayús+Z).
- **Las descargas de Firefox y Safari van a la carpeta de descargas** del navegador, con un
  nombre basado en el del documento.

## Preguntas frecuentes sobre editar Markdown

### ¿BPDF guarda borradores?

No. Ni en el navegador ni en ningún servidor: guarda solo cuando pulsas **Guardar**.

### ¿Puedo crear un Markdown nuevo?

Sí: **Crear Markdown** abre uno vacío en **Dividido**
([Crear un Markdown](../../primeros-pasos/crear-un-markdown.md)).

### ¿Qué hace «Guardar como…»?

Guarda el documento en otro destino, como Markdown (`.md`), o lo exporta a PDF, claro u
oscuro ([Exportar a PDF](exportar-a-pdf.md)). **Guardar** y Ctrl/⌘+S siguen guardando el
Markdown.

## Qué leer después

- [Modo dividido](modo-dividido.md)
- [Exportar a PDF](exportar-a-pdf.md)
- [Leer un Markdown](leer-un-markdown.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/markdown/editar-un-markdown
