---
id: configurar-bpdf
title: "Cómo configurar BPDF con las Preferencias"
sidebar_label: "Configurar BPDF"
sidebar_position: 1
slug: /guias/preferencias/configurar-bpdf
description: "En Preferencias eliges cómo se abren los PDF (colores, zoom, vista), la letra y el ancho de los Markdown y los atajos de una tecla. Se guardan en tu navegador."
keywords: [preferencias, configuración, zoom por defecto, tamaño de letra, atajos]
tags: [preferencias]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo cambio la configuración de BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/preferences/PreferencesDialog.tsx
---

**Respuesta corta.** Pulsa **Preferencias**, arriba a la derecha. Ahí eliges los colores, el
zoom y la vista con que se abren los PDF, el tamaño de letra y el ancho de los Markdown, y si
quieres atajos de una tecla. Cada cambio se guarda al momento, solo en este navegador.

## Cómo cambiar las preferencias, paso a paso

1. Pulsa **Preferencias** en la barra superior.
2. En **PDF: al abrir un documento**, elige **Colores de la página** (Oscuro u Original),
   **Zoom** (ajustar al ancho, a la página o un porcentaje) y **Vista** (Continua o Página a
   página).
3. En **Markdown**, elige **Tamaño de letra** (de 15 a 22 px) y **Ancho de la columna**
   (estrecho, normal o ancho: 60, 72 o 90 caracteres).
4. En **Teclado**, marca o desmarca los atajos de una tecla del visor PDF.
5. En **Posición de lectura**, decide si BPDF recuerda la página y el zoom de cada PDF.
6. Cierra el diálogo con Esc o con **Cerrar las preferencias**. No hay que pulsar «Aceptar».

## Qué tener en cuenta

- Las preferencias de PDF se aplican **al siguiente PDF que abras**; los botones del visor
  cambian solo el abierto.
- Se guardan en el almacenamiento local de **este navegador**: en otro navegador o equipo
  empiezas con los valores por defecto.

## Lo que no es evidente

- **Si tienes BPDF abierto en dos pestañas**, un cambio en una se ve al momento en la otra.
- **Al final del diálogo está «Acerca de BPDF»**: la versión, la licencia y el enlace al
  código fuente.
- BPDF nunca guarda nombres de archivo, contenido ni contraseñas en las preferencias.

## Qué leer después

- [Posiciones recordadas](posiciones-recordadas.md)
- [Restablecer las preferencias](restablecer-preferencias.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/preferencias/configurar-bpdf
