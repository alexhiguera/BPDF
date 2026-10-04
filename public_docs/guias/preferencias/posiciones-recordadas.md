---
id: posiciones-recordadas
title: "Cómo recuerda BPDF por dónde ibas en un PDF"
sidebar_label: "Posiciones recordadas"
sidebar_position: 2
slug: /guias/preferencias/posiciones-recordadas
description: "BPDF puede recordar la página y el zoom de cada PDF con una huella del archivo, sin guardar su nombre. Cómo activarlo, desactivarlo u olvidarlo."
keywords: [recordar página, posición de lectura, seguir leyendo, olvidar posiciones]
tags: [preferencias, pdf, privacidad]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿BPDF recuerda en qué página me quedé en un PDF?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/preferences/positions.ts
---

**Respuesta corta.** Sí, si **Recordar la página y el zoom de cada PDF** está marcado en
**Preferencias** (lo está por defecto). Al volver a abrir el mismo PDF, sigue donde lo dejaste.
Guarda una huella del archivo, no su nombre, y solo en este navegador. Solo PDF: un Markdown
no guarda posición.

## Cómo gestionar las posiciones recordadas, paso a paso

1. Abre **Preferencias**.
2. En **Posición de lectura**, marca o desmarca **Recordar la página y el zoom de cada PDF**.
3. Para borrar las posiciones guardadas, pulsa **Olvidar posiciones guardadas**.

## Qué tener en cuenta

- Desmarcar la opción **no borra** las posiciones ya guardadas: usa **Olvidar posiciones
  guardadas**.
- Se guardan como mucho las de **50 PDF**; al pasar de ahí, se borran las más antiguas.

## Lo que no es evidente

- **La huella sale del propio PDF**, no del nombre: si renombras el archivo, BPDF lo reconoce
  igual; otra versión del documento puede contar como otro.
- **Nadie puede saber qué PDF has leído mirando lo guardado**: solo hay huellas, páginas,
  zoom y la fecha de la última lectura.
- **«Restablecer preferencias» no borra las posiciones**, y «Olvidar posiciones guardadas» no
  toca las preferencias.

## Qué leer después

- [Restablecer las preferencias](restablecer-preferencias.md)
- [Privacidad y datos locales](../../referencia/privacidad-y-datos-locales.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/preferencias/posiciones-recordadas
