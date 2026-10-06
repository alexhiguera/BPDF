// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DocumentContextValue,
  DocumentProvider,
  useDocument,
} from "@/documents/DocumentProvider";
import type { OpenedMarkdown } from "@/documents/types";
import type { Platform } from "@/platform";
import {
  BYTES_PNG,
  fichero,
  ficheroLento,
  PDF_VALIDO,
  PlataformaEnMemoria,
  soltado,
} from "../helpers/documentos";

/** Monta el proveedor y devuelve una referencia viva a su valor. */
function montar(platform: Platform) {
  const ref: { actual: DocumentContextValue | null } = { actual: null };
  function Sonda() {
    ref.actual = useDocument();
    return null;
  }
  render(
    <DocumentProvider platform={platform}>
      <Sonda />
    </DocumentProvider>,
  );
  const v = () => ref.actual!;
  return v;
}

afterEach(() => vi.restoreAllMocks());

describe("DocumentProvider: un documento a la vez (D16)", () => {
  it("empieza sin documento ni error", () => {
    const v = montar(new PlataformaEnMemoria());
    expect(v().document).toBeNull();
    expect(v().error).toBeNull();
  });

  it("abre un PDF con el selector", async () => {
    const v = montar(new PlataformaEnMemoria().elegira(fichero("a.pdf", PDF_VALIDO)));
    await act(() => v().openWithPicker());
    expect(v().document).toMatchObject({ kind: "pdf", name: "a.pdf" });
  });

  it("abrir otro documento sustituye al anterior (no se acumulan)", async () => {
    const plataforma = new PlataformaEnMemoria()
      .elegira(fichero("primero.pdf", PDF_VALIDO))
      .elegira(fichero("segundo.md", "# dos"));
    const v = montar(plataforma);
    await act(() => v().openWithPicker());
    const primero = v().document!;
    await act(() => v().openWithPicker());
    expect(v().document).toMatchObject({ kind: "markdown", name: "segundo.md" });
    expect(v().document!.id).not.toBe(primero.id);
    // El estado solo guarda uno: nada en él sigue apuntando al primero.
    expect(Object.values(v())).not.toContain(primero);
  });

  it("cancelar el selector no cambia nada: el documento abierto sigue", async () => {
    const plataforma = new PlataformaEnMemoria().elegira(fichero("a.md", "# a")).elegira(null);
    const v = montar(plataforma);
    await act(() => v().openWithPicker());
    const abierto = v().document;
    await act(() => v().openWithPicker());
    expect(plataforma.selectoresAbiertos).toBe(2);
    expect(v().document).toBe(abierto);
    expect(v().error).toBeNull();
  });

  it("un fichero no válido muestra el error y conserva el documento abierto", async () => {
    const plataforma = new PlataformaEnMemoria()
      .elegira(fichero("bueno.md", "# a"))
      .elegira(fichero("falso.pdf", BYTES_PNG));
    const v = montar(plataforma);
    await act(() => v().openWithPicker());
    await act(() => v().openWithPicker());
    expect(v().document).toMatchObject({ name: "bueno.md" });
    expect(v().error).toMatchObject({ code: "not-pdf", fileName: "falso.pdf" });
  });

  it("abrir un documento válido borra el error anterior, y el error se puede descartar", async () => {
    const plataforma = new PlataformaEnMemoria()
      .elegira(fichero("nota.txt", "x"))
      .elegira(fichero("a.md", "# a"))
      .elegira(fichero("vacio.md"));
    const v = montar(plataforma);
    await act(() => v().openWithPicker());
    expect(v().error?.code).toBe("unsupported");
    await act(() => v().openWithPicker());
    expect(v().error).toBeNull();
    await act(() => v().openWithPicker());
    expect(v().error?.code).toBe("empty");
    act(() => v().dismissError());
    expect(v().error).toBeNull();
    expect(v().document).toMatchObject({ name: "a.md" });
  });
});

describe("DocumentProvider: ficheros soltados", () => {
  it("abre el fichero soltado", async () => {
    const v = montar(new PlataformaEnMemoria());
    await act(() => v().openDropped(soltado(fichero("a.md", "# a"))));
    expect(v().document).toMatchObject({ kind: "markdown", text: "# a" });
  });

  it("rechaza soltar dos Markdown a la vez (un documento cada vez, D16) sin leer ninguno", async () => {
    const plataforma = new PlataformaEnMemoria();
    const a = fichero("a.md", "a");
    const leer = vi.spyOn(a, "arrayBuffer");
    const v = montar(plataforma);
    await act(() => v().openDropped(soltado(a, fichero("b.md", "b"))));
    expect(v().error).toMatchObject({ code: "several-markdown", fileName: undefined });
    expect(leer).not.toHaveBeenCalled();
    expect(v().document).toBeNull();
  });

  it("soltar un Markdown con sus imágenes lo abre con ellas como recursos", async () => {
    const v = montar(new PlataformaEnMemoria());
    await act(() =>
      v().openDropped(soltado(fichero("a.md", "![x](logo.png)"), fichero("logo.png", "png"))),
    );
    expect(v().document?.kind).toBe("markdown");
    const doc = v().document as OpenedMarkdown;
    expect([...doc.resources.ficheros.keys()]).toEqual(["logo.png"]);
  });

  it("soltar una lista vacía no hace nada", async () => {
    const v = montar(new PlataformaEnMemoria());
    await act(() => v().openDropped(soltado()));
    expect(v().document).toBeNull();
    expect(v().error).toBeNull();
  });
});

