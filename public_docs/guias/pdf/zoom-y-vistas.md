---
id: zoom-y-vistas
title: "Cómo cambiar el zoom, la vista y el giro de un PDF"
sidebar_label: "Zoom y vistas"
sidebar_position: 3
slug: /guias/pdf/zoom-y-vistas
description: "Acerca, aleja, ajusta al ancho o a la página, gira y elige entre vista continua o página a página en el visor PDF de BPDF, también a pantalla completa."
keywords: [zoom pdf, ajustar al ancho, página a página, girar pdf, pantalla completa]
tags: [pdf, zoom, vistas]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo cambio el zoom o la forma de ver las páginas de un PDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/app/pdf/BarraHerramientas.tsx
---

**Respuesta corta.** En la barra del visor: **Acercar** y **Alejar** (del 25 % al 500 %),
**Ajustar al ancho** o **Ajustar a la página**, los dos botones de giro y la **Vista**,
**Continua** o **Página a página**. **Pantalla completa** deja solo el documento. Todo tiene
atajo de teclado.

## Cómo cambiar el zoom y la vista, paso a paso

1. Pulsa **Acercar** o **Alejar** (Ctrl/⌘+más y Ctrl/⌘+menos) para cambiar el zoom por pasos.
2. Pulsa el porcentaje (por ejemplo, **157 %**) para volver al 100 %, o Ctrl/⌘+0.
3. Pulsa **Ajustar al ancho** o **Ajustar a la página** para que el zoom siga al tamaño de
   la ventana.
4. En **Vista**, elige **Continua** (todas las páginas seguidas) o **Página a página**.
5. Pulsa **Girar 90° a la derecha** (R) o **a la izquierda** (Mayús+R) si una página está
   tumbada.
6. Pulsa **Pantalla completa** (F) para leer sin distracciones; Esc sale.

## Qué tener en cuenta

- Estos botones cambian solo el PDF abierto. El zoom, la vista y los colores con que se
  abren los PDF se eligen en **Preferencias**.
- En un iPhone no hay botón de pantalla completa: el navegador no lo permite.

## Lo que no es evidente

- **En «Página a página», las flechas pasan de página:** → y ← cambian de página; ↓ y ↑
  bajan y suben, y al llegar al borde pasan a la siguiente o a la anterior.
- **Ctrl/⌘+G** lleva el foco al número de página: escribe el número y pulsa Intro.
- Los atajos de una tecla (F, R, Mayús+R) se pueden desactivar en **Preferencias**
  ([Atajos del visor](atajos-del-visor.md)).

## Qué leer después

- [Miniaturas](miniaturas.md)
- [Posiciones recordadas](../preferencias/posiciones-recordadas.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/pdf/zoom-y-vistas
