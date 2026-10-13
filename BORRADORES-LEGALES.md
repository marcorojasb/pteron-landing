# Borradores legales para la venta de Basic y Pro (octubre de 2026)

Estado: borrador para revisión. **Esto no es asesoría legal ni tributaria.** Son textos y preguntas para llevar a un
abogado y a un contador en Chile; ellos deciden. Parte de `LEGAL-PENDIENTE.md` (puntos 1 a 6 y 10), de
`public/terminos.html` y de `public/privacidad.html`, versión 2026-10-13.

Cada afirmación legal se apoya en una fuente oficial que se abrió el 13-10-2026 y se cita con su enlace. Cuando una
fuente no zanja algo, se dice. Las llaves `{…}` son datos o decisiones que faltan.

Hechos del producto que estos textos repiten y no cambian: Basic cuesta $2.990 CLP al mes, IVA incluido, con 7 días de
prueba gratis (una por persona) y 6.000.000 unidades de IA incluida por período (1.500.000 en la prueba). Pro cuesta
$9.990 CLP al mes, IVA incluido, sin prueba, con 30.000.000 unidades. Se paga con tarjeta mediante suscripciones de
Flow. Se cancela desde /cuenta.

Una corrección a `LEGAL-PENDIENTE.md`: el texto vigente de la Ley 19.496 es el refundido por el DFL 3 de 2019 de
Economía (publicado el 31-05-2021). En BCN, la ley original (idNorma 61438) quedó en su versión de 2021 y no muestra
los cambios de la Ley 21.398; hay que leer el DFL 3:
<https://www.bcn.cl/leychile/navegar?idNorma=1160403>. Esa versión rige hasta el 30-11-2026; desde el 1-12-2026 la Ley
21.719 suprime su artículo 15 bis (datos personales de consumidores bajo el SERNAC). Esa fecha puede cambiar: ver el
Boletín 18.623-07 en el punto 5.

---

## 1. Quién vende

### Qué exigen las normas

- **Reglamento de Comercio Electrónico** (Decreto 6 de 2021, Economía; vigente desde el 24-03-2022), art. 7: el
  vendedor que vende en su propia plataforma debe informar (1) nombre, razón social o nombre de fantasía; (2) RUT o
  RUN; (3) domicilio legal; (4) correo, teléfono u otro medio para que el consumidor lo contacte; (5) el medio por el
  cual el vendedor se pondrá en contacto con el consumidor, y (6) si es persona jurídica, su representante legal. El
  art. 6 exige que la información sea previa a la contratación, completa, clara, en castellano y de fácil acceso.
  <https://www.bcn.cl/leychile/navegar?idNorma=1165504>
- El mismo reglamento pide, antes del pago, un resumen con el servicio y su costo total (art. 18 inc. 1), un enlace
  visible a los términos antes de contratar (art. 16), el soporte de contacto para preguntas y reclamos (art. 15) y,
  en contratos de tracto sucesivo, cómo y cuándo se les pone término (art. 17).
- **Ley 19.496, art. 32 inc. 2** (texto del DFL 3): en contratos electrónicos el proveedor indica su dirección de
  correo postal o electrónico y los pasos para contratar.
- **Voucher o boleta** (punto 4): la Resolución Exenta SII 176 de 2020, letra E, exige que el comprobante de pago
  válido como boleta identifique el RUT, el nombre o razón social y el domicilio de la casa matriz del contribuyente.
  <https://www.sii.cl/normativa_legislacion/resoluciones/2020/reso176.pdf>
- **Desde el 1-12-2026**, la Ley 19.628 modificada por la Ley 21.719, art. 14 ter letras b) y c): la política de datos
  debe individualizar al responsable y su representante legal, y dar un domicilio postal o correo para las
  solicitudes. <https://www.bcn.cl/leychile/navegar?idNorma=141599> (versión diferida 2026-12-01)

La Ley 21.398 (D.O. 24-12-2021) no creó el reglamento de comercio electrónico (el Decreto 6 es anterior): reformó el
art. 3 bis y mandó dictar el reglamento de exclusión del retracto, que es el Decreto 52 (punto 2).

El SERNAC resume lo mismo en «Tus derechos en el Comercio Electrónico»:
<https://www.sernac.cl/portal/604/w3-propertyvalue-20982.html>

### Bloque de identificación

> **Quién vende.** {Razón social o nombre}{, nombre de fantasía pteron}, RUT {…}, domicilio legal {calle, número,
> comuna, ciudad}. Correo: pteron@patagua.dev. {Si es persona jurídica: Representante legal: {nombre}.} Te escribimos
> desde {no-reply@patagua.dev} a la dirección de tu cuenta.

La última frase cubre el numeral 5 del art. 7 (el medio por el que el vendedor contacta al consumidor). Si el correo
transaccional del Worker sale desde otra dirección, ponerla ahí.

### Dónde va

| Lugar | Qué lleva | Norma |
| --- | --- | --- |
| Términos, nueva §1 «Quién vende» | El bloque completo | Reglamento CE arts. 7 y 16 |
| Pie de todas las páginas (`colofon` en `scripts/sitio.mjs`) | Nombre o razón social, RUT y enlace a Términos | Reglamento CE arts. 6 y 7 (no exige el pie; es el lugar fácil de encontrar) |
| Resumen antes de Flow en /cuenta | El bloque completo, junto al precio | Reglamento CE arts. 7 y 18 |
| Correo de confirmación | El bloque completo | Ley 19.496 art. 12 A; Reglamento CE art. 18 inc. 2 |
| Voucher o boleta de cada cobro | RUT, razón social, domicilio | Res. Ex. SII 176/2020, letra E |
| Privacidad | Responsable y representante | Ley 19.628 art. 14 ter b), desde el 1-12-2026 |

