---
id: imagenes-locales
title: "Cómo escribir las rutas de imágenes para que BPDF las muestre"
sidebar_label: "Imágenes locales"
sidebar_position: 4
slug: /guias/markdown/imagenes-locales
description: "Cómo resuelve BPDF las imágenes de un Markdown: rutas relativas al .md, formatos admitidos, imágenes de internet y qué significa cada aviso."
keywords: [imágenes markdown, rutas relativas, png, svg, imagen remota]
tags: [markdown, imagenes]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo tienen que estar las imágenes de mi Markdown para que BPDF las muestre?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/documents/recursos.ts
---

**Respuesta corta.** Escribe rutas relativas al `.md`, como `![Plano](images/plano.png)`, y
abre el documento con su carpeta o junto con sus imágenes. BPDF muestra PNG, JPEG, GIF, WebP
y SVG de hasta 50 MiB. Las imágenes de internet no se cargan: aparece un aviso con su enlace.

## Cómo preparar un Markdown con imágenes, paso a paso

1. Guarda las imágenes en la misma carpeta que el `.md` o en una subcarpeta, como `images/`.
2. En el texto, enlázalas con rutas relativas al `.md`: `![Descripción](images/foto.jpg)`.
3. Escribe una descripción entre los corchetes: es lo que leen los lectores de pantalla y lo
   que ves si la imagen falla.
4. Abre la carpeta con **Abrir carpeta**
   ([Markdown con imágenes](../../primeros-pasos/markdown-con-imagenes.md)).

## Qué tener en cuenta

- Formatos: PNG, JPEG, GIF, WebP y SVG. Otros muestran el aviso «formato de imagen no
  admitido».
- Los SVG se muestran como imagen: un SVG con scripts no los ejecuta y no puede pedir nada a
  internet.
- Una ruta que sale de lo que elegiste (`../otra-carpeta/x.png`) no se resuelve.

## Lo que no es evidente

- **Por qué no se cargan las imágenes de internet:** pedirlas revelaría a quien las aloja que
  estás leyendo ese documento, y cuándo. BPDF muestra su texto y un enlace **Abrir la imagen
  en el navegador**, por si quieres verla tú.
- **Una misma imagen usada varias veces** se carga una sola vez.
- **Cada aviso dice por qué falta una imagen:** no incluida, fuera de los archivos elegidos,
  formato no admitido, demasiado grande, ambigua, ruta no válida o archivo dañado.

## Qué leer después

- [Una imagen no aparece](../../problemas/una-imagen-no-aparece.md)
- [Formatos compatibles](../../referencia/formatos-compatibles.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/markdown/imagenes-locales
