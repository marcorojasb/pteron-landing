# Pendientes legales de la venta de Basic (octubre de 2026)

Estado: abierto. Las páginas públicas (`/planes`, `/cuenta`, `terminos.html` y `privacidad.html`, versión
2026-10-13) dicen sólo hechos del producto: precio con IVA, prueba, renovación, cancelación, cobros pendientes,
cuota, uso aceptable, adónde viaja lo que se pide a la IA incluida y quiénes tratan los datos. Lo que necesita una
decisión de Marco o la revisión de un abogado o de un contador no se escribió en ellas: queda aquí, con borradores y
opciones. Las llaves `{…}` son datos que faltan.

Todo lo de este archivo requiere revisión. Las fuentes son las del informe web-legal de la auditoría R9; los textos
legales salieron de copias oficiales (SERNAC, SUSESO, Diario Oficial) y de estudios jurídicos, porque bcn.cl no se pudo
leer: hay que cotejarlos ahí.

Estado de la implementación (los puntos de abajo dicen lo que falta decidir): el Worker ya tiene el correo de confirmación,
el aviso de fin de prueba, el correo de cancelación y la copia inmutable de los Términos (`/terminos/2026-10-13`).
Están implementados: salen sólo con `RESEND_API_KEY` y los `SELLER_*` (y `EMAIL_FROM`). La clave ya está cargada en el
Worker y los `SELLER_*` están en `wrangler.jsonc`, así que quedan habilitados al desplegar este cambio desde `main`
(producción sigue con los `SELLER_*` vacíos hasta entonces); ver `README.md`, «Correos». Supabase Auth ya envía el enlace de acceso por Resend desde no-reply@patagua.dev. Los borradores
completos, con sus fuentes, están en `BORRADORES-LEGALES.md`.

Los puntos 1 a 4 impiden abrir la venta. Mientras tanto, la venta sigue cerrada con `for_sale = false` en
`plan_catalog` y /cuenta muestra «Disponible pronto».

## 1. Quién vende (resuelto)

**Llenado (13-10-2026), con la declaración jurada de inicio de actividades del SII:** vende Patagua.dev SpA (sociedad
por acciones), RUT 78.418.149-9, afecta a IVA, micro empresa, giro de desarrollo de software; contacto
hola@patagua.dev; representante legal, Marco Antonio Rojas Belmar. Domicilio legal: la declaración dice «FDO SAN
RICARDO LTA LTB, Comuna: CORONEL»; se escribió «Fundo San Ricardo, Lote A y Lote B, Coronel, Región del Biobío».
Marco confirmó el 13-10-2026 esa redacción del domicilio y que él es el representante legal. No se publican el
teléfono ni los datos de la propiedad que trae el certificado.

Ya está en `wrangler.jsonc` (`SELLER_NAME`, `SELLER_RUT`, `SELLER_ADDRESS`, `SELLER_EMAIL`, `SELLER_REPRESENTATIVE`), en
la sección 12 «Quién vende y contacto» de los Términos y su copia fija, y en la línea legal del colofón de todas las
páginas. `RESEND_API_KEY` ya está cargado en el Worker; con las variables puestas, los tres correos al cliente quedan
**habilitados al desplegar este cambio**.
Falta lo que la tabla de «Dónde va» marca para Privacidad (responsable) y el resumen antes de Flow en /cuenta.
La opción de abajo quedó resuelta como B: una empresa (Patagua.dev SpA).

Se vende en línea sin decir quién vende. El Reglamento de Comercio Electrónico (Decreto 6/2021 de Economía, vigente
desde el 24-03-2022) pide nombre o razón social, RUT, domicilio, un contacto y, si es persona jurídica, su representante
legal. La Ley 21.719 (art. 14 ter b) pide además individualizar al responsable de los datos.

Opciones:

- **A.** Marco como persona natural, con inicio de actividades y un giro que ampare servicios de software.
- **B.** Una empresa titular de la cuenta de Flow. Si la cuenta es de Patagua, decidir si Patagua vende pteron (el
  contrato de este repositorio lo declara un proyecto independiente) y qué nombre verá el docente en su cartola.

La elección arrastra a Flow: su «Cargo automático», el que cobra la tarjeta registrada sin que el docente haga nada, es
sólo para empresas, con cuenta bancaria de la empresa, RUT en el SII y un giro que ampare lo cobrado. Sin él, Flow
envía un enlace de pago cada mes y hay que cambiar los textos que dicen «Registras tu tarjeta en Flow» (/planes,
/cuenta, Términos §4).

