import { project } from "@/config/project";

const UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;

/**
 * Tamaño legible en el idioma del producto («850 B», «1,2 MB»). Múltiplos de
 * 1024, como los muestran los sistemas operativos al listar ficheros. Las
 * unidades las pone `Intl`, así que no hay texto que traducir.
 */
export function formatBytes(bytes: number, locale: string = project.locale): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: UNITS[unit],
    unitDisplay: "short",
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}
