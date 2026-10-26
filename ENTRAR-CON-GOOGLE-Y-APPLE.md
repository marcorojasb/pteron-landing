# Entrar con Google y Apple

Cómo `/cuenta` ofrece «Continuar con Google» y «Continuar con Apple» junto al enlace por correo: qué está
configurado en cada proveedor y cómo se comprueba. Los botones están en `public/cuenta/index.html`. Se reutiliza lo
que ya funciona en hola.patagua.dev:

- el cliente OAuth de Google;
- la cuenta pagada de Apple Developer y su equipo.

No hay secretos nuevos.

## Estado al 26 de octubre de 2026

Google y Apple están activos. Marco entró en producción con cada uno, antes de mostrar sus botones.

- Google (paso 1): el cliente de hola.patagua.dev tiene la URI de pteron. Su marca se llama Patagua, para pteron y
  hola, y está verificada: Google muestra «Ir a Patagua».
- Apple (paso 2): el Services ID `dev.patagua.pteron` tiene como Primary App ID el de la app pteron
  (`cl.pteron.app`). Apple muestra «iniciar sesión en pteron».
- Supabase tiene los dos encendidos (paso 3).
- Privacidad, versión 2026-10-26, declara los dos (paso 5).
- El código:
  - en el Worker: `POST /api/auth/oauth`, `POST /api/auth/apple-callback` y `POST /api/auth/id-token`;
  - en `/cuenta`: los botones y la vuelta;
  - las pruebas: `tests/worker.test.js`, `tests/cuenta.test.js` y, para Privacidad, `tests/sitio.test.js`;
  - en `wrangler.jsonc`: los Client IDs.

## Cómo funciona

Es OpenID Connect con `id_token`, sin pasar por el dominio de Supabase, igual que hola.patagua.dev, que recibe la
vuelta en su propio dominio.

1. El botón arma en el navegador un nonce y un state al azar, y los guarda en `localStorage` (`pteron-oauth`, media
   hora, un solo uso). A `POST /api/auth/oauth` sólo va la huella del nonce (SHA-256 en hex).
2. El Worker pregunta a Supabase (`/auth/v1/settings`) si el proveedor está encendido; si no, responde «no está
   disponible ahora» y el profe sigue con su correo. Si está, devuelve la dirección del proveedor, con la huella
   como `nonce`.
3. Cada proveedor vuelve de una forma:
   - Google, a `https://pteron.patagua.dev/cuenta`, con el `id_token` en el fragmento.
   - Apple, por POST (`form_post`, obligatorio al pedir el correo) a
     `https://pteron.patagua.dev/api/auth/apple-callback`, que sólo lo devuelve a `/cuenta` en el fragmento.

   El fragmento no llega a ningún servidor.
4. `/cuenta` revisa que el state sea el suyo y manda el `id_token` con el nonce a `POST /api/auth/id-token`.
   Supabase (`grant_type=id_token`) comprueba la firma del proveedor, que el token sea para nuestro Client ID, su
   vencimiento y que su nonce sea la huella del nonce de este navegador. Un `id_token` ajeno no abre nada.
5. Supabase une las cuentas por correo verificado: quien ya entraba con `profe@gmail.com` por enlace y elige Google
   con esa dirección entra a la misma cuenta, con su plan y sus licencias.

   En Apple, «Ocultar mi correo» entrega una dirección `@privaterelay.appleid.com` y crea otra cuenta, vacía. Si
   alguien escribe «no veo mi plan», pregunta con qué entró.
6. `/admin` sigue igual: exige un correo de `ADMIN_EMAILS` confirmado por Supabase.

## 1. Google: una URI más en el cliente de hola.patagua.dev (hecho)