### Lo que no se resuelve aquí

Si vende Marco como persona natural o una empresa (opciones A y B de `LEGAL-PENDIENTE.md`, punto 1). Hay una
restricción práctica: según Flow, el «Cargo automático» exige cuenta corriente de una empresa con RUT en el SII y un
giro que ampare lo cobrado, y «por el momento este servicio solo se encuentra disponible para empresas»
(<https://web.flow.cl/es-cl/preguntas-frecuentes/cargo-automatico/>). Sin él, Flow envía un enlace de pago por correo
cada mes.

---

## 2. Retracto y devoluciones

### Qué dice hoy la ley

Ley 19.496, art. 3 bis (texto del DFL 3, modificado por la Ley 21.398):

- Inciso primero: el consumidor puede poner término unilateral al contrato, sin expresión de causa, «en el plazo de 10
  días contados desde la recepción del producto o desde la contratación del servicio y antes de la prestación del
  mismo».
- Letra b): aplica a los contratos celebrados por medios electrónicos. «Sólo en el caso de la contratación de
  servicios, el proveedor podrá disponer lo contrario, y deberá informar al consumidor sobre dicha exclusión, de manera
  inequívoca, destacada y fácilmente accesible, en forma previa a la suscripción del contrato y pago del precio del
  servicio.»
- El consumidor puede retractarse por los mismos medios que usó para contratar. El plazo corre desde la celebración
  del contrato si el proveedor envió la confirmación del art. 12 A; si no, se extiende a 90 días.
- Devolución: «sin retención de gastos, a la mayor brevedad posible y, en cualquier caso, antes de cuarenta y cinco
  días»; en servicios, sólo lo pagado que no corresponda a servicios ya prestados a la fecha del retracto.

<https://www.bcn.cl/leychile/navegar?idNorma=1160403> · resumen del SERNAC:
<https://www.sernac.cl/portal/609/w3-propertyvalue-58897.html>

**Decreto 52 de 2022, Economía** (fechado el 21-04-2022, publicado en el D.O. el 27-08-2024; rige seis meses después de su publicación, art. transitorio):

- Art. 5: en servicios contratados a distancia, el retracto se ejerce dentro de 10 días «y antes del inicio de la
  prestación», salvo exclusión. La prestación «se inició desde el momento en que el proveedor notifique esta
  circunstancia al consumidor», por el medio de contratación o el que el consumidor designe.
- Art. 6: la exclusión se comunica antes del contrato o del pago, «en el mismo lugar y/o momento en que se informe
  acerca del precio», con una advertencia inequívoca y destacada «cuyo tamaño no sea inferior a la información respecto
  del precio», usando expresamente el concepto «derecho a retracto», y puede repetirse en los términos.
- Art. 3: el retracto o su exclusión no limita los demás derechos del consumidor.

<https://www.diariooficial.interior.gob.cl/publicaciones/2024/08/27/43935/01/2535265.pdf>

El Reglamento de Comercio Electrónico, art. 14, agrega que la existencia del derecho (o su exclusión) se informe «en
un lugar visible», antes del contrato y del pago, con la forma de ejercerlo.
<https://www.bcn.cl/leychile/navegar?idNorma=1165504>

### Lo que las fuentes no zanjan

- **Prueba gratis.** Con la prueba, el contrato se celebra el día 0 (se registra la tarjeta y se acepta la versión de
  los Términos) y el primer cobro ocurre el día 7, dentro de los 10 días. Ninguna fuente abierta dice si el plazo corre
  desde el día 0 o desde el primer cobro, ni si cada renovación mensual es un contrato nuevo.
- **Inicio de la prestación.** La IA incluida está disponible desde el día 0. Por el art. 5 del Decreto 52, si pteron
  notifica ese inicio, el retracto terminaría ahí aun sin exclusión. No está claro si basta con decirlo en el correo de
  confirmación, ni cómo se combina con una prueba gratuita.
- **Tamaño.** En /planes el precio va en letra muy grande. «Tamaño no inferior» puede obligar a una advertencia igual
  de grande en /planes, y no sólo en el resumen de /cuenta.
- **Medio de retracto.** Si se mantiene el derecho, el consumidor puede ejercerlo por el mismo medio con que contrató:
  la web. Probablemente hace falta un botón en /cuenta y no sólo un correo.

### Opción A: mantener el retracto

`LEGAL-PENDIENTE.md` §2 usa las mismas letras (A, mantener; B, excluir). Al decidir, conviene nombrar igual la
opción («mantener» o «excluir») y no sólo la letra.

Términos, nueva sección «Derecho a retracto y devoluciones»:

> **Derecho a retracto.** Puedes retractarte de Basic o Pro dentro de 10 días desde que lo contratas, sin dar motivo,
> desde tu cuenta con «Retractarme» o escribiendo a pteron@patagua.dev. Si ya se hizo un cobro, te devolvemos el
> monto completo a la misma tarjeta, a través de Flow, dentro de 45 días. El plan termina el día en que te retractas.
>
> **Devoluciones.** Si cancelas después de esos 10 días, el plan sigue hasta el fin del período pagado y no se
> devuelven los días que queden. Un cobro hecho por error nuestro se devuelve completo.

Resumen antes de Flow en /cuenta, junto al precio:

