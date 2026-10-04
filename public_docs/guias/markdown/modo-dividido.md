---
id: modo-dividido
title: "Cómo editar con el modo dividido"
sidebar_label: "Modo dividido"
sidebar_position: 3
slug: /guias/markdown/modo-dividido
description: "El modo Dividido de BPDF muestra el texto del Markdown y su resultado lado a lado, con desplazamiento sincronizado y un separador que puedes mover."
keywords: [modo dividido, vista previa markdown, editor y vista previa, separador]
tags: [markdown, edicion, dividido]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo veo el texto y el resultado del Markdown a la vez?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/editor/SplitView.tsx
---

**Respuesta corta.** Elige **Dividido** en **Modo**: el editor queda a la izquierda y la vista
previa a la derecha. La vista previa se actualiza al dejar de escribir y se desplaza a la vez
que el texto. Arrastra el separador, o usa ← y →, para repartir el ancho.

## Cómo usar el modo dividido, paso a paso

1. Con un Markdown abierto, elige **Dividido** en **Modo**.
2. Escribe en el editor; la vista previa se actualiza un instante después de parar.
3. Arrastra el separador **Ancho del editor** para dar más espacio a un lado.
4. Con el teclado, lleva el foco al separador y usa ← y → (pasos del 5 %), o Inicio y Fin
   para el mínimo y el máximo.
5. Guarda con **Guardar** o Ctrl/⌘+S ([Editar un Markdown](editar-un-markdown.md)).

## Qué tener en cuenta

- En pantallas estrechas, el editor y la vista previa se apilan uno sobre otro y no hay
  separador.
- Con un documento muy grande, la vista previa **se pausa** mientras escribes, para no
  interrumpirte: pulsa **Actualizar la vista previa** para verla al día.
- Con un Markdown muy grande lleno de fórmulas, escribir en **Dividido** puede ir lento; en
  **Edición** va fluido.

## Lo que no es evidente

- **La sincronía va por títulos:** cada título del texto se alinea con el mismo título de la
  vista previa, y entre dos títulos se interpola. Un documento sin títulos se sincroniza peor.
- **El reparto del ancho no se guarda:** al abrir otro documento vuelve al de siempre.

## Qué leer después

- [Editar un Markdown](editar-un-markdown.md)
- [Un Markdown grande tarda](../../problemas/un-markdown-grande-tarda.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/markdown/modo-dividido
