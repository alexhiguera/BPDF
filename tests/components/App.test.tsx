// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { project } from "@/config/project";
import { messages } from "@/i18n/messages";

describe("App", () => {
  it("pinta la estructura semántica: enlace de salto, cabecera y contenido principal", () => {
    render(<App />);
    expect(screen.getByRole("banner")).toHaveTextContent(project.name);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "contenido");
    expect(screen.getByRole("link", { name: messages.app.skipToContent })).toHaveAttribute(
      "href",
      "#contenido",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages.emptyState.title);
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { container } = render(<App />);
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
