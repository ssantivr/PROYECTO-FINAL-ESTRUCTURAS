import { Component } from '../core/component';
import { h, icon } from '../core/dom';
import type { AppStore } from '../core/appState';
import type { AssistantProvider } from '../services/aiAssistant';

export class AIAssistantPanel extends Component {
  private readonly list = h('ul', { class: 'reco-list' });
  private readonly chat = h('div', { class: 'chat-log', 'aria-live': 'polite' });

  constructor(private readonly store: AppStore, private readonly assistant: AssistantProvider) {
    super(h('section', { class: 'panel', 'data-area': 'ai' }));
    const input = h('input', { type: 'text', placeholder: 'Pregunte sobre normativa, terreno, iluminación…', 'aria-label': 'Pregunta al asistente' });
    const form = h('form', { class: 'chat-form' }, input,
      h('button', { class: 'btn btn-primary', type: 'submit', 'aria-label': 'Enviar' }, icon('send', 16)));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      this.say('user', question);
      this.say('ai', this.assistant.answer(this.store.get().project, question));
      input.value = '';
    });

    this.el.append(
      h('header', { class: 'panel-head' }, h('h2', {}, 'IA Asistente'), h('span', { class: 'badge' }, 'Motor local de reglas')),
      h('div', { class: 'panel-body ai-layout' },
        h('div', {}, h('h3', { class: 'sub-title' }, 'Recomendaciones del proyecto'), this.list),
        h('div', { class: 'chat' }, this.chat, form),
      ),
    );
    this.say('ai', 'Hola, soy el asistente de ARQUILA. Analizo el proyecto activo y respondo en español.');
    this.render();
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private render(): void {
    this.list.replaceChildren(...this.assistant.recommend(this.store.get().project).map((r) =>
      h('li', { class: 'reco' },
        h('div', { class: 'reco-head' }, h('span', { class: 'tag' }, r.topic), h('span', { class: `priority priority-${r.priority}` }, `Prioridad ${r.priority}`)),
        h('p', {}, r.text))));
  }

  private say(author: 'user' | 'ai', text: string): void {
    this.chat.append(h('div', { class: `bubble bubble-${author}` }, text));
    this.chat.scrollTop = this.chat.scrollHeight;
  }
}
