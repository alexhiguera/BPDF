// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { project } from "@/config/project";
import { messages } from "@/i18n/messages";
import { PdfNoLegibleError, PdfProtegidoError } from "@/pdf/engine";
import { BYTES_PNG, fichero, PDF_VALIDO, PlataformaEnMemoria } from "../helpers/documentos";

/**
 * pdf.js no corre en jsdom (sin worker ni lienzo): aquí se sustituye la carga y
 * se prueba lo que hace la app con cada resultado. Por defecto la apertura no
 * termina nunca (el visor se queda «abriendo»). El visor con pdf.js real se
 * prueba en Playwright (e2e/specs/visor-pdf.spec.ts).
 */
const motor = vi.hoisted(() => ({
  abrirPdf: vi.fn(
    (_b: Blob, _p: unknown, _r: unknown, _s?: AbortSignal, _c?: string) =>
      new Promise<never>(() => {}),
  ),
}));
vi.mock("@/pdf/engine", async (original) => ({
  ...(await original<typeof import("@/pdf/engine")>()),
  cargarPdfjs: vi.fn(async () => ({})),
  abrirPdf: motor.abrirPdf,
}));
// El editor de verdad (CodeMirror) necesita medir y pintar: se prueba en Playwright.
vi.mock("@/editor/EditorMarkdown", async () => import("../helpers/editor-falso"));

/**
 * Precarga de los visores que `App` carga con `React.lazy`. El primer
 * `import()` de cada uno obliga a Vitest a transformar todo su árbol de módulos
 * (~330 ms; más de 1 s con la máquina cargada), y los tests lo esperaban con el
 * tiempo por defecto de `findByRole`: fallaban de forma intermitente midiendo
 * el transformador, no la app. Con los módulos ya en caché, `React.lazy` y
 * `Suspense` siguen actuando igual. La carga de los trozos reales de la build
 * se prueba en Playwright.
 */
beforeAll(async () => {
  await import("@/app/pdf/VisorPdf");
  await import("@/markdown/MarkdownView");
  await import("@/preferences/PreferencesDialog");
});

function montar(plataforma = new PlataformaEnMemoria()) {
  const utils = render(<App platform={plataforma} />);
  return { ...utils, plataforma };
}

/** Pulsa «Abrir archivo» y espera a que la apertura termine. */
async function abrir() {
  const [boton] = screen.getAllByRole("button", { name: messages.open.button });
  await act(async () => fireEvent.click(boton!));
}

