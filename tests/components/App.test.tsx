// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
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
    (_b: Blob, _p: unknown, _r: unknown, _s?: AbortSignal) => new Promise<never>(() => {}),
  ),
}));
vi.mock("@/pdf/engine", async (original) => ({
  ...(await original<typeof import("@/pdf/engine")>()),
  cargarPdfjs: vi.fn(async () => ({})),
  abrirPdf: motor.abrirPdf,
}));

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

  it.each([
    [new PdfNoLegibleError(), messages.pdf.errors.unreadable],
    [new PdfProtegidoError(), messages.pdf.errors.protected],
  ])("si pdf.js no puede abrirlo (%s) lo dice y se puede cerrar", async (error, aviso) => {
    motor.abrirPdf.mockRejectedValueOnce(error);
    montar(new PlataformaEnMemoria().elegira(fichero("roto.pdf", PDF_VALIDO)));
    await abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent(aviso);
    fireEvent.click(screen.getByRole("button", { name: messages.pdf.close }));
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
    fireEvent.click(await screen.findByRole("button", { name: messages.markdown.close }));
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
        dataTransfer: { types: ["Files"], files: [f] },
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
