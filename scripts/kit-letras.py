"""Las letras del kit para instalar en un computador: Archivo y Outfit en TTF, desde los woff2 que sirve el sitio.

Son las fuentes variables tal cual (todo el peso y, en Archivo, todo el ancho), del subconjunto latino que publica
fontsource: cubre el castellano entero (á é í ó ú ü ñ ¿ ¡ « »). Sólo se cambia el envoltorio (woff2 → TTF); los nombres y
la licencia (SIL Open Font License 1.1) son los de sus autores.

    python3 scripts/kit-letras.py            escribe kit/archivos/letras/*.ttf
    python3 scripts/kit-letras.py --revisar  sólo comprueba que estén al día

Necesita fontTools con brotli (pip install fonttools brotli). No son dependencias del sitio: los TTF viven en el repositorio.
"""
import io
import pathlib
import sys

from fontTools.ttLib import TTFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
LETRAS = {
    "Archivo.ttf": RAIZ / "public/assets/fonts/archivo-latin-wdth-normal.woff2",
    "Outfit.ttf": RAIZ / "public/assets/fonts/outfit-latin-wght-normal.woff2",
}
SALIDA = RAIZ / "kit/archivos/letras"


def ttf(origen):
    # Sin recalcular la fecha de la cabecera: el mismo woff2 da siempre el mismo TTF, byte a byte
    font = TTFont(origen, recalcTimestamp=False)
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf, reorderTables=True)
    return buf.getvalue()


def main():
    revisar = "--revisar" in sys.argv
    SALIDA.mkdir(parents=True, exist_ok=True)
    desactualizados = 0
    for nombre, origen in LETRAS.items():
        datos = ttf(origen)
        destino = SALIDA / nombre
        if destino.exists() and destino.read_bytes() == datos:
            continue
        desactualizados += 1
        if not revisar:
            destino.write_bytes(datos)
        print(f"{'desactualizado' if revisar else 'escrito'}: {destino.relative_to(RAIZ)}")
    if revisar and desactualizados:
        sys.exit(1)


if __name__ == "__main__":
    main()
