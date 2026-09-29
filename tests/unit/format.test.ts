import { describe, expect, it } from "vitest";
import { formatBytes } from "@/lib/format";

// Intl separa número y unidad con un espacio duro (U+00A0); se normaliza para comparar.
const f = (n: number) => formatBytes(n, "es-ES").replace(/\s/g, " ");

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [850, "850 B"],
    [1024, "1 kB"],
    [1536, "1,5 kB"],
    [1024 * 1024 * 1.25, "1,3 MB"],
    [20 * 1024 * 1024, "20 MB"],
    [512 * 1024 * 1024, "512 MB"],
    [3 * 1024 ** 3, "3 GB"],
  ])("%d bytes → %s", (bytes, texto) => {
    expect(f(bytes)).toBe(texto);
  });
});
