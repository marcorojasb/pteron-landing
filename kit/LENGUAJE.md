# El lenguaje visual de pteron

Versión 1.0.0 · 12 de octubre de 2026. La fuente única de cada medida es `color/tokens.json`; lo que dice este
documento y lo que traen los archivos del kit coinciden, y `verificar.mjs` comprueba que nada haya cambiado.

## La idea: la lámina y la figura

pteron arma guías, pruebas, planificaciones y presentaciones para profes. Su lenguaje sale de sus propias hojas: la
tinta y el azul de sus materiales, el amarillo con que rellena sus figuras, el gris que Write pone detrás de cada hoja.
La web lo cuenta con láminas: lo que se sabe desde siempre (obras de dominio público) y, detrás, la figura con que pteron
lo dibuja hoy para tu clase.

Tres reglas lo sostienen:

1. **Lo que se ve es papel.** Hojas, tarjetas y reversos son blancos sobre la mesa; las sombras son de tinta y suaves.
2. **Dos gestos y nada más.** El doblez a 45° y la escalera sobre la cuadrícula. No hay otros adornos.
3. **La interfaz se explica sola.** Nada de titulares que celebran lo obvio: los rótulos dicen qué hace cada cosa.

## 1. La marca

«pteron» en Outfit 600, la letra con que pteron rotula sus figuras, con dos cortes propios: la esquina de arriba a la
derecha de la «t», doblada a 45° como la esquina de una hoja, y la esquina opuesta de la «p», cortada en espejo. Los
dos cortes miden el 60 % del ancho del asta de la «t».

La marca es un dibujo, no un texto: se usa el archivo (`marca/marca.svg` o sus derivados), nunca se vuelve a escribir
con la letra.

| Regla | Medida |
| --- | --- |
| Nombre | pteron, siempre en minúscula, también al comienzo de una oración |
| Espacio libre | el alto de su «o» por cada lado (504 unidades del contorno, el 57 % del alto de la marca) |
| Tamaño mínimo | 30 px de alto en pantalla, 8 mm en papel; más chico, va el icono |
| Colores | azul sobre la hoja o la mesa; blanco sobre el azul o una foto oscura; tinta para imprimir en blanco y negro |
| Fondo | liso; sobre una foto, sólo en blanco y donde el fondo sea oscuro y parejo |

Archivos: `marca/pteron-{azul,blanco,tinta}.svg` y `.png` traen su espacio libre (pegados en un documento no quedan
apretados); los `-ajustada` llegan justo al dibujo, para imprenta o para montarlos en una interfaz que mide el aire por
su cuenta.

**No se hace:** cambiarle la letra o el peso; estirarla, inclinarla o girarla; separar sus letras o mover los cortes;
ponerle contorno, sombra, degradado o un color fuera de los tres; encerrarla en una forma; usarla más chica que el
mínimo; ponerla en las hojas que arma pteron (ver «La hoja»).

**En la app**, la Home y el arranque muestran la marca como marca de agua: grande, detrás de los rumbos, en un solo
color muy claro (el azul al 24 % sobre la mesa; en oscuro, la tinta al 16 %) y desvanecida hacia abajo hasta disolverse
en la mesa. Es el único uso aclarado de la marca y no sale de la app: no se le agrega degradado de color ni se usa en
otro lugar como fondo.

## 2. El icono

La «p» de la marca, con su corte, en blanco sobre el azul. Va donde la marca completa no se lee: la pestaña del
navegador, la pantalla de inicio del teléfono, la barra de tareas y el Dock.

