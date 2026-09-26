# ARQUILA API

Express 5 + Prisma 6 + PostgreSQL. Comparte tipos y cálculos de dominio con el frontend (`../shared`).

## Puesta en marcha

```bash
cd server
npm install
cp .env.example .env        # editar DATABASE_URL con la contraseña de PostgreSQL
npx prisma migrate dev      # crea la base "arquila" y las tablas
npm run db:seed             # catálogo de materiales + Casa Familiar Andina
npm run dev                 # http://localhost:4000
```

En otra terminal, desde `arquila/`: `npm run dev`. Vite redirige `/api` al puerto 4000.
Si la API no responde, el frontend trabaja con una copia en `localStorage`.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servidor y de la base de datos |
| GET | `/api/projects` | Lista resumida (área construida, lote, pisos) |
| POST | `/api/projects` | Crea un proyecto completo (terreno + edificación) |
| GET | `/api/projects/:id` | Proyecto completo con catálogo de materiales |
| PUT | `/api/projects/:id` | Reemplaza el proyecto completo (transaccional) |
| PATCH | `/api/projects/:id` | Actualiza nombre, ciudad, departamento o estilo |
| DELETE | `/api/projects/:id` | Elimina el proyecto y sus dependencias |
| PUT | `/api/projects/:id/terrain` | Actualiza el terreno |
| GET | `/api/projects/:id/metrics` | COS, CUS, áreas, altura total y cumplimiento |
| GET | `/api/projects/:id/terrain-analysis` | Perfil, pendientes e insolación mensual |
| GET | `/api/projects/:id/estimate` | Cantidades, costo de materiales y cronograma |
| GET/POST | `/api/materials` | Catálogo de materiales |
| GET/PATCH/DELETE | `/api/materials/:id` | Material por clave (`concrete`, `rebar`, …) |

## Errores

Respuesta JSON `{ error, details? }`:
`400` datos inválidos (Zod) · `404` no encontrado · `409` clave duplicada ·
`422` geometría inválida (huella fuera del lote, espacios fuera de la planta, vanos que exceden muros, pisos sobre el máximo) · `500` error interno.

## Estructura

```
server/
├── prisma/        schema.prisma, seed.ts, migrations/
└── src/
    ├── config/    variables de entorno validadas con Zod
    ├── db/        cliente Prisma
    ├── http/      errores HTTP y middleware de errores
    └── modules/
        ├── projects/   schemas → service (reglas) → repository (Prisma) → mapper (DTO)
        ├── materials/  catálogo CRUD
        └── analysis/   métricas, análisis de terreno y presupuesto
```