En [Google Cloud](https://console.cloud.google.com), en el proyecto de hola.patagua.dev, abre Google Auth Platform ›
Clients y el cliente `561105936463-52r38o936uacthu7rtin8ttvkqqfhjaa.apps.googleusercontent.com`. En Authorized
redirect URIs está, sin barra final:

```text
https://pteron.patagua.dev/cuenta
```

No hace falta su secreto.

La marca del proyecto se llama Patagua, con su logo, y sirve para pteron y para hola: Google muestra «Ir a Patagua».
Cambiar el nombre o el logo pide verificar la marca de nuevo, y mientras tanto Google muestra el dominio
(«patagua.dev»). Las cuentas siguen siendo las mismas: Google identifica a cada persona igual en todos los clientes.

Si un profe usa la cuenta de Google de su colegio y el administrador del colegio limita las apps de terceros, Google
puede no dejarlo entrar. En ese caso entra con su correo.

## 2. Apple: el Services ID de pteron (hecho)

En [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources), con la cuenta pagada de
siempre:

1. Identifiers › App IDs › pteron (`cl.pteron.app`, el de la app de escritorio): «Sign In with Apple» activado, como
   primary App ID. Así Apple agrupa la entrada web con la app pteron y no con hola.

   No toca la firma ni la notarización: la app se firma con Developer ID, sin perfiles de aprovisionamiento, y sus
   entitlements son todos `com.apple.security.*`. Si algún día usa un perfil, cambiar las capacidades de este App ID
   lo invalida y hay que generarlo de nuevo.
2. Identifiers › Services IDs › `dev.patagua.pteron`, el mismo de `APPLE_SERVICES_ID` en `wrangler.jsonc`, con
   descripción `pteron`. En «Sign In with Apple» › Configure:
   - Primary App ID: pteron (`cl.pteron.app`).
   - Domains and Subdomains: `pteron.patagua.dev`.
   - Return URLs: `https://pteron.patagua.dev/api/auth/apple-callback`.
3. Services › Sign in with Apple for Email Communication: `patagua.dev` (o `no-reply@patagua.dev`) en Email Sources.
   Es el remitente de los enlaces de acceso y de los avisos del plan; sin esto, Apple no reenvía a una dirección
   `@privaterelay.appleid.com`. La lista es de toda la cuenta de desarrollador. Resend firma ese dominio con DKIM, y
   su subdominio de envío tiene SPF.

No hace falta crear una clave `.p8` ni firmar un secreto: Apple devuelve el `id_token` directamente.

## 3. Supabase

Lo hago yo con la API de administración. En Authentication › Sign In / Providers:

1. Google: encendido, con Client IDs `561105936463-52r38o936uacthu7rtin8ttvkqqfhjaa.apps.googleusercontent.com`.
2. Apple: encendido, con Client IDs `dev.patagua.pteron`.
3. En los dos, «Skip nonce checks» apagado: el nonce es lo que ata el `id_token` al navegador.
4. Email queda encendido: el enlace por correo sigue siendo la entrada de quien no use Google ni Apple.

## 4. Comprobar un proveedor

El Worker dice si cada proveedor quedó encendido:

```bash
curl -s -X POST https://pteron.patagua.dev/api/auth/oauth -H 'content-type: application/json' \
  -d '{"provider":"google","state":"comprobacion_0123456789","nonce_hash":"'$(printf %064d 0)'"}'
```

- Encendido, responde `{"url":"https://accounts.google.com/o/oauth2/v2/auth?…"}`.
- Apagado, `provider_unavailable`.

Repite con `"provider":"apple"`.

Para probar el viaje real de un proveedor cuyo botón sigue oculto (`hidden`), sin mostrarlo a nadie:
1. Abre `https://pteron.patagua.dev/cuenta` sin sesión.
2. En la consola del navegador, escribe `document.querySelector('[data-oauth-provider="apple"]').hidden = false`
   (o `"google"`).
3. Entra con esa cuenta. Debe abrirse tu cuenta.
4. Revisa en Supabase › Authentication › Users que quedó una sola cuenta por correo, con sus identidades.

## 5. Mostrar u ocultar un proveedor

Los dos botones están a la vista desde el 26 de octubre. Para mostrar u ocultar uno:

1. `public/cuenta/index.html`: `hidden` en su botón (`data-oauth-provider="google"` o `"apple"`).
2. `public/privacidad.html`, con versión nueva:
   - en «Cuenta y planes», su párrafo: «Si entras con Google…» o «Si entras con Apple…». El de Apple no menciona
     el nombre: Apple lo manda sólo fuera del `id_token`, y la vuelta no lo pasa;
   - en «Proveedores», su línea: «**Google**, sólo si eliges entrar con Google…» o la de Apple.

   `tests/sitio.test.js` exige las dos frases para cada botón a la vista, y ninguna para uno oculto.
3. Subir la revisión `?v=`, `npm run verify`, desplegar y entrar en producción con una cuenta real.
