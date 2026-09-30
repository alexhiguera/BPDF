# Mermaid hostil

Cada diagrama intenta ejecutar algo, pedir algo a la red o salirse de su imagen. Si algo
se ejecutara, escribiría en `window.__bpdfXss`.

## click

```mermaid
flowchart LR
  A[Nodo A] --> B[Nodo B]
  click A "javascript:window.__bpdfXss='click'"
  click B href "https://tracker.example/click"
  click A callback "window.__bpdfXss='callback'"
```

## HTML en las etiquetas

```mermaid
flowchart TD
  A["<img src=x onerror=window.__bpdfXss='label'>"] --> B["<script>window.__bpdfXss='script'</script>"]
  B --> C["<a href='javascript:window.__bpdfXss=1'>enlace</a>"]
  C --> D["`**negrita** <img src=https://tracker.example/md.png>`"]
```

## Directiva que intenta relajar la seguridad

```mermaid
%%{init: {"securityLevel": "loose", "htmlLabels": true, "flowchart": {"htmlLabels": true}, "themeCSS": "@import url(https://tracker.example/x.css); .node rect { fill: url(https://tracker.example/y.png) }", "dompurifyConfig": {"ADD_TAGS": ["script", "iframe"]}}}%%
flowchart LR
  A["<iframe src='https://tracker.example/iframe'></iframe>"] --> B["<img src=x onerror=window.__bpdfXss='init'>"]
```

## Imágenes en nodos

```mermaid
flowchart LR
  A@{ img: "https://tracker.example/nodo.png", label: "remota", pos: "t", w: 60, h: 60 }
  B@{ img: "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+", label: "data", pos: "t", w: 60, h: 60 }
  A --> B
```

## Secuencia con HTML

```mermaid
sequenceDiagram
  participant A as <img src=x onerror=window.__bpdfXss='participant'>
  participant B as B
  A->>B: <script>window.__bpdfXss='mensaje'</script>
  Note over A,B: <iframe src="https://tracker.example/nota"></iframe>
```

## Clases con enlaces

```mermaid
classDiagram
  class Foo
  class Bar
  link Foo "javascript:window.__bpdfXss='link'"
  link Bar "https://tracker.example/link"
  callback Foo "window.__bpdfXss" "tooltip"
```

## IDs que pisarían globales

```mermaid
flowchart LR
  location --> __proto__
  constructor --> body
  document --> window
```