describe("App: estructura", () => {
  it("pinta la estructura semántica: enlace de salto, cabecera y contenido principal", () => {
    montar();
    expect(screen.getByRole("banner")).toHaveTextContent(project.name);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "contenido");
    expect(screen.getByRole("link", { name: messages.app.skipToContent })).toHaveAttribute(
      "href",
      "#contenido",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
  });

  it("el estado vacío ofrece abrir un archivo, el atajo y la frase de privacidad", () => {
    montar();
    expect(screen.getAllByRole("button", { name: messages.open.button })).toHaveLength(1);
    expect(screen.getByText(messages.open.shortcut)).toBeInTheDocument();
    expect(screen.getByText(messages.emptyState.privacy)).toBeInTheDocument();
  });

  it("no tiene violaciones de accesibilidad en el estado vacío", async () => {
    const { container } = montar();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("App: abrir documentos", () => {
  it("abre un PDF con el botón y monta el visor, que lo carga (sin mostrar sus bytes)", async () => {
    montar(new PlataformaEnMemoria().elegira(fichero("informe.pdf", PDF_VALIDO)));
    await abrir();
    const titulo = await screen.findByRole("heading", { level: 1, name: "informe.pdf" });
    expect(titulo).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(messages.pdf.loading);
    expect(screen.queryByText(/%PDF/)).toBeNull();
    // pdf.js recibe el Blob que entregó la capa de documentos, con una señal para cancelar.
    const [blob, , , senal] = motor.abrirPdf.mock.lastCall ?? [];
    expect(blob).toBeInstanceOf(Blob);
    expect(senal?.aborted).toBe(false);
  });

  it("si pdf.js no puede abrirlo lo dice y se puede cerrar", async () => {
    motor.abrirPdf.mockRejectedValueOnce(new PdfNoLegibleError());
    montar(new PlataformaEnMemoria().elegira(fichero("roto.pdf", PDF_VALIDO)));
    await abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent(messages.pdf.errors.unreadable);
    // Cerrar es asíncrono desde la Fase 9 (puede pedir confirmación).
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: messages.pdf.close })),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
  });

  it("abrir otro documento mientras un PDF carga cancela su apertura", async () => {
    montar(
      new PlataformaEnMemoria()
        .elegira(fichero("lento.pdf", PDF_VALIDO))
        .elegira(fichero("otro.md", "texto o")),
    );
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "lento.pdf" });
    const senal = motor.abrirPdf.mock.lastCall?.[3];
    const enCabecera = within(screen.getByRole("banner"));
    await act(async () =>
      fireEvent.click(enCabecera.getByRole("button", { name: messages.open.button })),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "otro.md" })).toBeInTheDocument();
    expect(senal?.aborted).toBe(true);
  });

  it("abre un Markdown y lo muestra sin interpretar su HTML", async () => {
    const hostil = "# Título\n\n<script>window.__x = 1</script><img src=x onerror=alert(1)>";
    const { container } = montar(new PlataformaEnMemoria().elegira(fichero("notas.md", hostil)));
    await abrir();
    expect(await screen.findByRole("heading", { level: 1, name: "notas.md" })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1, name: "Título" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("<script>window.__x = 1</script>");
    expect(container.querySelector("script, img")).toBeNull();
  });

  it("con un documento abierto, la cabecera ofrece abrir otro, que lo sustituye", async () => {
    montar(
      new PlataformaEnMemoria()
        .elegira(fichero("primero.pdf", PDF_VALIDO))
        .elegira(fichero("segundo.md", "texto 2")),
    );
    await abrir();
    const enCabecera = within(screen.getByRole("banner"));
    await act(async () =>
      fireEvent.click(enCabecera.getByRole("button", { name: messages.open.button })),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "segundo.md" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("primero.pdf")).toBeNull();
  });

  it("cancelar el selector deja la app como estaba", async () => {
    const { plataforma } = montar(new PlataformaEnMemoria().elegira(null));
    await abrir();
    expect(plataforma.selectoresAbiertos).toBe(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Ctrl+O y Cmd+O abren el selector; sin modificador, no", async () => {
    const { plataforma } = montar();
    await act(async () => fireEvent.keyDown(window, { key: "o", ctrlKey: true }));
    await act(async () => fireEvent.keyDown(window, { key: "O", metaKey: true }));
    await act(async () => fireEvent.keyDown(window, { key: "o" }));
    await act(async () => fireEvent.keyDown(window, { key: "o", ctrlKey: true, shiftKey: true }));
    expect(plataforma.selectoresAbiertos).toBe(2);
  });

  it("cerrar el documento vuelve al estado vacío y deja el foco en el contenido", async () => {
    montar(new PlataformaEnMemoria().elegira(fichero("a.md", "texto a")));
    await abrir();
    const cerrar = await screen.findByRole("button", { name: messages.markdown.close });
    await act(async () => fireEvent.click(cerrar));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("un fichero rechazado muestra el aviso y no toca el documento abierto", async () => {
    montar(
      new PlataformaEnMemoria()
        .elegira(fichero("bueno.md", "texto a"))
        .elegira(fichero("falso.pdf", BYTES_PNG)),
    );
    await abrir();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: messages.open.button })),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(messages.documentError.notPdf);
    expect(await screen.findByRole("heading", { level: 1, name: "bueno.md" })).toBeInTheDocument();
  });

  it("abre un fichero soltado en cualquier parte de la ventana", async () => {
    montar();
    const f = fichero("soltado.md", "texto s");
    await act(async () =>
      fireEvent.drop(screen.getByRole("banner"), {
        dataTransfer: {
          types: ["Files"],
          files: [f],
          items: [{ kind: "file", webkitGetAsEntry: () => null }],
        },
      }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "soltado.md" }),
    ).toBeInTheDocument();
  });
});

