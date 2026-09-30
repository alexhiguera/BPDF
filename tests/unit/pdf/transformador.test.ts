import { describe, expect, it, vi } from "vitest";
import {
  type ColoresOscuro,
  oscurecerLienzo,
  type Transformador,
  transformadorLocal,
} from "@/pdf/dark/aplicar";
import { crearRecoloreado, desempaquetar, recolorearRgb } from "@/pdf/dark/recolor";
import type { PeticionFranja, RespuestaFranja } from "@/pdf/dark/trabajador";
import { transformadorEnWorker } from "@/pdf/dark/transformador-worker";

/**
 * La transformación oscura fuera del lienzo real (que se prueba en Playwright):
 * el reparto en franjas, el worker (con un doble que sigue su protocolo) y la
 * cancelación.
 */
const COLORES: ColoresOscuro = { pagina: [43, 43, 43], texto: [236, 236, 236] };

/** `ImageData` mínimo para Node (jsdom no lo tiene y Node tampoco). */
class Imagen {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}
vi.stubGlobal("ImageData", Imagen);

/** Un contexto 2D de mentira: un búfer RGBA y get/putImageData por filas. */
function contexto(ancho: number, alto: number) {
  const px = new Uint8ClampedArray(ancho * alto * 4).fill(255);
  const lecturas: number[] = [];
  const ctx = {
    canvas: { width: ancho, height: alto },
    getImageData: (_x: number, y: number, w: number, h: number) => {
      lecturas.push(y);
      return new Imagen(px.slice(y * w * 4, (y + h) * w * 4), w, h);
    },
    putImageData: (img: Imagen, _x: number, y: number) => px.set(img.data, y * ancho * 4),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, px, lecturas };
}

const blancoOscurecido = recolorearRgb([255, 255, 255], COLORES);
const noOscura = { yaOscura: () => false };

describe("oscurecerLienzo", () => {
  it("recolorea el lienzo entero, franja a franja, y mide el hilo principal", async () => {
    const { ctx, px, lecturas } = contexto(4, 10);
    const r = await oscurecerLienzo(ctx, [], transformadorLocal(COLORES), {
      ...noOscura,
      filasPorFranja: 3,
    });
    expect(lecturas).toEqual([0, 3, 6, 9]);
    expect(r?.omitida).toBeNull();
    expect(r?.msHiloPrincipal).toBeGreaterThanOrEqual(0);
    expect(r?.bytesFranja).toBe(4 * 3 * 4);
    expect([...px.subarray(0, 3)]).toEqual(blancoOscurecido);
    expect([...px.subarray(px.length - 4, px.length - 1)]).toEqual(blancoOscurecido);
  });

  it("conserva las regiones de imagen", async () => {
    const { ctx, px } = contexto(4, 4);
    await oscurecerLienzo(ctx, [[0, 0, 2, 0, 0, 4]], transformadorLocal(COLORES), noOscura);
    expect([...px.subarray(0, 3)]).toEqual([255, 255, 255]); // x=0, dentro
    expect([...px.subarray(12, 15)]).toEqual(blancoOscurecido); // x=3, fuera
  });

  it("una página que ya es oscura no se toca", async () => {
    const { ctx, px, lecturas } = contexto(4, 4);
    const r = await oscurecerLienzo(ctx, [], transformadorLocal(COLORES), { yaOscura: () => true });
    expect(r?.omitida).toBe("pagina-oscura");
    expect(lecturas).toEqual([]);
    expect(px.every((v) => v === 255)).toBe(true);
  });

  it("si deja de estar vigente, para entre franjas y devuelve null", async () => {
    const { ctx, lecturas } = contexto(4, 10);
    let franjas = 0;
    const r = await oscurecerLienzo(ctx, [], transformadorLocal(COLORES), {
      ...noOscura,
      filasPorFranja: 2,
      vigente: () => franjas++ < 2,
    });
    expect(r).toBeNull();
    expect(lecturas.length).toBeLessThan(5);
  });

  it("con un transformador asíncrono nunca hay más de dos franjas en vuelo", async () => {
    const { ctx } = contexto(2, 12);
    let enVuelo = 0;
    let maximo = 0;
    const lento: Transformador = {
      tipo: "worker",
      async franja(f) {
        enVuelo++;
        maximo = Math.max(maximo, enVuelo);
        await new Promise((r) => setTimeout(r, 1));
        enVuelo--;
        return f;
      },
      destruir() {},
    };
    await oscurecerLienzo(ctx, [], lento, { ...noOscura, filasPorFranja: 1 });
    expect(maximo).toBe(2);
  });
});

