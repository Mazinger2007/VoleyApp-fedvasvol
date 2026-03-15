# Sync automático a MySQL (sin peticiones manuales)

Este servicio sincroniza `fedvasvol` a BD y se ejecuta en bucle.

## Variables necesarias

Configura variables de entorno:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `SYNC_INTERVAL_MINUTES` (por defecto: `5`)

## Scripts

- Ejecución única:
  - `npm run sync:db:once`
- Servicio continuo (scheduler):
  - `npm run sync:db:daemon`

## Qué hace

1. Descubre temporadas y torneos desde `/es/tournaments`
2. Extrae grupos desde `/ranking`
3. Descarga ranking (`/ranking/{groupId}`)
4. Descarga calendario completo (`/calendar/{groupId}/all`)
5. Guarda en tablas:
   - `sync_runs`
   - `tournaments`
   - `tournament_groups`

## Frecuencia recomendada

- Producción normal: **cada 5 minutos**
- Si quieres muy agresivo: cada 1 minuto (más carga y más probabilidad de bloqueo)

## Nota operativa

Como tu servidor no está 24/7, cuando vuelva a arrancar el daemon hará una sincronización completa automáticamente.
