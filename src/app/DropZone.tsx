import { type DragEvent, type ReactNode, useState } from "react";
import { messages } from "@/i18n/messages";

/** Solo interesan los arrastres de ficheros; texto o enlaces arrastrados se ignoran. */
const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

/**
 * Zona de soltar a pantalla completa (docs/PLAN.md §9.3). Envuelve toda la app
 * y ocupa la ventana, así que no necesita escuchar en `window` ni en
 * `document`: sus manejadores de React bastan, y dejan de existir con ella.
 *
 * Además evita que el navegador haga lo suyo con un fichero soltado (abrirlo
 * en la pestaña y perder la app).
 *
 * `dragenter` y `dragleave` se disparan también al pasar de un hijo a otro;
 * contar entradas y salidas es la forma fiable de saber si el arrastre sigue
 * dentro. El aviso es visual y no captura el puntero (`pointer-events-none`)
 * para no alterar ese recuento. Para teclado y lectores de pantalla, la vía
 * equivalente es el botón «Abrir archivo».
 */
export function DropZone({
  onFiles,
  children,
}: {
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const [depth, setDepth] = useState(0);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: soltar ficheros no tiene rol ARIA; la alternativa accesible es el botón «Abrir archivo».
    <div
      className="relative flex min-h-dvh flex-col"
      data-dragging={depth > 0 || undefined}
      onDragEnter={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        setDepth((d) => d + 1);
      }}
      onDragOver={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault(); // sin esto, el navegador no permite soltar
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!carriesFiles(e)) return;
        setDepth((d) => Math.max(0, d - 1));
      }}
      onDrop={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        setDepth(0);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {children}
      {depth > 0 && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center bg-app/85 p-6">
          <p className="rounded-lg border-2 border-dashed border-accent bg-elevated px-8 py-6 text-lg font-medium">
            {messages.dropZone.hint}
          </p>
        </div>
      )}
    </div>
  );
}
