import type { ColoresOscuro } from "@/pdf/dark/aplicar";
import type { Rgb } from "@/pdf/dark/color";

/** Lee un token `--rgb-*` de globals.css: los colores del modo oscuro salen de ahí. */
function token(nombre: string, porDefecto: Rgb): Rgb {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  const partes = valor.split(/\s+/).map(Number);
  const valido =
    partes.length === 3 && partes.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  return valido ? (partes as unknown as Rgb) : porDefecto;
}

/** Colores de destino del modo oscuro: la página (`--rgb-page`) y el texto (`--rgb-fg`). */
export const coloresOscuro = (): ColoresOscuro => ({
  pagina: token("--rgb-page", [14, 20, 37]),
  texto: token("--rgb-fg", [236, 236, 236]),
});