Dónde va: una sección 1 «Quién vende» en los Términos; el responsable en Privacidad; el resumen antes de Flow en
/cuenta; el correo de confirmación (punto 3), y la línea legal del colofón, que escribe `scripts/sitio.mjs` (función
`colofon`).

Borrador:

> Quién vende: {razón social o nombre}, RUT {…}, domicilio {…}, correo pteron@patagua.dev{, representante legal {…}}.

Fuentes: https://www.bcn.cl/leychile/navegar?i=1165504 ·
https://www.carey.cl/tras-meses-de-espera-se-publica-reglamento-de-comercio-electronico/ ·
https://www.sernac.cl/portal/604/w3-propertyvalue-20982.html ·
https://web.flow.cl/es-cl/preguntas-frecuentes/cargo-automatico/

## 2. Derecho a retracto y devoluciones

Borradores y fuentes: `BORRADORES-LEGALES.md`, sección 2 (mismas letras y nombres: opción A, mantener el retracto;
opción B, excluirlo). Implementado: nada de
política; el correo omite el párrafo de retracto mientras `TERMS_RETRACTO` (`src/lib/terms.js`) esté vacío, y una prueba
obliga a pegarlo ahí si los Términos lo incluyen. Decisión pendiente: mantenerlo o excluirlo, desde cuándo corre con la
prueba, el tamaño de la advertencia y el procedimiento de reembolso.

Ni las páginas ni el Worker dicen nada de retracto ni de devoluciones. Según el art. 3 bis b) de la Ley 19.496 (texto
de la Ley 21.398), en servicios contratados a distancia el consumidor puede retractarse dentro de 10 días desde la
contratación y antes de la prestación; el proveedor de servicios puede excluirlo si lo informa de manera inequívoca,
destacada y fácilmente accesible antes del contrato y del pago. Sin la confirmación escrita del art. 12 A (punto 3) el
plazo sube a 90 días. La devolución se hace sin retener gastos y antes de 45 días, y en servicios cubre sólo lo no
prestado.

El Decreto 52/2024 de Economía (vigente desde el 28-02-2025) fija cómo se excluye: antes del contrato o del pago, en el
mismo lugar o momento en que se informa el precio, con una advertencia destacada «cuyo tamaño no sea inferior a la
información respecto del precio» y con la expresión «derecho a retracto».

- **Opción A, mantener el retracto:**
  > Derecho a retracto: puedes retractarte dentro de 10 días desde que contratas, escribiendo a pteron@patagua.dev o
  > desde tu cuenta. Te devolvemos dentro de 45 días lo pagado que no corresponda a días ya usados.
- **Opción B, excluir el retracto** (la que recomienda la auditoría). Junto al precio en /planes y en el resumen antes de
  Flow, en letra no menor que «$2.990»; repetido en los Términos y en la confirmación:
  > Basic no tiene derecho a retracto. Lo pruebas gratis 7 días y lo cancelas cuando quieras desde tu cuenta.

Devoluciones, en las dos opciones (A y B):

> Al cancelar no se devuelven los días que queden del período pagado. Un cobro hecho por error nuestro se devuelve
> completo{, también el primer cobro si nos avisas dentro de 10 días que olvidaste cancelar la prueba}.

Operación: el Worker no reembolsa. Flow ofrece `/refund/create`, asíncrono (avisa por `urlCallback`), y /admin tiene
«Terminar ahora» (cancela en Flow con `at_period_end = 0`). Falta escribir el procedimiento de retracto, reembolso y
contracargo.

Para el abogado: ¿desde cuándo corre el retracto con prueba gratis, desde que se registra la tarjeta (día 0) o desde el
primer cobro (día 7)? ¿«Tamaño no inferior» exige la misma letra que el precio?

Fuentes: https://www.sernac.cl/portal/609/w3-propertyvalue-58897.html ·
https://www.suseso.gob.cl/620/w3-propertyvalue-119530.html ·
https://www.diariooficial.interior.gob.cl/publicaciones/2024/08/27/43935/01/2535265.pdf ·
https://www.carey.cl/publican-reglamento-que-establece-exclusiones-al-derecho-de-retracto

## 3. Confirmación escrita del contrato y copia de los Términos