describe("App: nombres de fichero hostiles", () => {
  const NOMBRES = [
    `<img src=x onerror="alert(1)">.md`,
    `"><svg onload=alert(1)><script>alert(1)<\\script>.pdf`,
    `comillas "dobles" y 'simples'.md`,
    `año ñandú 日本語 🙂 emoji.md`,
    `   espacios   por   todas partes   .md`,
  ];

  it.each(NOMBRES)("muestra «%s» como texto y nunca como HTML", async (nombre) => {
    const contenido = nombre.endsWith(".pdf") ? PDF_VALIDO : "texto x";
    const { container } = montar(new PlataformaEnMemoria().elegira(fichero(nombre, contenido)));
    await abrir();
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(nombre.trim());
    // Los únicos SVG permitidos son los iconos de BPDF (lucide).
    expect(container.querySelector("main img, main script, main svg:not(.lucide)")).toBeNull();
  });

  it("también en el aviso de error", async () => {
    const nombre = `<b onmouseover="alert(1)">negrita<b>.txt`;
    const { container } = montar(new PlataformaEnMemoria().elegira(fichero(nombre, "x")));
    await abrir();
    expect(screen.getByRole("alert")).toHaveTextContent(messages.documentError.title(nombre));
    expect(container.querySelector("b")).toBeNull();
  });
});

describe("App: accesibilidad con documento y con error", () => {
  it("sin violaciones con un documento abierto y un aviso de error a la vez", async () => {
    const { container } = montar(
      new PlataformaEnMemoria()
        .elegira(fichero("a.pdf", PDF_VALIDO))
        .elegira(fichero("b.txt", "x")),
    );
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "a.pdf" });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: messages.open.button })),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("App: PDF con contraseña (Fase 6, D13)", () => {
  const p = messages.pdf.password;

  /** Abre un PDF cuya primera apertura pide contraseña; las siguientes no terminan. */
  async function abrirProtegido() {
    motor.abrirPdf.mockRejectedValueOnce(new PdfProtegidoError("necesita"));
    const utils = montar(new PlataformaEnMemoria().elegira(fichero("secreto.pdf", PDF_VALIDO)));
    await abrir();
    const dialogo = await screen.findByRole("dialog", { name: p.title });
    const campo = within(dialogo).getByLabelText(p.label);
    return { ...utils, dialogo, campo };
  }

  const enviar = async (campo: HTMLElement, valor: string) => {
    fireEvent.change(campo, { target: { value: valor } });
    await act(async () => fireEvent.submit(campo.closest("form") as HTMLFormElement));
  };

  it("pide la contraseña en un diálogo accesible, con el foco en el campo", async () => {
    const { container, dialogo, campo } = await abrirProtegido();
    expect(dialogo).toHaveAttribute("open");
    expect(campo).toHaveAttribute("type", "password");
    expect(campo).toHaveAttribute("autocomplete", "off");
    expect(campo).toHaveFocus();
    expect(within(dialogo).getByRole("button", { name: p.open })).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("con la contraseña, vuelve a abrir el PDF con ella y vacía el campo", async () => {
    const { campo } = await abrirProtegido();
    await enviar(campo, "bpdf");
    const [blob, , , senal, contrasena] = motor.abrirPdf.mock.lastCall ?? [];
    expect(blob).toBeInstanceOf(Blob);
    expect(senal?.aborted).toBe(false);
    expect(contrasena).toBe("bpdf");
    expect(campo).toHaveValue("");
    expect(screen.getByRole("button", { name: p.checking })).toBeDisabled();
  });

  it("incorrecta: aviso asociado al campo, campo vacío con el foco, y se puede reintentar", async () => {
    const { container, campo } = await abrirProtegido();
    motor.abrirPdf.mockRejectedValueOnce(new PdfProtegidoError("incorrecta"));
    await enviar(campo, "mala");
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(p.wrong);
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo.getAttribute("aria-describedby")).toBe(aviso.id);
    expect(campo).toHaveValue("");
    expect(campo).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
    // Otra incorrecta (sin límite de intentos) y después la buena.
    motor.abrirPdf.mockRejectedValueOnce(new PdfProtegidoError("necesita"));
    await enviar(campo, "otra");
    expect(await screen.findByRole("alert")).toHaveTextContent(p.wrong);
    await enviar(campo, "bpdf");
    expect(motor.abrirPdf.mock.lastCall?.[4]).toBe("bpdf");
  });

  it("Cancelar cierra el documento", async () => {
    const { dialogo } = await abrirProtegido();
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: p.cancel })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
  });

  it("Esc (evento cancel del diálogo) también cierra el documento", async () => {
    const { dialogo } = await abrirProtegido();
    await act(async () => fireEvent(dialogo, new Event("cancel", { cancelable: true })));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
  });

  it("abrir otro documento mientras se comprueba la contraseña lo cancela", async () => {
    motor.abrirPdf.mockRejectedValueOnce(new PdfProtegidoError("necesita"));
    montar(
      new PlataformaEnMemoria()
        .elegira(fichero("secreto.pdf", PDF_VALIDO))
        .elegira(fichero("otro.md", "texto")),
    );
    await abrir();
    const campo = within(await screen.findByRole("dialog")).getByLabelText(p.label);
    await enviar(campo, "bpdf");
    const senal = motor.abrirPdf.mock.lastCall?.[3];
    await act(async () =>
      fireEvent.click(
        within(screen.getByRole("banner")).getByRole("button", { name: messages.open.button }),
      ),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "otro.md" })).toBeInTheDocument();
    expect(senal?.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("la contraseña no se guarda: ni en el almacenamiento ni en el DOM", async () => {
    const { container, campo } = await abrirProtegido();
    motor.abrirPdf.mockRejectedValueOnce(new PdfProtegidoError("incorrecta"));
    await enviar(campo, "muy-secreta-42");
    await screen.findByRole("alert");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(new XMLSerializer().serializeToString(container)).not.toContain("muy-secreta-42");
  });
});

