---
id: novedades
title: "Novedades de BPDF"
sidebar_label: "Novedades"
sidebar_position: 2
slug: /novedades
description: "Qué versión de BPDF está publicada, qué puede hacer y qué ha cambiado en cada versión. Versión actual: 1.0.0, la primera estable y open source."
keywords: [bpdf, novedades, versión, cambios, 1.0.0]
tags: [novedades]
last_update:
  date: 2026-10-06
  author: Equipo R3ZON
r3zon:
  tipo: referencia
  intencion: "¿Qué versión de BPDF hay y qué ha cambiado?"
  app_url: /
  jsonld: none
  estado: publicado
  origen: package.json
---

**Respuesta corta.** La versión actual de BPDF es la **1.0.0**, la primera estable: el código es
público (Apache-2.0) y hay documentación oficial. Abre PDF y Markdown en tu navegador, en modo
oscuro, sin subir tus documentos. La versión que usas aparece en **Preferencias** → «Acerca de
BPDF».

## Qué trae la versión 1.0.0

- **Nueva portada e identidad visual.** La pantalla inicial presenta BPDF como producto, con
  accesos claros a abrir archivos, abrir carpetas y crear Markdown, un nuevo icono de libro y
  un resumen de sus funciones y su privacidad local.
- **Código abierto.** El repositorio de BPDF es público, con licencia Apache-2.0. «Acerca de
  BPDF» enlaza a él (**Código fuente en GitHub**).
- **Documentación oficial**, con guías de cada función, referencia, preguntas frecuentes y
  soluciones a problemas habituales.
- **Crear Markdown**: un documento nuevo, vacío, en modo **Dividido**.
- **Guardar como…**: el Markdown en otro destino, o **exportado a PDF**, claro u oscuro, con
  la impresión del navegador y sin nada de BPDF en el PDF.

## Qué trae la versión 0.1.0

La primera versión publicada en `https://bpdf.r3zon.com`.

- **PDF.** Un visor propio con modo oscuro que oscurece las páginas sin tocar las imágenes,
  búsqueda, miniaturas, zoom, giro, pantalla completa, atajos de una tecla (se desactivan en
  **Preferencias**) y PDF protegidos con contraseña. BPDF no guarda la contraseña.
- **Markdown.** Tablas, listas de tareas, notas al pie, índice, fórmulas y diagramas. Las
  imágenes se ven si las eliges junto con el `.md` o abres la carpeta que lo contiene; las de
  internet no se cargan, se muestran como enlace.
- **Edición de Markdown.** Tres modos: **Lectura**, **Edición** y **Dividido**. **Guardar**
  (Ctrl+S, ⌘S en Mac) te pregunta dónde guardar el archivo en Chrome y Edge; en Firefox y
  Safari descarga una copia.
- **Preferencias** para cómo se abren los PDF y cómo se leen los Markdown, y la página por la
  que ibas en cada PDF.
- **Privacidad.** Sin cuentas, sin servidor y sin estadísticas de uso. Las preferencias se
  guardan solo en tu navegador.

## Qué navegador necesitas

Chrome o Edge 111, Firefox 128 o Safari 16.4, o una versión posterior
([Navegadores compatibles](referencia/navegadores-compatibles.md)).

## Qué límites conocidos tiene

- Abre **un documento cada vez**.
- Un Markdown muy grande, de alrededor de 1 MB, tarda unos segundos en aparecer.
- Con un Markdown muy grande, la vista previa de **Dividido** se pausa mientras escribes:
  pulsa **Actualizar la vista previa** para verla. Si además tiene muchas fórmulas, escribir
  en **Dividido** puede ir lento; en **Edición** va fluido.
- El modo oscuro de los PDF no oscurece sus imágenes.
- No hay tema claro.

Lista completa: [Límites conocidos](referencia/limites-conocidos.md).

## Qué cambia en cada versión

Cada versión nueva añade aquí su apartado con lo que notas al usarla: funciones nuevas,
cambios de comportamiento y límites que desaparecen. Los arreglos internos que no cambian
nada visible no se anotan. Las versiones siguen SemVer: un cambio que notas sube la segunda
cifra; un arreglo, la tercera.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-06.
> https://docs.r3zon.com/bpdf/novedades
