"""El trazado de la marca «pteron»: public/assets/marca.svg, el único dibujo de la marca. De él salen las descargas, el
icono y el favicon (scripts/marca.mjs).

La marca es la palabra compuesta en Outfit (The Outfit Project Authors, OFL), la letra con que pteron rotula sus
figuras: peso 600, con la forma y el kerning de la propia letra y el espacio cerrado en 10 unidades. Tiene dos ajustes
de dibujo:

- la «t» dobla a 45° la esquina de arriba a la derecha de su asta, como la hoja de la web;
- la «p» corta a 45° la esquina opuesta: abajo a la izquierda de su asta.

Los dos cortes miden el 60 % del ancho del asta de la «t». Las letras se unen en un solo contorno con sus huecos
invertidos; el origen del símbolo queda en el centro de la tinta y en la línea base, en unidades de em × 1000.

    python3 scripts/marca-trazado.py            escribe public/assets/marca.svg
    python3 scripts/marca-trazado.py --revisar  sólo comprueba que esté al día

Necesita fontTools, uharfbuzz y skia-pathops (pip install fonttools brotli uharfbuzz skia-pathops; se probó con
fonttools 4.66.1, uharfbuzz 0.56.3 y skia-pathops 0.9.2). No son dependencias del sitio: el SVG vive en el repositorio.
"""
import io
import math
import pathlib
import sys

import pathops
import uharfbuzz as hb
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "public/assets/fonts/outfit-latin-wght-normal.woff2"
SALIDA = RAIZ / "public/assets/marca.svg"

EJES = {"wght": 600}
ESPACIO = -10
CORTE = 0.6


def instancia():
    font = instancer.instantiateVariableFont(TTFont(FUENTE), EJES, inplace=False)
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def letras(datos):
    """Cada letra de «pteron» como un pathops.Path, ya en su lugar (forma y kerning de HarfBuzz)."""
    font = TTFont(io.BytesIO(datos))
    glifos = font.getGlyphSet()
    orden = font.getGlyphOrder()
    buf = hb.Buffer()
    buf.add_str("pteron")
    buf.guess_segment_properties()
    hb.shape(hb.Font(hb.Face(datos)), buf, {"kern": True, "liga": False})
    x = 0
    out = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        p = pathops.Path()
        glifos[orden[info.codepoint]].draw(TransformPen(p.getPen(glyphSet=glifos), (1, 0, 0, 1, x + pos.x_offset, pos.y_offset)))
        out.append(p)
        x += pos.x_advance + ESPACIO
    return out


def poligono(puntos):
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo(puntos[0])
    for q in puntos[1:]:
        pen.lineTo(q)
    pen.closePath()
    return p


def puntos(path):
    return [q for _, pts in path for q in pts]


def unir(paths):
    out = pathops.Path()
    for p in paths:
        out = pathops.op(out, p, pathops.PathOp.UNION)
    return out


def esquina(path, x, y, c, sx, sy):
    """Corta a 45° la esquina (x, y): un triángulo de catetos c hacia adentro (sx, sy: hacia dónde queda la esquina)."""
    e = c * 0.5 + 4  # el triángulo sobresale de la letra para que el corte sea limpio
    triangulo = [(x - sx * (c + e), y + sy * e), (x + sx * e, y + sy * e), (x + sx * e, y - sy * (c + e))]
    return pathops.op(path, poligono(triangulo if sx * sy > 0 else triangulo[::-1]), pathops.PathOp.DIFFERENCE)


def marca():
    p, t, *resto = letras(instancia())
    # El asta de la t es un rectángulo: su borde de arriba da el ancho y la esquina que se dobla
    pt = puntos(t)
    arriba = max(q[1] for q in pt)
    borde = [q[0] for q in pt if q[1] > arriba - 1]
    izquierda, derecha = min(borde), max(borde)
    c = (derecha - izquierda) * CORTE
    t = esquina(t, derecha, arriba, c, 1, 1)
    pp = puntos(p)
    p = esquina(p, min(q[0] for q in pp), min(q[1] for q in pp), c, -1, -1)
    return unir([p, t, *resto])


def numero(v):
    t = f"{v:.1f}".rstrip("0").rstrip(".")
    return "0" if t in ("-0", "") else t


def svg(path):
    x0, y0, x1, y1 = path.bounds
    cx = (x0 + x1) / 2

    def pt(x, y):
        # y hacia abajo: la línea base en 0 y la tinta de arriba en negativo; x desde el centro de la tinta
        return f"{numero(x - cx)} {numero(-y)}"

    partes = []
    for verbo, pts in path:
        if verbo == pathops.PathVerb.MOVE:
            partes.append("M" + pt(*pts[0]))
        elif verbo == pathops.PathVerb.LINE:
            partes.append("L" + pt(*pts[0]))
        elif verbo == pathops.PathVerb.QUAD:
            partes.append("Q" + pt(*pts[0]) + " " + pt(*pts[1]))
        elif verbo == pathops.PathVerb.CUBIC:
            partes.append("C" + " ".join(pt(*q) for q in pts))
        elif verbo == pathops.PathVerb.CLOSE:
            partes.append("Z")
    # La caja, redondeada hacia afuera: tan ancha como la tinta, de la t a la p
    medio = math.ceil((x1 - x0) / 2)
    caja = f"{-medio} {-math.ceil(y1)} {2 * medio} {math.ceil(y1) + math.ceil(-y0)}"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="pteron" viewBox="' + caja + '"><title>pteron</title>'
        '<path fill="currentColor" fill-rule="evenodd" d="' + "".join(partes) + '"/></symbol></svg>\n'
    )


if __name__ == "__main__":
    nuevo = svg(marca())
    antes = SALIDA.read_text() if SALIDA.exists() else ""
    if "--revisar" in sys.argv:
        print("al día" if antes == nuevo else "desactualizado: public/assets/marca.svg")
        sys.exit(0 if antes == nuevo else 1)
    SALIDA.write_text(nuevo)
    print("escrito: public/assets/marca.svg", nuevo.split('viewBox="')[1].split('"')[0])
