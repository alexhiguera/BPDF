# BPDF v1.0.0

BPDF es un visor gratuito y open source de PDF y Markdown que funciona íntegramente en el
navegador. Está pensado para leer, escribir y consultar documentos en modo oscuro sin subirlos
a ningún servidor.

## Qué incluye

- **Visor PDF propio**, con modo oscuro que conserva las imágenes originales, búsqueda,
  miniaturas, zoom, giro, pantalla completa, atajos y apertura de PDF con contraseña.
- **Lector Markdown** con tablas, listas de tareas, notas al pie, índice e imágenes locales.
- **Editor Markdown** con modos Lectura, Edición y Dividido, guardado local y vista previa.
- **Crear Markdown** desde una página vacía preparada para editar y previsualizar.
- **Exportar a PDF** claro u oscuro mediante el diálogo de impresión del navegador.
- **Fórmulas KaTeX** y **diagramas Mermaid**, procesados localmente.
- Una interfaz responsive para escritorio, tablet y móvil, con el documento como prioridad.

## Privacidad

BPDF no tiene cuentas, backend, base de datos, telemetría ni subida de archivos. Los documentos
se procesan en tu dispositivo y no provocan peticiones externas. Solo se guardan localmente las
preferencias y, si lo permites, la posición de lectura de los PDF.

## Limitaciones conocidas principales

- Abre un documento cada vez.
- Un Markdown de alrededor de 1 MB puede tardar unos segundos en aparecer.
- En documentos muy grandes, la vista previa de Dividido puede pausarse mientras escribes; con
  muchas fórmulas también puede responder lentamente.
- El modo oscuro de PDF mantiene las imágenes con sus colores originales.
- La interfaz solo tiene tema oscuro.
- Exportar a PDF depende de las opciones y el nombre elegidos en el diálogo del navegador.

Consulta la lista completa en [Límites conocidos](https://docs.r3zon.com/bpdf/referencia/limites-conocidos).

## Enlaces

- [Abrir BPDF](https://bpdf.r3zon.com)
- [Documentación](https://docs.r3zon.com/bpdf)
- [Código fuente](https://github.com/alexhiguera/BPDF)
- [Novedades de la versión](https://docs.r3zon.com/bpdf/novedades)

BPDF se distribuye con licencia [Apache-2.0](https://github.com/alexhiguera/BPDF/blob/main/LICENSE).
