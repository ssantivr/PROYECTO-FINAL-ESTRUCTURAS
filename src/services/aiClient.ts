import type { Project } from '../types/project';
import type { AIEnvelope, ChatMessage, ChatResult, LayoutSuggestionResult, MaterialRecommendationResult, TerrainAnalysisResult } from '../types/ai';
import type { AppStore } from '../state/appState';
import { analyzeTerrainRules, answerRules, recommendMaterialsRules, terrainInputFromProject } from '../../shared/domain/assistantRules';
import { generateLayout } from '../../shared/domain/layoutGenerator';
import { PRELIMINARY_DISCLAIMER } from '../../shared/i18n/es';
import { api, toInput } from './apiClient';

const OFFLINE_REASON = 'Sin conexión con el servidor: respuesta del motor de reglas local.';

function offline<T>(result: T): AIEnvelope<T> {
  return { source: 'rules', model: null, disclaimer: PRELIMINARY_DISCLAIMER, fallbackReason: OFFLINE_REASON, result };
}

const serverId = (project: Project) => (project.id.startsWith('local-') ? undefined : project.id);

export const aiClient = {
  chat(store: AppStore, message: string, history: ChatMessage[]): Promise<AIEnvelope<ChatResult>> {
    const { project, mode } = store.get();
    if (mode === 'local') return Promise.resolve(offline({ reply: answerRules(project, message) }));
    return api.chat({ projectId: serverId(project), project: toInput(project), message, history });
  },

  analyzeTerrain(store: AppStore): Promise<AIEnvelope<TerrainAnalysisResult>> {
    const { project, mode } = store.get();
    const terrain = terrainInputFromProject(project);
    if (mode === 'local') return Promise.resolve(offline(analyzeTerrainRules(terrain)));
    return api.analyzeTerrain({ projectId: serverId(project), terrain });
  },

  recommendMaterials(store: AppStore): Promise<AIEnvelope<MaterialRecommendationResult>> {
    const { project, mode } = store.get();
    if (mode === 'local') return Promise.resolve(offline(recommendMaterialsRules(project)));
    return api.recommendMaterials({ projectId: serverId(project), project: toInput(project) });
  },

  generateLayout(store: AppStore, program: Project['building']['program']): Promise<AIEnvelope<LayoutSuggestionResult>> {
    const { project, mode } = store.get();
    const { terrain, buildingType, budget, style } = project;
    if (mode === 'local') {
      const layout = generateLayout(terrain, program, buildingType);
      return Promise.resolve(offline({ ...layout, notes: ['Distribución generada por el algoritmo procedural local.'] }));
    }
    return api.generateLayout({ projectId: serverId(project), terrain, program, buildingType, budget, style });
  },
};

export function sourceLabel(envelope: Pick<AIEnvelope<unknown>, 'source' | 'model'>): string {
  if (envelope.source === 'lmstudio') return `LM Studio · ${envelope.model ?? 'modelo local'}`;
  if (envelope.source === 'external') return `API externa · ${envelope.model ?? 'modelo'}`;
  return 'Motor de reglas';
}
