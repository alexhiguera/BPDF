// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { Creditos } from "@/app/Creditos";
import { project } from "@/config/project";
import { messages } from "@/i18n/messages";

const t = messages.credits;

describe("Creditos (Fase 11)", () => {
  it("menciona BPDF, gratis y open source, y a R3ZON, sin violaciones de axe", async () => {
    const { container } = render(<Creditos onOpenExternal={() => {}} />);
    const pie = screen.getByRole("contentinfo");
    expect(pie).toHaveTextContent(
      `${project.name}·${t.free}·${t.createdBy}${project.organization}${t.withLove}`,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("R3ZON enlaza solo a https://r3zon.com, y el clic va al mecanismo externo de la plataforma", () => {
    const onOpenExternal = vi.fn();
    render(<Creditos onOpenExternal={onOpenExternal} />);
    const enlace = screen.getByRole("link", { name: project.organization });
    expect(project.organizationUrl).toBe("https://r3zon.com");
    expect(enlace).toHaveAttribute("href", "https://r3zon.com");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    // El clic no navega (se cancela) y lo abre la plataforma, que revalida la URL.
    expect(fireEvent.click(enlace)).toBe(false);
    expect(onOpenExternal).toHaveBeenCalledExactlyOnceWith("https://r3zon.com");
    // El clic central se anula: abriría la URL fuera de ese mecanismo.
    expect(
      fireEvent(enlace, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 })),
    ).toBe(false);
    expect(onOpenExternal).toHaveBeenCalledTimes(1);
    // Ningún otro enlace (tampoco al repositorio: Fase 16).
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