> Tienes derecho a retracto: 10 días desde hoy, desde tu cuenta o por correo.

Devolver el cobro completo es más de lo que exige la ley (que permite descontar lo ya prestado), pero evita calcular
días y discutir qué se prestó durante la prueba. El abogado puede preferir la devolución proporcional.

Efecto cuando Flow ya cobró: se reembolsa por Flow (`/refund/create`, asíncrono) dentro de 45 días y el plan se
termina de inmediato («Terminar ahora» en /admin). El contador debe decir cómo se anula el voucher o la boleta de ese
cobro: la Res. 176 manda usar el procedimiento del terminal o, si no se puede, una nota de crédito electrónica (punto
4). Hoy el Worker no tiene «Retractarme» ni reembolso automático: es trabajo pendiente.

### Opción B: excluir el retracto

Junto al precio en /planes y en el resumen de /cuenta, en letra no menor que la del precio (Decreto 52, art. 6):

> **Basic no tiene derecho a retracto.** Lo pruebas gratis 7 días y lo cancelas cuando quieras desde tu cuenta.

> **Pro no tiene derecho a retracto.** Lo cancelas cuando quieras desde tu cuenta y no se renueva.

Términos, nueva sección «Derecho a retracto y devoluciones»:

> **Sin derecho a retracto.** Basic y Pro no tienen derecho a retracto (artículo 3 bis de la Ley 19.496): Basic se
> prueba gratis 7 días y ambos planes se cancelan cuando quieras desde tu cuenta. Esto no limita tus demás derechos
> como consumidor.
>
> **Devoluciones.** Si cancelas, el plan sigue hasta el fin del período pagado y no se devuelven los días que queden.
> Un cobro hecho por error nuestro se devuelve completo{, también el primer cobro de Basic si nos escribes dentro de
> {3} días porque olvidaste cancelar la prueba}.

Efecto cuando Flow ya cobró: no hay devolución por retracto. Siguen los reembolsos por cobro erróneo y, si se decide,
la devolución voluntaria del primer cobro. Ese mismo párrafo va en el correo de confirmación (punto 3).

---

## 3. Confirmación escrita (art. 12 A)

### Qué exige la norma

Ley 19.496, art. 12 A, inciso tercero: «Una vez perfeccionado el contrato, el proveedor estará obligado a enviar
confirmación escrita del mismo. Ésta podrá ser enviada por vía electrónica […] el que se le indicará previamente. Dicha
confirmación deberá contener una copia íntegra, clara y legible del contrato.»
<https://www.bcn.cl/leychile/navegar?idNorma=1160403>

El Reglamento de Comercio Electrónico, art. 18 inc. 2, repite la obligación: copia escrita y aviso previo del medio
que se usará. <https://www.bcn.cl/leychile/navegar?idNorma=1165504>

Sin esta confirmación, el plazo de retracto sube a 90 días (art. 3 bis b). Eso importa aunque se elija excluir el retracto (opción B), si
la exclusión llegara a fallar.

### Consecuencias para el diseño

- «Copia íntegra» sugiere que **un enlace no basta**: conviene adjuntar los Términos aceptados (HTML o PDF) además del
  enlace a `/terminos/2026-10-13`. Si el adjunto no es posible, poner el texto completo de los Términos al final del
  correo. El abogado decide si la Política de privacidad también va.
- «Se le indicará previamente»: el resumen de /cuenta debe decir antes del pago «Te enviaremos la confirmación y una
  copia de los Términos a {correo de la cuenta}».
- El Worker envía el correo una vez por compra, cuando `card-callback` crea la suscripción, con la versión de los
  Términos que quedó registrada.
- El texto sigue el borrador de `LEGAL-PENDIENTE.md` (punto 3) y la estructura de `src/lib/correo-textos.js` (bloque
  «Quién vende», cobro, fechas, cancelación, retracto, cuota y Términos). El párrafo de retracto es copia literal del
  que digan los Términos de esa versión.
- Hoy el bloque «Quién vende» del Worker (`linea` en `src/lib/correo-textos.js`) sólo imprime nombre, RUT, domicilio y
  correo (`SELLER_NAME`, `SELLER_RUT`, `SELLER_ADDRESS`, `SELLER_EMAIL`): **no puede mostrar el representante legal**
  que exige el art. 7 n.º 6 del Reglamento CE si vende una persona jurídica, que es lo probable si se usa el cargo
  automático de Flow (punto 1). Falta una variable opcional, por ejemplo `SELLER_REPRESENTATIVE`, antes de vender como
  empresa.

### Texto del correo

Asunto: `Tu plan {Basic} de pteron`

