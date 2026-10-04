---
id: pdf-protegido
title: "No consigo abrir un PDF protegido o dañado"
sidebar_label: "PDF protegido o dañado"
sidebar_position: 5
slug: /problemas/pdf-protegido
description: "Qué hacer si BPDF dice que la contraseña no es correcta, que el PDF está dañado o que el archivo no es un PDF aunque se llame .pdf."
keywords: [pdf protegido, contraseña incorrecta, pdf dañado, no se puede abrir pdf]
tags: [problemas, pdf, contrasena]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: problema
  intencion: "¿Por qué BPDF no abre mi PDF?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: src/app/pdf/DialogoContrasena.tsx
---

**Respuesta corta.** Si BPDF dice que la contraseña no es correcta, revísala: distingue
mayúsculas. Si dice que el PDF está dañado o que no es un PDF, el archivo está roto o es otra
cosa con nombre `.pdf`: descárgalo de nuevo o pide otra copia. BPDF no puede saltarse una
contraseña.

## Qué significa cada aviso

| Aviso | Qué hacer |
|---|---|
| La contraseña no es correcta | Escríbela de nuevo; cuidado con las mayúsculas y la distribución del teclado |
| BPDF no ha podido leer este PDF: está dañado o no es un PDF válido | Descárgalo otra vez; si persiste, el archivo está dañado |
| El archivo se llama .pdf, pero su contenido no es un PDF | Es otro tipo de archivo renombrado: ábrelo con su programa |
| El archivo supera el tamaño máximo para este tipo | BPDF abre PDF de hasta 512 MiB |
| No se ha podido mostrar esta página | Esa página concreta tiene un problema; el resto del PDF se ve |

## Qué no puede hacer BPDF

- Abrir un PDF sin su contraseña de apertura.
- Quitar la protección de un PDF ni guardar una copia sin ella.

## Qué leer después

- [PDF con contraseña](../guias/pdf/pdf-con-contrasena.md)
- [Formatos compatibles](../referencia/formatos-compatibles.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/problemas/pdf-protegido
