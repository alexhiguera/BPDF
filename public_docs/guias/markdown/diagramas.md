---
id: diagramas
title: "Cómo mostrar diagramas Mermaid en un Markdown"
sidebar_label: "Diagramas (Mermaid)"
sidebar_position: 6
slug: /guias/markdown/diagramas
description: "BPDF dibuja los bloques de código mermaid de un Markdown como diagramas, en un marco aislado. Si la sintaxis falla, muestra el código con un aviso."
keywords: [mermaid, diagramas markdown, diagrama de flujo, secuencia]
tags: [markdown, diagramas, mermaid]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: guia
  intencion: "¿Cómo hago que BPDF dibuje un diagrama Mermaid de mi Markdown?"
  app_url: /
  jsonld: HowTo
  estado: publicado
  origen: src/markdown/mermaid.ts
---

**Respuesta corta.** Escribe el diagrama en un bloque de código con el lenguaje `mermaid`.
BPDF lo dibuja con Mermaid, en tu dispositivo y en un marco aislado. Si la sintaxis no es
válida, el diagrama es demasiado grande o usa imágenes, ves su código con un aviso.

## Cómo añadir un diagrama, paso a paso

1. Abre un bloque de código con tres acentos graves y la palabra `mermaid`.
2. Escribe el diagrama, por ejemplo `graph TD` y en la línea siguiente `A --> B`.
3. Cierra el bloque con tres acentos graves.
4. Abre o actualiza el documento: aparece «Dibujando el diagrama…» y después el diagrama.

## Qué tener en cuenta

- Se dibujan con los colores del modo oscuro de BPDF, no con el tema del documento.
- Un diagrama de más de 50 000 caracteres no se dibuja: se muestra su código.
- Las etiquetas son texto: el HTML dentro de un diagrama no se interpreta.

## Lo que no es evidente

- **Un diagrama que usa imágenes no se dibuja:** podrían pedirse a internet, así que BPDF
  muestra su código.
- **El código del diagrama sigue disponible:** **Código del diagrama** lo despliega debajo,
  por ejemplo para copiarlo.
- **Mermaid solo se descarga si hace falta**, y se ejecuta en un marco separado de la app con
  su propia política de seguridad.

## Qué leer después

- [Fórmulas](formulas.md)
- [Leer un Markdown](leer-un-markdown.md)

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/guias/markdown/diagramas
