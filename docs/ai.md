# Integración de IA (LM Studio)

## Flujo

```
Frontend (aiClient)
   ↓  POST /api/ai/*  (JWT)
Backend (ai.routes.ts: validación Zod, propiedad del proyecto, rate limit)
   ↓
TerrainAnalysisService · MaterialRecommendationService · BuildingSuggestionService · chat
   ↓
AIService  (orquesta, valida la salida, registra en ai_requests / ai_generations, respaldo por reglas)
   ↓
LMStudioService  (HTTP, OpenAI-compatible: GET /v1/models, POST /v1/chat/completions)
   ↓
LM Studio → modelo local
```

El frontend nunca habla con LM Studio ni conoce su URL. No hay claves de IA en el navegador.

## Configuración (`server/.env`)

| Variable | Valor por defecto | Uso |
|---|---|---|
| `AI_PROVIDER` | `lmstudio` | `none` desactiva el modelo y usa siempre el motor de reglas |
| `AI_BASE_URL` | `http://localhost:1234/v1` | Servidor de LM Studio |
| `AI_MODEL` | *(vacío)* | Identificador del modelo; vacío = primer modelo cargado |
| `AI_TIMEOUT_MS` | `90000` | Tiempo máximo por respuesta |
| `AI_TEMPERATURE` | `0.3` | Baja para respuestas consistentes |

Cambiar de modelo solo requiere editar `AI_MODEL` y reiniciar el backend.

## Salidas estructuradas

La IA no dibuja: devuelve **datos**. Las tareas estructuradas envían a LM Studio un `response_format` de tipo `json_schema`; la respuesta se extrae (tolera bloques ```json y etiquetas `<think>` de modelos de razonamiento) y se valida con Zod.

- **Análisis de terreno**: siete campos (`orientationRecommendation`, `placementRecommendation`, `drainageRecommendation`, `lightingRecommendation`, `ventilationRecommendation`, `materialRecommendation`, `generalNotes`). El prompt incluye una referencia calculada por reglas para anclar al modelo en los datos reales.
- **Materiales**: un acabado por superficie; los `materialId` están restringidos al catálogo (`enum` en el esquema) y se descartan los que no correspondan a la superficie.
- **Distribución**: lista `rooms[{ name, floor, area, zone }]`. El backend normaliza claves, pisos y escaleras, y la entrega al generador procedural (`packLayout`) que produce plantas, espacios, puertas y ventanas. Así el algoritmo de geometría puede reemplazarse sin tocar la IA, y viceversa.
- **Chat**: texto libre en español, con el proyecto actual (terreno, programa, espacios por piso, métricas y acabados) en el mensaje de sistema y hasta 10 mensajes de historial.

## Respaldo y transparencia

Si LM Studio no está iniciado, no tiene modelo cargado, excede el tiempo o devuelve una salida inválida, `AIService` responde con el motor de reglas (`shared/domain/assistantRules.ts`) y lo indica:

```json
{ "source": "rules", "model": null, "fallbackReason": "No hay conexión con LM Studio en http://localhost:1234/v1. …" }
```

La interfaz muestra el origen de cada respuesta (“LM Studio · modelo” o “Motor de reglas”) y la advertencia profesional. Cada solicitud queda registrada con su entrada, salida, origen, modelo y duración.

## Advertencia

Todas las respuestas incluyen:

> Las recomendaciones, planos, cantidades y costos generados por este sistema son preliminares y tienen fines de visualización y planificación. No sustituyen la revisión o certificación de un arquitecto, ingeniero u otro profesional competente.

## Probar la conexión

```bash
curl http://localhost:1234/v1/models          # LM Studio responde
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/ai/status
```
