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
- `GET /api/events`
- `POST /api/events/:eventId/reserve` (Bearer token)
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
