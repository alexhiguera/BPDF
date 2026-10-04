---
id: pdf-con-contrasena
title: "Cómo abrir un PDF protegido con contraseña"
sidebar_label: "PDF con contraseña"
sidebar_position: 4
slug: /guias/pdf/pdf-con-contrasena
description: "Si un PDF tiene contraseña de apertura, BPDF te la pide en un diálogo. La comprueba en tu dispositivo y no la guarda en ningún sitio."
keywords: [pdf contraseña, pdf protegido, desbloquear pdf, password pdf]
tags: [pdf, contrasena]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo abro un PDF que pide contraseña?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/app/pdf/DialogoContrasena.tsx
---

**Respuesta corta.** Abre el PDF como cualquier otro. Si tiene contraseña de apertura, BPDF
muestra el diálogo **PDF protegido con contraseña**: escríbela y pulsa **Abrir**. Se
comprueba en tu dispositivo y BPDF no la guarda: tendrás que escribirla cada vez.

## Qué necesitas antes de empezar

- La contraseña de apertura del PDF. BPDF no puede abrirlo sin ella.

## Cómo abrir un PDF con contraseña, paso a paso

1. Abre el PDF con **Abrir archivo** o arrastrándolo.
2. En el diálogo, escribe la contraseña en **Contraseña**.
3. Pulsa **Abrir**.
4. Si no es correcta, BPDF lo dice: vuelve a escribirla. **Cancelar** deja de intentarlo.

## Qué tener en cuenta

- La contraseña no se guarda: ni en Preferencias, ni en el navegador, ni en ningún servidor.
- Un PDF con solo «contraseña de permisos» (la que limita imprimir o copiar) se abre sin
  pedir nada.

## Lo que no es evidente

- **Puede que tu gestor de contraseñas no ofrezca guardarla:** el diálogo está hecho para que
  la contraseña no salga de él.
- **La página y el zoom sí pueden recordarse** como en cualquier PDF, porque se guarda una
  huella del archivo, no su contenido ni su contraseña.

## Qué leer después

- [PDF protegido: problemas](../../problemas/pdf-protegido.md)
- [Privacidad y datos locales](../../referencia/privacidad-y-datos-locales.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/pdf/pdf-con-contrasena
