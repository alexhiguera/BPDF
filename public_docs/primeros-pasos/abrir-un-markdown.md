---
id: abrir-un-markdown
title: "Cómo abrir un Markdown en BPDF"
sidebar_label: "Abrir un Markdown"
sidebar_position: 2
slug: /primeros-pasos/abrir-un-markdown
description: "Abre un archivo Markdown (.md o .markdown) en BPDF con «Abrir archivo», Ctrl/⌘+O o arrastrándolo. Se lee en modo oscuro y se puede editar."
keywords: [abrir markdown, visor markdown, .md, leer markdown]
tags: [markdown, primeros-pasos]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo abro un archivo Markdown en BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/documents/read.ts
---

**Respuesta corta.** Pulsa **Abrir archivo** (o Ctrl/⌘+O) y elige un archivo `.md` o
`.markdown`, o arrástralo a la ventana. BPDF lo muestra formateado, en modo oscuro, y puedes
editarlo. Si tiene imágenes, ábrelo junto con ellas o abre su carpeta.

## Qué necesitas antes de empezar

- Un Markdown en **UTF-8** de hasta 20 MiB. Es la codificación habitual; si no lo es, BPDF te
  pide que lo guardes en UTF-8.

## Cómo abrir un Markdown, paso a paso

1. Abre `https://bpdf.r3zon.com`.
2. Pulsa **Abrir archivo**, o Ctrl+O (⌘+O en Mac).
3. Elige el archivo `.md` o `.markdown`.
4. Lee el documento. Si tiene al menos dos títulos, el botón **Índice** muestra su índice.

## Qué tener en cuenta

- El HTML que lleve el Markdown **no se interpreta**: se ve como texto. Así un documento no
  puede ejecutar nada en BPDF.
- Las imágenes de internet no se cargan: en su lugar aparece un aviso con un enlace para
  abrirlas en el navegador, si quieres.
- Un Markdown muy grande (alrededor de 1 MB) tarda unos segundos en mostrarse.

## Lo que no es evidente

- **Para ver las imágenes locales**, el `.md` solo no basta: elige el `.md` junto con sus
  imágenes o abre la carpeta ([Markdown con imágenes](markdown-con-imagenes.md)).
- **Los enlaces a otros archivos** (por ejemplo, a otro `.md`) no se abren: BPDF no busca
  archivos en tu equipo por su cuenta.

## Preguntas frecuentes sobre abrir un Markdown

### ¿Puedo editar el Markdown?

Sí. Cambia a **Edición** o **Dividido** en la barra del documento
([Editar un Markdown](../guias/markdown/editar-un-markdown.md)).

### ¿Qué extensiones abre?

`.md` y `.markdown`. Un `.txt` no se abre como Markdown.

## Qué leer después

- [Markdown con imágenes](markdown-con-imagenes.md)
- [Leer un Markdown](../guias/markdown/leer-un-markdown.md)
- [Editar un Markdown](../guias/markdown/editar-un-markdown.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/primeros-pasos/abrir-un-markdown
