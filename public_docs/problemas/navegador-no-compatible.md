---
id: navegador-no-compatible
title: "BPDF no carga o falla en mi navegador"
sidebar_label: "Navegador no compatible"
sidebar_position: 3
slug: /problemas/navegador-no-compatible
description: "Si BPDF se queda en blanco o falla al abrir documentos, comprueba que tu navegador es Chrome o Edge 111, Firefox 128 o Safari 16.4 o posterior, y JavaScript."
keywords: [navegador no compatible, página en blanco, actualizar navegador, javascript]
tags: [problemas, navegadores]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: problema
  intencion: "¿Por qué BPDF no funciona en mi navegador?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: vite.config.ts
---

**Respuesta corta.** BPDF necesita JavaScript y un navegador reciente: Chrome o Edge 111,
Firefox 128 o Safari 16.4, o posteriores. Con uno más antiguo puede quedarse en blanco o
fallar al abrir documentos. Actualiza el navegador o prueba con otro.

## Cómo saber qué versión tienes

- **Chrome y Edge:** menú → Ayuda → Información.
- **Firefox:** menú → Ayuda → Acerca de Firefox.
- **Safari:** depende del sistema: en macOS, Safari → Acerca de Safari; en iPhone y iPad, la
  versión de iOS o iPadOS.

## Qué comprobar después

1. Que JavaScript está activado. Sin él, BPDF muestra «BPDF necesita JavaScript para
   funcionar.».
2. Que ninguna extensión bloquea la web: prueba en una ventana privada sin extensiones.
3. Que la dirección es `https://bpdf.r3zon.com`.

## Qué hacer si sigue fallando

Si tu navegador cumple los requisitos y BPDF falla, cuéntalo en un issue del repositorio de
GitHub (enlazado desde **Preferencias** → «Acerca de BPDF»), con el navegador, su versión y el
sistema. No adjuntes documentos con datos personales.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/problemas/navegador-no-compatible
