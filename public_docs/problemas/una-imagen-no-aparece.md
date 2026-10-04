---
id: una-imagen-no-aparece
title: "Una imagen de mi Markdown no aparece"
sidebar_label: "Una imagen no aparece"
sidebar_position: 1
slug: /problemas/una-imagen-no-aparece
description: "Si en lugar de una imagen ves un aviso, BPDF te dice por qué: no incluida, fuera de lo elegido, formato, tamaño, ruta o imagen de internet. Cómo arreglarlo."
keywords: [imagen no aparece, imagen local no incluida, markdown imágenes, error imagen]
tags: [problemas, markdown, imagenes]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: problema
  intencion: "¿Por qué no se ve una imagen de mi Markdown en BPDF?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: src/documents/recursos.ts
---

**Respuesta corta.** En lugar de la imagen, BPDF muestra un aviso con el motivo. Casi siempre
es «imagen local no incluida»: abriste el `.md` solo. Ábrelo con **Abrir carpeta**, o elige el
`.md` junto con sus imágenes. Si la imagen es de internet, BPDF no la carga a propósito.

## Qué significa cada aviso

| Aviso | Por qué | Qué hacer |
|---|---|---|
| imagen local no incluida | No está entre los archivos que elegiste | Abre la carpeta, o el `.md` con sus imágenes |
| imagen fuera de los archivos elegidos | La ruta sale de la carpeta (por ejemplo, `../x.png`) | Mueve la imagen dentro de la carpeta del documento |
| formato de imagen no admitido | No es PNG, JPEG, GIF, WebP ni SVG | Conviértela a uno de esos formatos |
| imagen demasiado grande | Pesa más de 50 MiB | Redúcela o comprímela |
| imagen ambigua | Varios archivos elegidos encajan con esa ruta | Elige solo el que corresponde |
| ruta de imagen no válida | La ruta no se puede interpretar | Corrige la ruta en el Markdown |
| no se ha podido mostrar la imagen | El archivo está dañado o no es lo que dice ser | Vuelve a exportar la imagen |
| imagen de internet no cargada | Es una URL de internet | Pulsa **Abrir la imagen en el navegador** si quieres verla |

## Cómo comprobar la ruta

- Las rutas son relativas al `.md`: `images/foto.png` busca la carpeta `images` junto al `.md`.
- Las mayúsculas cuentan: `Foto.PNG` no es `foto.png`.
- «Abrir archivo» no ve subcarpetas: para `images/foto.png`, usa **Abrir carpeta**.

## Por qué no carga imágenes de internet

Pedir una imagen a otra web revelaría a quien la aloja que estás leyendo ese documento, y
cuándo. BPDF nunca hace peticiones a internet por un documento.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/problemas/una-imagen-no-aparece