> Hola:
>
> Contrataste {Basic} de pteron. Este correo es la confirmación de tu contrato y lleva adjunta una copia de los
> Términos que aceptaste.
>
> **Quién vende.** {Razón social o nombre}, RUT {…}, domicilio legal {…}. Correo: pteron@patagua.dev.{
> Representante legal: {…}.}
>
> **Tu plan.** {Basic}: {$2.990} al mes, IVA incluido. Se paga con tarjeta a través de Flow, que registra la tarjeta
> en su propio sitio: pteron no la recibe.
>
> {Con prueba:} Tu prueba gratis empezó el {fecha de contratación} y termina el {fecha de fin de la prueba}. Ese día se
> cobran {$2.990} y luego cada mes, hasta que canceles.
>
> {Sin prueba:} El primer cobro, de {$2.990}, se hizo el {fecha}. El plan se renueva cada mes, hasta que canceles.
>
> **Cancelar.** Cancelas cuando quieras en https://pteron.patagua.dev/cuenta, con «Cancelar renovación». Si cancelas
> durante la prueba, no se cobra nada y {Basic} termina el día en que terminaba la prueba. Si ya pagaste, el plan sigue
> hasta el fin del período pagado y no se renueva.
>
> **{Derecho a retracto | Sin derecho a retracto} y devoluciones.** {Párrafo literal de los Términos, según se
> mantenga (opción A) o se excluya (opción B) el retracto en el punto 2.}
>
> **Tu cuota de IA incluida.** {6.000.000} unidades por período{ (1.500.000 durante la prueba)}. Lo que no usas no pasa
> al período siguiente.
>
> **Boleta.** {Según lo que se decida en el punto 4: «El comprobante de cada cobro, válido como boleta, te lo envía
> Flow a este correo» o «Por cada cobro te enviamos la boleta electrónica a este correo».}
>
> **Términos aceptados.** Aceptaste los Términos versión {2026-10-13}. Van adjuntos y quedan publicados, sin cambios,
> en https://pteron.patagua.dev/terminos/{2026-10-13}.
>
> **Consultas y reclamos.** Responde este correo o escribe a pteron@patagua.dev. También puedes reclamar ante el
> SERNAC, en www.sernac.cl.
>
> pteron

Notas:

- Si se mantiene el retracto (opción A) y el abogado quiere aplicar el art. 5 del Decreto 52, aquí iría la frase que notifica el
  inicio de la prestación. No se incluyó porque depende de la duda del punto 2.
- La cuota de prueba entre paréntesis sólo va cuando hay prueba. Pro: $9.990 y 30.000.000 unidades, sin prueba.
- La línea de reclamos sigue el borrador del punto 9 de `LEGAL-PENDIENTE.md`, que también espera revisión.

---

## 4. Boleta electrónica por cada cobro

### La obligación

- La boleta electrónica es obligatoria desde el 1-01-2021 para quienes ya emitían factura electrónica y desde el
  1-03-2021 para los demás (SII, preguntas frecuentes, con cita de la Res. 74 de 2020 y la Ley 21.256). Debe indicar
  el IVA por separado.
  <https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_7666.htm> ·
  <https://www.sii.cl/preguntas_frecuentes/bol_electr_vtas_serv/001_380_7672.htm>
- **El voucher puede ser la boleta.** Por la Res. Ex. SII 176 de 2020 (art. 54 de la Ley sobre Impuesto a las Ventas
  y Servicios), el comprobante de un pago con tarjeta «corresponderá a la boleta electrónica de ventas y servicios».
  El SII aclara que esto incluye las ventas por internet: el voucher es el recibo «que entrega la máquina de pago (POS)
  o en ventas por Internet, el cual tiene validez como boleta electrónica», siempre que el operador de medios de pago
  esté inscrito y autorizado para informar las transacciones al SII. Para valer como boleta, el comprobante debe
  llevar RUT, razón social y domicilio del vendedor, el IVA por separado, la leyenda «Válido como Boleta» y los demás
  requisitos de la letra E. Si se emiten boleta y voucher por el mismo cobro, hay que anular la boleta con una nota de
  crédito electrónica.
  <https://www.sii.cl/normativa_legislacion/resoluciones/2020/reso176.pdf> ·
  <https://www.sii.cl/destacados/boleta_electronica_voucher/index.html> ·
  <https://www.sii.cl/noticias/2021/050121noti01er.htm>
- El contribuyente declara en el SII su «modelo de emisión»: emite siempre boleta, o no la emite cuando recibe un pago
  electrónico porque el voucher la reemplaza (mismo portal del SII).
- La Res. Ex. SII 53 de 2025, sobre entregar la boleta o el voucher impreso o virtual, se refiere a ventas «a través
  de canales presenciales»; no se encontró una regla equivalente para ventas por internet.
  <https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso53.pdf>

En consecuencia, la premisa de `LEGAL-PENDIENTE.md` («Flow no emite boletas, cada cobro requiere boleta») depende de
algo que hay que preguntarle a Flow (punto 6): si está inscrito como operador ante el SII y si su comprobante cumple la
letra E de la Res. 176.

### IVA

- Desde el 1-01-2023 todos los servicios están afectos a IVA (Ley 21.420), salvo exenciones que ya existían, como los
  servicios personales con boleta de honorarios, la educación y el transporte. La tasa es 19 %.
  <https://www.sii.cl/noticias/2022/211222noti01aav.htm>
- Ninguna fuente abierta trata específicamente una suscripción de software con IA. **El contador debe confirmar** que
  está afecta, con qué giro y si cambia algo que la venda una persona natural o una empresa.
- Desglose de los precios publicados, redondeando el IVA al peso (el contador confirma el redondeo):

| Precio con IVA | Neto | IVA 19 % |
| --- | --- | --- |
| $2.990 | $2.513 | $477 |
| $9.990 | $8.395 | $1.595 |

- **Compras a proveedores extranjeros.** Si pteron es contribuyente de IVA, por los servicios digitales que paga a
  Anthropic (y, según su situación, a Cloudflare y Supabase) el sujeto del impuesto es pteron: emite una factura de
  compra, con RUT 55.555.555 si el proveedor no está inscrito en el régimen simplificado, y la declara en el F29
  (línea 104, código 39). El contador revisa en qué nómina está cada proveedor y si el emisor de la tarjeta aplica el
  cambio de sujeto.
  <https://www.sii.cl/preguntas_frecuentes/iva_serv_digitales/001_200_7775.htm> ·
  <https://www.sii.cl/noticias/2022/010822noti01aav.htm>

