// @vitest-environment jsdom

/**
 * jest-axe sobre los primitivos por los que pasa toda la UI. Un fallo aquí es
 * un fallo en todas las pantallas a la vez, no en una.
 */

import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

describe("accesibilidad", () => {
  it("formulario con campos, ayuda y error", async () => {
    const { container } = render(
      <form>
        <Field label="Nombre" hint="Como quieres que te llamemos">
          <Input />
        </Field>
        <Field label="Email" error="Escribe un email válido">
          <Input type="email" />
        </Field>
        <Button type="submit">Guardar</Button>
      </form>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("botón en estado de carga", async () => {
    const { container } = render(<Button loading>Enviando</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
