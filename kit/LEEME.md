# pteron · lenguaje visual 1.0.0

Todo lo necesario para usar la marca de pteron y aplicar su lenguaje visual, en archivos que no varían: cada uno sale
del mismo dibujo y del mismo archivo de medidas, y `manifiesto.json` guarda su suma SHA-256.

## Por dónde empezar

1. **`LENGUAJE.md`**: el lenguaje completo, con sus reglas y medidas: marca, icono, color, letra, geometría, láminas, la
   hoja, la interfaz y la voz.
2. **`marca/`** e **`icono/`**: los archivos para usar. PNG para Word, PowerPoint o Canva; SVG para imprenta o diseño.
3. **`color/`**: los colores y medidas en `tokens.json` (la fuente única), `tokens.css` y `tokens.ts`, y la tabla de
   contrastes.
4. **`letras/`**: Archivo y Outfit para instalar en el computador (TTF) y para la web (woff2), con su licencia.
5. **`app/`**: el icono de la aplicación listo para su carpeta `build/` (también `build/icons/` para Linux). El kit
   completo trae además los tres parches que alinean la app con este lenguaje, sus capturas de antes y después y la
   guía para aplicarlos (`app/APLICAR.md`).

## Comprobar que los archivos son los publicados

Con Node 18 o posterior, desde esta carpeta:

    node verificar.mjs

Dice si algún archivo cambió, falta o sobra.

## Qué archivo de la marca uso

| Necesito | Archivo |
| --- | --- |
| La marca sobre papel o un fondo claro | `marca/pteron-azul.png` (o `.svg`) |
| La marca sobre el azul o una foto oscura | `marca/pteron-blanco.png` |
| Imprimir en blanco y negro | `marca/pteron-tinta.png` |
| Montar la marca en una interfaz o en imprenta, midiendo el aire aparte | `marca/pteron-*-ajustada.svg` |
| Un icono o una foto de perfil | `icono/p-azul.png` · `icono/p-azul-perfil.png` |
| El icono en el Dock de macOS | `icono/p-azul-macos.png` (la cuadrícula de 824) |

## Licencias

La marca y el icono son de pteron · Patagua: se usan para hablar de pteron, sin cambiarlos. Archivo y Outfit se
distribuyen con la SIL Open Font License 1.1 (`letras/LICENCIA-OFL.txt`).

Consultas: pteron@patagua.dev
