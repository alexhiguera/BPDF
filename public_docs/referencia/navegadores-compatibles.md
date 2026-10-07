---
id: navegadores-compatibles
title: "Navegadores compatibles con BPDF"
sidebar_label: "Navegadores compatibles"
sidebar_position: 2
slug: /referencia/navegadores-compatibles
description: "BPDF funciona en Chrome y Edge 111, Firefox 128 y Safari 16.4 o posteriores, con JavaScript activado. Qué cambia entre navegadores."
keywords: [navegadores, chrome, firefox, safari, edge, compatibilidad, móvil]
tags: [referencia, navegadores]
last_update:
  date: 2026-10-07
  author: Equipo R3ZON
r3zon:
  tipo: referencia
  intencion: "¿En qué navegadores funciona BPDF?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: vite.config.ts
---

**Respuesta corta.** BPDF funciona en **Chrome y Edge 111**, **Firefox 128** y **Safari 16.4**,
o versiones posteriores, en ordenador y en móvil, con JavaScript activado. No hace falta
instalar nada. Unas pocas funciones dependen del navegador: guardar un Markdown y la pantalla
completa en iPhone.

## Qué versiones necesitas

| Navegador | Versión mínima |
|---|---|
| Google Chrome | 111 |
| Microsoft Edge | 111 |
| Mozilla Firefox | 128 |
| Safari (macOS, iOS, iPadOS) | 16.4 |

Otros navegadores basados en Chromium de versiones equivalentes deberían funcionar, pero no
se prueban.

## Qué cambia entre navegadores

| Función | Chrome y Edge | Firefox | Safari |
|---|---|---|---|
| Guardar un Markdown | Eliges dónde guardarlo | Descarga una copia | Descarga una copia |
| Pantalla completa del PDF | Sí | Sí | Sí en macOS y iPad; en iPhone no hay botón |
| Elegir una carpeta | Pide confirmación con el texto «subir archivos»: no se sube nada | Sí | Sí |

## Cómo se prueba

Cada cambio de BPDF pasa una batería de pruebas automáticas en Chromium, Firefox y WebKit. El
WebKit automatizado corre en Linux y no sustituye una medición de rendimiento en Safari real;
el caso extremo de alrededor de 1 MB con muchas fórmulas en modo dividido no se ha medido allí.

## Qué pasa con un navegador antiguo

Con una versión anterior a las de la tabla, BPDF puede no cargar o fallar al abrir
documentos. Actualiza el navegador ([Navegador no compatible](../problemas/navegador-no-compatible.md)).

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-07.
> https://docs.r3zon.com/bpdf/referencia/navegadores-compatibles
