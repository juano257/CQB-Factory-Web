# CQB-Factory-Web

Landing web para negocio de airsoft CQB + backend inicial.

## Configuracion de base de datos (Neon)

1. Crea un archivo `.env` en la raiz del proyecto (puedes copiar desde `.env.example`).

2. Configura `DATABASE_URL` con tu cadena de conexion de Neon.

Ejemplo Neon:

```bash
DATABASE_URL=postgresql://neondb_owner:<password-encoded>@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

3. Si tu contrasena tiene caracteres especiales (por ejemplo `[]!#$`), codificala en URL.

4. Al iniciar el backend, las tablas se crean automaticamente si no existen.

5. Puedes validar la conexion antes de levantar el servidor:

```bash
npm run db:check
```

## Verificacion de correo

El registro envia automaticamente un enlace de verificacion al correo del usuario.

Configuracion recomendada con Brevo en `.env`:

```bash
APP_URL=https://cqbfactory.com
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-login-smtp-brevo
SMTP_PASS=tu-clave-smtp-brevo
MAIL_FROM="CQB Factory <no-reply@tu-dominio.com>"
```

Notas:

- En Brevo debes verificar el remitente o dominio que usaras en `MAIL_FROM`.
- `SMTP_USER` y `SMTP_PASS` salen desde la seccion SMTP de Brevo, no necesariamente son tu email de acceso.
- Si `SMTP_*` no esta configurado, la cuenta se crea igual pero el backend deja el enlace de verificacion en logs.
- Las reservas quedan bloqueadas hasta verificar el correo.
- El usuario puede reenviar el enlace desde la interfaz cuando tenga sesion iniciada.

## Dominio en produccion (cqbfactory.com)

Para que la app responda en `https://cqbfactory.com`:

1. Apunta DNS del dominio al servidor donde corre Node (o al proxy inverso).
2. Configura HTTPS (Cloudflare, Nginx + Let's Encrypt, o tu proveedor de hosting).
3. En `.env` de produccion usa:

```bash
NODE_ENV=production
APP_URL=https://cqbfactory.com
# Opcional si quieres forzar canónico explícito:
# CANONICAL_HOST=cqbfactory.com
# CANONICAL_PROTOCOL=https
```

Con `NODE_ENV=production`, el backend redirige automáticamente cualquier host/protocolo distinto al dominio canónico.

## Recuperacion de contrasena

La aplicacion permite solicitar un enlace de recuperacion por correo.

Flujo:

1. En login, usar "Olvide mi contrasena".
2. Llega un enlace con token temporal (30 minutos).
3. El usuario define una nueva contrasena en `reset-password.html`.

Pasos rapidos en Brevo:

1. Crea una cuenta en Brevo.
2. Verifica tu remitente o dominio.
3. Genera una credencial SMTP.
4. Copia esos datos a tu `.env`.
5. Reinicia el servidor.

## Ejecutar proyecto

1. Instalar dependencias:

```bash
npm install
```

2. Levantar servidor (sirve frontend y API):

```bash
npm run dev
```

3. Abrir en navegador:

- http://localhost:3000

## Endpoints backend inicial

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/resend-verification` (Bearer token)
- `POST /api/auth/password/forgot` (body: `{"email":"..."}`)
- `POST /api/auth/password/reset` (body: `{"token":"...","newPassword":"..."}`)
- `POST /api/auth/logout` (Bearer token)
- `GET /auth/verify-email?token=...`
- `GET /auth/reset-password?token=...`
- `GET /api/me` (Bearer token)
- `GET /api/seasons/current` (Bearer token)
- `GET /api/events`
- `POST /api/payments/prepare` (Bearer token, body: `{"eventId":"...","team":"rojo"|"azul"}`)
- `POST /api/payments/confirm` (Bearer token, body: `{"paymentToken":"..."}`)
- `POST /api/events/:eventId/reserve` (Bearer token, body: `{"team":"rojo"|"azul","paymentToken":"..."}`)

Nota: el pago esta preparado para integracion con proveedor externo. La pasarela real aun no esta conectada.
- `GET /api/moderation/reservations` (Bearer token de admin o moderator)
- `GET /api/moderation/players` (Bearer token de admin o moderator)
- `POST /api/moderation/reservations/:reservationId/team` (Bearer token de admin o moderator, body: `{"team":"rojo"|"azul"}`)
- `POST /api/moderation/events/:eventId/result` (Bearer token de admin o moderator, body: `{"winningTeam":"rojo"|"azul"}`)
- `POST /api/moderation/seasons/end` (Bearer token de admin o moderator)
- `POST /api/moderation/seasons/start` (Bearer token de admin o moderator)
- `POST /api/reservations/:reservationId/result` (Bearer token, body: `{"result":"win"|"loss"}`)

## Motor de base de datos

Este backend usa PostgreSQL mediante la libreria `pg`.
