import { cn } from "@/lib/utils";

/**
 * Identidad visual oficial de BPDF. El nombre adyacente ya identifica el
 * producto, así que la imagen se oculta del árbol de accesibilidad para no
 * anunciar «BPDF» dos veces.
 */
export function LogoBpdf({ className }: { className?: string }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("shrink-0 select-none", className)}
      data-testid="bpdf-logo"
    />
  );
}
