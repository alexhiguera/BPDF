# Markdown hostil

Este fichero contiene HTML y URLs que un renderizador inseguro ejecutaría o pediría a
la red. BPDF no debe ejecutar ni pedir nada de lo que hay aquí: el HTML crudo no se
interpreta (D6), las URLs pasan por la política de `url-policy.ts` y las imágenes
remotas no se cargan (D7). Si algo se ejecutara, escribiría en `window.__bpdfXss`.

## HTML crudo

<script>window.__bpdfXss = "script";</script>

<img src="https://tracker.example/pixel-html.gif" onerror="window.__bpdfXss = 'img'">

<svg onload="window.__bpdfXss = 'svg'"></svg>

<iframe src="https://tracker.example/espia"></iframe>

<object data="https://tracker.example/x.swf"></object>

<style>body { display: none !important; }</style>

<details open ontoggle="window.__bpdfXss = 'details'"><summary>x</summary>y</details>

En línea: <b onmouseover="window.__bpdfXss = 'b'">negrita HTML</b> y <a href="javascript:window.__bpdfXss='a'">enlace HTML</a>.

## Enlaces

- [javascript:](javascript:window.__bpdfXss='enlace')
- [JAVASCRIPT:](JAVASCRIPT:window.__bpdfXss='mayusculas')
- [entidad](java&#x73;cript:window.__bpdfXss='entidad')
- [tabulador](<java	script:window.__bpdfXss='tab'>)
- [data:](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)
- [vbscript:](vbscript:msgbox(1))
- [file:](file:///etc/passwd)
- [protocolo relativo](//tracker.example/x)
- [otro fichero](otro.md)
- <javascript:window.__bpdfXss='autolink'>
- [externo permitido](https://example.com/permitido)

## Imágenes

![píxel espía](https://tracker.example/pixel.gif)

![javascript](javascript:window.__bpdfXss='imagen')

![data](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+)

![local](./imagen.png)

## Encabezados que pisarían globales

### location

### \_\_proto\_\_
