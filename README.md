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
- `POST /api/auth/logout` (Bearer token)
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
