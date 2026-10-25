# Qué falta para que funcione

Lista, en orden, de lo que se hace a mano para abrir la venta de Basic con IA incluida (ADR-177 de
pteron). El código está completo en `main`: el Worker, el sitio y el Cron se publican con un
despliegue (sección 0). No hay usuarios reales, migraciones ni Worker viejo: la base se arma con un
solo archivo y la venta nace cerrada (`for_sale = false`).

Cada paso dice dónde y cómo comprobarlo, sin exponer secretos. Lo que se decide con abogado o
contador está en `LEGAL-PENDIENTE.md`.

## Estado al 13 de octubre de 2026

- Verificado: el Worker está desplegado desde `main`, con todos sus secretos cargados, incluido
  `RESEND_API_KEY`. Los correos al cliente salen cuando se despliegue el cambio con los `SELLER_*` (ver 1b); la
  producción actual los tiene vacíos y por eso aún los omite.
- `supabase/esquema.sql` está aplicado y `/api/health` responde `{"ok":true}` (en verde).
- Supabase Auth tiene Site URL `https://pteron.patagua.dev/cuenta`, Redirect URLs y SMTP propio por Resend desde
  `no-reply@patagua.dev`, con su propia clave de Resend; el dominio `patagua.dev` está verificado en Resend. Los
  correos de acceso usan las plantillas en español de `supabase/correos/` (aplicadas con `supabase-auth.mjs`).
- Probado con la cortesía `tester` propia: un pedido real a la IA incluida funcionó de punta a punta y quedó
  registrado (16.962 unidades, modelo `claude-haiku-5-5`).
- Hecho: la clave de Resend del Worker está cargada y los `SELLER_*` (con `SELLER_REPRESENTATIVE`) están en
  `wrangler.jsonc`, con los datos de la declaración de inicio de actividades del SII (Patagua.dev SpA).
- Hecho (Marco, 13 de octubre): el workspace de Anthropic tiene su tope de gasto mensual con alertas al 50 % y al
  80 % (sección 3, paso 4). `/admin` › Salud muestra desde ese día los rechazos de Anthropic y el tope sugerido.
  Falta confirmar en API keys que la clave cargada en el Worker sea del mismo workspace: si no, el tope no la cubre.
- Datos del vendedor confirmados por Marco (domicilio y representante legal). Falta lo de `LEGAL-PENDIENTE.md` y
  publicar la app 0.8.0 (sección 7). La venta sigue cerrada.

Los pasos de abajo son genéricos, para un proyecto nuevo o para rehacer algo; lo ya hecho se salta.

## 0. Publicar el Worker

Workers Builds no está conectado a este repositorio: un push a `main` todavía no despliega solo.

1. Cloudflare › Workers & Pages › `pteron-landing` › Settings › Variables and Secrets: borra el
   secreto `FLOW_BASE_URL`. Ahora es una variable de `wrangler.jsonc` (la API de producción de Flow)
   y no puede existir también como secreto.
2. Despliega `main`, de una de estas dos formas:
   - Settings › Build › Connect: repositorio `marcorojasb/pteron-landing`, rama `main`, build vacío y
     deploy `npx wrangler deploy`. Desde ahí cada push a `main` se publica solo.
   - A mano, como se ha hecho hasta ahora: los pasos de «Despliegue» en `README.md` (`main` al día,
     `npm ci`, `npm run verify`, `npx wrangler deploy --message "main <commit>: …"` y comprobar).
