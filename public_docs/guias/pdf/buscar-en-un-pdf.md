---
id: buscar-en-un-pdf
title: "Cómo buscar texto en un PDF"
sidebar_label: "Buscar"
sidebar_position: 2
slug: /guias/pdf/buscar-en-un-pdf
description: "Busca texto en un PDF con Ctrl/⌘+F: BPDF resalta las coincidencias, te lleva de una a otra y puede distinguir mayúsculas o palabras completas."
keywords: [buscar en pdf, ctrl+f, coincidencias, mayúsculas, palabra completa]
tags: [pdf, busqueda]
last_update:
  date: 2026-10-07
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo busco una palabra en un PDF con BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/app/pdf/BarraBusqueda.tsx
---

**Respuesta corta.** Pulsa **Buscar** en la barra del visor, o Ctrl/⌘+F, y escribe. BPDF
resalta todas las coincidencias, dice cuántas hay y te lleva de una a otra con Intro, Mayús+Intro
o F3. Puede distinguir mayúsculas y buscar palabras completas.

## Cómo buscar en un PDF, paso a paso

1. Con un PDF abierto, pulsa **Buscar** o Ctrl+F (⌘+F en Mac).
2. Escribe lo que buscas en **Buscar en el documento**.
3. Pulsa Intro para ir a la coincidencia siguiente y Mayús+Intro para la anterior. F3 y
   Mayús+F3 hacen lo mismo con la búsqueda abierta.
4. Si lo necesitas, marca **Distinguir mayúsculas** o **Palabra completa**.
5. Pulsa Esc o **Cerrar la búsqueda** para terminar.

## Qué tener en cuenta

- En un PDF largo, la búsqueda avanza página a página e indica cuántas ha revisado.
- Si termina sin coincidencias, muestra **Sin resultados** y desactiva los botones anterior y
  siguiente hasta que cambies la búsqueda.
- Busca en el texto que trae el PDF. Un PDF escaneado no tiene texto: BPDF te avisa de que
  sus páginas son imágenes.

## Lo que no es evidente

- **Las tildes no cuentan:** «camion» encuentra «camión», también con **Distinguir
  mayúsculas** marcado.
- **Encuentra palabras partidas con guion al final de línea**, como en el texto original.
- **Palabra completa** evita que «rosa» encuentre «Rosal».

## Preguntas frecuentes sobre la búsqueda

### ¿Por qué no encuentra nada en mi PDF escaneado?

Porque sus páginas son fotos del papel, sin texto. BPDF no reconoce texto en imágenes (OCR).

### ¿La búsqueda se envía a algún servidor?

No. Se hace en tu dispositivo, sobre el PDF abierto.

## Qué leer después

- [Atajos del visor](atajos-del-visor.md)
- [Miniaturas](miniaturas.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-07.
> https://docs.r3zon.com/bpdf/guias/pdf/buscar-en-un-pdf
