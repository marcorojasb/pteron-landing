# Lanzar Basic con IA incluida

Guía para configurar y abrir la venta de Basic con IA incluida (ADR-177 de pteron). Cada paso
dice qué hacer, dónde y cómo comprobarlo sin exponer secretos. El orden importa:

1. Inventario, sin cambiar nada.
2. Anthropic, Cloudflare y Supabase preparados.
3. Migración y Worker nuevo, juntos.
4. La clave de Anthropic, al final del servidor.
5. Prueba con una cortesía, sin cobrar.
6. 0.7.2 publicada.
7. Lo legal resuelto, la web nueva y la venta abierta.

Cargar la clave de Anthropic antes de desplegar el Worker nuevo abriría un proxy sin cuota ni
filtros. Lo que se decide con abogado o contador está en `LEGAL-PENDIENTE.md`.

## 0. Inventario (sólo lecturas)

Supabase › SQL Editor:

```sql
-- Precio, prueba y cuota que tiene hoy el catálogo
select id, monthly_price_clp, trial_period_days, ai_units_limit, license_plan, active, listed
from public.plan_catalog order by monthly_price_clp, id;

-- ¿Hay suscripciones de Flow? (precio viejo, pruebas en curso, filas atascadas)
select plan_id, provider, status, count(*), min(current_period_end), max(current_period_end)
from public.subscriptions group by 1, 2, 3 order by 1, 2, 3;

-- ¿Algún checkout creó ya un plan en Flow?
select provider_plan_id, status, count(*) from public.billing_checkout_intents group by 1, 2;

-- Licencias vigentes por clave (¿quedan k1?)
select key_id, status, count(*) from public.licenses where expires_at > now() group by 1, 2;
```

Cloudflare, en el panel del Worker `pteron-landing`:
- Workers & Pages › Plans: ¿Free o Paid?
- Settings › Variables and Secrets: ¿hay variables de tipo **Text**? Se borran en cada despliegue;
  las que importan ya están en `wrangler.jsonc`.
- `npx wrangler secret list` (desde esta carpeta) muestra sólo los nombres.
- Settings › Build: el *Preview command*.
- Zona patagua.dev › Security › Bots: ¿Bot Fight Mode activo?

Flow, en el panel de producción:
- ¿Existe el plan `pteron-basic-monthly`? ¿Con qué monto y cuántos suscriptores?
- ¿La cuenta tiene **Cargo automático**? Sin él, Flow no cobra la tarjeta registrada: manda un enlace
  de pago cada mes y el flujo de la web no sirve tal cual. Confírmalo con Flow antes de seguir.

Anthropic, en la consola: tier de la organización, fecha de creación, crédito y recarga automática.

Sonda del sitio vivo (sin efectos):

```bash
curl -sS -X POST https://pteron.patagua.dev/api/billing/flow-callback -d 'token=sonda'
# 503 billing_not_configured: producción no tiene llaves de Flow, nadie puede comprar hoy.
# 502 flow_error: hay llaves y la venta vieja está abierta; ver el paso 3.
```

## 1. Anthropic

1. Settings › Workspaces › Create: `pteron-produccion`. No uses el Default, que no admite límites.
2. Settings › Service accounts: `pteron-gateway`, agregada a ese workspace.
3. API keys › Create: vinculada a esa cuenta de servicio y limitada a ese único workspace. Una
   clave sin workspace fijo hace fallar cada petición. Guárdala para el paso 4.
4. El workspace › Spend limits: tope mensual de 1,5 × (Basic × US$0,60 + Pro × US$3,00), mínimo
   US$20, con alertas al 50 % y al 80 %. Es el techo duro si algo más falla.
5. El workspace › Rate limits › Claude Haiku 5.5: la mitad de los de la organización.
6. https://platform.claude.com/settings/capabilities: apaga la búsqueda web y la obtención web.
   pteron no las usa y el Worker ya las filtra; esto es una segunda barrera.
7. Billing: crédito y recarga automática.

## 2. Cloudflare y Supabase

Cloudflare:
1. Workers Paid (US$5 al mes). El plan gratis da 10 ms de CPU y corta las respuestas largas.
2. Bot Fight Mode: apágalo, o usa Super Bot Fight Mode con una regla *Skip* para `/api/billing/*`
   y `/api/ai/*`. Si no, desafía los avisos de Flow y a la app de escritorio.
3. Secretos (tipo **Secret**; `npx wrangler secret put NOMBRE` o el panel):
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FLOW_API_KEY` y `FLOW_SECRET_KEY` **de
   producción**, `LICENSE_PRIVATE_KEY_PEM` (k2) y `ADMIN_EMAILS`. `ANTHROPIC_API_KEY`, en el paso 4.
4. Comprueba la privada k2 en tu equipo:
   `openssl pkey -in k2.pem -pubout` debe imprimir
   `MCowBQYDK2VwAyEAIWGm5jH/yZJ2b5hsQ3UusUn+HIxC5dGiqc1gwOqvrrY=`.
5. Las vistas previas (`*.workers.dev` y URLs de versión) corren con los secretos de producción.
   El Worker nuevo responde 421 en sus rutas de cuenta, cobro, licencia e IA, pero protégelas con
   Cloudflare Access o apágalas (`workers_dev` y `preview_urls` en `wrangler.jsonc`) cuando ya no
   revises la web nueva ahí.

Supabase:
1. Authentication › Emails › SMTP Settings: SMTP propio con tu dominio (SPF y DKIM). Sin él,
   Supabase sólo envía el enlace mágico a miembros del equipo del proyecto. Prueba con un correo
   externo.
2. Authentication › URL Configuration: Site URL `https://pteron.patagua.dev/cuenta` y la misma en
   Redirect URLs.