3. Comprueba. Esto debe imprimir 404; otro número significa que todavía responde el Worker anterior,
   que usaría la clave de Anthropic sin cuota ni filtros. Y `/planes` debe decir $2.990:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://pteron.patagua.dev/api/ai/v1/chat/completions
   curl -sS https://pteron.patagua.dev/planes | grep -o '\$2\.990' | head -1
   ```

## 1. Supabase

Los pasos 1 a 3 tienen dos variantes: con script (1b) o a mano.

1. Antes de correr el esquema (y antes de cada vez que lo vuelvas a correr), sólo lectura. El script
   `supabase-esquema` lo hace solo: se detiene si hay suscripciones de Flow vivas y, con `--aplicar`, también si
   cualquier tabla de datos (suscripciones, licencias, uso, eventos de cobro) ya tiene filas; a mano, en SQL Editor:

   ```sql
   select user_id, provider_subscription_id, status
   from public.subscriptions
   where provider = 'flow' and status in ('incomplete', 'trialing', 'active', 'past_due', 'paused');
   ```

   Cada fila es una suscripción que Flow sigue cobrando: cancélala en el panel de Flow antes de
   seguir, porque después del esquema nada la encuentra para cancelarla. En un proyecto nuevo la
   tabla no existe y no hay nada que revisar.
2. **Script:** `node scripts/supabase-esquema.mjs --aplicar` corre el archivo entero y comprueba el resultado.
   **A mano:** SQL Editor, pega entero `supabase/esquema.sql` y ejecútalo. Borra **todos los datos de pteron**
   (no toca `auth.users`) y deja el esquema de cero; puede correrse de nuevo. Sólo conserva qué
   cliente de Flow es de cada cuenta (`billing_customers`): Flow no deja crear otro con la misma
   cuenta. Comprueba (el script ya lo hace):

   ```sql
   select id, monthly_price_clp, trial_period_days, ai_units_limit, trial_ai_units_limit, for_sale
   from public.plan_catalog order by id;
   -- free 0 / 0 / null / null / false · basic 2990 / 7 / 6000000 / 1500000 / false
   -- pro 9990 / 0 / 30000000 / null / false · tester 0 / 0 / 6000000 / null / false
   select key, value from public.app_settings;   -- included_ai_paused = false
   select tablename from pg_tables where schemaname = 'public' and not rowsecurity;   -- 0 filas
   select (select count(*) from auth.users) as cuentas, (select count(*) from public.profiles) as perfiles;   -- iguales
   -- 0 filas: ninguna tabla del servidor abierta al navegador
   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('billing_customers', 'app_settings', 'ai_requests', 'billing_events', 'billing_checkout_intents')
     and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'));
   -- 0 filas: ninguna función SECURITY DEFINER que el navegador pueda ejecutar
   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
   ```

   Un proyecto con el esquema anterior al 25 de octubre de 2026 deja a `billing_events` y
   `billing_checkout_intents` con los permisos por defecto de anon y authenticated (RLS sin políticas igual les
   niega todo). Sin volver a correr el esquema, lo cierra esto, que no toca datos:

   ```sql
   revoke all on table public.billing_events, public.billing_checkout_intents from anon, authenticated;
   ```

   Si el disparador de `auth.users` hubo que rehacerlo, debe correr el archivo quien sea dueño de esa
   tabla (el esquema sólo lo crea si falta o difiere). Si alguna vez aplicaste migraciones con la CLI
   (`supabase db push`), no la vuelvas a usar para la base: este archivo la reemplaza.
3. Authentication: **script** `node scripts/supabase-auth.mjs --aplicar` fija Site URL, Redirect URLs (conserva
   las que haya) y los correos en español de `supabase/correos/`; **a mano:** Authentication › URL Configuration,
   Site URL `https://pteron.patagua.dev/cuenta` y la misma en Redirect URLs, y en Emails › Templates pega esos
   HTML (asunto en su primera línea). Authentication › Emails › SMTP Settings: SMTP propio con tu dominio
   (SPF y DKIM); sin él, Supabase sólo envía el enlace mágico a miembros del equipo del proyecto. El script no
   toca el SMTP salvo con `--smtp` (ver 1b). Prueba con un correo externo.
4. Antes de abrir la venta, plan Pro (US$25 al mes): el gratis pausa proyectos inactivos y no da
   respaldos descargables, y esta base guarda quién pagó.

## 1b. Correos con Resend y scripts de operación

