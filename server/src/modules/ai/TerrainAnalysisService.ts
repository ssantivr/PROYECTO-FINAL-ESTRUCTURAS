import { z } from 'zod';
import type { AIEnvelope, TerrainAnalysisInput, TerrainAnalysisResult } from '../../../../shared/types/ai';
import { analyzeTerrainRules, climateFor } from '../../../../shared/domain/assistantRules';
import { ORIENTATION_LABEL, SHAPE_LABEL, SIDE_LABEL } from '../../../../shared/i18n/es';
import type { AIRequestContext, AIService } from './AIService';
import { SYSTEM_PROMPT } from './prompts';

const text = z.string().trim().min(10).max(900);

const resultSchema = z.object({
  orientationRecommendation: text,
  placementRecommendation: text,
  drainageRecommendation: text,
  lightingRecommendation: text,
  ventilationRecommendation: text,
  materialRecommendation: text,
  generalNotes: z.array(z.string().trim().min(3).max(400)).min(1).max(8),
}) satisfies z.ZodType<TerrainAnalysisResult>;

const stringProp = { type: 'string' };
const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['orientationRecommendation', 'placementRecommendation', 'drainageRecommendation', 'lightingRecommendation', 'ventilationRecommendation', 'materialRecommendation', 'generalNotes'],
  properties: {
    orientationRecommendation: stringProp,
    placementRecommendation: stringProp,
    drainageRecommendation: stringProp,
    lightingRecommendation: stringProp,
    ventilationRecommendation: stringProp,
    materialRecommendation: stringProp,
    generalNotes: { type: 'array', items: stringProp, minItems: 1, maxItems: 6 },
  },
};

function describe(input: TerrainAnalysisInput): string {
  return [
    `Ancho ${input.width} m, largo ${input.length} m, área ${input.area} m², forma ${SHAPE_LABEL[input.shape].toLowerCase()}.`,
    `Pendiente ${input.slope} % (desnivel ${((input.slope / 100) * input.length).toFixed(2)} m), elevación ${input.elevation} m s. n. m. (clima ${climateFor(input.elevation)}), latitud ${input.latitude}°.`,
    `Frente orientado al ${ORIENTATION_LABEL[input.orientation]}, acceso por el ${SIDE_LABEL[input.access].toLowerCase()}.`,
    `Área de construcción ${input.constructionArea} m², jardín ${input.gardenArea} m², estacionamiento ${input.parkingArea} m², piscina ${input.poolArea} m², máximo ${input.maxFloors} pisos.`,
  ].join('\n');
}

export class TerrainAnalysisService {
  constructor(private readonly ai: AIService) {}

  analyze(input: TerrainAnalysisInput, context: AIRequestContext): Promise<AIEnvelope<TerrainAnalysisResult>> {
    const baseline = analyzeTerrainRules(input);
    return this.ai.run({
      kind: 'terrain_analysis',
      context,
      input,
      structured: { format: { name: 'terrain_analysis', schema: jsonSchema }, schema: resultSchema },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            'Analiza este terreno para implantar una construcción y devuelve recomendaciones preliminares en JSON.',
            describe(input),
            'Referencia calculada por el sistema (puedes mejorarla o precisarla, sin contradecir los datos):',
            JSON.stringify(baseline),
            'Cada recomendación debe ser una o dos frases concretas en español.',
          ].join('\n\n'),
        },
      ],
      interpret: (output) => output as TerrainAnalysisResult,
      fallback: () => baseline,
    });
  }
}
