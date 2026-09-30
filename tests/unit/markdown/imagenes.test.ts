import { describe, expect, it, vi } from "vitest";
import type { RecursoLocal } from "@/documents/types";
import { AlmacenUrls } from "@/markdown/imagenes";

const recurso = (ruta: string): RecursoLocal => ({
  ruta,
  tipo: "png",
  size: 1,
  blob: new Blob(["x"], { type: "image/png" }),
});

function almacen() {
  let n = 0;
  const crear = vi.fn((_b: Blob) => `blob:bpdf/${++n}`);
  const revocar = vi.fn((_u: string) => {});
  return { a: new AlmacenUrls(crear, revocar), crear, revocar };
}

describe("AlmacenUrls: el ciclo de vida de las URL blob: de un documento", () => {
  it("crea la URL al primer uso, con el Blob del recurso", () => {
    const { a, crear } = almacen();
    const r = recurso("a.png");
    expect(a.adquirir(r)).toBe("blob:bpdf/1");
    expect(crear).toHaveBeenCalledWith(r.blob);
    expect(a.tamano).toBe(1);
  });

  it("reutiliza la misma URL para el mismo recurso y solo revoca con el último uso", () => {
    const { a, crear, revocar } = almacen();
    const r = recurso("a.png");
    expect(a.adquirir(r)).toBe(a.adquirir(r));
    expect(crear).toHaveBeenCalledOnce();
    a.liberar(r);
    expect(revocar).not.toHaveBeenCalled();
    a.liberar(r);
    expect(revocar).toHaveBeenCalledWith("blob:bpdf/1");
    expect(a.tamano).toBe(0);
  });

  it("una URL por recurso distinto", () => {
    const { a } = almacen();
    expect(a.adquirir(recurso("a.png"))).not.toBe(a.adquirir(recurso("b.png")));
    expect(a.tamano).toBe(2);
  });

  it("liberar algo que no se adquirió no hace nada", () => {
    const { a, revocar } = almacen();
    a.liberar(recurso("a.png"));
    expect(revocar).not.toHaveBeenCalled();
  });

  it("revocarTodo (desmontar el visor) revoca todo lo vivo y deja el almacén vacío", () => {
    const { a, revocar } = almacen();
    const r = recurso("a.png");
    a.adquirir(r);
    a.adquirir(r);
    a.adquirir(recurso("b.png"));
    a.revocarTodo();
    expect(revocar.mock.calls.map(([u]) => u).sort()).toEqual(["blob:bpdf/1", "blob:bpdf/2"]);
    expect(a.tamano).toBe(0);
    // Después, un uso nuevo crea una URL nueva (no devuelve una revocada).
    expect(a.adquirir(r)).toBe("blob:bpdf/3");
  });
});
