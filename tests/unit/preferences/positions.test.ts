// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  guardarPosicion,
  marcarUso,
  olvidarPosiciones,
  recortar,
  recuperarPosicion,
} from "@/preferences/positions";
import { CLAVE_POSICIONES, MAX_POSICIONES, type Posicion } from "@/preferences/schema";

/** Posición por PDF (Fase 10, D8): `bpdf:positions`. */

const ANCHO = { tipo: "ancho" } as const;
const huella = (n: number) => n.toString(16).padStart(32, "0");
const registro = () => JSON.parse(localStorage.getItem(CLAVE_POSICIONES) ?? "null");

describe("posiciones de PDF", () => {
  it("sin nada guardado: ninguna, y leer no escribe", () => {
    expect(recuperarPosicion(huella(1))).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("guarda `{ v: 1, docs: { huella: { page, zoom, t } } }` y la recupera", () => {
    guardarPosicion(huella(1), { page: 7, zoom: { tipo: "fijo", valor: 1.5 } }, 100);
    expect(registro()).toEqual({
      v: 1,
      docs: { [huella(1)]: { page: 7, zoom: { tipo: "fijo", valor: 1.5 }, t: 100 } },
    });
    expect(recuperarPosicion(huella(1))).toEqual({
      page: 7,
      zoom: { tipo: "fijo", valor: 1.5 },
      t: 100,
    });
  });

  it("recuperar solo lee: no escribe nada (se puede llamar al renderizar)", () => {
    guardarPosicion(huella(1), { page: 2, zoom: ANCHO }, 100);
    const antes = localStorage.getItem(CLAVE_POSICIONES);
    expect(recuperarPosicion(huella(1))?.t).toBe(100);
    expect(recuperarPosicion(huella(2))).toBeNull();
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBe(antes);
  });

  it("marcar el uso actualiza `t` y nada más", () => {
    guardarPosicion(huella(1), { page: 2, zoom: { tipo: "fijo", valor: 2 } }, 100);
    marcarUso(huella(1), 500);
    expect(registro().docs[huella(1)]).toEqual({
      page: 2,
      zoom: { tipo: "fijo", valor: 2 },
      t: 500,
    });
  });

  it("marcar el uso sin entrada, con una huella inválida o con una versión futura no escribe", () => {
    marcarUso(huella(1), 500);
    marcarUso("informe.pdf", 500);
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBeNull();
    guardarPosicion(huella(1), { page: 2, zoom: ANCHO }, 100);
    const antes = localStorage.getItem(CLAVE_POSICIONES);
    marcarUso(huella(2), 500);
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBe(antes);
    const futura = JSON.stringify({ v: 2, docs: { [huella(1)]: { page: 4 } } });
    localStorage.setItem(CLAVE_POSICIONES, futura);
    marcarUso(huella(1), 500);
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBe(futura);
  });

  it("guardar otra vez la misma huella la sustituye", () => {
    guardarPosicion(huella(1), { page: 2, zoom: ANCHO }, 1);
    guardarPosicion(huella(1), { page: 9, zoom: ANCHO }, 2);
    expect(Object.keys(registro().docs)).toHaveLength(1);
    expect(registro().docs[huella(1)].page).toBe(9);
  });

  it(`como mucho ${MAX_POSICIONES}: al pasar se borra la más antigua (por \`t\`)`, () => {
    for (let i = 1; i <= MAX_POSICIONES; i++)
      guardarPosicion(huella(i), { page: i, zoom: ANCHO }, i);
    expect(Object.keys(registro().docs)).toHaveLength(MAX_POSICIONES);
    // La 1 se usa: deja de ser la más antigua; la 2 pasa a serlo.
    marcarUso(huella(1), 1000);
    guardarPosicion(huella(999), { page: 1, zoom: ANCHO }, 1001);
    const docs = registro().docs;
    expect(Object.keys(docs)).toHaveLength(MAX_POSICIONES);
    expect(docs[huella(2)]).toBeUndefined();
    expect(docs[huella(1)]).toBeDefined();
    expect(docs[huella(999)]).toBeDefined();
  });

  it("recortar deja las de `t` más reciente", () => {
    const docs: Record<string, Posicion> = {};
    for (let i = 0; i < MAX_POSICIONES + 5; i++) docs[huella(i)] = { page: 1, zoom: ANCHO, t: i };
    const r = recortar(docs);
    expect(Object.keys(r)).toHaveLength(MAX_POSICIONES);
    for (let i = 0; i < 5; i++) expect(r[huella(i)]).toBeUndefined();
    expect(r[huella(MAX_POSICIONES + 4)]).toBeDefined();
  });

  it("una huella que no es hexadecimal (un nombre, `__proto__`) ni se guarda ni se busca", () => {
    for (const mala of ["informe.pdf", "__proto__", "", "../x"]) {
      guardarPosicion(mala, { page: 3, zoom: ANCHO });
      expect(recuperarPosicion(mala)).toBeNull();
    }
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBeNull();
  });

  it("entradas corruptas se descartan y las buenas se conservan", () => {
    localStorage.setItem(
      CLAVE_POSICIONES,
      JSON.stringify({
        v: 1,
        docs: { [huella(1)]: { page: 4, zoom: ANCHO, t: 1 }, [huella(2)]: { page: "x" } },
      }),
    );
    expect(recuperarPosicion(huella(2))).toBeNull();
    expect(recuperarPosicion(huella(1))?.page).toBe(4);
    // La siguiente escritura deja solo las buenas.
    marcarUso(huella(1), 5);
    expect(Object.keys(registro().docs)).toEqual([huella(1)]);
  });

  it("un registro roto se sustituye al guardar", () => {
    localStorage.setItem(CLAVE_POSICIONES, "{roto");
    expect(recuperarPosicion(huella(1))).toBeNull();
    guardarPosicion(huella(1), { page: 2, zoom: ANCHO }, 1);
    expect(registro().docs[huella(1)].page).toBe(2);
  });

  it("versión futura: ni se lee ni se sobrescribe (guardar es automático)", () => {
    const futura = JSON.stringify({ v: 2, docs: { [huella(1)]: { page: 4 } } });
    localStorage.setItem(CLAVE_POSICIONES, futura);
    expect(recuperarPosicion(huella(1))).toBeNull();
    guardarPosicion(huella(1), { page: 9, zoom: ANCHO });
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBe(futura);
  });

  it("«Olvidar posiciones guardadas» borra la clave entera (también una versión futura) y nada más", () => {
    guardarPosicion(huella(1), { page: 2, zoom: ANCHO });
    localStorage.setItem("bpdf:prefs", '{"v":1}');
    olvidarPosiciones();
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBeNull();
    expect(localStorage.getItem("bpdf:prefs")).toBe('{"v":1}');
    localStorage.setItem(CLAVE_POSICIONES, '{"v":9}');
    olvidarPosiciones();
    expect(localStorage.getItem(CLAVE_POSICIONES)).toBeNull();
  });
});