describe("ErrorBoundary", () => {
  it("sustituye un render que falla por un aviso con reintento, y reintentar lo recupera", async () => {
    // React registra el error en consola; aquí es esperado.
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    let falla = true;
    function Fragil() {
      if (falla) throw new Error("fallo de prueba");
      return <p>recuperado</p>;
    }

    render(
      <ErrorBoundary>
        <Fragil />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: messages.error.title })).toBeInTheDocument();

    falla = false;
    fireEvent.click(screen.getByRole("button", { name: messages.error.retry }));
    expect(screen.getByText("recuperado")).toBeInTheDocument();
    consola.mockRestore();
  });
});

describe("App: Markdown con recursos y carpetas (Fase 7 bis)", () => {
  const carpeta = (entradas: Record<string, string>) =>
    Object.entries(entradas).map(([ruta, contenido]) => ({
      ruta,
      file: fichero(ruta.slice(ruta.lastIndexOf("/") + 1), contenido),
    }));

  it("el estado vacío ofrece abrir archivo y abrir carpeta, y explica cómo ver las imágenes", () => {
    montar();
    expect(screen.getByRole("button", { name: messages.open.button })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: messages.open.folder })).toBeInTheDocument();
    expect(screen.getByText(messages.emptyState.resources)).toBeInTheDocument();
  });

  it("una carpeta con varios Markdown pide elegir; elegir abre ese", async () => {
    const plataforma = new PlataformaEnMemoria().elegiraCarpeta(
      carpeta({ "README.md": "texto readme", "docs/guia.md": "texto guía", "i.png": "x" }),
    );
    const { container } = montar(plataforma);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: messages.open.folder })),
    );
    const t = messages.chooseMarkdown;
    const titulo = screen.getByRole("heading", { name: t.title });
    expect(titulo).toHaveFocus();
    expect(screen.queryByRole("button", { name: messages.open.button })).toBeNull();
    const lista = screen.getByRole("list", { name: t.list });
    expect(
      within(lista)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["README.md", "docs/guia.md"]);
    expect(await axe(container)).toHaveNoViolations();
    await act(async () =>
      fireEvent.click(within(lista).getByRole("button", { name: "docs/guia.md" })),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "guia.md" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: t.title })).toBeNull();
  });

  it("cancelar la elección deja el documento abierto como estaba", async () => {
    const plataforma = new PlataformaEnMemoria()
      .elegira(fichero("abierto.md", "texto"))
      .elegiraCarpeta(carpeta({ "a.md": "a", "b.md": "b" }));
    montar(plataforma);
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "abierto.md" });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: messages.open.folder })),
    );
    fireEvent.click(screen.getByRole("button", { name: messages.chooseMarkdown.cancel }));
    expect(screen.queryByRole("heading", { name: messages.chooseMarkdown.title })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })[0]).toHaveTextContent("abierto.md");
  });

  it("elegir varios Markdown a la vez da un error claro y no abre ninguno", async () => {
    montar(new PlataformaEnMemoria().elegira([fichero("a.md", "a"), fichero("b.md", "b")]));
    await abrir();
    expect(screen.getByRole("alert")).toHaveTextContent(messages.documentError.severalMarkdown);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
  });
});

