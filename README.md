# CQB-Factory-Web

Landing web para negocio de airsoft CQB + backend inicial.

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

## Base de datos de jugadores

Este backend usa SQLite en `data/cqb.sqlite`.

Tabla `jugadores`:

- `nombre`
- `correo`
- `contrasena`
- `victorias`
- `derrotas`
- `partidas_jugadas`
- `reservas_activas`

Tabla `reservas`:

- `jugador_id`
- `evento_id`
- `equipo`
- `estado`
- `resultado`
