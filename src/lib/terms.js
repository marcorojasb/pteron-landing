// Versión vigente de los Términos: el checkout exige que la cuenta web envíe esta misma fecha.
export const TERMS_VERSION = "2026-10-13";
// La confirmación de compra enlaza la copia fija de la versión aceptada:
// /terminos/<versión> (public/terminos/<versión>.html). Al cambiar la versión,
// publica antes esa copia y deja la de la versión anterior donde está.

// El párrafo de retracto y devoluciones de la confirmación de compra es copia
// literal del que digan los Términos de esa versión: el correo repite lo que los
// Términos dicen y no inventa política. Los de 2026-10-13 todavía no lo dicen
// (LEGAL-PENDIENTE.md, punto 2), así que el correo no lo lleva. Cuando los
// Términos lo incluyan, pégalo aquí (con una prueba que lo compare, ver
// tests/correo.test.js) y súbeles la versión.
export const TERMS_RETRACTO = "";