Resend envía dos cosas: el enlace de acceso (lo manda Supabase Auth con su propia clave de Resend) y los correos
de compra, fin de prueba y cancelación (los manda el Worker, `src/lib/correo.js`). Son claves distintas. La cuenta
y el dominio `patagua.dev` verificado ya existen.

1. (Hecho) Resend › API Keys › Create: permiso **Sending access**, sólo el dominio `patagua.dev`. Cárgala como secreto
   del Worker: `npx wrangler secret put RESEND_API_KEY` (tipo **Secret**).
2. El plan gratis de Resend da unos 3.000 correos al mes y 100 al día (confirma en resend.com/pricing). Los
   enlaces de acceso y los correos de compra comparten ese tope: si se acerca, pasa a un plan de pago.
3. (Llenado; falta desplegar) `wrangler.jsonc` ya tiene `SELLER_NAME`, `SELLER_RUT`, `SELLER_ADDRESS`,
   `SELLER_EMAIL` y `SELLER_REPRESENTATIVE` (opcional: el representante legal de una persona jurídica) con los
   datos de la declaración del SII (`LEGAL-PENDIENTE.md`, punto 1); confirma el domicilio y el representante, y despliega. Sin la clave o sin cualquiera de los cuatro no sale
   ningún correo del Worker y cada intento queda como evento `<tipo>_email_skipped`: se configura **antes**
   de abrir la venta, porque esas suscripciones no recibirían después ese correo.
4. Scripts (en `scripts/`; sirven desde una sesión de Claude o desde tu equipo). Los tokens se leen sólo del
   entorno y nunca se imprimen. Cada uno es ensayo de sólo lectura por omisión; corre primero así, revisa y
   repite con `--aplicar`:

   | Script | Variables de entorno | Hace |
   |---|---|---|
   | `supabase-esquema.mjs` | `SUPABASE_ACCESS_TOKEN` | Esquema (sección 1). `--verificar` sólo comprueba; `--forzar` sigue pese a suscripciones vivas; `--aplicar` se niega si ya hay datos, salvo `--borrar-datos` (vacía todo pteron: sólo para rehacer un proyecto a propósito) |
   | `supabase-auth.mjs` | `SUPABASE_ACCESS_TOKEN` (y `RESEND_SMTP_KEY` con `--smtp`) | Site URL, Redirect URLs y correos en español. `--limite-correos N` cambia el límite por hora (hoy 30) |
   | `resend-dns.mjs` | `RESEND_API_KEY` (de administración), `CLOUDFLARE_API_TOKEN` | Compara los registros DNS que pide Resend con Cloudflare y crea los que faltan; nunca modifica ni borra |

   ```bash
   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-esquema.mjs        # ensayo; en producción ya hay datos: no lo apliques
   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-auth.mjs           # ensayo; luego --aplicar
   RESEND_API_KEY=... CLOUDFLARE_API_TOKEN=... node scripts/resend-dns.mjs   # ensayo; luego --aplicar
   ```

   Hoy el esquema, Auth, el SMTP y el DNS de Resend ya están hechos: los scripts sirven para comprobar o rehacer.
   En una sesión de Claude en la nube, antepón `NODE_USE_ENV_PROXY=1` a cada comando: el `fetch` de Node no usa
   el proxy del entorno por sí solo y el script diría «no hubo respuesta de la red». En tu equipo no hace falta.
5. Prompt para una sesión nueva de Claude (con los tres tokens en el entorno):

   > En /workspace/pteron-landing corre, en este orden, `scripts/supabase-esquema.mjs`, `scripts/supabase-auth.mjs`
   > y `scripts/resend-dns.mjs`. De cada uno, primero el ensayo (sin `--aplicar`): muéstrame su salida y espera mi
   > OK. Para `supabase-auth.mjs` y `resend-dns.mjs`, luego repítelo con `--aplicar`. Para `supabase-esquema.mjs`
   > NUNCA uses `--aplicar`, `--forzar` ni `--borrar-datos` (borra todos los datos de pteron): sólo el ensayo y
   > `--verificar`. No imprimas ningún token, no uses `--smtp` sin preguntarme, no hagas commit ni despliegues. Al final reporta qué cambió,
   > qué ya estaba bien y qué falló.