### Opciones prácticas

1. **El voucher de Flow como boleta.** Si Flow confirma que informa al SII y que su comprobante cumple la Res. 176, se
   declara el modelo «No emito boleta cuando recibo un pago electrónico» y no se emite nada más. Requiere que Flow
   envíe el comprobante al pagador en cada cobro.
2. **Sistema gratuito del SII.** Web o aplicación e-Boleta, sin costo. Según el SII, «no se integra con aplicaciones
   informáticas del contribuyente»: habría que emitir a mano una boleta por cada cobro y enviarla al correo del
   cliente. Sirve con poco volumen; con más, se vuelve propenso a errores.
3. **Emisión automática.** Un sistema de mercado ya autorizado por el SII o un desarrollo propio certificado ante el
   SII, llamado desde el Worker cuando la sincronización con Flow ve un cobro pagado. El SII publica la lista de
   proveedores autorizados (<https://www.sii.cl/servicios_online/3785-proveedores_autorizados_be.html>); esta nota no
   recomienda ninguno. Requiere un secreto más en el Worker y manejar reintentos y notas de crédito por reembolsos.

Texto para los Términos cuando se decida, según la opción:

> Por cada cobro recibes en tu correo {el comprobante de Flow, válido como boleta | la boleta electrónica}.

Para el contador: ¿afecto o exento?, ¿giro?, ¿modelo de emisión?, ¿cómo se anula el documento de un cobro
reembolsado?, ¿IVA de servicios digitales y retenciones al pagar a Anthropic, Cloudflare y Supabase?

---

## 5. Datos personales

### Ley vigente y ley que viene

- **Hasta el 30-11-2026 rige la Ley 19.628** en su texto actual: el tratamiento requiere ley o consentimiento expreso,
  informado y escrito (art. 4); el tratamiento por mandato se otorga por escrito con las condiciones de uso (art. 8);
  el titular puede pedir información, modificación, eliminación o bloqueo, sin costo (art. 12), y si no se le responde
  en dos días hábiles puede recurrir al juez (art. 16). No regula
  transferencias internacionales ni tiene una agencia.
  <https://www.bcn.cl/leychile/navegar?idNorma=141599>
- **La Ley 21.719** se publicó en el Diario Oficial el 13-12-2024. Su artículo primero transitorio dice que las
  modificaciones a la Ley 19.628 «entrarán en vigencia el día primero del mes vigésimo cuarto posterior a la
  publicación»: **el 1 de diciembre de 2026**. BCN muestra la nueva versión de la Ley 19.628 (que pasa a llamarse
  «sobre protección de los datos personales») con vigencia desde el 2026-12-01. La Ley 21.806 (D.O. 05-02-2026)
  modificó el nombramiento del consejo de la Agencia, no esa fecha.
  <https://www.bcn.cl/leychile/navegar?idNorma=1209272>
- **Esa fecha puede moverse.** El proyecto del Boletín 18.623-07 («Modifica la ley N° 21.719…», mensaje del Ejecutivo
  ingresado al Senado el 01-09-2026, con urgencia suma) propone postergar la entrada en vigencia de las modificaciones
  al 1 de diciembre de 2027 y quitar el límite a empresas de menor tamaño de la amonestación escrita del primer año.
  Según la revisión del 13-10-2026 seguía en primer trámite, en la Comisión de Constitución del Senado; no es ley y la
  fecha legal sigue siendo el 1-12-2026. Esa ficha no se pudo abrir en esta pasada: cotejarla, y volver a revisar el
  estado del proyecto antes de publicar cualquiera de estos textos. Por eso las fechas «1-12-2026» y «30-11-2026» de
  este documento son la fecha legal de hoy, no una fecha segura, y las cláusulas para publicar no la fijan.
  <https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=18623>
- Durante los primeros 12 meses, a una empresa de menor tamaño la Agencia puede sancionarla con una amonestación
  escrita (art. sexto transitorio). Eso no elimina las obligaciones. Si se aprueba el Boletín 18.623-07 tal como se
  presentó, la amonestación del primer año valdría para cualquier empresa, no sólo para las de menor tamaño.

### Roles

| Datos | Responsable | Encargados | Fuente |
| --- | --- | --- | --- |
| Cuenta, plan, suscripción, licencias, uso medido | pteron (quien vende, punto 1) | Supabase, Cloudflare, el proveedor de correo (Resend), Anthropic para el identificador seudónimo | Ley 19.628 nueva, arts. 15 bis y 14 ter |
| Datos de la tarjeta | Flow, en su propio sitio | — | {El abogado confirma si Flow es responsable o encargado} |
| Lo que el docente envía a la IA incluida, con sus propios datos | pteron | Anthropic (y Cloudflare, por donde pasa) | DPA de Anthropic, B.1 |
| Datos de estudiantes dentro de un pedido | Probablemente el docente o su establecimiento | pteron como encargado; Anthropic como subencargado | Ley 19.628 nueva, arts. 15 bis y 16 quáter; el abogado decide |

Lo que obliga el art. 15 bis (desde el 1-12-2026) si pteron es encargado: tratar sólo conforme al encargo, contrato con
objeto, duración, finalidad, tipos de datos y categorías de titulares, y **no delegar en otro encargado sin
autorización específica y por escrito del responsable**, quedando solidariamente responsable. Por eso la cláusula de
encargo de abajo pide la autorización para usar a Anthropic y a Cloudflare.

El art. 16 quáter: los datos de niños y niñas (menores de 14 años) requieren el consentimiento de sus padres o
representantes, salvo autorización legal, y los establecimientos educacionales tienen la obligación especial de velar
por su uso lícito. Es otro argumento para que el docente o el establecimiento sea el responsable y para mantener el
aviso de datos de estudiantes de la app.

### El DPA de Anthropic

- Está en <https://www.anthropic.com/legal/data-processing-addendum> (la página dice «Effective February 24, 2025»).
- Se aplica a los clientes de la API sin firmar nada: los Commercial Terms (sección C) lo incorporan por referencia, y
  rigen desde que el cliente acepta o usa la API. <https://www.anthropic.com/legal/commercial-terms> (la página dice
  «Effective June 17, 2025»).
