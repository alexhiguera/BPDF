---
id: carpeta-y-recursos
title: "Problemas al abrir una carpeta o un Markdown con sus imágenes"
sidebar_label: "Carpetas y recursos"
sidebar_position: 4
slug: /problemas/carpeta-y-recursos
description: "Qué significan los avisos al abrir una carpeta o varios archivos en BPDF: sin Markdown, varios Markdown, demasiados archivos o archivos que no encajan."
keywords: [abrir carpeta, varios markdown, demasiados archivos, chrome subir archivos]
tags: [problemas, markdown, carpetas]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: problema
  intencion: "¿Por qué BPDF no abre mi carpeta o mis archivos?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: src/documents/seleccion.ts
---

**Respuesta corta.** BPDF abre una carpeta si contiene al menos un Markdown y no pasa de 10 000
archivos; si hay varios Markdown, te pide elegir uno. Si eliges archivos sueltos, solo acepta
un `.md` con sus imágenes o un PDF solo. Cada aviso explica qué falta.

## Qué significa cada aviso

| Aviso | Qué hacer |
|---|---|
| La carpeta no contiene ningún Markdown | Para un PDF, usa **Abrir archivo**; para un Markdown, elige la carpeta que lo contiene |
| La carpeta tiene demasiados archivos | Abre una carpeta más pequeña, o el `.md` con sus imágenes |
| Entre los archivos elegidos no hay ningún Markdown | Incluye el `.md` en la selección |
| Has elegido varios Markdown | Elige uno solo con sus imágenes, o abre la carpeta y elígelo en la lista |
| Ese archivo no puede acompañar a un Markdown | Un PDF se abre solo; con un `.md` solo van imágenes |
| Suelta una sola carpeta, o archivos sueltos | No sueltes una carpeta y archivos a la vez |

## Por qué Chrome habla de «subir» archivos

Al elegir una carpeta, Chrome pregunta si quieres «subir» sus archivos a la web. Es el texto
genérico del navegador: BPDF no sube nada, solo lee los archivos en tu dispositivo. Si eliges
una carpeta vacía, no pasa nada: se trata como si cancelaras.

## Qué carpetas se ignoran

Dentro de la carpeta, BPDF no recorre `.git` ni `node_modules`, ni baja más de 32 niveles: ahí
no hay imágenes de un documento y pueden tener decenas de miles de archivos.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/problemas/carpeta-y-recursos