describe("App: editar un Markdown (Fase 9)", () => {
  const e = messages.markdown;
  const d = messages.discard;

  /** Abre `uno.md`, entra en edición y lo cambia. `despues`: lo que se elegirá luego. */
  async function editarUno(...despues: File[]) {
    const plataforma = new PlataformaEnMemoria().elegira(fichero("uno.md", "# Uno"));
    for (const f of despues) plataforma.elegira(f);
    const utils = montar(plataforma);
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "uno.md" });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: e.mode.edicion })));
    const editor = await screen.findByRole("textbox", { name: e.editor.label });
    act(() => {
      fireEvent.change(editor, { target: { value: "# Uno cambiado" } });
    });
    return { ...utils, plataforma };
  }

  const abrirDesdeCabecera = () =>
    act(async () =>
      fireEvent.click(
        within(screen.getByRole("banner")).getByRole("button", { name: messages.open.button }),
      ),
    );

  it("con cambios, abrir otro pregunta; «Seguir editando» los conserva", async () => {
    const { container } = await editarUno(fichero("dos.md", "# Dos"));
    await abrirDesdeCabecera();
    const dialogo = await screen.findByRole("dialog", { name: d.title });
    expect(within(dialogo).getByRole("button", { name: d.cancel })).toHaveFocus();
    expect(dialogo).toHaveTextContent("uno.md");
    expect(await axe(container)).toHaveNoViolations();
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: d.cancel })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "uno.md" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: e.editor.label })).toHaveValue("# Uno cambiado");
  });

  it("«Descartar los cambios» abre el nuevo, limpio", async () => {
    await editarUno(fichero("dos.md", "# Dos"));
    await abrirDesdeCabecera();
    const dialogo = await screen.findByRole("dialog", { name: d.title });
    await act(async () =>
      fireEvent.click(within(dialogo).getByRole("button", { name: d.confirm })),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "dos.md" })).toBeInTheDocument();
    expect(screen.queryByText(e.modified)).toBeNull();
  });

  it("Esc en el diálogo es «seguir editando»", async () => {
    await editarUno(fichero("dos.md", "# Dos"));
    await abrirDesdeCabecera();
    const dialogo = await screen.findByRole("dialog", { name: d.title });
    await act(async () => fireEvent(dialogo, new Event("cancel", { cancelable: true })));
    expect(screen.getByRole("heading", { level: 1, name: "uno.md" })).toBeInTheDocument();
  });

  it("cerrar con cambios pregunta antes", async () => {
    await editarUno();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: e.close })));
    expect(await screen.findByRole("dialog", { name: d.title })).toBeInTheDocument();
  });

  it("Ctrl+S guarda por la plataforma, con el texto editado y el documento", async () => {
    const { plataforma } = await editarUno();
    await act(async () => fireEvent.keyDown(window, { key: "s", ctrlKey: true }));
    expect(plataforma.guardados).toHaveLength(1);
    expect(plataforma.guardados[0]?.texto).toBe("# Uno cambiado");
    expect(plataforma.guardados[0]?.documento.name).toBe("uno.md");
    expect(screen.queryByText(e.modified)).toBeNull();
    // Ya guardado: abrir otro no pregunta.
    plataforma.elegira(fichero("dos.md", "# Dos"));
    await abrirDesdeCabecera();
    expect(await screen.findByRole("heading", { level: 1, name: "dos.md" })).toBeInTheDocument();
  });

  it("si guardar falla, se avisa y abrir otro sigue preguntando", async () => {
    const { plataforma } = await editarUno();
    plataforma.guardara(new Error("sin permiso"));
    await act(async () => fireEvent.keyDown(window, { key: "s", ctrlKey: true }));
    expect(screen.getByRole("alert")).toHaveTextContent(e.saveFailed);
    plataforma.elegira(fichero("dos.md", "# Dos"));
    await abrirDesdeCabecera();
    expect(await screen.findByRole("dialog", { name: d.title })).toBeInTheDocument();
  });

  it("un PDF no ofrece guardar ni modos de edición", async () => {
    montar(new PlataformaEnMemoria().elegira(fichero("a.pdf", PDF_VALIDO)));
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "a.pdf" });
    expect(screen.queryByRole("button", { name: e.save })).toBeNull();
    expect(screen.queryByRole("button", { name: e.mode.edicion })).toBeNull();
  });
});

