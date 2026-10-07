---
id: privacidad-y-datos-locales
title: "Privacidad y datos locales en BPDF"
sidebar_label: "Privacidad y datos locales"
sidebar_position: 4
slug: /referencia/privacidad-y-datos-locales
description: "BPDF procesa tus documentos en tu dispositivo: sin servidor, sin cuentas, sin telemetría y sin peticiones provocadas por un documento. Qué guarda y dónde."
keywords: [privacidad, local, sin servidor, sin telemetría, localstorage, datos]
tags: [referencia, privacidad, seguridad]
last_update:
  date: 2026-10-07
  author: Equipo R3ZON
r3zon:
  tipo: referencia
  intencion: "¿BPDF sube mis documentos o guarda datos sobre mí?"
  app_url: /
  jsonld: TechArticle
  estado: publicado
  origen: src/preferences/schema.ts
---

**Respuesta corta.** BPDF no sube tus documentos: los lee el navegador de tu disco y BPDF los
procesa en tu dispositivo. No hay cuentas, servidor de datos ni telemetría. Solo guarda, en tu
navegador, tus preferencias y la página por la que ibas en cada PDF, nunca nombres de archivo,
contenido ni contraseñas.

## Qué sale de tu dispositivo

Nada de tus documentos. El servidor de `bpdf.r3zon.com` solo entrega los archivos de la
aplicación (es una web estática). Abrir, leer, buscar, editar y guardar ocurre en tu navegador.

## Qué no puede hacer un documento

Un PDF o un Markdown **no puede hacer que BPDF pida nada a internet**: ni imágenes, ni fuentes,
ni scripts. Una política de seguridad del navegador (CSP) lo refuerza: la app solo puede
cargar recursos de su propio origen. Si un documento enlaza a una web, el enlace solo se abre
si lo pulsas, en una pestaña nueva y sin decir a esa web desde dónde llegas.

## Qué guarda BPDF y dónde

| Qué | Dónde | Contiene |
|---|---|---|
| Preferencias (`bpdf:prefs`) | Almacenamiento local del navegador | Colores, zoom, vista y estado de miniaturas de PDF; letra y ancho de Markdown; atajos de una tecla; si recordar posiciones |
| Posiciones (`bpdf:positions`) | Almacenamiento local del navegador | Por cada PDF (hasta 50): una huella del archivo, página, zoom y fecha de lectura |

Nada más: ni cookies, ni otros almacenamientos, ni cachés de documentos. Borrarlo:
[Restablecer y borrar](../guias/preferencias/restablecer-preferencias.md).

## Qué no hay

- Cuentas, inicio de sesión o sincronización entre equipos.
- Estadísticas de uso, analítica o informes de errores a ningún servicio, tampoco anónimos.
- Anuncios o rastreadores.

## Cómo comprobarlo

El código es público (Apache-2.0), en el repositorio enlazado desde **Preferencias** → «Acerca
de BPDF». En las herramientas de desarrollo del navegador, la pestaña de red muestra que, al
abrir un documento, no sale ninguna petición fuera de `bpdf.r3zon.com`.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-07.
> https://docs.r3zon.com/bpdf/referencia/privacidad-y-datos-locales
