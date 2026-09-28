# ARQUILA · Diseña · Analiza · Construye

Plataforma web de arquitectura asistida por IA: terreno (2D, topografía y 3D), programa arquitectónico, distribución automática, planos preliminares, materiales aplicados al modelo 3D y un asistente de IA local ejecutado con **LM Studio**.

> Las recomendaciones, planos, cantidades y costos generados por este sistema son preliminares y tienen fines de visualización y planificación. No sustituyen la revisión o certificación de un arquitecto, ingeniero u otro profesional competente.

La interfaz está en español; el código, la API y la base de datos usan identificadores en inglés.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | TypeScript estricto + Vite, componentes propios sin framework, CSS Grid, visor 3D propio sobre Canvas 2D, planos en SVG |
| Backend | Node.js 20+, Express 5, Zod, JWT (`jsonwebtoken`), `helmet`, `express-rate-limit` |
| Base de datos | PostgreSQL 16+ con Prisma 6 |
| IA | LM Studio (servidor local compatible con OpenAI, `/v1/chat/completions`) con motor de reglas de respaldo |
| Código compartido | `shared/`: tipos, cálculos de dominio, generador de distribución y motor de reglas, usados por frontend y backend |

> El frontend se construyó sin React ni Three.js por decisión del proyecto (“sin frameworks pesados”). La lógica está desacoplada del renderizado (`shared/domain`, `src/render`), así que se puede migrar a React/Three.js más adelante sin rehacer el dominio ni la API.

## Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL 16+ instalado **o** Docker (para `docker compose`).
- LM Studio y un modelo local de chat (por ejemplo Qwen 2.5 7B Instruct, Llama 3.1 8B Instruct o Gemma). Es opcional: sin LM Studio la IA responde con el motor de reglas y la interfaz lo indica.

## Instalación y ejecución

```bash
# 1. Dependencias (frontend y backend)
npm run setup

# 2. Variables de entorno del backend
cp server/.env.example server/.env     # en Windows: copy server\.env.example server\.env
#    Edite DATABASE_URL (usuario/contraseña de PostgreSQL) y JWT_SECRET (cadena aleatoria larga).

# 3. Base de datos
npm run db:up        # solo si usa Docker (PostgreSQL en localhost:5432, usuario/clave postgres/postgres)
npm run db:migrate   # crea la base "arquila" y aplica las migraciones de Prisma
npm run db:seed      # catálogo de materiales + usuario demo + proyecto "Casa Familiar Andina"

# 4. Backend (http://localhost:4000) y frontend (http://localhost:5173) juntos
npm run dev
```

Abra **http://localhost:5173** e inicie sesión con la cuenta demo:

- Correo: `demo@arquila.co`
- Contraseña: `arquila2026`

También puede crear una cuenta nueva desde la pantalla de acceso. Si el backend no responde, la aplicación ofrece **“Continuar sin conexión”**: el proyecto se guarda en el navegador y la IA usa el motor de reglas.

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run setup` | Instala dependencias del frontend y de `server/` y genera el cliente de Prisma |
| `npm run db:generate` | Regenera el cliente de Prisma (tras cambiar `schema.prisma`) |
| `npm run dev` | Inicia API y frontend a la vez (`dev:api` / `dev:web` por separado) |
| `npm run build` | Verifica tipos, compila el frontend (`dist/`) y el backend (`server/dist/`) |
| `npm test` | Pruebas del backend y del dominio compartido (`node:test`) |
| `npm run typecheck` | Verificación de tipos de frontend y backend |
| `npm run db:up` / `db:down` | Levanta / detiene PostgreSQL en Docker |
| `npm run db:migrate` | `prisma migrate dev` (desarrollo) |
| `npm run db:deploy` | `prisma migrate deploy` (aplica migraciones existentes) |
| `npm run db:seed` | Datos demo |

## LM Studio

1. Instale LM Studio desde https://lmstudio.ai.
2. Descargue un modelo local de chat (pestaña **Discover**). Se recomienda un modelo *Instruct* de 7–8 B parámetros.
3. Abra la pestaña **Developer**.
4. Cargue el modelo e inicie el servidor local (**Start Server**) o ejecute `lms server start`.
5. Verifique el puerto (por defecto `1234`): `http://localhost:1234/v1/models` debe listar el modelo.
6. Configure `AI_BASE_URL` en `server/.env` (por defecto `http://localhost:1234/v1`).
7. Configure `AI_MODEL` con el identificador exacto del modelo que muestra LM Studio. Si lo deja vacío, se usa el primer modelo cargado.

