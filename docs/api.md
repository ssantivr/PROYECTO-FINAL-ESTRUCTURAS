# API REST

Base: `http://localhost:4000/api` (en desarrollo Vite redirige `/api`). JSON en todas las respuestas.

Autenticación: `Authorization: Bearer <token>` obtenido en `/auth/login` o `/auth/register`. Salvo `/health`, `/auth/*` y la lectura del catálogo, todo requiere sesión, y cada usuario solo ve sus proyectos (los ajenos responden 404).

## Salud y autenticación

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ status, database }` |
| POST | `/auth/register` | `{ name, email, password (≥ 8) }` | `201 { token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | — | `{ id, email, name }` |

## Proyectos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/projects` | Crea un proyecto completo (`ProjectInput`: datos generales + `terrain` + `building` + `finishes`) |
| GET | `/projects` | Lista resumida del usuario (área de lote, área construida, pisos, espacios) |
| GET | `/projects/:id` | Proyecto completo con catálogo de materiales |
| PUT | `/projects/:id` | Reemplaza el proyecto completo (transaccional) |
| PATCH | `/projects/:id` | Actualiza nombre, descripción, tipo, ciudad, departamento, estilo o presupuesto |
| DELETE | `/projects/:id` | Elimina el proyecto y sus dependencias |
| GET · POST · PUT | `/projects/:id/terrain` | Lee o reemplaza el terreno |
| GET · POST · PUT | `/projects/:id/building` | Lee o reemplaza programa, plantas, espacios y vanos |
| GET | `/projects/:id/materials` | Acabados seleccionados `{ walls, roof, floor, frames }` |
| POST | `/projects/:id/materials` | Cambia los acabados (cada material debe existir y corresponder a la superficie) |
| POST | `/projects/:id/floor-plans` | Genera y guarda plantas, implantación, 4 fachadas y corte (geometría JSON) |
| GET | `/projects/:id/floor-plans` | Planos guardados |
| GET | `/projects/:id/metrics` | COS, CUS, áreas, altura y cumplimiento |
| GET | `/projects/:id/terrain-analysis` | Perfil, distribución de pendientes e insolación mensual |
| GET | `/projects/:id/estimate` | Cantidades y costo de materiales, cronograma |

## Materiales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/materials` | Catálogo: `id, name, category, description, unit, ratePerM2, unitPrice, slot, color, roughness, metalness` |
| GET | `/materials/:id` | Un material |
| POST · PATCH · DELETE | `/materials[/:id]` | Administración del catálogo (requiere sesión) |

## Inteligencia artificial

Todas devuelven un sobre:

```json
{
  "source": "lmstudio" | "rules",
  "model": "qwen2.5-7b-instruct" | null,
  "disclaimer": "Las recomendaciones … son preliminares …",
  "fallbackReason": "No hay conexión con LM Studio en http://localhost:1234/v1 …",
  "result": { … }
}
```

| Método | Ruta | Cuerpo | `result` |
|---|---|---|---|
| GET | `/ai/status` | — | (sin sobre) `{ provider, baseUrl, available, model, models, message }` |
| POST | `/ai/chat` | `{ projectId?, project?, message, history? }` | `{ reply }` |
| POST | `/ai/analyze-terrain` | `{ projectId?, terrain: { width, length, area, shape, slope, elevation, orientation, access, latitude, constructionArea, gardenArea, parkingArea, poolArea, maxFloors } }` | `{ orientationRecommendation, placementRecommendation, drainageRecommendation, lightingRecommendation, ventilationRecommendation, materialRecommendation, generalNotes[] }` |
| POST | `/ai/recommend-materials` | `{ projectId?, project }` | `{ recommendations: [{ slot, materialId, reason }], notes[] }` |
| POST | `/ai/generate-layout` | `{ projectId?, terrain, program, buildingType, budget, style }` | `{ rooms: [{ key, name, floor, area, zone }], building, notes[], warnings[] }` |

`project` es el estado actual (aunque no esté guardado); `projectId`, si se envía, debe pertenecer al usuario y se usa para el historial en `ai_requests` / `ai_generations`.

## Errores

`{ "error": "mensaje en español", "details"?: … }`

| Código | Caso |
|---|---|
| 400 | JSON mal formado o datos inválidos (Zod: `details` = `[{ path, message }]`) |
| 401 | Sin sesión, token inválido o credenciales incorrectas |
| 404 | Recurso inexistente o de otro usuario |
| 409 | Correo o clave duplicados |
| 422 | Reglas de negocio: huella fuera del lote, espacios fuera de la planta, vanos que exceden muros, pisos sobre la norma, áreas del lote, acabados inválidos (`details` = lista de problemas) |
| 429 | Límite de peticiones excedido |
| 500 | Error interno |

## Ejemplo

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@arquila.co","password":"arquila2026"}' | jq -r .token)
curl -s localhost:4000/api/projects -H "Authorization: Bearer $TOKEN"
```