| Variante | Archivo | Para |
| --- | --- | --- |
| Icono | `icono/p-azul.svg` · `.png` | todo uso general; esquinas de radio 229 en 1024 |
| Azul sobre blanco | `icono/p-blanco.svg` · `.png` | sobre fondos azules o fotos |
| A sangre | `icono/p-azul-sangre.svg` · `.png` | sistemas que ponen su propia máscara |
| Perfil | `icono/p-azul-perfil.svg` · `.png` | fotos de perfil que se recortan en círculo (la letra en el 80 % central) |
| Favicon | `icono/favicon.svg`, `.ico` y los PNG de 16, 32 y 48 | pestañas: la letra más grande, radio 200, y engruesada a 16 y 32 px |
| Teléfono | `icono/apple-touch-icon.png`, `icono/android-*.png` | accesos directos en iPhone y Android |
| macOS | `icono/p-azul-macos.svg` · `.png` | el Dock y Finder: el cuadrado de 824 centrado en el lienzo de 1024, la cuadrícula de macOS |
| La app | `app/build/icon.{svg,png,ico,icns}` y `app/build/icons/` | el icono de la aplicación: `.icns` en la cuadrícula de macOS, `.ico` para Windows (letra engruesada hasta 32 px) y un PNG por tamaño para Linux |

La «p» del icono mide 600 de 1024 de alto (con su descendente) y su centro cae un poco bajo la mitad, para que el ojo
de la letra quede al centro.

## 3. Color

Son los colores de las hojas que arma pteron.

| Nombre | Valor | Rol | En fotocopia |
| --- | --- | --- | --- |
| Tinta | `#1F2A3D` | el texto | gris al 83 % |
| Azul | `#1E3F94` | títulos, enlaces, la marca; en la app, la acción dominante | gris al 71 % |
| Azul hondo | `#162F70` | el azul al presionar; el texto sobre el lápiz | |
| Lápiz | `#F0C060` | el destacador | gris al 20 % |
| Lápiz hondo | `#E2AC3A` | el borde y el estado presionado del lápiz | |
| Mesa | `#E9EDF1` | el fondo: el lienzo de Write | gris al 6 % |
| Mesa honda | `#DEE3EA` | la mesa en una franja o bajo el cursor | |
| Hoja | `#FFFFFF` | lo que es papel | blanco |
| Grafito | `#5B6B82` | el texto secundario | gris al 55 % |
| Suave | `#68778C` | el texto de ejemplo de un campo, sólo sobre la hoja | |
| Regla | `#DCE3EE` | las reglas entre filas y secciones | |
| Línea | `#C9D3E1` | los bordes de controles y cuadros | |

Estados (los de los momentos de pteron-design): éxito `#1D5C3C` sobre `#EAF5EF` con borde `#CBE5D6`; error `#9A2F23`
sobre `#FBEDEB` con borde `#F0C9C4`; nota sobre `#F2F6FC` con borde `#D6E0EF`; aviso sobre `#FDF5E2` con borde `#EDD49B`.
Sobre el azul, el texto secundario va en `#C9D3EA` y los enlaces en `#DCE3F2`.

En la app, sobre la mesa, el texto tiene tres niveles: tinta, el **rótulo** `#4A5A72` (el de los rótulos de campo de
las hojas, 6 : 1 sobre la mesa) y el grafito, los tres AA sobre la mesa y la hoja. Entre la mesa y la hoja, los paneles
van en **lavado** `#F3F6FB`. Los dos están en `color-app` de `tokens.json`.

Reglas:

- **El lápiz destaca, no decora.** En la web marca la acción principal de una vista y lo que se subraya; nunca va en
  cápsulas, fondos ni estados de paso del cursor. En la app reemplaza al dorado sólo como destacador: nunca pinta un
  estado interactivo (cursor, selección, activo); la acción dominante de la app es azul.
- **Una sola acción llena por vista.** Las demás, con borde.
- **Las sombras son de tinta** (`#1F2A3D` con transparencia), nunca negras ni de color.
- **El texto secundario va en grafito**, sobre la mesa o la hoja. El suave, sólo sobre la hoja: sobre la mesa no llega
  a 4,5 : 1.
- Todos los pares de texto cumplen WCAG AA (4,5 : 1); la tabla completa está en `color/CONTRASTES.md`.

