# Arquitectura

ARQUILA es un **monolito modular**: un frontend, un backend y un paquete de código compartido, sin microservicios.

```
Navegador (src/)  ──HTTP/JSON + JWT──►  API Express (server/)  ──Prisma──►  PostgreSQL
        │                                      │
        └──────────── shared/ ◄────────────────┘          └──HTTP──► LM Studio (modelo local)
```

## Una sola fuente de datos

Todo sale del agregado `Project` (`shared/types/project.ts`):

```
Project
 ├── Terrain            → vista 2D (implantación), topografía, terreno 3D, análisis de IA
 ├── Building
 │    ├── program       → generador de distribución / IA
 │    └── floors[]
 │         ├── rooms[]  → planos, tabiques y mobiliario 3D
 │         └── openings → puertas y ventanas en planos, fachadas y 3D
 ├── finishes           → materiales del modelo 3D y presupuesto
 └── materials          → catálogo
```

Los planos y el modelo 3D **no se guardan como imágenes**: se dibujan cada vez desde estos datos (`src/render/*`). Cambiar el ancho del lote actualiza área, implantación, topografía, terreno 3D y la información del proyecto; cambiar el programa y pulsar “Generar distribución” regenera plantas, fachadas, corte y modelo 3D; cambiar un material repinta el 3D y recalcula el presupuesto.

## Frontend (`src/`)

- **Store observable** (`core/store.ts`, patrón Observer): estado inmutable; cada panel se suscribe solo a la parte que usa (`select`).
- **Componentes** (`components/`): clases que extienden `Component`, crean su DOM con `h()` y liberan suscripciones en `destroy()`.
- **Workspace**: cada vista declara qué paneles muestra; el panel se ubica en un *slot* de la grilla CSS.
- **Render** (`render/`): funciones puras datos → SVG/Canvas. El visor 3D proyecta polígonos con una cámara orbital propia (`math3d.ts`), ordena por profundidad (algoritmo del pintor), aplica iluminación difusa + especular según rugosidad/metalicidad y recorta contra el plano cercano para la vista interior.
- **Servicios**: `apiClient` (JWT en `localStorage`), `projectSync` (servidor o copia local), `aiClient` (fachada: servidor o motor de reglas sin conexión), `pdfExport`.

## Backend (`server/src/`)

Cada módulo sigue **rutas → servicio → repositorio → mapper**:

| Módulo | Responsabilidad |
|---|---|
| `auth` | Registro, login, `scrypt` para contraseñas, JWT, middleware `requireAuth` |
| `projects` | CRUD del agregado, terreno, edificación y acabados; reglas geométricas (huella dentro del lote, espacios dentro de la planta, vanos dentro de muros, pisos máximos, áreas del lote) |
| `materials` | Catálogo (lectura pública, escritura autenticada) |
| `floorPlans` | Genera y guarda el juego de planos preliminares como geometría JSON |
| `analysis` | Métricas, análisis de terreno y presupuesto calculados |
| `ai` | `AIService`, `LMStudioService`, `TerrainAnalysisService`, `MaterialRecommendationService`, `BuildingSuggestionService` |

Transversales: validación con **Zod** en cada entrada, errores JSON uniformes (`http/errors.ts`), `helmet`, CORS limitado a `CORS_ORIGIN`, límites de peticiones por IP (general, login e IA), variables de entorno validadas al iniciar.

## Base de datos (Prisma)

`User 1─N Project`; `Project 1─1 Terrain`, `1─1 Building 1─N Floor 1─N Room / Opening`, `1─N ProjectMaterial N─1 Material`, `1─N FloorPlan`, `1─N AIRequest 1─1 AIGeneration`. Borrar un proyecto borra en cascada su terreno, edificación, acabados y planos; los registros de IA conservan el historial (`SET NULL`).

## Código compartido (`shared/`)

- `domain/metrics.ts`: COS, CUS, áreas, altura.
- `domain/terrainAnalysis.ts`: superficie procedural, perfil, pendientes, posición solar.
- `domain/layoutGenerator.ts`: programa → lista de espacios → plantas con franjas, vanos y escalera alineada.
- `domain/assistantRules.ts`: motor de reglas (terreno, materiales, chat) usado como respaldo de la IA y sin conexión.
- `i18n/es.ts`: etiquetas en español de los enumerados y la advertencia profesional.

## Cómo crecer hacia el 100 %

- Reemplazar el generador de distribución o el renderizador sin tocar la API: ambos consumen el mismo `Project`.
- Añadir proveedores de IA implementando otro servicio con la interfaz de `LMStudioService`.
- Migrar la interfaz a React/Three.js reutilizando `shared/` y `services/`.
