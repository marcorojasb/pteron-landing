# Entrar con Google y Apple

Qué falta para que `/cuenta` ofrezca «Continuar con Google» y «Continuar con Apple» junto al enlace por correo, en
orden. El código está completo y probado. Los botones están en `public/cuenta/index.html`, ocultos (`hidden` en
`data-oauth`), así que publicarlo no cambia nada a la vista. Se reutiliza lo que ya funciona en hola.patagua.dev:

- el cliente OAuth de Google;
- la cuenta pagada de Apple Developer y su equipo.

No hay secretos nuevos.

## Estado al 25 de octubre de 2026

- Hecho:
  - en el Worker: `POST /api/auth/oauth`, `POST /api/auth/apple-callback` y `POST /api/auth/id-token`;
  - en `/cuenta`: los botones y la vuelta;
  - las pruebas: `tests/worker.test.js` y `tests/cuenta.test.js`;
  - en `wrangler.jsonc`: los Client IDs.
- Falta:
  - en Google, una URI de redirección más en el cliente de hola.patagua.dev (paso 1);
  - en Apple, el Services ID de pteron (paso 2);
  - encender ambos proveedores en Supabase (paso 3);
  - el texto de la Política de privacidad;
  - mostrar los botones.

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

## 1. Google: una URI más en el cliente de hola.patagua.dev

En [Google Cloud](https://console.cloud.google.com), en el proyecto de hola.patagua.dev, abre Google Auth Platform ›
Clients y el cliente `561105936463-52r38o936uacthu7rtin8ttvkqqfhjaa.apps.googleusercontent.com`. En Authorized
redirect URIs agrega, sin barra final:

```text
https://pteron.patagua.dev/cuenta
```

Nada más:
- No hace falta su secreto.
- La marca y los dominios autorizados no cambian, porque `patagua.dev` ya está entre ellos. La verificación de
  hola.patagua.dev no se toca.

Google mostrará el nombre de la app de ese proyecto. Si se quiere que diga «pteron», se crea un proyecto aparte con
su propia pantalla de permiso y se cambia `GOOGLE_CLIENT_ID`. Las cuentas siguen siendo las mismas: Google identifica
a cada persona igual en todos los clientes.

Si un profe usa la cuenta de Google de su colegio y el administrador del colegio limita las apps de terceros, Google
puede no dejarlo entrar. En ese caso entra con su correo.

## 2. Apple: el Services ID de pteron

En [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources), con la cuenta pagada de
siempre:

1. Identifiers › Services IDs › +.
   - Descripción: `pteron`. Es el nombre que Apple muestra al profe.
   - Identifier: `dev.patagua.pteron`, el mismo de `APPLE_SERVICES_ID` en `wrangler.jsonc`.
2. Actívale «Sign In with Apple» y, en Configure:
   - Primary App ID: el mismo que usa `dev.patagua.web`.
   - Domains and Subdomains: `pteron.patagua.dev`.
   - Return URLs: `https://pteron.patagua.dev/api/auth/apple-callback`.

   Si Apple pide verificar el dominio con un archivo, pásamelo y lo publico en `/.well-known/` del sitio.
3. Services › Sign in with Apple for Email Communication. Revisa que estén `patagua.dev` o `no-reply@patagua.dev`,
   el remitente de los enlaces de acceso y de la confirmación de compra. Sin esto, Apple no reenvía a una dirección
   `@privaterelay.appleid.com`. Resend ya firma ese dominio con SPF y DKIM.

No hace falta crear una clave `.p8` ni firmar un secreto: Apple devuelve el `id_token` directamente.

## 3. Supabase

Lo hago yo con la API de administración. En Authentication › Sign In / Providers:

1. Google: encendido, con Client IDs `561105936463-52r38o936uacthu7rtin8ttvkqqfhjaa.apps.googleusercontent.com`.
2. Apple: encendido, con Client IDs `dev.patagua.pteron`.
3. En los dos, «Skip nonce checks» apagado: el nonce es lo que ata el `id_token` al navegador.
4. Email queda encendido: el enlace por correo sigue siendo la entrada de quien no use Google ni Apple.

## 4. Comprobar antes de mostrar los botones

El Worker dice si cada proveedor quedó encendido:

```bash
curl -s -X POST https://pteron.patagua.dev/api/auth/oauth -H 'content-type: application/json' \
  -d '{"provider":"google","state":"comprobacion_0123456789","nonce_hash":"'$(printf %064d 0)'"}'
```

- Encendido, responde `{"url":"https://accounts.google.com/o/oauth2/v2/auth?…"}`.
- Apagado, `provider_unavailable`.

Repite con `"provider":"apple"`.

Para probar el viaje real sin mostrar los botones a nadie:
1. Abre `https://pteron.patagua.dev/cuenta` sin sesión.
2. En la consola del navegador, escribe `document.querySelector("[data-oauth]").hidden = false`.
3. Entra con tu cuenta de Google y después con tu Apple ID. Debe abrirse tu cuenta.
4. Revisa en Supabase › Authentication › Users que quedó una sola cuenta por correo, con las dos identidades.

## 5. Mostrar los botones

Lo hago yo cuando me digas que Google y Apple están listos:

1. `public/cuenta/index.html`: quitar `hidden` de `<div class="acceso-proveedores" data-oauth hidden>`. Si sólo
   uno está listo, se quita el botón del otro.
2. `public/privacidad.html`, con versión nueva. Texto propuesto, para que lo revises:
   - En «Cuenta y planes»: «Si entras con Google o Apple, ese servicio confirma quién eres y entrega tu correo y,
     si lo comparte, tu nombre; Google también la dirección de tu foto de perfil. Si en Apple eliges ocultar tu
     correo, recibimos una dirección de reenvío de Apple en vez de la tuya.»
   - En «Proveedores»: «**Google** y **Apple**, sólo si eliges entrar con uno de ellos, confirman quién eres.
     Saben que entraste a pteron; no reciben nada de tu cuenta ni de tu trabajo.»
3. Subir la revisión `?v=`, `npm run verify`, desplegar y entrar en producción con una cuenta real de cada uno.
