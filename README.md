# pteron — landing y cuenta

Sitio público de `pteron`, con la cuenta web para autenticación, planes,
registro de tarjeta y activación de licencias en la aplicación de escritorio.

## Contenido

- `index.html`: landing principal.
- `planes/index.html`: planes, precios y funcionamiento de las licencias.
- `cuenta/`: cuenta web, acceso por enlace mágico, checkout y activación.
- `api/`: funciones serverless de autenticación, Flow, licencias y activación.
- `supabase/migrations/`: esquema de perfiles, suscripciones, licencias,
  activaciones, eventos de cobro y uso.
- `styles.css` y `cuenta/styles.css`: sistema visual responsive.
- `script.js` y `cuenta/cuenta.js`: interacción del sitio y de la cuenta.
- `release-data.js`: selección semver de la última versión completa a partir
  del JSON incluido, la API pública de GitHub y el fallback de la web.
- `vercel.json`: URLs limpias, caché de assets y cabeceras de seguridad.
- `assets/`: imágenes, favicons y recursos públicos.

## Arquitectura

La web estática y las funciones API viven en Vercel. Supabase mantiene sólo
metadatos de cuenta y suscripción; los archivos de trabajo permanecen en el
equipo del profesor. Flow gestiona el registro de tarjeta y los cobros. La
aplicación `pteron` recibe un enlace de un solo uso y guarda localmente una
licencia firmada con protección del sistema operativo.

Proyecto Supabase configurado:

```text
https://swzqblyllbudwbmbcthr.supabase.co
```

Las migraciones ya aplicadas deben conservarse en `supabase/migrations/` y
aplicarse en orden si se prepara otro entorno.

## Versiones públicas

El workflow `sync-pteron-releases.yml` actualiza `docs/data/releases.json` a
partir de los releases publicados. Una versión sólo pasa a ser la actual cuando
su matriz de artefactos está completa. En el navegador, `release-data.js`
combina ese JSON con la API pública de GitHub y conserva un fallback local.

Los HTML cargan el CSS y JavaScript compartidos con un parámetro `?v=` para
evitar que un archivo antiguo de la caché reemplace los enlaces actuales. Ese
valor debe cambiar cuando se modifica alguno de esos recursos; publicar una
versión nueva sin cambios de código no requiere tocarlo.

## Variables de Vercel

Configúralas por entorno desde Vercel; nunca las guardes en el repositorio ni
las pegues en la interfaz del navegador.

Variables públicas o de configuración:

- `PUBLIC_SITE_URL=https://pteron.patagua.dev`
- `SUPABASE_URL=https://swzqblyllbudwbmbcthr.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`
- `FLOW_BASE_URL=https://sandbox.flow.cl/api` durante las pruebas, o
  `https://www.flow.cl/api` al pasar a producción.
- `LICENSE_KID=k1`

Variables sensibles que aún deben introducirse de forma segura si no están
configuradas:

- `SUPABASE_SERVICE_ROLE_KEY`: la usan sólo las funciones serverless para
  escribir suscripciones, eventos y licencias.
- `FLOW_API_KEY` y `FLOW_SECRET_KEY`: credenciales del entorno de Flow que
  corresponda a `FLOW_BASE_URL`.
- `LICENSE_PRIVATE_KEY_PEM`: clave privada de firma; su clave pública ya está
  incluida en la aplicación de escritorio.

También pueden definirse `FLOW_BASIC_PLAN_ID` y `FLOW_PRO_PLAN_ID` si los planes
se crean previamente en Flow con identificadores distintos de
`pteron_basic` y `pteron_pro`.

## Configuración externa antes de publicar

1. En Supabase Auth, establece como Site URL
   `https://pteron.patagua.dev/cuenta/` y permite ese mismo destino como URL de
   redirección.
2. En Cloudflare, configura el CNAME exacto que muestra la tarjeta del dominio
   `pteron.patagua.dev` en Vercel. No sustituyas ese destino por una IP.
3. En Flow, prueba primero con sandbox: registro de tarjeta, callback,
   suscripción Basic con siete días de prueba, cancelación y callback de pago.
4. Antes de cobrar, cambia las credenciales y `FLOW_BASE_URL` al entorno de
   producción, confirma los precios publicados y revisa las condiciones de
   devolución.
5. Define la cuota de IA antes de habilitar capacidad adicional; el esquema
   deja `ai_units_limit` como `null` hasta tomar esa decisión.

## Despliegue

Desde esta carpeta:

```bash
vercel
vercel --prod
```

El despliegue requiere que las variables anteriores estén completas. La
integración automática con GitHub es opcional; Vercel puede desplegar mediante
su proyecto conectado o desde la CLI.

## Probar localmente

```bash
python3 -m http.server 4173
```

Luego abre `http://localhost:4173`, `/planes/` o `/cuenta/`. La cuenta necesita
un despliegue con las funciones API y variables configuradas para completar
autenticación, Flow y activación.

Comprobaciones rápidas:

```bash
for file in $(find api -type f -name '*.js' -print); do node --check "$file"; done
node --check cuenta/cuenta.js
```

## Antes del lanzamiento comercial

- Revisar legalmente Privacidad, Términos, prueba con tarjeta y devoluciones.
- Mantener los enlaces de descarga sincronizados con los releases públicos.
- Probar la activación en una instalación limpia de cada plataforma soportada.
- Confirmar las capacidades exactas de Basic y Pro, incluida la cuota de IA.
