---
id: exportar-a-pdf
title: "Cómo guardar un Markdown como PDF"
sidebar_label: "Exportar a PDF"
sidebar_position: 7
slug: /guias/markdown/exportar-a-pdf
description: "Guarda cualquier Markdown como PDF, claro u oscuro, con «Guardar como…»: BPDF lo prepara y el diálogo de impresión del navegador lo guarda."
keywords: [markdown a pdf, exportar pdf, guardar como pdf, imprimir markdown, pdf oscuro]
tags: [markdown, pdf, exportar]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo convierto un Markdown en PDF con BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/markdown/impresion.ts
---

**Respuesta corta.** Con el Markdown abierto, pulsa **Guardar como…**, elige **PDF (.pdf)** y
los colores (**Claro** u **Oscuro**) y pulsa **Guardar**. BPDF prepara el documento, con
fórmulas, diagramas e imágenes, y abre el diálogo de impresión del navegador: ahí eliges
**Guardar como PDF**. Todo ocurre en tu dispositivo.

## Cómo exportar un Markdown a PDF, paso a paso

1. Abre o crea el Markdown. Da igual el modo: **Lectura**, **Edición** o **Dividido**.
2. Pulsa **Guardar como…**.
3. En **Formato**, elige **PDF (.pdf)**.
4. En **Colores del PDF**, elige **Claro** u **Oscuro**.
5. Pulsa **Guardar**. Verás «Preparando PDF…» un momento.
6. En el diálogo de impresión, elige **Guardar como PDF** como destino, el tamaño de papel
   que quieras y guarda.

## Qué tener en cuenta

- El PDF lleva **solo tu documento**: sin cabeceras, pies ni nada de BPDF.
- Se exporta el texto **tal como está en ese momento**, aunque no lo hayas guardado.
- El nombre del archivo lo propone el navegador (normalmente «BPDF»): escríbelo en su
  diálogo. BPDF no pone el nombre del documento en el título de la página, por privacidad.
- **Claro** u **Oscuro** solo cambia el PDF, no BPDF, y no se recuerda.

## Lo que no es evidente

- **El texto del PDF se puede seleccionar y buscar**, y las fórmulas y los diagramas se ven
  nítidos a cualquier zoom: no es una captura de pantalla.
- **Los enlaces a internet siguen funcionando** en el PDF que genera Chrome o Edge; en otros
  navegadores depende de cómo imprimen.
- **El papel lo eliges tú** en el diálogo (A4, Carta…): BPDF no fija ninguno.
- **Las imágenes de internet tampoco salen en el PDF**: BPDF no las descarga nunca.

## Preguntas frecuentes sobre exportar a PDF

### ¿Se sube el documento a algún servicio para convertirlo?

No. El PDF lo genera tu propio navegador al imprimir; BPDF no tiene servidor.

### ¿Por qué tengo que elegir «Guardar como PDF» en el diálogo?

Porque BPDF usa la impresión del navegador para crear el PDF: así no necesita ninguna
herramienta externa y el resultado conserva texto, fórmulas y enlaces.

## Qué leer después

- [Editar un Markdown](editar-un-markdown.md)
- [Fórmulas](formulas.md) y [diagramas](diagramas.md)
- [Límites conocidos](../../referencia/limites-conocidos.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/markdown/exportar-a-pdf
