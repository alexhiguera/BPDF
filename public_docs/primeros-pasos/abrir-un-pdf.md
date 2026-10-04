---
id: abrir-un-pdf
title: "Cómo abrir un PDF en BPDF"
sidebar_label: "Abrir un PDF"
sidebar_position: 1
slug: /primeros-pasos/abrir-un-pdf
description: "Abre un PDF en BPDF con el botón «Abrir archivo», con Ctrl/⌘+O o arrastrándolo a la ventana. Se lee en tu dispositivo, sin subirlo."
keywords: [abrir pdf, visor pdf, arrastrar, ctrl+o]
tags: [pdf, primeros-pasos]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo abro un PDF en BPDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/documents/read.ts
---

**Respuesta corta.** Entra en `https://bpdf.r3zon.com`, pulsa **Abrir archivo** (o Ctrl/⌘+O)
y elige el PDF. También puedes arrastrarlo a la ventana. BPDF lo abre en modo oscuro, en tu
propio dispositivo: el archivo no se sube a ningún servidor.

## Qué necesitas antes de empezar

- Un navegador compatible: Chrome o Edge 111, Firefox 128 o Safari 16.4, o posteriores
  ([Navegadores compatibles](../referencia/navegadores-compatibles.md)).
- Un PDF de hasta 512 MiB.

## Cómo abrir un PDF, paso a paso

1. Abre `https://bpdf.r3zon.com` en el navegador.
2. Pulsa **Abrir archivo**, arriba a la derecha, o pulsa Ctrl+O (⌘+O en Mac).
3. Elige el PDF en el diálogo de tu sistema.
4. Lee: BPDF muestra la primera página y la barra del visor encima.
5. Para cerrarlo, pulsa **Cerrar documento**, junto al nombre del archivo.

## Qué tener en cuenta

- BPDF abre **un documento cada vez**: abrir otro sustituye al actual.
- Si el PDF tiene contraseña de apertura, BPDF te la pide
  ([PDF con contraseña](../guias/pdf/pdf-con-contrasena.md)).
- Si el archivo no es un PDF válido aunque se llame `.pdf`, BPDF lo dice y no lo abre.

## Lo que no es evidente

- **Arrastrar funciona en cualquier momento:** suelta el PDF sobre la ventana, también con
  otro documento abierto.
- **BPDF puede recordar la página y el zoom de cada PDF.** Si vuelves a abrirlo, sigue donde
  lo dejaste ([Posiciones recordadas](../guias/preferencias/posiciones-recordadas.md)).
- **Los enlaces del PDF funcionan:** los internos te llevan a su página; los de internet se
  abren en una pestaña nueva, sin que la web de destino sepa desde dónde llegas.

## Preguntas frecuentes sobre abrir un PDF

### ¿Se sube mi PDF a algún sitio?

No. El navegador lo lee de tu disco y BPDF lo procesa en tu dispositivo. No hay servidor que
lo reciba.

### ¿Puedo abrir un PDF desde una URL?

No. BPDF abre archivos de tu equipo: descárgalo primero y ábrelo desde ahí.

## Qué leer después

- [Modo oscuro](../guias/pdf/modo-oscuro.md)
- [Buscar en un PDF](../guias/pdf/buscar-en-un-pdf.md)
- [Atajos del visor](../guias/pdf/atajos-del-visor.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/primeros-pasos/abrir-un-pdf