### En pantallas oscuras

La app tiene tema oscuro: el de pteron-design, el mismo de su editor de figuras. Usa los mismos nombres y roles con estos
valores (`color-oscuro` en `tokens.json`):

| Nombre | Valor | Contraste |
| --- | --- | --- |
| Tinta | `#E6EBF3` | 15,6 : 1 sobre la mesa |
| Azul | `#8FB0F4` | 8,6 : 1 sobre la mesa; la acción dominante lleva texto `#0E1A33` encima |
| Azul hondo | `#B3C4F4` | al presionar: en lo oscuro, más claro |
| Lápiz | `#F0C060` | igual que en lo claro |
| Mesa | `#0E131B` | el fondo |
| Mesa honda | `#1C2430` | una franja o el paso del cursor: en lo oscuro, más clara |
| Hoja | `#151B25` | superficies |
| Grafito | `#A3B0C2` | 8,5 : 1 sobre la mesa |
| Suave | `#7D8BA0` | el tercer nivel de texto, 5 : 1 sobre la hoja |
| Regla | `#232C3A` | |
| Línea | `#2C3646` | |

La marca sobre fondo oscuro va en blanco; el icono no cambia.

## 4. Letra

| Letra | Para | Licencia |
| --- | --- | --- |
| Archivo (Omnibus-Type) | todo el texto de la web | SIL OFL 1.1 |
| Outfit (The Outfit Project) | la marca (como dibujo) y las hojas que arma pteron: su texto, sus títulos y sus figuras | SIL OFL 1.1 |
| Playwrite CL (TypeTogether) | la pauta de caligrafía de primer ciclo | SIL OFL 1.1 |
| Arial | las diapositivas que arma pteron | del sistema |
| IBM Plex Sans, Serif y Mono | la interfaz de la app: los controles, los títulos y el código | SIL OFL 1.1 |

En la web, una sola familia: la jerarquía la hacen el ancho y el peso de Archivo.

| Rol | Tamaño | Ancho | Peso | Interlínea |
| --- | --- | --- | --- | --- |
| Titular (sólo el del inicio) | 2,9 a 6,6 rem | 118 % | 780 | 0,94 |
| Sección | 1,9 a 3 rem | 112 % | 760 | 1 |
| Subtítulo | 1,25 a 1,5 rem | 106 % | 700 | 1,15 |
| Texto | 1,0625 rem (17 px) | 100 % | 400; 650 para destacar | 1,55 |
| Chico | 0,9375 rem (15 px) | 100 % | 400 | 1,5 |
| Rótulo | 0,8125 rem (13 px) | 92 % | 620 | 1,4 |

Reglas: sin cursivas; sin mayúsculas espaciadas (los rótulos van en minúscula); cifras tabulares donde se alinean;
Outfit no compone texto en la web. `letras/` trae Archivo y Outfit para instalar en el computador (TTF variables) y
para la web (woff2), con su licencia.

## 5. Geometría

Dos gestos y nada más:

- **El doblez a 45°.** La esquina de arriba a la derecha de una hoja, doblada, deja ver el azul de abajo: en la web,
  esa esquina abre el índice y no significa otra cosa. Los cortes de la «t» y la «p» de la marca son el mismo doblez.
- **La escalera sobre la cuadrícula.** Las láminas se recortan en escalera de uno, tres o seis cuadros (cada fila con un
  cuadro más que la anterior, todas pegadas al mismo lado). La pieza que falta en la hoja del 404 es la escalera de tres.

No se hace: usar la esquina doblada como adorno, en tarjetas o botones; recortar en otras formas; copiar piezas o
mecánicas de juegos de bloques (caer, girar, completar filas).

## 6. Láminas y figuras

Lo que se sabe desde siempre y la figura con que pteron lo dibuja hoy para tu clase.