3. Antes de abrir la venta, plan Pro (US$25 al mes). El gratis pausa proyectos inactivos y no da
   respaldos descargables, y esta base guarda quién pagó.

## 3. Migración y Worker nuevo, juntos

La migración deja el catálogo en $1.990 y con la venta cerrada. El Worker viejo cobra $2.999 e
ignora ese cierre. Por eso:
- si la sonda del paso 0 dio `billing_not_configured`, el orden no tiene riesgo;
- si dio `flow_error`, aplica la migración y despliega el Worker nuevo en el mismo rato, o cierra
  antes la venta quitando `FLOW_API_KEY`.

1. Aplica `supabase/migrations/20261013120000_basic_ia_incluida.sql` (SQL Editor, o
   `supabase db push`). Comprueba:

   ```sql
   select id, monthly_price_clp, trial_period_days, ai_units_limit, trial_ai_units_limit, for_sale
   from public.plan_catalog order by id;
   -- basic 1990 / 7 / 6000000 / 1500000 / false · pro 9990 / 0 / 30000000 / null / false
   -- tester 6000000 / false
   select key, value from public.app_settings;   -- included_ai_paused = false
   ```

2. Despliega el Worker nuevo, es decir, lleva a `main` los commits del servidor. Workers Builds
   publica en cada push a `main`. Comprueba:

   ```bash
   curl -sS https://pteron.patagua.dev/api/health
   # {"ok":false} con 503 mientras falte la clave de Anthropic; nunca más que eso.
   ```

   En `/admin` › Salud, todo en verde salvo la clave de Anthropic. Flow debe decir producción.

3. El Cron diario (12:17 UTC) aparece en Workers › Triggers › Cron Events. Desde el primer día,
   `subscriptions.last_synced_at` avanza en las filas de Flow.

## 4. La clave de Anthropic

1. `npx wrangler secret put ANTHROPIC_API_KEY` con la clave del paso 1.
2. Sonda sin licencia: `curl -sS -X POST https://pteron.patagua.dev/api/ai/v1/messages -H
   'content-type: application/json' -d '{}'` debe pasar de 503 a **401** `not_authenticated`.
3. `/admin` › Salud: clave de Anthropic válida y `/api/health` en `{"ok":true}`.

## 5. Probar con una cortesía, sin cobrar

1. Entra una vez a https://pteron.patagua.dev/cuenta con tu correo; luego, en `/admin`, concédete
   la cortesía `tester`.
2. En pteron 0.7.2 (el build de desarrollo sirve), Configuración › Perfil › «Activar este equipo»:
   la app espera sola a que autorices en el navegador.
3. Modelo de IA › IA incluida › Guardar: el aviso dice que lo enviado va a Anthropic.
4. Haz un pedido largo con varias vueltas de herramientas. En `/admin` › Consumo debe aparecer en
   unidades, con el modelo `claude-haiku-5-5`, sin contenido.
5. Mide cuántas unidades usa cada material (los casos C01–C08 de `EVALUACION.md` de la app). Con
   eso se publica la equivalencia en materiales.

## 6. Publicar 0.7.2

Publicar la versión hace un commit en `main` de esta web (`sync-pteron-releases.yml`) y la
despliega. Con el servidor ya en `main` no cambia nada del cobro ni de la IA.

## 7. Abrir la venta

1. Resuelve `LEGAL-PENDIENTE.md`: quién vende (con RUT y domicilio), retracto y devoluciones,
   confirmación escrita, boleta por cada cobro y encargo de datos.
2. Mergea la web nueva (precios con IVA, cuota publicada, casilla de Términos, Privacidad con
   Anthropic).
3. Flow: el Worker crea `pteron-basic-1990-mensual` con los valores del catálogo en el primer
   checkout y lo valida con `plans/get` antes de cada cobro. Si prefieres crearlo a mano, usa esos
   valores: 1990 CLP, mensual, 7 días de prueba, 3 días para pagar, 3 reintentos y `urlCallback`
   `https://pteron.patagua.dev/api/billing/flow-callback`. Si `pteron-basic-monthly` tiene
   suscriptores a $2.999, decide si los pasas al plan nuevo (`subscription/changePlan`).
4. `/admin` › Planes: abre la venta de Basic, y la de Pro si corresponde.
5. Primera compra real con tu tarjeta:
   - la suscripción queda en prueba;
   - al séptimo día, Flow cobra y la licencia se extiende sola;
   - cancelas y el plan termina al cierre.
   Revisa la boleta y el correo de confirmación.

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