describe("DocumentProvider: carreras y liberación", () => {
  it("si un documento lento termina después de abrir otro, se descarta el lento", async () => {
    const lento = ficheroLento("lento.md", "# lento");
    const v = montar(new PlataformaEnMemoria());
    let primera: Promise<void> = Promise.resolve();
    act(() => {
      primera = v().openDropped(soltado(lento.file as File));
    });
    await act(() => v().openDropped(soltado(fichero("rapido.md", "# rápido"))));
    expect(v().document).toMatchObject({ name: "rapido.md" });
    lento.liberar();
    await act(() => primera);
    expect(v().document).toMatchObject({ name: "rapido.md" });
  });

  it("cerrar vuelve al estado vacío y descarta una apertura en curso", async () => {
    const lento = ficheroLento("lento.md", "# lento");
    const v = montar(new PlataformaEnMemoria().elegira(fichero("a.pdf", PDF_VALIDO)));
    await act(() => v().openWithPicker());
    let enCurso: Promise<void> = Promise.resolve();
    act(() => {
      enCurso = v().openDropped(soltado(lento.file as File));
    });
    await act(() => v().close());
    expect(v().document).toBeNull();
    lento.liberar();
    await act(() => enCurso);
    expect(v().document).toBeNull();
    expect(v().error).toBeNull();
  });

  it("no crea URL de objeto que haya que revocar", async () => {
    const original = URL.createObjectURL;
    const crearUrl = vi.fn();
    URL.createObjectURL = crearUrl;
    try {
      const plataforma = new PlataformaEnMemoria()
        .elegira(fichero("a.pdf", PDF_VALIDO))
        .elegira(fichero("b.md", "# b"));
      const v = montar(plataforma);
      await act(() => v().openWithPicker());
      await act(() => v().openWithPicker());
      await act(() => v().close());
      expect(crearUrl).not.toHaveBeenCalled();
    } finally {
      URL.createObjectURL = original;
    }
  });

  it("un fallo inesperado de la plataforma se muestra como unreadable y se registra en local", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const rota: Platform = {
      pickDocument: () => Promise.reject(new TypeError("fallo interno")),
      pickFolder: () => Promise.reject(new TypeError("fallo interno")),
      openDropped: () => Promise.reject(new TypeError("fallo interno")),
      openExternal: () => {},
      saveText: () => Promise.reject(new TypeError("fallo interno")),
    };
    const v = montar(rota);
    await act(() => v().openWithPicker());
    expect(v().error?.code).toBe("unreadable");
    expect(consola).toHaveBeenCalledOnce();
  });

  it("useDocument() fuera del proveedor avisa del error de programación", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Suelta() {
      useDocument();
      return null;
    }
    expect(() => render(<Suelta />)).toThrow(/DocumentProvider/);
  });
});

