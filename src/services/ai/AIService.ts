import type { AIEnvelope, ChatMessage, ChatResult } from '../../types/ai';
import type { AIProviderId } from '../../types/ui';
import type { AppState, AppStore } from '../../state/appState';
import { answerRules } from '../../../shared/domain/assistantRules';
import { PRELIMINARY_DISCLAIMER } from '../../../shared/i18n/es';
import { AI_PROVIDERS } from '../../data/aiProviders';
import { aiClient } from '../aiClient';
import { describeProject, EXTERNAL_SYSTEM_PROMPT } from './projectContext';

export interface AIProvider {
  readonly id: Exclude<AIProviderId, 'auto'>;
  available(state: AppState): string | null;
  chat(store: AppStore, message: string, history: ChatMessage[]): Promise<AIEnvelope<ChatResult>>;
}

function envelope(source: AIEnvelope<ChatResult>['source'], model: string | null, reply: string, fallbackReason?: string): AIEnvelope<ChatResult> {
  return { source, model, disclaimer: PRELIMINARY_DISCLAIMER, ...(fallbackReason ? { fallbackReason } : {}), result: { reply } };
}

const rulesProvider: AIProvider = {
  id: 'rules',
  available: () => null,
  chat: (store, message) => Promise.resolve(envelope('rules', null, answerRules(store.get().project, message))),
};

const serverProvider: AIProvider = {
  id: 'server',
  available: (state) => (state.mode === 'server' ? null : 'El servidor no está conectado.'),
  chat: (store, message, history) => aiClient.chat(store, message, history),
};

interface CompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
}

const externalProvider: AIProvider = {
  id: 'external',
  available: (state) => (state.settings.aiEndpoint.trim() ? null : 'No hay un endpoint de API externa configurado.'),
  async chat(store, message, history) {
    const { settings, project } = store.get();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.aiApiKey) headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
    const response = await fetch(`${settings.aiEndpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.aiModel || undefined,
        temperature: 0.4,
        messages: [
          { role: 'system', content: `${EXTERNAL_SYSTEM_PROMPT}\n\n${describeProject(project)}` },
          ...history,
          { role: 'user', content: message },
        ],
      }),
    });
    if (!response.ok) throw new Error(`La API externa respondió ${response.status}.`);
    const data = (await response.json()) as CompletionResponse;
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('La API externa devolvió una respuesta vacía.');
    return envelope('external', data.model ?? (settings.aiModel || null), reply);
  },
};

const PROVIDERS: Record<AIProvider['id'], AIProvider> = { rules: rulesProvider, server: serverProvider, external: externalProvider };

export class AIService {
  constructor(private readonly store: AppStore) {}

  resolve(): { provider: AIProvider; reason: string | null } {
    const state = this.store.get();
    const wanted = state.settings.aiProvider;
    if (wanted === 'auto') return { provider: state.mode === 'server' ? serverProvider : rulesProvider, reason: null };
    const provider = PROVIDERS[wanted];
    const reason = provider.available(state);
    return reason ? { provider: rulesProvider, reason } : { provider, reason: null };
  }

  describe(): string {
    const { provider, reason } = this.resolve();
    const label = AI_PROVIDERS.find((p) => p.id === provider.id)?.label ?? provider.id;
    return reason ? `${label} · ${reason}` : label;
  }

  async chat(message: string, history: ChatMessage[]): Promise<AIEnvelope<ChatResult>> {
    const { provider, reason } = this.resolve();
    try {
      const result = await provider.chat(this.store, message, history);
      return reason && !result.fallbackReason ? { ...result, fallbackReason: reason } : result;
    } catch (error) {
      if (provider.id !== 'external') throw error;
      const detail = error instanceof Error ? error.message : 'Error desconocido.';
      return envelope('rules', null, answerRules(this.store.get().project, message), `${detail} Se usó el motor de reglas.`);
    }
  }
}
