---
id: un-markdown-grande-tarda
title: "Un Markdown grande tarda en abrirse o al escribir"
sidebar_label: "Un Markdown grande tarda"
sidebar_position: 2
slug: /problemas/un-markdown-grande-tarda
description: "Un Markdown de alrededor de 1 MB tarda unos segundos en aparecer, y en modo dividido la vista previa se pausa. Es un límite conocido: cómo trabajar con él."
keywords: [markdown lento, documento grande, vista previa en pausa, rendimiento]
tags: [problemas, markdown, rendimiento]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: problema
  intencion: "¿Por qué BPDF va lento con mi Markdown grande?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: src/markdown/MarkdownView.tsx
---

**Respuesta corta.** Es un límite conocido: un Markdown de alrededor de 1 MB tarda unos
segundos en mostrarse («Preparando el documento…»), y en **Dividido** la vista previa se pausa
mientras escribes. Escribe en **Edición** y mira el resultado en **Lectura**, o pulsa
**Actualizar la vista previa** cuando quieras verla.

## Qué está pasando

BPDF convierte todo el documento cada vez que lo muestra: un Markdown de cientos de páginas son
cientos de tablas, bloques de código o fórmulas que dibujar. Mientras escribes en **Dividido**,
rehacerlo todo con cada pausa te interrumpiría, así que BPDF deja la vista previa en pausa y te
lo dice.

## Cómo trabajar con un documento grande

- Escribe en **Edición**: el editor va fluido con documentos grandes.
- Cambia a **Lectura** o pulsa **Actualizar la vista previa** cuando quieras ver el resultado.
- Si puedes, divide el documento en varios archivos más pequeños.

## Qué lo empeora

- Muchas fórmulas o diagramas: cada uno se dibuja aparte.
- Un equipo o un navegador lentos. En pruebas con el motor de Safari, escribir en **Dividido**
  con un Markdown grande lleno de fórmulas fue especialmente lento.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/problemas/un-markdown-grande-tarda
