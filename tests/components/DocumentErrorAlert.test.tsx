// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { DocumentErrorAlert } from "@/app/DocumentErrorAlert";
import { DocumentError, type DocumentErrorCode } from "@/documents/errors";
import { messages } from "@/i18n/messages";

const t = messages.documentError;

// Cada código con el texto que debe verse: ninguno se queda sin mensaje.
const CASOS: [DocumentErrorCode, string][] = [
  ["unsupported", t.unsupported],
  ["no-markdown", t.noMarkdown],
  ["several-markdown", t.severalMarkdown],
  ["incompatible", t.incompatible],
  ["folder-no-markdown", t.folderNoMarkdown],
  ["folder-too-large", t.folderTooLarge("10.000")],
  ["mixed-drop", t.mixedDrop],
  ["empty", t.empty],
  ["not-pdf", t.notPdf],
  ["not-utf8", t.notUtf8],
  ["unreadable", t.unreadable],
];

describe("DocumentErrorAlert", () => {
  it.each(CASOS)("%s tiene su mensaje y se anuncia como alerta", (code, texto) => {
    render(<DocumentErrorAlert error={new DocumentError(code)} onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(texto);
    expect(screen.getByRole("alert")).toHaveTextContent(t.titleNoFile);
  });

  it.each([
    ["pdf", "512 MB"],
    ["markdown", "20 MB"],
  ] as const)("too-large dice el límite de su tipo (%s: %s)", (kind, limite) => {
    render(
      <DocumentErrorAlert
        error={new DocumentError("too-large", { kind, fileName: "x" })}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent?.replace(/\s/g, " ")).toContain(limite);
  });

  it("muestra el nombre del fichero como texto, aunque parezca HTML", () => {
    const nombre = `<img src=x onerror="alert(1)"> & "comillas" 'año' 🙂.pdf`;
    const { container } = render(
      <DocumentErrorAlert
        error={new DocumentError("not-pdf", { fileName: nombre })}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(t.title(nombre));
    expect(container.querySelector("img")).toBeNull();
  });

  it("se puede descartar con su botón", () => {
    const onDismiss = vi.fn();
    render(<DocumentErrorAlert error={new DocumentError("empty")} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: t.dismiss }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { container } = render(
      <DocumentErrorAlert
        error={new DocumentError("unsupported", { fileName: "nota.txt" })}
        onDismiss={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