6. Comprueba: `/admin` › Salud, ítem «Correos al cliente» (no bloquea; dice qué falta) y su botón «Enviarme los
   correos de prueba», que manda a tu correo de administrador los tres correos al cliente con datos de ejemplo
   (asunto «[Prueba] …»; una vez por minuto, sin compra ni escrituras en la base): revisa que lleguen, de quién
   y en qué carpeta. Luego entra a `/cuenta` con
   un correo externo a tu dominio: el enlace debe llegar en español y no a spam. El primer correo de compra se
   ve en la primera compra real (sección 8).

## 2. Cloudflare

1. Workers Paid (US$5 al mes). El plan gratis da 10 ms de CPU y corta las respuestas largas de la IA.
2. Secretos del Worker `pteron-landing`, de tipo **Secret** (`npx wrangler secret put NOMBRE` desde
   esta carpeta, o Settings › Variables and Secrets). `npx wrangler secret list` muestra sólo los
   nombres. El código lee estos ocho:
   - `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (el nombre viejo `SUPABASE_ANON_KEY`
     ya no se lee: si la tenías así, créala con el nombre nuevo)
   - `FLOW_API_KEY` y `FLOW_SECRET_KEY`, **de producción**
   - `LICENSE_PRIVATE_KEY_PEM`: la privada k2 (PKCS8)
   - `ANTHROPIC_API_KEY`: se carga en la sección 3
   - `ADMIN_EMAILS`: tus correos, separados por comas; sin él, `/admin` responde 503
   - `RESEND_API_KEY`: la del Worker (sección 1b); sin ella no salen los correos al cliente

   Las variables de texto ya están en `wrangler.jsonc` (`PUBLIC_SITE_URL`, `SUPABASE_URL`,
   `LICENSE_KID`, `GATEWAY_MODEL_ID`, `FLOW_BASE_URL`, `FLOW_BASIC_PLAN_ID`, `FLOW_PRO_PLAN_ID`, `EMAIL_FROM`, los cuatro `SELLER_*` y, opcional, `SELLER_REPRESENTATIVE`): no
   las repitas en el panel, porque cada despliegue borra las de tipo Text. Opcionales que no hay que
   poner: `GATEWAY_MAX_IN_FLIGHT` (por defecto 3), `ANTHROPIC_BASE_URL` (en producción sólo la oficial)
   y `FLOW_ALLOW_SANDBOX`, que nunca va en producción.
3. Comprueba la privada k2 en tu equipo: `openssl pkey -in k2.pem -pubout` debe imprimir la misma
   clave pública que `PUBLIC_KEYS.k2` de `src/lib/license.js`, es decir
   `MCowBQYDK2VwAyEAIWGm5jH/yZJ2b5hsQ3UusUn+HIxC5dGiqc1gwOqvrrY=`.
4. Zona patagua.dev › Security › Bots: apaga Bot Fight Mode, o usa Super Bot Fight Mode con una regla
   *Skip* para `/api/billing/*` y `/api/ai/*`. Si no, desafía los avisos de Flow y a la app de
   escritorio.
5. Las vistas previas están apagadas (`workers_dev` y `preview_urls` en `false`): el Worker sólo
   responde en `pteron.patagua.dev`. En Settings › Domains & Routes no debe quedar ninguna otra
   dirección activa.

## 3. Anthropic

1. Settings › Workspaces › Create: `pteron-produccion`. No uses el Default, que no admite límites.
2. Settings › Service accounts: `pteron-gateway`, agregada a ese workspace.
3. API keys › Create: vinculada a esa cuenta de servicio y limitada a ese único workspace. Una
   clave sin workspace fijo hace fallar cada petición.
4. El workspace › Spend limits: tope mensual de 1,5 × (Basic × US$0,60 + Pro × US$3,00), mínimo
   US$20, con alertas al 50 % y al 80 %. Es el techo duro si algo más falla. `/admin` › Salud calcula
   el tope sugerido con las cuentas que hoy usan la IA incluida (cortesías `tester` incluidas, con
   su cuota) y avisa en rojo si Anthropic rechazó peticiones en los últimos 7 días por el tope, el
   crédito o la clave y ninguna funcionó después, con dónde arreglarlo; la primera petición aceptada
   tras el arreglo lo apaga. Revísalo al abrir la venta y cuando crezcan las cuentas.
5. El workspace › Rate limits › Claude Haiku 5.5: la mitad de los de la organización.
6. https://platform.claude.com/settings/capabilities: apaga la búsqueda web y la obtención web.
   pteron no las usa y el Worker ya las filtra; esto es una segunda barrera.
7. Billing: crédito y recarga automática.
8. `npx wrangler secret put ANTHROPIC_API_KEY` con esa clave.

## 4. Flow

1. Cuenta de producción: `FLOW_API_KEY` y `FLOW_SECRET_KEY` cargadas como secretos (sección 2).
2. Confirma con Flow que la cuenta tiene **Cargo automático**. Sin él, Flow no cobra la tarjeta
   registrada: manda un enlace de pago cada mes y el flujo de la web no sirve tal cual (ver
   `LEGAL-PENDIENTE.md`, punto 1).
3. Los planes `pteron-basic-2990-mensual` y `pteron-pro-9990-mensual` los crea el Worker en el primer
   checkout, con los valores del catálogo, y los valida con `plans/get` antes de cada cobro. Si
   prefieres crearlos a mano, deben calzar exactamente:

   | | `pteron-basic-2990-mensual` | `pteron-pro-9990-mensual` |
   |---|---|---|
   | Nombre | pteron Basic | pteron Pro |
   | Monto y moneda | 2990 CLP | 9990 CLP |
   | Intervalo | mensual (cada 1 mes) | mensual (cada 1 mes) |
   | Días de prueba | 7 | 0 |
   | Días para pagar | 3 | 3 |
   | Reintentos de cobro | 3 | 3 |
   | Número de períodos | sin límite (0) | sin límite (0) |
   | `urlCallback` | `https://pteron.patagua.dev/api/billing/flow-callback` | el mismo |

4. Los planes viejos (`pteron-basic-monthly`, `pteron-pro-monthly` y cualquier otro de pteron) ya no
   los usa el Worker. Antes de borrar uno, revisa en el panel de Flow que no tenga suscriptores:
   borrar el plan no cancela sus suscripciones. Si tiene, cancélalas primero.

## 5. Comprobar el sitio vivo

Con todo en `main` y los secretos cargados:

```bash
curl -sS https://pteron.patagua.dev/api/health
# {"ok":true} con 200; {"ok":false} con 503 si falta algo (nunca más que eso).
curl -sS -X POST https://pteron.patagua.dev/api/ai/v1/messages -H 'content-type: application/json' -d '{}'
# 401 not_authenticated: la IA pide licencia. 503 si falta la clave de Anthropic.
```

- `/admin` › Salud: todos los secretos presentes, Flow en producción, la firma k2 verificada, la clave
  de Anthropic válida y «Anthropic acepta las peticiones» en Sí. Los planes de Flow se revisan sólo
  cuando están a la venta (sección 8).
- Cloudflare › Workers › `pteron-landing` › Settings › Triggers: el Cron `17 12 * * *` (UTC). Desde el
  primer día, `subscriptions.last_synced_at` avanza en las filas de Flow.

## 6. Probar con una cortesía, sin cobrar

1. Entra una vez a https://pteron.patagua.dev/cuenta con tu correo; luego, en `/admin`, concédete la
   cortesía `tester` (el esquema borró las cortesías anteriores).
2. En pteron 0.8.0 (el build de desarrollo sirve), Configuración › Perfil › «Activar este equipo»: la
   app espera sola a que autorices en el navegador.
3. Modelo de IA › IA incluida › Guardar: el aviso dice que lo enviado va a Anthropic.
4. Haz un pedido largo con varias vueltas de herramientas. En `/admin` › Consumo debe aparecer en
   unidades, con el modelo `claude-haiku-5-5`, sin contenido.
5. Mide cuántas unidades usa cada material (los casos C01–C08 de `EVALUACION.md` de la app). Con eso
   se publica la equivalencia en materiales.

## 7. Publicar 0.8.0

1. En la app (`marcorojasb/pteron`), con la versión en 0.8.0, empuja la etiqueta `v0.8.0`:
   `release.yml` arma los instaladores y deja un borrador en `marcorojasb/pteron-beta`. Publícalo
   ahí. 0.8.0 trae Basic a $2.990 con IVA, sólo la clave k2 y la activación que espera sola a la
   cuenta; la 0.7.1 publicada todavía muestra $1.990.
2. `sync-pteron-releases.yml` hace un commit en `main` de esta web con
   `public/docs/data/releases.json` en 0.8.0 (corre cada 15 minutos, o a mano desde Actions). Ese
   commit no se publica solo: `/descargar` ya ofrece 0.8.0 porque la consulta a la API de GitHub,
   pero el JSON de respaldo queda viejo hasta desplegar `main` («Despliegue» en `README.md`).
   Comprueba que https://pteron.patagua.dev/descargar ofrece 0.8.0.

## 8. Abrir la venta

Sólo con 0.8.0 publicada (sección 7).

1. Resuelve `LEGAL-PENDIENTE.md`: quién vende (con RUT y domicilio), retracto y devoluciones,
   confirmación escrita, boleta por cada cobro y encargo de datos. Los borradores están en
   `BORRADORES-LEGALES.md`. Llena los `SELLER_*` (1b; `SELLER_REPRESENTATIVE` es opcional).
2. `/admin` › Planes: abre la venta de Basic, y la de Pro si corresponde. `/planes` cambia sola
   «Disponible pronto» por «Elegir Basic» (lee `GET /api/plans`, con un minuto de caché):
   compruébalo en https://pteron.patagua.dev/planes.
3. Primera compra real con tu tarjeta:
   - la suscripción queda en prueba;
   - al séptimo día, Flow cobra y la licencia se extiende sola;
   - cancelas y el plan termina al cierre.
   Revisa la boleta y el correo de confirmación (con la copia de los Términos).
4. `/admin` › Salud: el plan de Flow de cada plan a la venta debe calzar con el catálogo. Si abriste
   Pro antes de que alguien lo comprara, dirá que no calza hasta que el primer checkout cree el plan
   (o lo crees a mano con los valores de la sección 4).

## Después

- Cada semana, las suscripciones vigentes con el período vencido (debe dar 0 filas):

  ```sql
  select id, user_id, plan_id, status, current_period_end, last_synced_at
  from public.subscriptions
  where provider = 'flow' and status in ('trialing', 'active', 'past_due')
    and current_period_end < now() - interval '3 days';
  ```

- Cada semana, los checkouts que quedaron sin saber si Flow creó la suscripción (debe dar 0 filas;
  el Cron y el siguiente checkout los concilian solos):

  ```sql
  select id, user_id, plan_id, provider_customer_id, status, updated_at
  from public.billing_checkout_intents
  where status = 'subscription_pending'
    and updated_at < now() - interval '10 minutes';
  ```

- Cada mes, el costo del workspace en la consola de Anthropic contra la suma de unidades de
  `/admin` (10.000.000 = US$1). La diferencia debe ser menor al 5 %.
- Subir una cuota no exige aviso; bajarla, sí, y rige desde el período siguiente.
