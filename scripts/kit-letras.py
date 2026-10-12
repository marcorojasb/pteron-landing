"""Las letras del kit para instalar en un computador: Archivo y Outfit en TTF.

Archivo sale del woff2 que sirve el sitio: la fuente variable tal cual (todo el peso y todo el ancho), del subconjunto
latino que publica fontsource, que cubre el castellano entero (á é í ó ú ü ñ ¿ ¡ « »). Sólo cambia el envoltorio
(woff2 → TTF).

Outfit es la misma de pteron, byte a byte: la que trae pteron-design 6.0.0 (fonts/outfit/Outfit-wght.ttf) y con la que
pteron compone sus hojas y rotula sus figuras. Tiene los signos de las figuras que el subconjunto de la web no trae
(→, −). No se genera: se copia de la app y se fija por su suma.

    python3 scripts/kit-letras.py                    escribe kit/archivos/letras/Archivo.ttf
    python3 scripts/kit-letras.py --outfit RUTA      además copia Outfit desde la app, si su suma es la esperada
                                                     (RUTA: src/vendor/pteron-design/fonts/outfit/Outfit-wght.ttf)
    python3 scripts/kit-letras.py --revisar          sólo comprueba que estén al día

Los nombres y la licencia (SIL Open Font License 1.1) son los de sus autores. Necesita fontTools con brotli
(pip install fonttools brotli). No son dependencias del sitio: los TTF viven en el repositorio.
"""
import hashlib
import io
import pathlib
import sys

from fontTools.ttLib import TTFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARCHIVO = RAIZ / "public/assets/fonts/archivo-latin-wdth-normal.woff2"
# La suma de Outfit-wght.ttf en el manifiesto de pteron-design 6.0.0 (src/vendor/pteron-design/upstream.json de la app)
OUTFIT_SHA256 = "fc7287273e66929776e2ba54f144fe699080bec29f61bf649d70d871468aeade"
SALIDA = RAIZ / "kit/archivos/letras"


def ttf(origen):
    # Sin recalcular la fecha de la cabecera: el mismo woff2 da siempre el mismo TTF, byte a byte
    font = TTFont(origen, recalcTimestamp=False)
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf, reorderTables=True)
    return buf.getvalue()


def sha256(datos):
    return hashlib.sha256(datos).hexdigest()


def main():
    revisar = "--revisar" in sys.argv
    SALIDA.mkdir(parents=True, exist_ok=True)
    fallas = 0

    destino = SALIDA / "Archivo.ttf"
    datos = ttf(ARCHIVO)
    if not (destino.exists() and destino.read_bytes() == datos):
        if revisar:
            fallas += 1
        else:
            destino.write_bytes(datos)
        print(f"{'desactualizado' if revisar else 'escrito'}: {destino.relative_to(RAIZ)}")

    destino = SALIDA / "Outfit.ttf"
    if "--outfit" in sys.argv and not revisar:
        origen = pathlib.Path(sys.argv[sys.argv.index("--outfit") + 1])
        datos = origen.read_bytes()
        if sha256(datos) != OUTFIT_SHA256:
            sys.exit(f"{origen} no es la Outfit de pteron-design 6.0.0: si cambió en la app, actualiza OUTFIT_SHA256")
        if not (destino.exists() and destino.read_bytes() == datos):
            destino.write_bytes(datos)
            print(f"escrito: {destino.relative_to(RAIZ)}")
    if not destino.exists() or sha256(destino.read_bytes()) != OUTFIT_SHA256:
        fallas += 1
        print(f"no es la Outfit de pteron: {destino.relative_to(RAIZ)} (cópiala con --outfit)")

    if fallas:
        sys.exit(1)


if __name__ == "__main__":
    main()
