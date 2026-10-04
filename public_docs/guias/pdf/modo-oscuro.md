---
id: modo-oscuro
title: "Cómo leer un PDF en modo oscuro"
sidebar_label: "Modo oscuro"
sidebar_position: 1
slug: /guias/pdf/modo-oscuro
description: "BPDF muestra los PDF en modo oscuro: oscurece el fondo y aclara el texto sin invertir las fotos. Puedes volver a los colores originales en un clic."
keywords: [pdf modo oscuro, dark mode pdf, colores originales, leer de noche]
tags: [pdf, modo-oscuro]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo leo un PDF en modo oscuro sin que se estropeen las fotos?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/pdf/dark/recolor.ts
---

**Respuesta corta.** BPDF abre los PDF en modo oscuro: la página pasa a gris oscuro y el
texto a claro, y las fotos se quedan como están. Para ver los colores del documento, elige
**Original** en el control **Colores de la página** de la barra; **Oscuro** vuelve al modo
oscuro.

## Cómo cambiar entre modo oscuro y colores originales, paso a paso

1. Abre un PDF.
2. En la barra del visor, busca el control **Colores de la página**.
3. Pulsa **Original** para ver el PDF tal como es.
4. Pulsa **Oscuro** para volver al modo oscuro.

## Qué tener en cuenta

- El cambio afecta al PDF abierto. Para que todos los PDF se abran con unos colores, elígelos
  en **Preferencias** ([Configurar BPDF](../preferencias/configurar-bpdf.md)).
- Las imágenes del PDF **no se oscurecen**: una foto clara sigue siendo clara.

## Lo que no es evidente

- **No es invertir colores:** BPDF recolorea el fondo, el texto y los gráficos, pero
  reconoce dónde hay imágenes y las deja intactas, para que las fotos no queden en negativo.
- **Los colores se conservan**: el blanco y el negro se invierten, pero un rojo sigue siendo el
  mismo rojo; si un color queda demasiado oscuro para leerse (un azul marino), se aclara lo
  justo.
- El recoloreado se hace en segundo plano, en tu dispositivo; en un equipo lento, una página
  puede tardar un instante en pasar a oscuro.

## Preguntas frecuentes sobre el modo oscuro

### ¿Puedo imprimir o descargar el PDF en modo oscuro?

No. El modo oscuro es solo para leer en BPDF: no modifica el archivo.

### ¿Hay tema claro para la interfaz?

No en esta versión: BPDF es oscuro por diseño.

## Qué leer después

- [Zoom y vistas](zoom-y-vistas.md)
- [Configurar BPDF](../preferencias/configurar-bpdf.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/pdf/modo-oscuro