Borradores y fuentes: `BORRADORES-LEGALES.md`, sección 3. Implementado (la clave de Resend ya está cargada y los
`SELLER_*` puestos en `wrangler.jsonc`; sale al desplegar): el Worker envía el correo de confirmación al crearse la suscripción, con la copia de los Términos aceptados
adjunta y el enlace a la copia inmutable `/terminos/2026-10-13` (`public/terminos/`), por Resend, una vez por
suscripción, con reintentos del Cron. Decisión pendiente: si basta ese adjunto o hay que enviar el texto íntegro y
Privacidad, y los textos de quién vende y retracto. Ver `README.md`, «Correos».

La aceptación previa ya existe: el resumen de /cuenta exige marcar «Leí y acepto los Términos (versión 2026-10-13) y
la Política de privacidad», el checkout rechaza otra versión (`terms_required`) y la versión aceptada queda en el
intento de pago y en la suscripción. La otra mitad del art. 12 A es una vez perfeccionado el contrato: una
confirmación escrita, por un medio informado antes, con copia íntegra, clara y legible del contrato. Ya está
implementada con Resend, el mismo proveedor del SMTP de Supabase Auth; la clave y los `SELLER_*` ya están puestos y
sólo falta desplegar.

Borrador del correo, que sale cuando `card-callback` crea la suscripción:

> Asunto: Tu plan {Basic} de pteron
>
> {Quién vende, punto 1.} Contrataste {Basic} a $2.990 al mes, IVA incluido. {Si hay prueba:} Tu prueba termina el
> {fecha}; ese día se cobran $2.990, y luego cada mes, hasta que canceles. {Si no:} El primer cobro se hizo el {fecha}.
> Cancelas cuando quieras en https://pteron.patagua.dev/cuenta. {Retracto y devoluciones, punto 2.} Tu cuota de IA
> incluida: {6.000.000} unidades por período ({1.500.000} durante la prueba). Aceptaste los Términos versión
> {2026-10-13}: {enlace a esa versión y texto íntegro o PDF}.

El aviso previo al pago ya existe: el resumen de /cuenta dice «Te enviaremos la confirmación de la compra y una copia
de los Términos a {correo de la cuenta}», para que el comprador sepa de antemano adónde llega la confirmación escrita.

Versiones: antes de cambiar el texto de los Términos, publicar la versión vigente en una URL fija (por ejemplo
`/terminos/2026-10-13`) para que lo aceptado siga legible.

Para el abogado: ¿basta un enlace a la versión aceptada o hay que enviar el texto íntegro?

Fuente: https://www.suseso.gob.cl/612/w3-propertyvalue-119539.html

## 4. Boleta electrónica e IVA

Borradores y fuentes: `BORRADORES-LEGALES.md`, sección 4. Corrige este punto: según la Res. 176/2020 del SII, el
comprobante de una venta con tarjeta en línea puede valer como boleta si Flow está registrado ante el SII y el
comprobante trae el contenido exigido; hay que confirmarlo con Flow (correo listo en la sección 6 de los borradores) y
con el contador. El desglose es $2.990 = $2.513 neto + $477 IVA. Implementado: nada. Decisión pendiente: voucher de
Flow, sistema gratuito del SII o emisión automática, el giro y la anulación en reembolsos.

Cada cobro de $2.990 a un consumidor requiere boleta electrónica (Ley 21.210) con el IVA desglosado, y desde el
1-1-2023 los servicios están afectos a IVA (Ley 21.420). Flow no emite boletas y el Worker tampoco. Los precios ya se
publican con IVA incluido ($2.990 = $2.512,61 neto + $477,39 de IVA, según el informe).

- **Opción A.** El sistema gratuito del SII, una boleta por cobro, a mano. Sirve con poco volumen.
- **Opción B.** Un proveedor con API, disparado cuando la sincronización con Flow ve una factura pagada.

Texto para los Términos y las preguntas frecuentes, cuando se decida:

> Por cada cobro te enviamos la boleta electrónica a tu correo.

Para el contador: la boleta por cobro, el giro, y el IVA y las retenciones al pagar a Anthropic, Cloudflare y Supabase.

Fuentes: https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_7666.htm ·
https://www.sii.cl/preguntas_frecuentes/bol_electr_vtas_serv/001_380_7672.htm ·
https://www.sii.cl/noticias/2022/211222noti01aav.htm ·
https://www.sii.cl/normativa_legislacion/circulares/2022/circu50.pdf

## 5. Datos de estudiantes: tratamiento por encargo

Borradores y fuentes: `BORRADORES-LEGALES.md`, sección 5 (roles, DPA de Anthropic, cláusula de encargo). Implementado:
nada. Decisión pendiente: los roles, si las cláusulas tipo del DPA amparan la transferencia a EE. UU. y la cláusula de
los Términos.

