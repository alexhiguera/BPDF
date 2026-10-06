---
id: que-es-bpdf
title: "Qué es BPDF"
sidebar_label: "Qué es BPDF"
sidebar_position: 1
slug: /que-es-bpdf
description: "BPDF es un visor y editor de documentos PDF y Markdown que funciona en el navegador, en modo oscuro, gratis, open source y sin subir tus archivos."
keywords: [bpdf, qué es, visor pdf, visor markdown, open source, privacidad]
tags: [concepto]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: concepto
  intencion: "¿Qué es BPDF y para qué sirve?"
  app_url: /
  jsonld: Article
  estado: publicado
  origen: src/config/project.ts
---

**Respuesta corta.** BPDF es una herramienta web gratuita y open source (Apache-2.0), creada
por R3ZON, para leer PDF y leer o editar Markdown en modo oscuro. Funciona en el navegador,
sin instalar nada y sin cuenta. Tus documentos se abren en tu dispositivo: BPDF no tiene
servidor que los reciba.

## Qué hace BPDF

- **PDF:** un visor con modo oscuro que oscurece las páginas sin tocar las fotos, búsqueda,
  miniaturas, zoom, giro, pantalla completa y PDF protegidos con contraseña.
- **Markdown:** un lector con tablas, listas de tareas, notas al pie, índice, código
  resaltado, fórmulas (KaTeX) y diagramas (Mermaid), y un editor con vista previa y modo
  dividido. Puedes crear un Markdown desde cero y guardarlo como `.md` o como PDF, claro u
  oscuro.
- **Imágenes locales:** muestra las imágenes de un Markdown si eliges sus archivos junto con
  el `.md` o abres su carpeta.
- **Preferencias:** zoom, vista y colores del PDF, tamaño de letra y ancho del Markdown, y la
  página por la que ibas en cada PDF.

## Por qué tus documentos no salen de tu equipo

BPDF es una web **estática**: el servidor solo entrega la aplicación. Cuando abres un
documento, el navegador lo lee de tu disco y BPDF lo procesa ahí mismo. No hay cuentas, ni
sincronización, ni estadísticas de uso. Un documento tampoco puede hacer que BPDF pida nada a
internet: no carga imágenes, fuentes ni scripts remotos. Detalle en
[Privacidad y datos locales](referencia/privacidad-y-datos-locales.md).

## Qué no hace BPDF

- No sube, comparte ni guarda tus documentos en ningún sitio.
- No reconoce texto en imágenes (OCR): en un PDF escaneado no hay texto que buscar.
- No rellena formularios de PDF ni modifica PDF: los muestra.
- No abre varios documentos a la vez: uno cada vez.
- No tiene tema claro ni versión de escritorio: es una web, oscura por diseño.

## Quién hace BPDF

BPDF lo crea y mantiene R3ZON (`https://r3zon.com`). Su código es público en GitHub, con
licencia Apache-2.0, y cualquiera puede revisarlo o proponer mejoras. En la app, el enlace está
en **Preferencias**, al final, en «Acerca de BPDF».

## Qué leer después

- [Abrir un PDF](primeros-pasos/abrir-un-pdf.md)
- [Abrir un Markdown](primeros-pasos/abrir-un-markdown.md)
- [Novedades](novedades.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/que-es-bpdf