- B.1: respecto de los datos personales del cliente, el cliente es responsable y Anthropic su encargado. Anthropic no
  los vende, no los usa fuera de la relación y no los combina con otros (B.3). Los Commercial Terms, sección B, agregan
  que Anthropic no entrena modelos con el contenido del cliente.
- Subencargados: autorización general a la lista de <https://www.anthropic.com/subprocessors>, aviso previo de nuevos y
  15 días para objetar (C.1 a C.3).
- Brechas: aviso al cliente dentro de 48 horas (G.1). Al terminar, eliminación de los datos salvo excepciones legales,
  de disputa o de abuso (H.1.b).
- Transferencias: incorpora las cláusulas contractuales tipo de la UE (módulos 2 y 3) y anexos para el Reino Unido y
  Suiza «to the extent required by Applicable Data Protection Laws». **No tiene un anexo chileno.** Sí promete apoyo
  para cumplir las reglas de transferencia internacional (I.4).
- Los Commercial Terms también exigen cumplir la Usage Policy (D.2), avisar a los usuarios que las afirmaciones de hecho
  pueden ser falsas (D.3, ya en Términos §8) y prohíben revender los servicios salvo aprobación expresa (D.4(a)). Sigue
  abierta la pregunta a Anthropic del punto 8 de `LEGAL-PENDIENTE.md`.

### Transferencia a Estados Unidos

Desde el 1-12-2026, la Ley 19.628 nueva (arts. 27 y 28) permite transferir datos al extranjero si el país tiene un
nivel adecuado declarado por la Agencia, o si hay cláusulas contractuales u otros instrumentos con garantías adecuadas.
Sin eso, sólo caben transferencias «específicas y no habituales» con excepciones como el consentimiento expreso o la
necesidad para ejecutar el contrato. El envío a Anthropic es habitual, así que esas excepciones no parecen calzar.

Lo que no se pudo verificar: la Agencia todavía no publica su lista de países adecuados ni cláusulas modelo (debe
hacerlo en su sitio, art. 28). **El abogado decide** si las cláusulas tipo de la UE incluidas en el DPA son «garantías
adecuadas» para la ley chilena o si hace falta otro instrumento. Mientras tanto, Privacidad debe informar la
transferencia y las garantías (art. 14 ter h).

### Lo que debe decir Privacidad (art. 14 ter, desde el 1-12-2026)

| Exigencia | Hoy en Privacidad | Falta |
| --- | --- | --- |
| a) Política, fecha y versión | Sí (2026-10-13) | — |
| b) Responsable y representante legal | No | Bloque del punto 1 |
| c) Domicilio o correo para solicitudes | Correo, sí | Domicilio postal |
| d) Datos, titulares, destinatarios, finalidades, base de licitud | Datos y finalidades, sí; destinatarios, incompleto | Bases de licitud; Resend como destinatario (hoy Privacidad §7 atribuye a Supabase el envío del enlace de acceso, que entrega Resend) |
| e) Política y medidas de seguridad | Parcial (minimización, trabajo local) | Una descripción breve de las medidas |
| f) Derechos de acceso, rectificación, supresión, oposición y portabilidad | No | Cláusula de abajo |
| g) Reclamo ante la Agencia | No | Cláusula de abajo |
| h) Transferencia internacional y garantías | Dice que Anthropic está en EE. UU. | Las garantías |
| i) Plazo de conservación | No | Plazos por categoría |
| j) Fuente de los datos | Implícita | Una frase |
| k) Derecho a retirar el consentimiento | No | Cláusula de abajo |
| l) Decisiones automatizadas | No aplica, según lo que hace el producto | Una frase que lo diga |

Plazo de respuesta: el responsable acusa recibo y responde dentro de 30 días corridos, prorrogables una vez por 30
(art. 11 nuevo). El bloqueo temporal, que se pide junto con una rectificación, supresión u oposición, se responde
dentro de dos días hábiles (art. 11 nuevo). Si se rechaza una solicitud, hay que avisar al titular que tiene 30 días
hábiles para reclamar ante la Agencia. Hasta el 30-11-2026 el plazo es mucho más corto: si el responsable no se pronuncia dentro de dos días
hábiles, el titular puede recurrir al juez de letras en lo civil (art. 16 vigente). El borrador de abajo distingue
los dos plazos; **el abogado decide** si hasta la entrada en vigencia hay que decir otra cosa.

### Cláusulas para Privacidad