Cuando un docente incluye datos de sus estudiantes (muchas veces menores) en un pedido a la IA incluida, el
responsable sería el docente o su establecimiento, y pteron un encargado que a su vez usa a Anthropic y a Cloudflare.
Desde el 1-12-2026 la Ley 21.719 regula al encargado (art. 15 bis) y las transferencias internacionales (arts. 27 y
28). Sin contrato de encargo ni autorización de subencargados, ese envío queda sin base. Privacidad ya explica el aviso
de datos de estudiantes y adónde viaja el contenido; falta definir el rol.

Si el abogado concluye que es un encargo, borrador de una sección de los Términos, «Tratamiento por encargo»:

> Cuando incluyes en un pedido datos personales de otras personas, como tus estudiantes, pteron los trata por encargo
> tuyo y sólo para responder ese pedido. No los usa para otra cosa, no los guarda y los trata con reserva. Para
> responder se apoya en Anthropic (Estados Unidos) y Cloudflare, con sus acuerdos de tratamiento de datos, y tú
> autorizas ese envío. {Eliminación, seguridad y cómo se ejerce el encargo.}

Fuentes: https://www.bcn.cl/leychile/navegar?idNorma=1209272 ·
https://blog.hackmetrix.com/proveedores-y-transferencia-internacional-en-la-ley-21-719/

## 6. Lo que le falta a Privacidad (art. 14 ter, desde el 1-12-2026)

Borradores y fuentes: `BORRADORES-LEGALES.md`, sección 5. Implementado: el proveedor de correo (Resend, para el enlace de acceso de
Supabase Auth, desde no-reply@patagua.dev, y para los correos del Worker) ya figura en Privacidad, sección 7. Lo demás de
este punto sigue pendiente. Decisión pendiente: todo lo demás, con los plazos de respuesta antes de diciembre.

Privacidad ya tiene: los datos de la cuenta y del plan, la IA incluida (contenido, identificador seudónimo, retención de
Anthropic), los proveedores (Cloudflare con sus registros de hasta 7 días, Supabase, Resend, Flow, Anthropic, GitHub) y su
versión. Falta lo que exige una decisión:

- El responsable y su representante (punto 1).
- Las bases de licitud: el contrato; el consentimiento para la nube, que pide la app; la obligación legal (boletas).
- Los plazos de conservación por categoría: cuenta, suscripción y cobros, licencias y activaciones, uso de la IA
  incluida y eventos de cobro.
- Los derechos (acceso, rectificación, supresión, oposición, portabilidad y bloqueo), cómo se piden, en qué plazo se
  responde, y el reclamo ante la Agencia de Protección de Datos Personales.
- La región del proyecto de Supabase (`swzqblyllbudwbmbcthr`) y si eso es una transferencia internacional.
- El rol de Flow: encargado de pteron o responsable de los datos de pago.
- El rol de Resend: encargado de pteron para el envío de correo (recibe la dirección y el mensaje). Supabase Auth ya
  envía por su SMTP, no por el incluido de Supabase, que sólo envía a direcciones autorizadas.

Borrador de derechos:

> Puedes pedir acceso a tus datos, corregirlos, eliminarlos, oponerte a su tratamiento, llevártelos o bloquearlos
> escribiendo a pteron@patagua.dev. Te respondemos dentro de {30} días. Desde el 1 de diciembre de 2026 también puedes
> reclamar ante la Agencia de Protección de Datos Personales.

Fuentes: https://actualidadjuridica.doe.cl/articulo-14-ter-el-deber-de-informar-que-no-entrega-instrucciones-para-cumplir/ ·
https://supabase.com/docs/guides/auth/auth-smtp

## 7. Cambios de precio, cuota o condiciones

Implementado: el correo de cancelación (`cancellation`) confirma «Cancelar renovación». El aviso de cambios de precio no
existe. Decisión pendiente: plazos y texto; los correos ya tienen por dónde salir.

Hecho técnico que la decisión debe considerar: la cuota de un período se fija la primera vez que se usa la IA incluida
en él, con el valor del catálogo de ese momento. Una baja de cuota en /admin puede alcanzar así a un período ya empezado
pero todavía sin uso. Bajar la cuota o subir el precio es un cambio unilateral (art. 16 a de la Ley 19.496); subir la
cuota no.

Borrador para los Términos, que necesita el correo del punto 3:

