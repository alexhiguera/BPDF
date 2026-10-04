---
id: restablecer-preferencias
title: "Cómo restablecer o borrar lo que BPDF guarda"
sidebar_label: "Restablecer y borrar"
sidebar_position: 3
slug: /guias/preferencias/restablecer-preferencias
description: "Vuelve a los valores por defecto de BPDF con «Restablecer preferencias», borra las posiciones guardadas o elimina todo desde los datos del sitio del navegador."
keywords: [restablecer preferencias, borrar datos, valores por defecto, olvidar]
tags: [preferencias, privacidad]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo vuelvo BPDF a los valores por defecto o borro lo que guarda?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/preferences/store.ts
---

**Respuesta corta.** En **Preferencias**, **Restablecer preferencias** vuelve a los valores por
defecto y **Olvidar posiciones guardadas** borra las páginas recordadas de los PDF. Son las dos
únicas cosas que BPDF guarda. Para borrarlo todo de una vez, elimina los datos del sitio
`bpdf.r3zon.com` en tu navegador.

## Cómo restablecer y borrar, paso a paso

1. Abre **Preferencias**.
2. Pulsa **Restablecer preferencias**: verás «Preferencias restablecidas.».
3. Pulsa **Olvidar posiciones guardadas** si también quieres borrar las posiciones: verás
   «Posiciones guardadas olvidadas.».

## Qué tener en cuenta

- Los valores por defecto: PDF en modo oscuro, ajustado al ancho y en vista continua;
  Markdown a 17 px y 72 caracteres; atajos de una tecla activados; posiciones recordadas.
- Restablecer no se puede deshacer, pero tampoco toca ningún documento.

## Lo que no es evidente

- **Borrar los datos del sitio desde el navegador** (en la configuración de privacidad,
  «cookies y datos de sitios») elimina las dos cosas a la vez. BPDF no usa cookies.
- **En una ventana privada**, el navegador borra lo guardado al cerrarla.

## Qué leer después

- [Configurar BPDF](configurar-bpdf.md)
- [Privacidad y datos locales](../../referencia/privacidad-y-datos-locales.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/preferencias/restablecer-preferencias
