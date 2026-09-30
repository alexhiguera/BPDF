import type { ColoresOscuro, Transformador } from "./aplicar";
import type { PeticionFranja, RespuestaFranja } from "./trabajador";

/**
 * El recoloreado en un Web Worker (docs/ARCHITECTURE.md → visor PDF, «Worker»).
 *
 * Por qué un worker y no WebGL: el cálculo es el mismo código probado del
 * spike, sin reescribirlo en GLSL; no hace falta contexto WebGL (que falla o se
 * pierde en equipos sin GPU); y los bytes van y vuelven TRANSFERIDOS, sin copia.
 * El hilo principal solo lee y escribe las franjas del lienzo.
 *
 * El fichero del worker lo empaqueta Vite desde `new URL(…, import.meta.url)`:
 * es un fichero del propio origen (CSP `worker-src 'self'`).
 *
 * Devuelve `null` si el navegador no puede crear el worker; quien llama usa
 * entonces `transformadorLocal`. Si el worker falla después, todas las franjas
 * pendientes se rechazan y `roto` pasa a `true`: el visor vuelve a pintar la
 * página con el transformador local.
 */
export function transformadorEnWorker(
  colores: ColoresOscuro,
  crear: () => Worker = () =>
    new Worker(new URL("./trabajador.ts", import.meta.url), {
      type: "module",
      name: "bpdf-modo-oscuro",
    }),
): (Transformador & { readonly roto: boolean }) | null {
  let worker: Worker;
  try {
    worker = crear();
  } catch {
    return null;
  }
  let siguiente = 0;
  let roto = false;
  const pendientes = new Map<
    number,
    { resolver: (d: ArrayBuffer) => void; rechazar: (e: Error) => void }
  >();
  const fallar = (motivo: string) => {
    roto = true;
    for (const p of pendientes.values()) p.rechazar(new Error(motivo));
    pendientes.clear();
  };
  worker.onmessage = (e: MessageEvent<RespuestaFranja>) => {
    const p = pendientes.get(e.data.id);
    if (!p) return;
    pendientes.delete(e.data.id);
    if ("error" in e.data) p.rechazar(new Error(e.data.error));
    else p.resolver(e.data.datos);
  };
  worker.onerror = (e) => {
    e.preventDefault();
    fallar("worker-modo-oscuro");
  };
  worker.onmessageerror = () => fallar("worker-modo-oscuro");

  return {
    tipo: "worker",
    get roto() {
      return roto;
    },
    franja(franja, y0, conservar) {
      if (roto) return Promise.reject(new Error("worker-modo-oscuro"));
      const { width: ancho, height: alto } = franja;
      const id = siguiente++;
      const datos = franja.data.buffer as ArrayBuffer;
      return new Promise<ImageData>((resolver, rechazar) => {
        pendientes.set(id, {
          resolver: (d) => resolver(new ImageData(new Uint8ClampedArray(d), ancho, alto)),
          rechazar,
        });
        const peticion: PeticionFranja = { id, datos, ancho, y0, conservar, colores };
        worker.postMessage(peticion, [datos]);
      });
    },
    destruir() {
      fallar("worker-destruido");
      worker.terminate();
    },
  };
}
