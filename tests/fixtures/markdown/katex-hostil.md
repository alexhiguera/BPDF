# KaTeX hostil

Cada fórmula intenta generar HTML, enlaces, atributos o peticiones. Con `trust: false`
ninguna lo consigue: o se pinta como fórmula inerte o se muestra su código.

## Comandos que necesitan confianza

$\href{javascript:window.__bpdfXss='href'}{pulsa}$

$\url{javascript:window.__bpdfXss='url'}$

$\href{https://tracker.example/href}{externo}$

$\htmlClass{md-contenido}{x}$

$\htmlId{location}{x}$

$\htmlStyle{background:url(https://tracker.example/estilo.png)}{x}$

$\htmlData{onclick=alert(1)}{x}$

$\includegraphics{https://tracker.example/imagen.png}$

## HTML dentro de la fórmula

$\text{<img src=x onerror="window.__bpdfXss='text'">}$

$\mathrm{</span><script>window.__bpdfXss='mathrm'</script>}$

$<script>window.__bpdfXss='directo'</script>$

## Macros

$\def\a{\a}\a$

$\def\x{\x\x}\x$

$\gdef\secreto{filtrado}$ y después $\secreto$

$\newcommand{\b}[1]{#1#1#1#1#1#1#1#1}\b{\b{\b{\b{\b{\b{x}}}}}}$

## Tamaños y colores

$\rule{100000em}{100000em}$

$\color{javascript:alert(1)}{x}$

$\textcolor{red;background:url(https://tracker.example/c.png)}{x}$

$$
\begin{matrix} \href{javascript:alert(1)}{a} & b \end{matrix}
$$
