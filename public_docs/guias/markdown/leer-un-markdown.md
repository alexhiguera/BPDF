---
id: leer-un-markdown
title: "Cómo leer un Markdown en BPDF"
sidebar_label: "Leer"
sidebar_position: 1
slug: /guias/markdown/leer-un-markdown
description: "BPDF muestra los Markdown con tablas, listas de tareas, notas al pie, índice y código resaltado. Ajusta el tamaño de letra y el ancho en Preferencias."
keywords: [leer markdown, gfm, índice, notas al pie, copiar código]
tags: [markdown, lectura]
last_update:
  date: 2026-10-07
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo se ve y se navega un Markdown en BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/markdown/MarkdownView.tsx
---

**Respuesta corta.** Abre el `.md` y BPDF lo muestra en modo **Lectura**: títulos, tablas,
listas de tareas, notas al pie, código resaltado con botón **Copiar código**, fórmulas y
diagramas. Si tiene al menos dos títulos, **Índice** te lleva a cada sección.

## Cómo leer y navegar un Markdown, paso a paso

1. Abre el Markdown ([Abrir un Markdown](../../primeros-pasos/abrir-un-markdown.md)).
2. Pulsa **Índice** para ver sus secciones y pulsa una para ir a ella.
3. En un bloque de código, pulsa **Copiar código** para llevártelo al portapapeles.
4. En una nota al pie, el enlace de vuelta te devuelve a donde la llamaste.
5. Para leer con otra letra o con la columna más ancha, cambia **Tamaño de letra** y
   **Ancho de la columna** en **Preferencias**.

## Qué tener en cuenta

- BPDF lee Markdown con las extensiones de GitHub (GFM): tablas, listas de tareas, texto
  tachado y enlaces automáticos.
- El HTML incrustado **no se interpreta**: se ve como texto. Los comentarios HTML sí se
  ocultan.
- Las imágenes de internet no se cargan
  ([Imágenes locales](imagenes-locales.md)).

## Lo que no es evidente

- **Los enlaces a internet se abren en una pestaña nueva**, sin que la web de destino sepa que
  vienes de leer este documento. Los enlaces peligrosos (por ejemplo, `javascript:`) se
  bloquean.
- **Un Markdown no recuerda por dónde ibas:** al volver a abrirlo empieza arriba. Solo los PDF
  guardan su posición.

## Preguntas frecuentes sobre leer Markdown

### ¿Por qué veo etiquetas HTML como texto?

Porque BPDF no interpreta el HTML de un documento: así un archivo no puede ejecutar código ni
pedir nada a internet. Lo muestra para que sepas que estaba ahí.

### ¿Puedo imprimir el Markdown formateado?

Sí. Usa **Guardar como… → PDF (.pdf)** y elige colores claros u oscuros. BPDF prepara el
documento para papel y abre la impresión del navegador; allí eliges **Guardar como PDF**
([Exportar a PDF](exportar-a-pdf.md)).

## Qué leer después

- [Editar un Markdown](editar-un-markdown.md)
- [Fórmulas](formulas.md) y [diagramas](diagramas.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-07.
> https://docs.r3zon.com/bpdf/guias/markdown/leer-un-markdown
