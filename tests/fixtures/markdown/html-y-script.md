# Markdown con HTML y scripts

Este fichero contiene HTML que un renderizador inseguro ejecutaría. BPDF no debe
ejecutar nada de lo que hay aquí: en la Fase 3 ni siquiera lo muestra, y a partir
de la Fase 7 el HTML crudo no se interpreta (D6).

<script>window.__bpdfXss = "script";</script>

<img src="x" onerror="window.__bpdfXss = 'img'">

<svg onload="window.__bpdfXss = 'svg'"></svg>

<iframe src="https://tracker.example/espia"></iframe>

[enlace peligroso](javascript:window.__bpdfXss='enlace')

![imagen remota](https://tracker.example/pixel.gif)