> **Quién es el responsable.** {Razón social o nombre}, RUT {…}, domicilio {…}{, representada por {…}}, es el
> responsable de los datos de tu cuenta y de tu plan. Escríbenos a pteron@patagua.dev.
>
> **Por qué los tratamos.** Los datos de tu cuenta y de tu plan, para cumplir el contrato. Lo que envías a un modelo en
> la nube, porque lo consientes en la aplicación; puedes retirar ese consentimiento en cualquier momento, sin afectar
> lo hecho antes. Los datos de cobro, además, para cumplir obligaciones tributarias.
>
> **Cuánto tiempo.** La cuenta, mientras exista y {…} después de cerrarla. La suscripción y los cobros, {…} años, por
> las obligaciones tributarias. Las licencias y activaciones, {…}. El uso de la IA incluida, {…}. Los registros de
> Cloudflare, hasta 7 días.
>
> **Quién más recibe tus datos.** {Lista de Privacidad §7, con esta línea nueva:} Resend envía los correos de pteron, el
> enlace de acceso y los avisos de tu plan; recibe tu correo y el contenido de esos mensajes.
>
> **Estados Unidos.** Para responder la IA incluida, lo que envías viaja a Anthropic, en Estados Unidos, que lo trata
> como encargado de pteron bajo su acuerdo de tratamiento de datos, con {las garantías que el abogado apruebe}.
>
> **Tus derechos.** Puedes pedir acceso a tus datos, corregirlos, eliminarlos, oponerte a su tratamiento, llevártelos
> o bloquearlos, escribiendo a pteron@patagua.dev. Si pides bloquearlos mientras resolvemos una corrección,
> eliminación u oposición, te respondemos dentro de dos días hábiles; lo demás, dentro de 30 días corridos, que
> podemos extender una sola vez por otros 30 avisándote. Desde {fecha de vigencia de la Ley 21.719}, si no
> respondemos o rechazamos tu solicitud, tienes 30 días hábiles para reclamar ante la Agencia de Protección de
> Datos Personales.
>
> **Decisiones automatizadas.** pteron no toma decisiones automatizadas sobre ti ni elabora perfiles.

La última frase sólo va si el abogado y Marco confirman que es cierta. {fecha de vigencia de la Ley 21.719} se
escribe con la fecha que rija al publicar (hoy el 1-12-2026; el Boletín 18.623-07 propone el 1-12-2027).

### Cláusula para los Términos: tratamiento por encargo

Sobre el borrador del punto 5 de `LEGAL-PENDIENTE.md`, ajustado al art. 15 bis. Sólo si el abogado concluye que es un
encargo:

> **Tratamiento por encargo.** Cuando incluyes en un pedido a la IA incluida datos personales de otras personas, como
> tus estudiantes, pteron los trata por encargo tuyo o de tu establecimiento, sólo para responder ese pedido y mientras
> dure tu plan. No los usa para otra cosa, no los cede y no guarda el contenido. Para responder se apoya en Anthropic,
> en Estados Unidos, y en Cloudflare, que actúan con sus propios acuerdos de tratamiento de datos; al contratar,
> autorizas expresamente ese envío. Antes de incluir datos de estudiantes, asegúrate de que tu establecimiento lo
> permite y, si son niños o niñas, de que existe la autorización que exige la ley. {Seguridad, aviso de incidentes y
> qué pasa con los datos al terminar.}

---

## 6. Correo a Flow

Para enviarlo desde la dirección registrada en la cuenta de Flow. No incluye llaves ni datos de clientes.

> **Asunto:** Consulta sobre la cuenta {N.º de comercio o RUT}: cargo automático, ambiente de las llaves y comprobantes
>
> Hola, equipo de Flow:
>
> Soy {nombre}, {representante legal} de {razón social}, RUT {…}, titular de la cuenta {N.º de comercio}. Usamos
> Suscripciones por la API REST para cobrar un plan mensual de $2.990 IVA incluido, con 7 días de prueba gratis.
> Antes de abrir la venta necesitamos confirmar lo siguiente:
>
> 1. **Cargo automático.** ¿La cuenta tiene contratado y activo el medio de pago «Cargo automático», de modo que
>    Flow cobre la tarjeta registrada en cada período de la suscripción sin enviar un enlace de pago? Si no, ¿qué falta
>    para activarlo?
> 2. **Llaves de producción.** ¿Las credenciales de API asociadas a esta cuenta que usa nuestra integración, contra
>    https://www.flow.cl/api, son de producción y no de sandbox? Si pueden, indíquennos cómo verificarlo desde el panel
>    sin compartir las llaves por correo.
> 3. **Comprobante al pagador.** En cada cobro de una suscripción, ¿Flow envía un comprobante al correo del pagador?
>    ¿Qué datos lleva (RUT, razón social y domicilio del comercio, monto neto, IVA y total)?
> 4. **Boleta.** ¿Flow está inscrito ante el SII como operador de medios de pago electrónicos según la Resolución
>    Exenta SII N.º 176 de 2020, de modo que ese comprobante valga como boleta (con la leyenda «Válido como Boleta»)?
>    Si no, ¿Flow puede emitir boletas electrónicas por nosotros o integrarse con un emisor?
> 5. **Validación de tarjeta.** ¿Al registrar la tarjeta se hace un cargo de validación? ¿De cuánto, y cuándo se
>    devuelve?
> 6. **Cancelación en la prueba.** Si cancelamos una suscripción durante la prueba con `at_period_end = 1`, ¿confirman
>    que no se genera ni cobra la primera factura?
> 7. **Reembolsos.** Para devolver un cobro de suscripción, ¿`/refund/create` sirve con tarjeta registrada? ¿En qué
>    plazo llega al cliente?
> 8. **Nombre en la cartola.** ¿Qué nombre ve el cliente en el estado de cuenta de su tarjeta?
>
> Gracias,
> {nombre}
> {cargo}, {razón social}
> pteron@patagua.dev

