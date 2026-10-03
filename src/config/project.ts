/**
 * Identidad del proyecto: el ÚNICO sitio del código donde vive.
 *
 * El código de la app no escribe nunca el nombre, el dominio o el idioma a
 * mano: los lee de aquí. Los ficheros que no pueden importar TypeScript
 * (`package.json`, `public_docs/_meta/*.json`, `public_docs/index.md`) repiten
 * algunos valores, y `npm run docs:validar` comprueba que coinciden con este
 * fichero (lo importa directamente).
 */
export const project = {
  /**
   * Nombre visible del producto: `<title>`, cabecera de la app, metadatos.
   * Validado contra `entidad.json` (`softwareApplication.name`) y el título de
   * `public_docs/index.md`.
   */
  name: "BPDF",
  /**
   * Identificador corto (minúsculas y guiones). La app no lo lee en runtime:
   * es el nombre que `docs:validar` exige en `package.json` (`name`) y la ruta
   * de la documentación pública (`docs.r3zon.com/<slug>`).
   */
  slug: "bpdf",
  /** Descripción de una frase: metadatos y `entidad.json`. */
  description:
    "Visor de PDF y Markdown para leer en modo oscuro. Los documentos no salen del dispositivo.",
  /**
   * Dominio de la web pública, sin protocolo: URL pública, `entidad.json`,
   * `rutas-app.json`. D5 está confirmada (docs/PLAN.md §14: `bpdf.r3zon.com`), pero el
   * cambio es parte de la Fase 15 (con `robots.txt`, `sitemap.xml` y `public_docs/_meta/`):
   * hasta entonces es `example.com` a propósito, para que se note.
   */
  domain: "app.example.com",
  /** Organización que publica el producto: `entidad.json` (documentación pública). */
  organization: "R3ZON",
  /**
   * Web de la organización: el «Creado por R3ZON» de la app (Fase 11). Se abre con
   * `Platform.openExternal`, como cualquier enlace externo. No es el dominio de BPDF.
   */
  organizationUrl: "https://r3zon.com",
  /**
   * Idioma del producto (BCP 47). Configura `<html lang>` (index.html) y el
   * `inLanguage` de `entidad.json`.
   *
   * NO traduce nada. La interfaz está en español (D2); desde la Fase 2 los
   * textos viven en un único módulo de mensajes para poder añadir otro idioma.
   */
  locale: "es-ES",
} as const;

/** Código de idioma corto para `<html lang>`. */
export const htmlLang = project.locale.split("-")[0] ?? "es";

/**
 * URL pública del sitio. `robots.txt` y `sitemap.xml` se generan en el BUILD,
 * así que queda fijada con el dominio de arriba.
 */
export function siteUrl(): string {
  return `https://${project.domain}`;
}