describe("DocumentProvider: cambios sin guardar (Fase 9)", () => {
  /**
   * Abre `a.md` y lo marca como modificado. `despues`: lo que «elegirá» el
   * usuario en las siguientes aperturas (`null` = cancelar).
   */
  async function conCambios(...despues: (File | null)[]) {
    const plataforma = new PlataformaEnMemoria().elegira(fichero("a.md", "# a"));
    for (const f of despues) plataforma.elegira(f);
    const v = montar(plataforma);
    await act(() => v().openWithPicker());
    act(() => v().setModified(true));
    return { v, plataforma };
  }

  /**
   * Empieza una operación que pedirá confirmación y espera, dentro de `act`, a
   * que la pida (la lectura del fichero es asíncrona).
   */
  async function pedir(v: () => DocumentContextValue, operacion: () => Promise<unknown>) {
    let promesa: Promise<unknown> = Promise.resolve();
    await act(async () => {
      promesa = operacion();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(v().pendingDiscard).toBe(true);
    // En un objeto: devolver la promesa tal cual haría que `await pedir()` la esperase.
    return { promesa };
  }

  const responder = (v: () => DocumentContextValue, descartar: boolean, p: Promise<unknown>) =>
    act(async () => {
      v().respondDiscard(descartar);
      await p;
    });

  it("abrir otro empieza limpio y no pide nada si no hay cambios", async () => {
    const v = montar(
      new PlataformaEnMemoria().elegira(fichero("a.md", "# a")).elegira(fichero("b.md", "# b")),
    );
    await act(() => v().openWithPicker());
    expect(v().modified).toBe(false);
    await act(() => v().openWithPicker());
    expect(v().pendingDiscard).toBe(false);
    expect(v().document).toMatchObject({ name: "b.md" });
  });

  it("con cambios, pide confirmar DESPUÉS de elegir: «seguir editando» no toca nada", async () => {
    const { v } = await conCambios(fichero("b.md", "# b"));
    const { promesa: abrir } = await pedir(v, () => v().openWithPicker());
    expect(v().document).toMatchObject({ name: "a.md" });
    await responder(v, false, abrir);
    expect(v().document).toMatchObject({ name: "a.md" });
    expect(v().modified).toBe(true);
    expect(v().pendingDiscard).toBe(false);
  });

  it("«descartar» abre el nuevo, limpio", async () => {
    const { v } = await conCambios(fichero("b.md", "# b"));
    const { promesa: abrir } = await pedir(v, () => v().openWithPicker());
    await responder(v, true, abrir);
    expect(v().document).toMatchObject({ name: "b.md" });
    expect(v().modified).toBe(false);
  });

  it("Crear Markdown (Fase 17): sin documento, abre uno nuevo, vacío y limpio", async () => {
    const v = montar(new PlataformaEnMemoria());
    await act(() => v().createMarkdown());
    expect(v().document).toMatchObject({ kind: "markdown", nuevo: true, text: "" });
    expect(v().modified).toBe(false);
    expect(v().pendingDiscard).toBe(false);
  });

  it("Crear Markdown con cambios sin guardar pide confirmar, como cualquier sustitución", async () => {
    const { v } = await conCambios();
    const { promesa: seguir } = await pedir(v, () => v().createMarkdown());
    await responder(v, false, seguir);
    expect(v().document).toMatchObject({ name: "a.md" });
    expect(v().modified).toBe(true);
    const { promesa: descartar } = await pedir(v, () => v().createMarkdown());
    await responder(v, true, descartar);
    expect(v().document).toMatchObject({ kind: "markdown", nuevo: true });
    expect(v().modified).toBe(false);
  });

  it("cancelar el selector o elegir algo no válido no pregunta ni pierde nada", async () => {
    const { v } = await conCambios(null, fichero("x.txt", "hola"));
    await act(() => v().openWithPicker());
    expect(v().pendingDiscard).toBe(false);
    await act(() => v().openWithPicker());
    expect(v().pendingDiscard).toBe(false);
    expect(v().error?.code).toBe("unsupported");
    expect(v().document).toMatchObject({ name: "a.md" });
    expect(v().modified).toBe(true);
  });

  it("también al soltar, al abrir una carpeta y al elegir el Markdown de una carpeta", async () => {
    const { v, plataforma } = await conCambios();
    plataforma.elegiraCarpeta([
      { ruta: "uno.md", file: fichero("uno.md", "# 1") },
      { ruta: "dos.md", file: fichero("dos.md", "# 2") },
    ]);
    // Soltar: pregunta.
    const { promesa: soltar } = await pedir(v, () =>
      v().openDropped(soltado(fichero("c.md", "# c"))),
    );
    await responder(v, false, soltar);
    expect(v().document).toMatchObject({ name: "a.md" });
    // Carpeta con varios: la elección no sustituye nada, así que no pregunta…
    await act(() => v().openFolder());
    expect(v().choice).not.toBeNull();
    expect(v().pendingDiscard).toBe(false);
    // …elegir uno sí.
    const elegido = v().choice?.candidates[1];
    const { promesa: elegir } = await pedir(v, () => v().choose(1));
    await responder(v, true, elegir);
    expect(v().document).toMatchObject({ name: elegido });
    expect(v().choice).toBeNull();
  });

  it("cerrar con cambios pregunta; «seguir editando» no cierra", async () => {
    const { v } = await conCambios();
    const { promesa: cerrar } = await pedir(v, () => v().close());
    await responder(v, false, cerrar);
    expect(await cerrar).toBe(false);
    expect(v().document).not.toBeNull();
    const { promesa: otra } = await pedir(v, () => v().close());
    await responder(v, true, otra);
    expect(await otra).toBe(true);
    expect(v().document).toBeNull();
    expect(v().modified).toBe(false);
  });

  it("beforeunload solo avisa con cambios", async () => {
    const v = montar(new PlataformaEnMemoria().elegira(fichero("a.md", "# a")));
    await act(() => v().openWithPicker());
    const limpio = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(limpio);
    expect(limpio.defaultPrevented).toBe(false);
    act(() => v().setModified(true));
    const sucio = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(sucio);
    expect(sucio.defaultPrevented).toBe(true);
    act(() => v().setModified(false));
    const otraVez = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(otraVez);
    expect(otraVez.defaultPrevented).toBe(false);
  });

  it("no guarda nada en el almacenamiento", async () => {
    const { v } = await conCambios();
    expect(v().modified).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