Las preguntas 5 a 8 vienen del punto 10 de `LEGAL-PENDIENTE.md`. Si se prefiere un correo más corto, enviar las 1 a 4.

---

## Lo que deben decidir el abogado y el contador

**Abogado**

1. Quién vende: persona natural o empresa, y cuál (punto 1).
2. Retracto: mantenerlo o excluirlo. Si se mantiene, desde cuándo corre con la prueba gratis, si cada renovación lo
   reabre, si conviene notificar el inicio de la prestación (Decreto 52, art. 5) y si se devuelve el cobro completo o
   proporcional. Si se excluye, si «tamaño no inferior» obliga a una advertencia tan grande como el precio de /planes.
3. Si la confirmación debe llevar el texto íntegro de los Términos o basta un adjunto, y si incluye Privacidad.
4. Roles en los datos de estudiantes (responsable, encargado y subencargado) y si la cláusula de encargo basta como
   contrato del art. 15 bis.
5. Si las cláusulas tipo de la UE del DPA de Anthropic sirven como garantías adecuadas para la transferencia a EE. UU.
   desde la entrada en vigencia de la Ley 21.719 (hoy el 1-12-2026), y qué hacer mientras la Agencia no publique sus
   modelos.
7. Los plazos de respuesta de la cláusula «Tus derechos» (dos días hábiles para el bloqueo, 30 días corridos para lo
   demás) y qué decir hasta la entrada en vigencia.
6. El rol de Flow respecto de los datos de pago.

**Contador**

1. IVA de la suscripción, giro y redondeo del desglose.
2. Modelo de emisión: voucher de Flow o boleta propia, según la respuesta de Flow.
3. Cómo anular el documento de un cobro reembolsado.
4. IVA de los servicios digitales pagados a Anthropic, Cloudflare y Supabase.

---

## Fuentes abiertas el 13-10-2026

- Ley 19.496, texto refundido (DFL 3 de 2019, Economía), arts. 1, 3 bis, 12 A, 15 bis, 16, 32 y 50 A:
  <https://www.bcn.cl/leychile/navegar?idNorma=1160403>
- Reglamento de Comercio Electrónico, Decreto 6 de 2021, Economía, arts. 6, 7 y 14 a 18:
  <https://www.bcn.cl/leychile/navegar?idNorma=1165504>
- Decreto 52 de 2022, Economía, exclusión del derecho a retracto (Diario Oficial, 27-08-2024):
  <https://www.diariooficial.interior.gob.cl/publicaciones/2024/08/27/43935/01/2535265.pdf>
- SERNAC, «Tus derechos en el Comercio Electrónico»: <https://www.sernac.cl/portal/604/w3-propertyvalue-20982.html>
- SERNAC, Ley 19.496, art. 3 bis: <https://www.sernac.cl/portal/609/w3-propertyvalue-58897.html>
- SERNAC, suscripciones y barreras de salida (contexto para el aviso antes del fin de la prueba):
  <https://www.sernac.cl/portal/604/w3-article-83137.html> · <https://www.sernac.cl/portal/604/w3-article-85909.html>
- Ley 19.628, versión vigente y versión diferida desde el 2026-12-01 (arts. 4, 8, 11, 12, 13, 14 ter, 15 bis, 16, 16
  quáter, 27 y 28): <https://www.bcn.cl/leychile/navegar?idNorma=141599>
- Ley 21.719 (artículos transitorios): <https://www.bcn.cl/leychile/navegar?idNorma=1209272>
- SII, obligación de boleta electrónica:
  <https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_7666.htm> ·
  <https://www.sii.cl/preguntas_frecuentes/bol_electr_vtas_serv/001_380_7672.htm> ·
  <https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_7670.htm>
- SII, voucher como boleta: <https://www.sii.cl/normativa_legislacion/resoluciones/2020/reso176.pdf> ·
  <https://www.sii.cl/destacados/boleta_electronica_voucher/index.html> ·
  <https://www.sii.cl/noticias/2021/050121noti01er.htm> ·
  <https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso53.pdf>
- SII, IVA a los servicios desde 2023: <https://www.sii.cl/noticias/2022/211222noti01aav.htm>
- SII, IVA a los servicios digitales: <https://www.sii.cl/preguntas_frecuentes/iva_serv_digitales/001_200_7775.htm> ·
  <https://www.sii.cl/noticias/2022/010822noti01aav.htm>
- Anthropic, Commercial Terms of Service: <https://www.anthropic.com/legal/commercial-terms>
- Anthropic, Data Processing Addendum: <https://www.anthropic.com/legal/data-processing-addendum>
- Flow, preguntas frecuentes sobre cargo automático (no es fuente oficial del Estado; describe las condiciones de Flow):
  <https://web.flow.cl/es-cl/preguntas-frecuentes/cargo-automatico/>

No se abrieron y quedan por cotejar: la ficha del Boletín 18.623-07 en el Senado y su mensaje, el encabezado del
Decreto 52 en el Diario Oficial (CVE 2535265) y el texto del art. 11 nuevo de la Ley 19.628 sobre el bloqueo temporal; el texto completo de la Res. Ex. SII 74 de 2020 (contenido de la boleta), la
fecha exacta de entrada en vigencia del Decreto 52 según BCN, los acuerdos de tratamiento de datos de Cloudflare,
Supabase y Resend, y la página de retención de datos de Anthropic que respalda lo que hoy dice Privacidad §6.
