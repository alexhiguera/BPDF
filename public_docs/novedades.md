---
title: "Novedades de BPDF"
sidebar_label: "Novedades"
sidebar_position: 1
slug: /novedades
description: "Qué versión de BPDF está publicada, qué puede hacer y qué límites conocidos tiene. Se amplía con cada versión que cambia algo que notas al usarlo."
keywords: [bpdf, novedades, versión, cambios]
tags: [novedades]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: referencia
  jsonld: none
  estado: publicado
  intencion: "¿Qué versión de BPDF hay y qué ha cambiado?"
  app_url: /
---

**Respuesta corta.** La versión publicada de BPDF es la **0.1.0**, la primera. Abre PDF y
Markdown en tu navegador, en modo oscuro, y tus documentos no se suben a ningún servidor. La
versión que usas aparece en **Preferencias**, al final, en «Acerca de BPDF».

## Qué trae la versión 0.1.0

- **PDF.** Un visor propio con modo oscuro que oscurece las páginas sin tocar las imágenes,
  búsqueda, pantalla completa, atajos de una tecla (se desactivan en **Preferencias**) y PDF
  protegidos con contraseña. BPDF no guarda la contraseña.
- **Markdown.** Tablas, listas de tareas, notas al pie, índice, fórmulas y diagramas. Las
  imágenes se ven si las eliges junto con el `.md` o abres la carpeta que lo contiene; las de
  internet no se cargan, se muestran como enlace.
- **Edición de Markdown.** Tres modos: **Lectura**, **Edición** y **Dividido**. **Guardar**
  (Ctrl+S, ⌘S en Mac) te pregunta dónde guardar el archivo en Chrome y Edge; en Firefox y
  Safari descarga una copia.
- **Privacidad.** Sin cuentas, sin servidor y sin estadísticas de uso. Las preferencias se
  guardan solo en tu navegador.

## Qué navegador necesitas

Chrome o Edge 111, Firefox 128 o Safari 16.4, o una versión posterior.

## Qué límites conocidos tiene

- Abre **un documento cada vez**.
- Un Markdown muy grande, de alrededor de 1 MB, tarda unos segundos en aparecer.
- Con un Markdown muy grande, la vista previa de **Dividido** se pausa mientras escribes:
  pulsa **Actualizar la vista previa** para verla. Si además tiene muchas fórmulas, escribir
  en **Dividido** puede ir lento; en **Edición** va fluido.
- El modo oscuro de los PDF no oscurece sus imágenes.
- No hay tema claro.

## Qué cambia en cada versión

Cada versión nueva añade aquí su apartado con lo que notas al usarla: funciones nuevas,
cambios de comportamiento y límites que desaparecen. Los arreglos internos que no cambian
nada visible no se anotan.