> Si subimos el precio o reducimos la cuota, te avisamos por correo con {30} días de anticipación. El cambio rige desde
> tu período siguiente y puedes cancelar antes, sin costo.

## 8. Uso indebido y contrato con Anthropic

Los Términos (§9) dicen que la licencia es personal y sólo sirve desde pteron, y remiten a la Política de uso de
Anthropic, pero no qué pasa si alguien no lo respeta. Decidir: revocar la licencia, suspender la IA incluida o terminar
el plan; con aviso o sin él; con devolución de lo no prestado o sin ella.

El contrato con Anthropic (Commercial Terms) exige que el uso cumpla su Usage Policy (D.2), avisar que las afirmaciones
de hecho de sus respuestas pueden ser incorrectas (D.3; ya está en los Términos §8) y prohíbe revender sus servicios sin
aprobación (D.4(a)). Preguntar a Anthropic si un plan con IA incluida necesita esa aprobación.

Una prueba por persona: el Worker la niega a una cuenta que ya tuvo un plan con Flow, pero alguien puede abrir otra
cuenta con otro correo. Decidir si los Términos lo prohíben y qué pasa si ocurre.

Fuente: https://www.anthropic.com/legal/commercial-terms

## 9. Reclamos y ley aplicable

Borrador, para validar (tribunal competente, art. 50 A de la Ley 19.496):

> Puedes reclamar escribiendo a pteron@patagua.dev o ante el SERNAC (www.sernac.cl). Estos términos se rigen por la ley
> chilena.

## 10. Flow: lo que hay que confirmar porque los textos lo afirman

Borradores y fuentes: `BORRADORES-LEGALES.md`, sección 6 (correo a Flow con ocho preguntas, listo para enviar).
Implementado: nada; son confirmaciones de Flow.

- **Cargo automático** (punto 1): sin él, la tarjeta registrada no se cobra sola.
- **Cargo de validación:** el manual de suscripciones de Flow anuncia un cargo de $50 para validar la tarjeta, que se
  devuelve. El resumen antes de Flow dice «Hoy no se cobra nada»; si ese cargo ocurre, agregar «Flow puede hacer un
  cargo de $50 para validar tu tarjeta, que se devuelve».
- **Cancelar durante la prueba:** /planes, /cuenta y los Términos dicen que cancelar en la prueba evita el primer
  cobro. Confirmar en el sandbox que `subscription/cancel` con `at_period_end = 1` durante la prueba no genera la
  primera factura.
- **Comprobante:** si Flow envía un comprobante en cada cobro, puede mencionarse junto a la boleta (punto 4).

Fuentes: https://web.flow.cl/manual-suscripciones-flowpagos.pdf · https://web.flow.cl/es-cl/suscripciones-de-pago/

## 11. Aviso antes del fin de la prueba

Implementado: el Cron diario envía el aviso a quien termina su prueba en menos de 48 horas y no canceló
(`trial_ending`), que sale al desplegar, con la clave de Resend y los `SELLER_*` ya puestos. Queda por decidir sólo el texto final.

No lo exige una norma que se haya encontrado, pero el SERNAC fiscaliza las conversiones poco claras de prueba a pago y
las barreras de salida. Recomendado: un correo 2 o 3 días antes del primer cobro (necesita el correo del punto 3).

> Tu prueba de Basic termina el {fecha}. Ese día se cobran $2.990, salvo que canceles antes en
> https://pteron.patagua.dev/cuenta.

Fuentes: https://www.sernac.cl/portal/604/w3-article-85909.html ·
https://www.sernac.cl/portal/604/w3-article-83137.html

## Lo que los textos públicos ya prometen y depende de decisiones técnicas

Si cambia alguna, hay que cambiar los textos y, si toca los Términos, su versión (que el Worker exige en el checkout:
`TERMS_VERSION`, hoy 2026-10-13):

- La gracia: la IA incluida sigue hasta 72 horas después del fin del período pagado (/planes, Términos §6). Es la
  decisión técnica `acceso_hasta = pagado_hasta + 72 h` del contrato R9.
- La cuota: 6.000.000 unidades por período en Basic, 1.500.000 en la prueba y 30.000.000 en Pro, renovada con el cobro
  (/planes, /cuenta, Términos §7). Están en `plan_catalog`; /cuenta las lee de ahí, pero /planes y los Términos las
  repiten escritas.
- La equivalencia en materiales: no se publicó ninguna cifra. Se publicará cuando se mida con docentes por el gateway
  real.
