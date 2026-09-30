// @vitest-environment jsdom

import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { DropZone } from "@/app/DropZone";
import { messages } from "@/i18n/messages";
import { fichero } from "../helpers/documentos";

/**
 * `DataTransfer` mínimo: jsdom no lo implementa. `entrada` hace de
 * `webkitGetAsEntry()` (`null`: como un navegador que no la tiene).
 */
const conFicheros = (files: File[] = [], entrada: (f: File) => unknown = () => null) => ({
  dataTransfer: {
    types: ["Files"],
    files,
    items: files.map((f) => ({ kind: "file", webkitGetAsEntry: () => entrada(f) })),
    dropEffect: "none",
  },
});
const conTexto = {
  dataTransfer: { types: ["text/plain"], files: [], items: [], dropEffect: "none" },
};

function montar() {
  const onFiles = vi.fn();
  render(
    <DropZone onFiles={onFiles}>
      <main>
        <p>contenido</p>
      </main>
    </DropZone>,
  );
  const zona = screen.getByRole("main").parentElement!;
  const hijo = screen.getByText("contenido");
  const aviso = () => screen.queryByText(messages.dropZone.hint);
  return { onFiles, zona, hijo, aviso };
}

describe("DropZone", () => {
  it("en reposo no muestra el aviso", () => {
    const { aviso, zona } = montar();
    expect(aviso()).toBeNull();
    expect(zona).not.toHaveAttribute("data-dragging");
  });

  it("al entrar un arrastre de ficheros muestra el aviso y lo quita al salir", () => {
    const { aviso, zona } = montar();
    fireEvent.dragEnter(zona, conFicheros());
    expect(aviso()).toBeInTheDocument();
    expect(zona).toHaveAttribute("data-dragging", "true");
    fireEvent.dragLeave(zona, conFicheros());
    expect(aviso()).toBeNull();
  });

  it("pasar de la zona a un hijo no apaga el aviso (cuenta entradas y salidas)", () => {
    const { aviso, zona, hijo } = montar();
    fireEvent.dragEnter(zona, conFicheros());
    fireEvent.dragEnter(hijo, conFicheros());
    fireEvent.dragLeave(zona, conFicheros());
    expect(aviso()).toBeInTheDocument();
    fireEvent.dragLeave(hijo, conFicheros());
    expect(aviso()).toBeNull();
  });

  it("permite soltar (dragover cancela lo que haría el navegador) y pide copiar", () => {
    const { zona } = montar();
    const dragOver = createEvent.dragOver(zona, conFicheros());
    fireEvent(zona, dragOver);
    expect(dragOver.defaultPrevented).toBe(true);
    expect((dragOver as DragEvent).dataTransfer?.dropEffect).toBe("copy");
  });

  it("al soltar entrega los ficheros, evita que el navegador los abra y quita el aviso", () => {
    const { onFiles, aviso, zona } = montar();
    const f = fichero("a.pdf", "%PDF-");
    fireEvent.dragEnter(zona, conFicheros([f]));
    const drop = createEvent.drop(zona, conFicheros([f]));
    fireEvent(zona, drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledWith({ ficheros: [f], entradas: [null] });
    expect(aviso()).toBeNull();
  });

  it("captura las entradas de carpeta dentro del propio evento", () => {
    const { onFiles, zona } = montar();
    const f = fichero("carpeta", "");
    const entrada = { isDirectory: true, name: "carpeta" };
    fireEvent.drop(
      zona,
      conFicheros([f], () => entrada),
    );
    expect(onFiles).toHaveBeenCalledWith({ ficheros: [f], entradas: [entrada] });
  });

  it("ignora arrastres que no llevan ficheros (texto, enlaces)", () => {
    const { onFiles, aviso, zona } = montar();
    fireEvent.dragEnter(zona, conTexto);
    expect(aviso()).toBeNull();
    const drop = createEvent.drop(zona, conTexto);
    fireEvent(zona, drop);
    expect(drop.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("no tiene violaciones de accesibilidad, en reposo ni durante el arrastre", async () => {
    const { zona } = montar();
    expect(await axe(zona)).toHaveNoViolations();
    fireEvent.dragEnter(zona, conFicheros());
    expect(await axe(zona)).toHaveNoViolations();
  });
});
