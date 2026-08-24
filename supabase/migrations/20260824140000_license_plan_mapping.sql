-- Qué plan viaja dentro de la licencia firmada.
--
-- La app de escritorio sólo reconoce dos valores (`src/main/services/license.ts`
-- rechaza el token si `payload.plan` no es 'basic' ni 'pro'). Firmar un plan
-- nuevo — `tester` — produciría una licencia válida que el cliente descarta en
-- silencio: sin error, sin activación y sin pista de por qué.
--
-- Así que el plan de la suscripción y el plan de la licencia dejan de ser el
-- mismo dato. `tester` da exactamente lo que da Basic, luego se firma como
-- Basic; la suscripción sigue diciendo `tester` para contabilidad. El CHECK
-- deja el contrato con la app escrito donde no se puede ignorar: añadir un
-- plan con un `license_plan` que el cliente no entienda falla aquí, no en el
-- equipo de un profesor.
alter table public.plan_catalog
  add column license_plan text check (license_plan in ('basic', 'pro'));

comment on column public.plan_catalog.license_plan is
  'Valor de `plan` en la licencia firmada. null = este plan no emite licencia.';

update public.plan_catalog set license_plan = 'basic' where id in ('basic', 'tester');
update public.plan_catalog set license_plan = 'pro'   where id = 'pro';
-- 'free' se queda en null a propósito: el núcleo local no necesita licencia.
