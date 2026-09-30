# Bloques de código

## JavaScript

```js
// Comentario
function suma(a, b) {
  return a + b; // 42
}
const texto = `plantilla ${suma(1, 2)}`;
```

## TypeScript

```ts
interface Documento {
  readonly id: string;
  tipo: "pdf" | "markdown";
}
export const abrir = async (d: Documento): Promise<void> => {};
```

## JSX

```jsx
export function Hola({ nombre }) {
  return <p className="saludo">Hola, {nombre}</p>;
}
```

## TSX

```tsx
const Boton = ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Ok</button>;
```

## JSON

```json
{ "nombre": "bpdf", "version": 1, "privado": true, "lista": [1, 2, null] }
```

## HTML

```html
<!doctype html>
<script>alert("esto es código, no se ejecuta")</script>
<a href="javascript:alert(1)">texto</a>
```

## CSS

```css
.md-contenido > h1 { color: #fff; margin: 0 auto; }
```

## Bash

```bash
#!/usr/bin/env bash
for f in *.md; do echo "$f"; done
```

## Python

```python
def fib(n: int) -> int:
    """Fibonacci."""
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

## Markdown

```markdown
# Título
- elemento con **negrita**
```

## SQL

```sql
SELECT nombre, COUNT(*) FROM documentos WHERE tipo = 'pdf' GROUP BY nombre;
```

## Sin lenguaje

```
Texto preformateado    con   espacios
	y un tabulador.
```

## Lenguaje desconocido

```cobol
       IDENTIFICATION DIVISION.
```

## Línea muy larga

```text
esta-es-una-linea-muy-larga-que-no-cabe-en-la-columna-de-lectura-y-debe-desplazarse-en-horizontal-sin-ensanchar-la-pagina-entera
```

Y `código en línea` en un párrafo.
