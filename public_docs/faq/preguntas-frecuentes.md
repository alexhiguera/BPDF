---
id: preguntas-frecuentes
title: "Preguntas frecuentes sobre BPDF"
sidebar_label: "Preguntas frecuentes"
sidebar_position: 1
slug: /faq/preguntas-frecuentes
description: "Respuestas a las dudas habituales sobre BPDF: precio, privacidad, instalación, formatos, edición, móviles y cómo informar de un fallo."
keywords: [preguntas frecuentes, faq, bpdf, gratis, privacidad, móvil]
tags: [faq]
last_update:
  date: 2026-10-04
  author: Equipo R3ZON
r3zon:
  tipo: faq
  intencion: "¿Qué dudas habituales hay sobre BPDF?"
  app_url: /
  jsonld: FAQPage
  estado: publicado
  origen: src/config/project.ts
---

**Respuesta corta.** BPDF es gratis, open source y funciona en el navegador sin instalar nada
ni crear cuenta. Tus documentos no se suben: se abren en tu dispositivo. Abre PDF y Markdown,
edita Markdown y funciona en móvil. Abajo, las dudas más habituales.

## Preguntas frecuentes sobre el producto

### ¿BPDF es gratis?

Sí, del todo: no tiene planes de pago, anuncios ni funciones bloqueadas. Su código es open
source con licencia Apache-2.0.

### ¿Quién hace BPDF?

R3ZON (`https://r3zon.com`). El código es público en GitHub: el enlace está en
**Preferencias** → «Acerca de BPDF».

### ¿Tengo que instalar algo o crear una cuenta?

No. Entra en `https://bpdf.r3zon.com` y abre un documento. No hay cuentas.

### ¿Hay versión de escritorio o app móvil?

No. BPDF es solo una web, que también funciona en el navegador del móvil.

## Preguntas frecuentes sobre privacidad

### ¿Se suben mis documentos a algún servidor?

No. El navegador los lee de tu disco y BPDF los procesa en tu dispositivo. Detalle en
[Privacidad y datos locales](../referencia/privacidad-y-datos-locales.md).

### ¿BPDF funciona sin conexión?

No. Necesita conexión para cargar la web, y algunas partes (el visor de PDF, el editor, las
fórmulas, los diagramas) se descargan de `bpdf.r3zon.com` la primera vez que las usas. Lo que
viaja es siempre la aplicación, nunca tus documentos.

### ¿Qué guarda BPDF en mi navegador?

Tus preferencias y, si lo permites, la página y el zoom de cada PDF (con una huella, no el
nombre). Nada más.

## Preguntas frecuentes sobre el uso

### ¿Puedo abrir varios documentos a la vez?

No: uno cada vez. Para tener dos, abre BPDF en dos pestañas.

### ¿Puedo editar un PDF o rellenar un formulario?

No. BPDF muestra los PDF y los formularios, pero no los modifica. Lo que se edita es Markdown.

### ¿Puedo convertir un Markdown en PDF?

Sí: **Guardar como… → PDF (.pdf)**, en claro u oscuro. Lo genera tu navegador al imprimir,
sin subir nada ([Exportar a PDF](../guias/markdown/exportar-a-pdf.md)).

### ¿Por qué no se ven las imágenes de mi Markdown?

Porque el navegador solo da a BPDF los archivos que eliges. Abre la carpeta del documento o
el `.md` junto con sus imágenes ([Una imagen no aparece](../problemas/una-imagen-no-aparece.md)).

### ¿Hay tema claro?

No en la versión 1.0.0: BPDF es oscuro por diseño. Para un PDF puedes elegir sus colores
originales.

## Preguntas frecuentes sobre fallos y ayuda

### ¿Cómo informo de un fallo o propongo una mejora?

Abre un issue en el repositorio de GitHub (enlazado desde «Acerca de BPDF»). No adjuntes
documentos con datos personales o confidenciales: describe el caso o crea uno de ejemplo.

### ¿Cómo informo de una vulnerabilidad de seguridad?

En privado, con el aviso de seguridad privado de GitHub del repositorio, nunca en un issue
público. Las instrucciones están en el fichero `SECURITY.md` del repositorio.

> Fuente: documentación oficial de BPDF (R3ZON). Actualizado el 2026-10-04.
> https://docs.r3zon.com/bpdf/faq/preguntas-frecuentes
