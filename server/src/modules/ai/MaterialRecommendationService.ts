import { z } from 'zod';
import type { AIEnvelope, MaterialRecommendation, MaterialRecommendationResult } from '../../../../shared/types/ai';
import type { Project } from '../../../../shared/types/project';
import { FINISH_SLOTS } from '../../../../shared/types/project';
import { recommendMaterialsRules } from '../../../../shared/domain/assistantRules';
import { FINISH_SLOT_LABEL } from '../../../../shared/i18n/es';
import type { AIRequestContext, AIService } from './AIService';
import { projectContext, SYSTEM_PROMPT } from './prompts';

const outputSchema = z.object({
  recommendations: z.array(z.object({
    slot: z.enum(['walls', 'roof', 'floor', 'frames']),
    materialId: z.string().min(1).max(40),
    reason: z.string().trim().min(1).max(400),
  })).min(1).max(8),
  notes: z.array(z.string().trim().min(3).max(400)).max(6),
});

export class MaterialRecommendationService {
  constructor(private readonly ai: AIService) {}

  recommend(project: Project, context: AIRequestContext): Promise<AIEnvelope<MaterialRecommendationResult>> {
    const baseline = recommendMaterialsRules(project);
    const options = project.materials.filter((m) => m.slot !== null);
    const catalog = FINISH_SLOTS.map((slot) =>
      `${FINISH_SLOT_LABEL[slot]} (slot "${slot}"): ${options.filter((m) => m.slot === slot).map((m) => `${m.id} = ${m.name} (${m.unitPrice} COP/${m.unit}; ${m.description})`).join(' | ')}`);

    return this.ai.run({
      kind: 'material_recommendation',
      context,
      input: { projectId: context.projectId, finishes: project.finishes, budget: project.budget, elevation: project.terrain.elevation },
      structured: {
        format: {
          name: 'material_recommendation',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['recommendations', 'notes'],
            properties: {
              recommendations: {
                type: 'array',
                minItems: 4,
                maxItems: 4,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['slot', 'materialId', 'reason'],
                  properties: {
                    slot: { type: 'string', enum: [...FINISH_SLOTS] },
                    materialId: { type: 'string', enum: options.map((m) => m.id) },
                    reason: { type: 'string' },
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
            'Recomienda un acabado por cada superficie (walls, roof, floor, frames) considerando clima, presupuesto y estilo.',
            projectContext(project),
            `Catálogo disponible (usa solo estos identificadores):\n${catalog.join('\n')}`,
            `Sugerencia del motor de reglas como referencia: ${JSON.stringify(baseline.recommendations)}`,
            'Responde en JSON; "reason" y "notes" en español.',
          ].join('\n\n'),
        },
      ],
      interpret: (output) => {
        const parsed = output as z.infer<typeof outputSchema>;
        const byId = new Map(options.map((m) => [m.id, m]));
        const chosen = new Map<string, MaterialRecommendation>();
        for (const rec of parsed.recommendations) {
          if (byId.get(rec.materialId)?.slot === rec.slot && !chosen.has(rec.slot)) chosen.set(rec.slot, rec);
        }
        if (chosen.size === 0) throw new Error('ningún material recomendado existe en el catálogo');
        const recommendations = FINISH_SLOTS.flatMap((slot) => {
          const rec = chosen.get(slot) ?? baseline.recommendations.find((r) => r.slot === slot);
          return rec ? [rec] : [];
        });
        return { recommendations, notes: parsed.notes };
      },
      fallback: () => baseline,
    });
  }
}