El navegador **nunca** llama a LM Studio: el flujo es `Frontend → Backend → AIService → LMStudioService → LM Studio → modelo local`. El estado de la conexión aparece en el panel de IA y en el inicio. Detalles en [`docs/ai.md`](docs/ai.md).

## Qué se puede hacer (flujo principal)

1. **Proyectos**: crear (nombre, descripción, tipo, ubicación, presupuesto, estilo), listar, abrir, editar y eliminar; todo en PostgreSQL y por usuario.
2. **Terreno**: ancho, largo, área calculada (ancho × largo), forma, pendiente, elevación, orientación, acceso, coordenadas, suelo, áreas de jardín/estacionamiento/piscina, COS/CUS y pisos máximos, con validaciones.
3. **Análisis del terreno**: resumen, mapa topográfico por curvas de nivel, perfil, pendientes, insolación y **“Analizar terreno”** con IA (recomendaciones estructuradas y marcadas como preliminares).
4. **Construcción**: programa (habitaciones, baños, pisos, cocina, sala, comedor, garaje, terraza, balcón, jardín, piscina, lavandería, oficina) y **“Generar distribución”** (IA → lista estructurada de espacios → generador procedural).
5. **Planos**: planta baja, planta alta, implantación, 4 fachadas y corte esquemático, con muros, puertas, ventanas, mobiliario básico, ejes y cotas. Se regeneran al cambiar los datos. “Generar planos” guarda el juego de planos en la base; “Descargar plano” (SVG) y “Exportar PDF” (hoja con datos del proyecto, fecha y nota de propuesta preliminar).
6. **Materiales**: catálogo con color, rugosidad y metalicidad; al elegir un acabado cambian el **modelo 3D** y el presupuesto. “Recomendar con IA” sugiere acabados del catálogo.
7. **Visor 3D**: terreno procedural con pendiente, edificación por pisos con muros, tabiques, losas, cubierta a dos aguas, puertas, ventanas, mobiliario, vegetación, piscina y estacionamiento; rotar, zoom, desplazar; vistas isométrica, frontal, lateral, superior e interior; capas activables; sol según mes y hora.
8. **Asistente de IA**: chat en español con el proyecto actual como contexto.
9. **Guardar** (Ctrl + S) y recuperar el proyecto más tarde.

## Estructura

```
arquila/
├── src/                  Frontend (TypeScript + Vite)
│   ├── components/       Paneles de la interfaz (dashboard, terreno, construcción, planos, materiales, IA, visor 3D…)
│   ├── core/             Store observable, componente base, utilidades DOM
│   ├── render/           Dibujo: escena 3D, proyección, planos, elevaciones, implantación, topografía, gráficos
│   ├── services/         Cliente API (JWT), sincronización, fachada de IA, exportación PDF
│   ├── styles/           Tokens, layout y estilos por módulo
│   └── main.ts           Arranque: conexión, sesión, carga del proyecto
├── server/               Backend (Express + Prisma)
│   ├── prisma/           schema.prisma, migraciones, seed.ts
│   └── src/
│       ├── config/       Variables de entorno validadas con Zod
│       ├── http/         Errores y rate limiting
│       ├── modules/      auth · projects · materials · floorPlans · analysis · ai
│       └── tests/        Pruebas (node:test)
├── shared/               Tipos, dominio (métricas, terreno, generador de distribución, reglas IA), catálogo, textos en español
├── docs/                 architecture.md · api.md · ai.md
├── scripts/dev.mjs       Arranque conjunto de API y frontend
├── docker-compose.yml    PostgreSQL
└── .env.example          Plantilla de variables (copiar a server/.env)
```

## Documentación

- [Arquitectura](docs/architecture.md)
- [API REST](docs/api.md)
- [Integración de IA con LM Studio](docs/ai.md)

## Alcance de esta etapa (≈ 40 %)

Implementado: proyectos, autenticación, terreno 2D/3D, análisis, programa y distribución, planos preliminares, materiales ↔ 3D, IA con LM Studio y respaldo por reglas, exportación básica. Pendiente para etapas siguientes: render fotorrealista, BIM/IFC/DWG, cálculo estructural y geotécnico, presupuestos detallados, multiusuario con roles, despliegue.
