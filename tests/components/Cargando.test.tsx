// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Cargando } from "@/app/Cargando";
import { messages } from "@/i18n/messages";

describe("Cargando (Fase 11)", () => {
  it("es un estado anunciado (`role=status`) con su texto, sin violaciones de axe", async () => {
    const { container } = render(<Cargando texto={messages.pdf.loading} />);
    expect(screen.getByRole("status")).toHaveTextContent(messages.pdf.loading);
    expect(await axe(container)).toHaveNoViolations();
  });
});
