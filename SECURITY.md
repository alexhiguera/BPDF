# Política de seguridad

## Versiones soportadas

BPDF es una aplicación web: solo existe la versión publicada en **https://bpdf.r3zon.com**, que
se corresponde con la rama `main` de este repositorio. Las correcciones de seguridad se publican
ahí; no hay versiones antiguas que mantener ni instaladores que actualizar.

| Versión | Soportada |
|---|---|
| La publicada en `bpdf.r3zon.com` (1.x) | ✅ |
| Cualquier otra (copias propias, *forks*, builds antiguas) | ❌ |

## Cómo informar de una vulnerabilidad

**No abras un issue público**, ni una discusión ni un *pull request* que la describa, para una
vulnerabilidad que pueda aprovecharse.

Usa el **aviso privado de vulnerabilidades de GitHub** de este repositorio: pestaña
**Security** → **Report a vulnerability**. Solo lo ven las personas que mantienen BPDF.

Incluye, si puedes:

- qué ocurre y qué impacto tiene (por ejemplo, ejecución de código, una petición de red
  provocada por un documento, lectura de archivos que no se eligieron);
- los pasos para reproducirlo, el navegador y su versión;
- un documento de prueba **mínimo y creado para la ocasión**, sin datos personales ni
  confidenciales.

Respondemos en cuanto podemos, con el mejor esfuerzo: BPDF lo mantiene un equipo pequeño y no
hay plazos garantizados. Te diremos si confirmamos el problema y cuándo se publica la
corrección; si quieres, te mencionaremos al publicarla.

## Superficie de seguridad

BPDF **procesa documentos que no son de confianza** dentro del navegador. Lo que más importa:

- **Contenido hostil.** Un PDF o un Markdown no debe poder ejecutar código en la app, leer otros
  archivos ni salir de su vista. El Markdown no interpreta HTML; los enlaces y las imágenes
  pasan una política de URLs; los diagramas Mermaid se dibujan en un marco aislado con su propia
  CSP; las fórmulas KaTeX no admiten comandos que inserten HTML o enlaces.
- **Ninguna petición de red provocada por un documento.** Ni imágenes remotas, ni fuentes, ni
  scripts. Una CSP estricta (`default-src 'none'`, sin `unsafe-inline` ni `unsafe-eval` en la
  app) lo refuerza, junto con `Permissions-Policy`, HSTS, COOP/CORP y `Referrer-Policy:
  no-referrer`.
- **Cadena de suministro.** Los motores que procesan contenido no confiable (pdf.js, KaTeX,
  Mermaid, la cadena de Markdown) van con versión exacta; CI ejecuta `npm audit`.

El modelo de amenazas completo y cada control, con sus pruebas, están en
[`docs/SEGURIDAD.md`](docs/SEGURIDAD.md). La última auditoría, en
[`docs/auditoria.md`](docs/auditoria.md).

## Privacidad

- BPDF **procesa los documentos localmente**, en tu navegador. **No los sube** a ningún
  servidor: la web es estática y no tiene backend que los reciba.
- **No hay cuentas, ni sincronización, ni telemetría**, analítica o informes de errores, tampoco
  anónimos.
- En el navegador solo guarda las preferencias y, si lo permites, la página y el zoom de cada
  PDF con una huella del archivo. Nunca nombres de archivo, contenido ni contraseñas.

Un fallo que rompa cualquiera de estas garantías es una vulnerabilidad: infórmalo como tal.

## Fuera de alcance

- Lo que depende de tu navegador o tu sistema (extensiones, un equipo comprometido).
- Cabeceras añadidas por el hosting que no afectan a la seguridad de la app (por ejemplo,
  `Access-Control-Allow-Origin: *` en recursos estáticos públicos; ver
  [`docs/auditoria.md`](docs/auditoria.md)).
- Ataques de denegación de servicio contra el hosting.
