import { Component } from '../core/component';
import { h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { ChatMessage } from '../types/ai';
import { projectRecommendations } from '../../shared/domain/assistantRules';
import { PRELIMINARY_DISCLAIMER } from '../../shared/i18n/es';
import { sourceLabel } from '../services/aiClient';
import { AIService } from '../services/ai/AIService';
import { describeApiError } from '../services/apiClient';

const SUGGESTIONS = [
  '¿Cómo debería distribuir mi casa?',
  '¿Qué debo considerar por la pendiente del terreno?',
  '¿Cómo mejoro la iluminación natural?',
  '¿Cumplo con el COS y el CUS?',
];

export class AIAssistantPanel extends Component {
  private readonly list = h('ul', { class: 'reco-list' });
  private readonly chat = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  private readonly status = h('span', { class: 'badge' });
  private readonly input = h('input', { type: 'text', placeholder: 'Escribe tu pregunta…', 'aria-label': 'Pregunta al asistente', maxlength: 2000 });
  private readonly send = h('button', { class: 'btn btn-primary', type: 'submit', 'aria-label': 'Enviar' }, icon('send', 16));
  private history: ChatMessage[] = [];
  private readonly service: AIService;

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'ai' }));
    this.service = new AIService(store);
    const form = h('form', { class: 'chat-form' }, this.input, this.send);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.ask(this.input.value);
    });

    this.el.append(
      h('header', { class: 'panel-head' }, h('h2', {}, 'IA Asistente'), this.status),
      h('div', { class: 'panel-body ai-layout' },
        h('div', { class: 'chat' },
          this.chat,
          h('div', { class: 'chips' }, ...SUGGESTIONS.map((q) => h('button', { class: 'chip', type: 'button', onclick: () => void this.ask(q) }, q))),
          form,
          h('p', { class: 'disclaimer' }, PRELIMINARY_DISCLAIMER)),
        h('div', {}, h('h3', { class: 'sub-title' }, 'Recomendaciones preliminares del proyecto'), this.list),
      ),
    );
    this.say('assistant', 'Hola, soy el asistente de ARQUILA. Conozco el terreno, el programa y los materiales del proyecto abierto; pregúntame en español.');
    this.render();
    this.renderStatus();
    this.track(store.select((st) => st.project, () => this.render()));
    this.track(store.select((st) => st.aiStatus, () => this.renderStatus()));
    this.track(store.select((st) => st.settings, () => this.renderStatus()));
    this.track(store.select((st) => st.project.id, () => {
      this.history = [];
      this.chat.replaceChildren();
      this.say('assistant', `Proyecto cambiado a "${this.store.get().project.name}". ¿En qué te ayudo?`);
    }));
  }

  private renderStatus(): void {
    const { aiStatus, mode, settings } = this.store.get();
    if (settings.aiProvider !== 'auto') {
      this.status.textContent = this.service.describe();
      this.status.title = this.service.describe();
      this.status.classList.toggle('chip-ok', this.service.resolve().reason === null);
      return;
    }
    this.status.textContent = mode === 'local' ? 'Sin conexión · motor de reglas' : aiStatus?.available ? `LM Studio · ${aiStatus.model}` : 'LM Studio no disponible · motor de reglas';
    this.status.title = aiStatus?.message ?? '';
    this.status.classList.toggle('chip-ok', Boolean(aiStatus?.available) && mode === 'server');
  }

  private render(): void {
    this.list.replaceChildren(...projectRecommendations(this.store.get().project).map((r) =>
      h('li', { class: 'reco' },
        h('div', { class: 'reco-head' }, h('span', { class: 'tag' }, r.topic), h('span', { class: `priority priority-${r.priority}` }, `Prioridad ${r.priority}`)),
        h('p', {}, r.text))));
  }

  private async ask(raw: string): Promise<void> {
    const question = raw.trim();
    if (!question || this.send.disabled) return;
    this.input.value = '';
    this.say('user', question);
    const pending = this.say('assistant', 'Analizando terreno y requisitos…', 'is-pending');
    this.send.disabled = true;
    try {
      const envelope = await this.service.chat(question, this.history.slice(-10));
      pending.remove();
      this.say('assistant', envelope.result.reply, '', sourceLabel(envelope) + (envelope.fallbackReason ? ` · ${envelope.fallbackReason}` : ''));
      this.history.push({ role: 'user', content: question }, { role: 'assistant', content: envelope.result.reply });
    } catch (error) {
      pending.remove();
      this.say('assistant', describeApiError(error, 'No fue posible obtener respuesta.'), 'is-error');
    } finally {
      this.send.disabled = false;
      this.input.focus();
    }
  }

  private say(author: 'user' | 'assistant', text: string, extra = '', meta = ''): HTMLElement {
    const bubble = h('div', { class: `bubble bubble-${author === 'user' ? 'user' : 'ai'} ${extra}` },
      h('span', { class: 'bubble-author' }, author === 'user' ? 'Usuario' : 'IA'),
      h('p', {}, text),
      meta ? h('span', { class: 'bubble-meta' }, meta) : null);
    this.chat.append(bubble);
    this.chat.scrollTop = this.chat.scrollHeight;
    return bubble;
  }
}
