import { z } from 'zod';
import type { AIEnvelope, LayoutSuggestionResult } from '../../../../shared/types/ai';
import type { BuildingProgram, BuildingType, Terrain } from '../../../../shared/types/project';
import { packLayout, planRoomProgram, STAIRS_NAME, type RoomSpec } from '../../../../shared/domain/layoutGenerator';
import { BUILDING_TYPE_LABEL } from '../../../../shared/i18n/es';
import type { AIRequestContext, AIService } from './AIService';
import { programContext, SYSTEM_PROMPT, terrainContext } from './prompts';

export interface LayoutRequest {
  terrain: Terrain;
  program: BuildingProgram;
  buildingType: BuildingType;
  budget: number;
  style: string;
}

const zoneSchema = z.enum(['social', 'private', 'service', 'circulation']);

const outputSchema = z.object({
  rooms: z.array(z.object({
    name: z.string().trim().min(2).max(60),
    floor: z.number().int().min(1).max(10),
    area: z.number().min(2).max(120),
    zone: zoneSchema,
  })).min(1).max(40),
  notes: z.array(z.string().trim().min(3).max(400)).max(6),
});

const slug = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'espacio';

export function toRoomSpecs(rooms: z.infer<typeof outputSchema>['rooms'], floors: number): RoomSpec[] {
  const used = new Set<string>();
  const specs: RoomSpec[] = [];
  for (const room of rooms) {
    const floor = Math.min(room.floor, floors) - 1;
    if (room.name.toLowerCase().startsWith('escalera')) continue;
    let key = slug(room.name);
    for (let i = 2; used.has(`${floor}:${key}`); i++) key = `${slug(room.name)}-${i}`;
    used.add(`${floor}:${key}`);
    specs.push({ key, name: room.name, floor, area: room.area, zone: room.zone });
  }
  if (floors > 1) {
    for (let f = 0; f < floors; f++) specs.push({ key: f === 0 ? 'stairs' : `stairs-${f}`, name: STAIRS_NAME, floor: f, area: 9.1, zone: 'circulation' });
  }
  return specs;
}

function ruleNotes(request: LayoutRequest): string[] {
  const notes = [
    'Zonas sociales hacia el frente y el acceso; servicios agrupados hacia el fondo para concentrar instalaciones hidráulicas.',
  ];
  if (request.program.floors > 1) notes.push('Habitaciones en los pisos superiores para separar la zona privada; escalera alineada en todos los niveles.');
  if (request.terrain.slopePercent > 5) notes.push('La pendiente favorece ubicar el garaje y los servicios en la parte baja del lote.');
  return notes;
}

export class BuildingSuggestionService {
  constructor(private readonly ai: AIService) {}

  generateLayout(request: LayoutRequest, context: AIRequestContext): Promise<AIEnvelope<LayoutSuggestionResult>> {
    const floors = Math.min(request.program.floors, request.terrain.maxFloors);
    const baseline = planRoomProgram(request.program, request.buildingType, request.terrain.maxFloors);
    const pack = (specs: RoomSpec[], notes: string[]): LayoutSuggestionResult => {
      const layout = packLayout(request.terrain, request.program, specs);
      return { rooms: layout.rooms, building: layout.building, notes, warnings: layout.warnings };
    };

    return this.ai.run({
      kind: 'layout',
      context,
      input: request,
      maxTokens: 1600,
      structured: {
        format: {
          name: 'layout',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['rooms', 'notes'],
            properties: {
              rooms: {
                type: 'array',
                minItems: 1,
                maxItems: 30,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'floor', 'area', 'zone'],
                  properties: {
                    name: { type: 'string' },
                    floor: { type: 'integer', minimum: 1, maximum: floors },
                    area: { type: 'number', minimum: 2, maximum: 120 },
                    zone: { type: 'string', enum: zoneSchema.options },
                  },
                },
              },
              notes: { type: 'array', items: { type: 'string' }, maxItems: 4 },
            },
          },
        },
        schema: outputSchema,
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Propón la distribución preliminar de una ${BUILDING_TYPE_LABEL[request.buildingType].toLowerCase()} de estilo ${request.style} con presupuesto de ${request.budget.toLocaleString('es-CO')} COP.`,
            terrainContext(request.terrain),
            programContext(request.program),
            `Devuelve la lista de espacios con nombre en español, piso (1 = planta baja, máximo ${floors}), área en m² y zona (social, private, service, circulation).`,
            'No incluyas escaleras: el sistema las agrega. Respeta el número de habitaciones y baños del programa.',
            `Referencia del sistema: ${JSON.stringify(baseline.filter((r) => r.name !== STAIRS_NAME).map((r) => ({ name: r.name, floor: r.floor + 1, area: r.area, zone: r.zone })))}`,
            'En "notes" explica en español la lógica de la distribución, iluminación, ventilación y aprovechamiento del espacio.',
          ].join('\n\n'),
        },
      ],
      interpret: (output) => {
        const parsed = output as z.infer<typeof outputSchema>;
        return pack(toRoomSpecs(parsed.rooms, floors), parsed.notes);
      },
      fallback: () => pack(baseline, ruleNotes(request)),
    });
  }
}
