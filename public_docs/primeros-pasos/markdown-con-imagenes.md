---
id: markdown-con-imagenes
title: "Cómo abrir un Markdown con sus imágenes"
sidebar_label: "Markdown con imágenes"
sidebar_position: 3
slug: /primeros-pasos/markdown-con-imagenes
description: "Para que BPDF muestre las imágenes de un Markdown, elige el .md junto con ellas o abre la carpeta que lo contiene. No se sube nada."
keywords: [markdown imágenes, abrir carpeta, imágenes locales, recursos]
tags: [markdown, imagenes, primeros-pasos]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo veo las imágenes de mi Markdown en BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/documents/seleccion.ts
---

**Respuesta corta.** Un navegador no deja a una web leer archivos que no le das. Para ver las
imágenes de un Markdown, pulsa **Abrir carpeta** y elige la carpeta del documento, o pulsa
**Abrir archivo** y selecciona el `.md` junto con sus imágenes. BPDF las muestra sin subir
nada.

## Qué necesitas antes de empezar

- Las imágenes en PNG, JPEG, GIF, WebP o SVG, de hasta 50 MiB cada una.
- Que las rutas del Markdown apunten a esas imágenes (por ejemplo, `![Plano](images/plano.png)`).

## Cómo abrir un Markdown con sus imágenes, paso a paso

1. Pulsa **Abrir carpeta** y elige la carpeta que contiene el `.md` y sus imágenes.
2. Si la carpeta tiene varios Markdown, elige cuál quieres leer en la lista que aparece.
3. Lee el documento: cada imagen aparece donde la pone el texto.

Si las imágenes están junto al `.md`, sin subcarpetas, también puedes pulsar **Abrir
archivo** y seleccionar a la vez el `.md` y las imágenes. Y puedes arrastrar la carpeta, o el
`.md` con sus imágenes, a la ventana.

## Qué tener en cuenta

- **Chrome pide confirmación** al elegir una carpeta y habla de «subir» archivos. Es su texto
  genérico: BPDF no sube nada, solo lee los archivos en tu navegador.
- «Abrir archivo» no ve subcarpetas: para `images/plano.png`, abre la carpeta.
- Una carpeta con más de 10 000 archivos no se abre. Las carpetas `.git` y `node_modules` no
  se recorren.

## Lo que no es evidente

- **Las mayúsculas cuentan:** `Logo.PNG` no es `logo.png`, igual que en la web.
- **Una ruta que sale de la carpeta elegida** (como `../fuera.png`) no se resuelve: BPDF solo
  usa los archivos que le das.
- **Si una imagen no aparece**, en su lugar hay un aviso que dice por qué
  ([Una imagen no aparece](../problemas/una-imagen-no-aparece.md)).

## Qué leer después

- [Imágenes locales](../guias/markdown/imagenes-locales.md)
- [Problemas con carpetas y recursos](../problemas/carpeta-y-recursos.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/primeros-pasos/markdown-con-imagenes