- **Origen:** sólo obras de dominio público o piezas propias, siempre con su crédito (autor y año, y la institución que
  la conserva).
- **Recorte:** en escalera sobre la cuadrícula. La lámina se recorta; no se deforma ni se colorea.
- **Figura:** detrás de cada lámina va la figura que dibuja el motor de pteron, el mismo de sus materiales, con su
  título en Outfit como lo rotula pteron.
- **Crédito:** legible (en Archivo, 10,5 px o más); donde no cabe, se omite en la lámina y se nombra en la página.

## 7. La hoja

- **Papel:** oficio por omisión (215,9 × 330,2 mm), el papel de las escuelas chilenas; también carta, A4 y legal (EE. UU.).
- **pteron no firma el trabajo del profe.** Las hojas que arma llevan el membrete del establecimiento que el profe
  configura (o ninguno), y su pie dice sólo el título y «Pág. N de M». Ni la marca ni la «p» van en hojas,
  exportaciones, marcas de agua o el centro de un código QR.
- En la web, cada página es una hoja: la marca va como membrete arriba a la izquierda, en el mismo lugar en cada
  página, y la esquina doblada abre el índice. No hay barra arriba.
- **Impreso:** la web se imprime en papel blanco con márgenes, sin láminas, sombras ni la esquina; lo que no cabe en
  una página no se corta (una ficha, una hoja de muestra, una tabla de colores).

## 8. La interfaz

- **Objetivos de 44 px** para todo lo que se toca, sin mover el dibujo (el área crece con un borde invisible).
- **Foco visible** siempre, encima de todo y con contraste de 3 : 1 o más contra lo que lo rodea: en azul (en la app,
  `#8FB0F4` sobre lo oscuro), nunca en lápiz.
- **Movimiento:** una curva, `cubic-bezier(0.2, 0.7, 0.2, 1)`, y tres gestos con nombre: doblar, voltear y volar.
  Con movimiento reducido, ninguno: los cambios son inmediatos.
- **Sin JavaScript** la página se lee entera y nada queda a medias.
- **Radios:** 12 px en tarjetas y paneles; 6 px en lo que es papel; los botones, redondos.
- La réplica de la app en la web es idéntica a la app: se recorta o se acerca, nunca se le cambia el estilo.

## 9. Voz

Hablamos como un colega que conoce el oficio: corto, concreto y en el español de la sala de profesores.

- **Tuteo** y verbos: pteron reconoce el material, el curso, la asignatura, el tema y la duración.
- **Las palabras de la escuela chilena:** guía, prueba, planificación, 6° básico, Currículum Nacional, computador.
- **Sin titulares que celebran lo obvio** ni exclamaciones: «Hoja del estudiante · Versión docente», no «¡Tu hoja,
  lista en segundos!».
- **Una sola frase acompaña a la marca:** Construido por profes, para profes.
- **Nada que el producto no haga hoy.** Ni métricas, testimonios, logos de colegios o del Ministerio.
- **Escritura:** comillas «», el signo › para rutas de menú (Configuración › Perfil), coma decimal y punto de miles
  ($2.999), fechas con el mes en palabras, «sólo» con tilde cuando es adverbio, como en el resto de pteron.

## 10. Accesibilidad

Contraste AA en todo texto; foco visible; objetivos de 44 px; movimiento reducido respetado; textos alternativos que
dicen qué muestra la imagen y, en una lámina, su crédito; nada que dependa sólo del color (en una figura, cada parte
lleva su rótulo o su sombreado).

## 11. Archivos y versiones

El kit trae un `manifiesto.json` con el tamaño y la suma SHA-256 de cada archivo, y `verificar.mjs` lo comprueba:

    node verificar.mjs

Si un archivo cambia, cambia la versión del kit. Los archivos del sitio salen de los mismos dibujos
(`scripts/marca-dibujos.mjs` en el repositorio de la web) y una prueba exige que coincidan con el kit.
