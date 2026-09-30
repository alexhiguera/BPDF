# Documento con recursos

Una imagen junto al documento, con y sin `./`:

![Imagen](./imagen.png)

![Imagen otra vez](imagen.png)

Un SVG (se muestra como imagen, nunca en línea):

![Logo](./logo.svg)

De un subdirectorio:

![Foto](./images/foto.jpg)

![Diagrama](images/diagrama.png)

![Dibujo WebP](images/dibujo.webp)

Un GIF:

![Píxel](pixel.gif)

Con espacios y Unicode:

![Foto grande](foto%20grande.png)

![Año](<año ñandú 🙂.png>)

## Lo que no debe verse

![No existe](./no-existe.png)

![Fuera de la carpeta](../fuera-de-recursos.png)

![Fuera, codificado](%2e%2e/fuera-de-recursos.png)

![Remota](https://tracker.example/remota.png)

![SVG hostil](malicioso.svg)

Un enlace a otro Markdown: [el otro](../basico.md).
