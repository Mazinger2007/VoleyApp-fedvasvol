# Lógica real de fedvasvol (scraping)

Este documento resume **de dónde sacar la información** de forma estable.

## 1) Descubrimiento de competiciones

- Punto de entrada: `https://fedvasvol.com/es/tournaments`
- Ahí están:
  - Select de temporadas (`<select name="season">`)
  - Token CSRF (`<input name="csrf_token">`)
  - Tabla pública con filas que enlazan a:
    - `.../es/tournament/{tournamentId}/summary`

### Endpoint AJAX observado (más rápido)

- Endpoint: `POST https://fedvasvol.com/es/ajax/tournaments`
- Requiere:
  - `csrf_token` de `/es/tournaments`
  - cookie de sesión de la misma carga inicial
  - `season={id}` (y opcionalmente resto de filtros)
- Devuelve HTML (a veces embebido en JSON) con la tabla filtrada.

### Regla
De cada enlace `summary` derivamos:
- `.../ranking` (base de clasificación/calendario)
- `.../information`

## 2) Descubrimiento de grupos

Para cada torneo, abrir:
- `.../es/tournament/{id}/ranking`

Desde ese HTML salen enlaces con `groupId`:
- `.../ranking/{groupId}`
- `.../calendar/{groupId}`

## 3) Ranking

Fuente estable:
- `.../es/tournament/{id}/ranking/{groupId}`

Se parsea la primera tabla (`<table>`) con cabeceras y filas.

### Optimización runtime app

- La app ya no depende del HTML completo para la clasificación.
- Flujo usado:
  - cargar `.../ranking` para descubrir `groupId` y enlaces de calendario
  - pedir tabla por AJAX con `GET /es/ajax/table-search?type=12&id={groupId}&rows=50&input=`
- El endpoint devuelve JSON con HTML embebido en `content`.

## 4) Calendario

Fuente recomendada para carga completa:
- `.../es/tournament/{id}/calendar/{groupId}/all`

Ventajas:
- Incluye todas las jornadas en una sola respuesta
- Se pueden parsear múltiples tablas (una por jornada)

### Optimización runtime app

- La app resuelve cada jornada por AJAX reutilizando los tokens `type=9`, `id`, `rows`, `data` encontrados en `.../calendar/{groupId}/all`.
- Endpoint usado:
  - `GET /es/ajax/table-search?type=9&id={tournamentId}&rows=50&data={token}&input=`
- Cada respuesta devuelve una tabla de jornada en JSON con HTML embebido.

## 5) Auto-actualización de temporadas nuevas

No hay hardcode:
- En cada ejecución se releen temporadas desde `/es/tournaments`
- Se vuelve a recorrer cada `seasonId` con `?season={id}`
- Se detectan torneos nuevos por `tournamentId`

## 6) Scripts incluidos

- `npm run sync:discover`
  - Genera mapa de temporadas/torneos en `data/fedvas-site-map.json`
  - Opcional: `--method auto|ajax|html` (por defecto: `auto`)
- `npm run sync:benchmark`
  - Compara latencia real de `html` vs `ajax` y muestra decisión recomendada
- `npm run sync:sample`
  - Descubre todo, y sincroniza 3 torneos de muestra en `data/fedvas-cache.json`
- `npm run sync:full`
  - Sincronización completa

## 7) Siguiente paso recomendado

Persistir `fedvas-cache.json` a BD (`tournaments`, `groups`, `ranking_rows`, `matches`) y servir API propia:
- `/api/tournaments`
- `/api/tournament/:id/ranking`
- `/api/tournament/:id/calendar`

Con esto la app deja de depender del scraping directo y mejora rendimiento/estabilidad.
