import { describe, expect, it } from "vitest";
import { crearMarkdown } from "@/documents/nuevo";
import { SIN_RECURSOS } from "@/documents/types";
import { messages } from "@/i18n/messages";

describe("crearMarkdown (Fase 17)", () => {
  it("un Markdown vacío, marcado como nuevo, sin recursos y con «Sin título» solo para mostrar", () => {
    const doc = crearMarkdown();
    expect(doc).toMatchObject({
      kind: "markdown",
      text: "",
      size: 0,
      nuevo: true,
      name: messages.document.newUntitled,
    });
    expect(doc.resources).toBe(SIN_RECURSOS);
  });

  it("cada uno tiene su propio id opaco: el nombre no es su identidad", () => {
    const a = crearMarkdown();
    const b = crearMarkdown();
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe(b.name);
    expect(a.id).not.toContain(a.name);
  });
});