describe("App: preferencias (Fase 10)", () => {
  const p = messages.preferences;

  it("el botón «Preferencias» está en la cabecera sin documento abierto, abre el diálogo y el foco vuelve", async () => {
    montar();
    const boton = within(screen.getByRole("banner")).getByRole("button", { name: p.open });
    expect(boton).toHaveAttribute("aria-haspopup", "dialog");
    boton.focus();
    await act(async () => fireEvent.click(boton));
    const dialogo = await screen.findByRole("dialog", { name: p.title });
    fireEvent.click(within(dialogo).getByRole("button", { name: p.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(boton).toHaveFocus();
  });

  it("también con un documento abierto", async () => {
    montar(new PlataformaEnMemoria().elegira(fichero("notas.md", "# Notas")));
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "notas.md" });
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("button", { name: p.open })).toBeInTheDocument();
    expect(within(banner).getByRole("button", { name: messages.open.button })).toBeInTheDocument();
  });

  it("abrir un Markdown no guarda nada: ni posición, ni huella, ni nombre", async () => {
    montar(
      new PlataformaEnMemoria().elegira(fichero("diario-secreto.md", "# Hola\n\nTexto privado")),
    );
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "diario-secreto.md" });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("la tipografía de Markdown elegida se aplica al documento abierto, al momento", async () => {
    montar(new PlataformaEnMemoria().elegira(fichero("notas.md", "# Notas")));
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "notas.md" });
    const contenido = document.querySelector<HTMLElement>(".md-contenido");
    expect(contenido).toHaveAttribute("data-letra", "17");
    expect(contenido).toHaveAttribute("data-ancho", "normal");
    expect(contenido).not.toHaveAttribute("style");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: p.open })));
    const dialogo = await screen.findByRole("dialog", { name: p.title });
    fireEvent.change(within(dialogo).getByRole("combobox", { name: p.fontSize }), {
      target: { value: "22" },
    });
    fireEvent.change(within(dialogo).getByRole("combobox", { name: p.width }), {
      target: { value: "estrecho" },
    });
    expect(contenido).toHaveAttribute("data-letra", "22");
    expect(contenido).toHaveAttribute("data-ancho", "estrecho");
    expect(localStorage.getItem("bpdf:prefs")).not.toContain("notas");
  });
});

describe("App: interfaz (Fase 11)", () => {
  it("los dos botones «Abrir archivo» anuncian Ctrl/⌘+O, sin cambiar su nombre", async () => {
    montar(new PlataformaEnMemoria().elegira(fichero("notas.md", "# Notas")));
    const vacio = screen.getByRole("button", { name: messages.open.button });
    expect(vacio).toHaveAttribute("aria-keyshortcuts", "Control+O Meta+O");
    expect(vacio).toHaveAttribute(
      "title",
      messages.withShortcut(messages.open.button, messages.keys.abrir),
    );
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "notas.md" });
    const cabecera = within(screen.getByRole("banner")).getByRole("button", {
      name: messages.open.button,
    });
    expect(cabecera).toHaveAttribute("aria-keyshortcuts", "Control+O Meta+O");
  });

  it("el título de la ventana no cambia al abrir un documento: nunca lleva su nombre", async () => {
    document.title = project.name;
    montar(new PlataformaEnMemoria().elegira(fichero("zq-secreto-4471.md", "# Hola")));
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "zq-secreto-4471.md" });
    expect(document.title).toBe(project.name);
  });
});

describe("App: mención a R3ZON (Fase 11)", () => {
  it("sin documento se ve al pie y abre r3zon.com por la plataforma; con documento no ocupa sitio", async () => {
    const plataforma = new PlataformaEnMemoria().elegira(fichero("notas.md", "# Notas"));
    montar(plataforma);
    const enlace = within(screen.getByRole("contentinfo")).getByRole("link", {
      name: project.organization,
    });
    fireEvent.click(enlace);
    expect(plataforma.externas).toEqual(["https://r3zon.com"]);
    await abrir();
    await screen.findByRole("heading", { level: 1, name: "notas.md" });
    expect(screen.queryByRole("link", { name: project.organization })).toBeNull();
  });
});