/** Un Worker de mentira que ejecuta el mismo código que `trabajador.ts`. */
class WorkerFalso {
  onmessage: ((e: MessageEvent<RespuestaFranja>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  transferidos: Transferable[][] = [];
  terminado = false;
  fallar = false;
  postMessage(p: PeticionFranja, transferir: Transferable[]) {
    this.transferidos.push(transferir);
    queueMicrotask(() => {
      if (this.fallar) {
        this.onerror?.({ preventDefault() {} } as ErrorEvent);
        return;
      }
      const datos = new Uint8ClampedArray(p.datos);
      const recolorear = crearRecoloreado(p.colores);
      const u32 = new Uint32Array(datos.buffer);
      for (let i = 0; i < u32.length; i++) u32[i] = recolorear(u32[i] ?? 0);
      this.onmessage?.({ data: { id: p.id, datos: p.datos } } as MessageEvent<RespuestaFranja>);
    });
  }
  terminate() {
    this.terminado = true;
  }
}

describe("transformadorEnWorker", () => {
  it("manda la franja TRANSFERIDA y devuelve una nueva con el resultado", async () => {
    const falso = new WorkerFalso();
    const t = transformadorEnWorker(COLORES, () => falso as unknown as Worker);
    expect(t?.tipo).toBe("worker");
    const franja = new Imagen(new Uint8ClampedArray(8).fill(255), 2, 1);
    const buffer = franja.data.buffer;
    const r = await t?.franja(franja as unknown as ImageData, 0, []);
    expect(falso.transferidos[0]).toEqual([buffer]);
    expect(desempaquetar(new Uint32Array(r?.data.buffer ?? new ArrayBuffer(4))[0] ?? 0)).toEqual(
      blancoOscurecido,
    );
    expect(r?.width).toBe(2);
  });

  it("si el worker falla, rechaza lo pendiente, queda roto y rechaza lo siguiente", async () => {
    const falso = new WorkerFalso();
    falso.fallar = true;
    const t = transformadorEnWorker(COLORES, () => falso as unknown as Worker);
    const franja = () => new Imagen(new Uint8ClampedArray(4), 1, 1) as unknown as ImageData;
    await expect(t?.franja(franja(), 0, [])).rejects.toThrow("worker-modo-oscuro");
    expect(t?.roto).toBe(true);
    await expect(t?.franja(franja(), 0, [])).rejects.toThrow();
  });

  it("sin Worker en el navegador devuelve null (el visor usa el hilo principal)", () => {
    expect(
      transformadorEnWorker(COLORES, () => {
        throw new Error("no hay Worker");
      }),
    ).toBeNull();
  });

  it("destruir termina el worker y rechaza lo pendiente", async () => {
    const falso = new WorkerFalso();
    falso.postMessage = () => {}; // nunca responde
    const t = transformadorEnWorker(COLORES, () => falso as unknown as Worker);
    const pendiente = t?.franja(
      new Imagen(new Uint8ClampedArray(4), 1, 1) as unknown as ImageData,
      0,
      [],
    );
    t?.destruir();
    await expect(pendiente).rejects.toThrow("worker-destruido");
    expect(falso.terminado).toBe(true);
  });
});
