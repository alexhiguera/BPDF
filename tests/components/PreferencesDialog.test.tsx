// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { project } from "@/config/project";
import { messages } from "@/i18n/messages";
import PreferencesDialog from "@/preferences/PreferencesDialog";
import { preferenciasPorDefecto } from "@/preferences/schema";
import { cambiarPreferencias } from "@/preferences/store";

const t = messages.preferences;
const prefs = () => JSON.parse(localStorage.getItem("bpdf:prefs") ?? "null");

function montar() {
  const onCerrar = vi.fn();
  const utils = render(<PreferencesDialog onCerrar={onCerrar} />);
  const dialogo = screen.getByRole("dialog", { name: t.title });
  return { ...utils, onCerrar, dialogo };
}

describe("PreferencesDialog (Fase 10)", () => {
  it("es un diálogo con nombre, descripción y controles etiquetados, sin violaciones de axe", async () => {
    const { container, dialogo } = montar();
    expect(dialogo).toHaveAccessibleDescription(t.intro);
    for (const nombre of [t.mode, t.zoom, t.view, t.fontSize, t.width]) {
      expect(within(dialogo).getByRole("combobox", { name: nombre })).toBeInTheDocument();
    }
    expect(within(dialogo).getByRole("checkbox", { name: t.singleKey })).toBeChecked();
    expect(within(dialogo).getByRole("checkbox", { name: t.remember })).toBeChecked();
    expect(within(dialogo).getByRole("checkbox", { name: t.remember })).toHaveAccessibleDescription(
      t.rememberHint,
    );
    for (const grupo of [t.pdf, t.markdown, t.keyboard, t.position]) {
      expect(within(dialogo).getByRole("group", { name: grupo })).toBeInTheDocument();
    }
    expect(await axe(container)).toHaveNoViolations();
  });

  it("muestra los valores por defecto (17 px y 72 caracteres) y abrirlo no escribe nada", () => {
    const { dialogo } = montar();
    expect(within(dialogo).getByRole("combobox", { name: t.fontSize })).toHaveValue("17");
    expect(within(dialogo).getByRole("combobox", { name: t.width })).toHaveValue("normal");
    expect(within(dialogo).getByRole("combobox", { name: t.zoom })).toHaveValue("ancho");
    expect(within(dialogo).getByRole("option", { name: t.fontSizeValue(22) })).toBeInTheDocument();
    expect(within(dialogo).getAllByRole("option", { name: /caracteres/ })).toHaveLength(3);
    expect(localStorage.length).toBe(0);
  });

  it("cada cambio se guarda al momento en `bpdf:prefs`", () => {
    const { dialogo } = montar();
    const elegir = (nombre: string, valor: string) =>
      fireEvent.change(within(dialogo).getByRole("combobox", { name: nombre }), {
        target: { value: valor },
      });
    elegir(t.mode, "original");
    elegir(t.zoom, "fijo:1.5");
    elegir(t.view, "pagina");
    elegir(t.fontSize, "20");
    elegir(t.width, "ancho");
    fireEvent.click(within(dialogo).getByRole("checkbox", { name: t.singleKey }));
    fireEvent.click(within(dialogo).getByRole("checkbox", { name: t.remember }));
    expect(prefs()).toEqual({
      v: 1,
      pdf: {
        modo: "original",
        zoom: { tipo: "fijo", valor: 1.5 },
        vista: "pagina",
        miniaturas: false,
      },
      markdown: { tamanoLetra: 20, ancho: "ancho" },
      atajosUnaTecla: false,
      recordarPosicion: false,
    });
    expect(Object.keys(localStorage)).toEqual(["bpdf:prefs"]);
  });

  it("un zoom guardado que no es uno de los pasos sale igualmente en la lista", () => {
    cambiarPreferencias((p) => ({ ...p, pdf: { ...p.pdf, zoom: { tipo: "fijo", valor: 0.3 } } }));
    const { dialogo } = montar();
    expect(within(dialogo).getByRole("combobox", { name: t.zoom })).toHaveValue("fijo:0.3");
    expect(within(dialogo).getByRole("option", { name: t.zoomFixed(30) })).toBeInTheDocument();
  });

  it("«Olvidar posiciones guardadas» borra `bpdf:positions`, no las preferencias, y lo anuncia", () => {
    localStorage.setItem("bpdf:positions", '{"v":1,"docs":{}}');
    cambiarPreferencias((p) => ({ ...p, atajosUnaTecla: false }));
    const { dialogo } = montar();
    fireEvent.click(within(dialogo).getByRole("button", { name: t.forget }));
    expect(localStorage.getItem("bpdf:positions")).toBeNull();
    expect(prefs().atajosUnaTecla).toBe(false);
    expect(within(dialogo).getByRole("status")).toHaveTextContent(t.forgotten);
  });

  it("«Restablecer preferencias» borra `bpdf:prefs`, deja las posiciones y vuelve a los valores por defecto", () => {
    localStorage.setItem("bpdf:positions", '{"v":1,"docs":{}}');
    cambiarPreferencias((p) => ({ ...p, markdown: { tamanoLetra: 22, ancho: "estrecho" } }));
    const { dialogo } = montar();
    expect(within(dialogo).getByRole("combobox", { name: t.fontSize })).toHaveValue("22");
    fireEvent.click(within(dialogo).getByRole("button", { name: t.reset }));
    expect(localStorage.getItem("bpdf:prefs")).toBeNull();
    expect(localStorage.getItem("bpdf:positions")).toBe('{"v":1,"docs":{}}');
    expect(within(dialogo).getByRole("combobox", { name: t.fontSize })).toHaveValue("17");
    expect(within(dialogo).getByRole("status")).toHaveTextContent(t.resetDone);
  });

  it("refleja al momento un cambio hecho en otra pestaña", () => {
    const { dialogo } = montar();
    localStorage.setItem(
      "bpdf:prefs",
      JSON.stringify({
        ...preferenciasPorDefecto(),
        markdown: { tamanoLetra: 15, ancho: "normal" },
      }),
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "bpdf:prefs", storageArea: localStorage }),
      );
    });
    expect(within(dialogo).getByRole("combobox", { name: t.fontSize })).toHaveValue("15");
  });

  it("su botón lo cierra", () => {
    const { dialogo, onCerrar } = montar();
    fireEvent.click(within(dialogo).getByRole("button", { name: t.close }));
    expect(onCerrar).toHaveBeenCalled();
  });
});

describe("PreferencesDialog: «Acerca de» (Fase 11)", () => {
  it("muestra la versión y la licencia de package.json y la frase de privacidad, sin enlaces", async () => {
    const paquete = JSON.parse(readFileSync("package.json", "utf8")) as {
      version: string;
      license: string;
    };
    const { container, dialogo } = montar();
    const acerca = within(dialogo).getByRole("region", { name: t.about.title(project.name) });
    expect(acerca).toHaveTextContent(t.about.version(paquete.version));
    expect(acerca).toHaveTextContent(t.about.license(paquete.license));
    expect(acerca).toHaveTextContent(messages.emptyState.privacy);
    expect(within(acerca).queryAllByRole("link")).toHaveLength(0);
    expect(within(acerca).getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
