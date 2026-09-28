import { Component } from '../core/component';
import { h, icon } from '../core/dom';
import { setProjectStatus, updateSettings, type AppStore } from '../state/appState';
import { selectProjectStatus } from '../state/selectors';
import type { AIProviderId, AppSettings, ProjectStatusId } from '../types/ui';
import { AI_PROVIDERS, DEFAULT_SETTINGS } from '../data/aiProviders';
import { PROJECT_STATUSES } from '../data/projectStatus';
import { AIService } from '../services/ai/AIService';

type BooleanKey = { [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never }[keyof AppSettings];

const TOGGLES: ReadonlyArray<[BooleanKey, string, string]> = [
  ['showAxes', 'Ejes estructurales', 'Muestra ejes y burbujas en los planos 2D.'],
  ['showDimensions', 'Cotas', 'Muestra líneas y textos de cota en los planos 2D.'],
  ['autosave', 'Autoguardado', 'Guarda el proyecto 4 s después del último cambio.'],
];

export class SettingsPanel extends Component {
  private readonly body = h('div', { class: 'panel-body settings-body' });
  private readonly service: AIService;
  private readonly aiState = h('p', { class: 'muted' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'settings' }));
    this.service = new AIService(store);
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Configuración'), h('span', { class: 'badge' }, 'Preferencias locales')), this.body);
    this.render();
    this.track(store.select((st) => st.project.id, () => this.render()));
    this.track(store.subscribe((st, prev) => {
      if (st.settings !== prev.settings || st.mode !== prev.mode) this.aiState.textContent = `Proveedor efectivo: ${this.service.describe()}`;
    }));
  }

  private render(): void {
    const { settings, mode, user } = this.store.get();
    this.aiState.textContent = `Proveedor efectivo: ${this.service.describe()}`;
    this.body.replaceChildren(
      h('section', { class: 'settings-group' },
        h('h3', { class: 'sub-title' }, 'Proyecto'),
        h('label', { class: 'field' }, h('span', {}, 'Estado del proyecto'), this.statusSelect()),
        h('dl', { class: 'data-list' },
          h('dt', {}, 'Almacenamiento'), h('dd', {}, mode === 'server' ? 'PostgreSQL (servidor)' : 'Navegador (sin conexión)'),
          h('dt', {}, 'Usuario'), h('dd', {}, user ? `${user.name} · ${user.email}` : '—'))),
      h('section', { class: 'settings-group' },
        h('h3', { class: 'sub-title' }, 'Visualización y edición'),
        ...TOGGLES.map(([key, label, hint]) => this.toggle(key, label, hint, settings[key]))),
      h('section', { class: 'settings-group span-2' },
        h('h3', { class: 'sub-title' }, 'Inteligencia artificial'),
        h('div', { class: 'provider-grid', role: 'radiogroup', 'aria-label': 'Proveedor de IA' }, ...AI_PROVIDERS.map((p) =>
          h('button', {
            class: 'provider-card', type: 'button', role: 'radio', 'aria-checked': String(settings.aiProvider === p.id),
            onclick: () => this.change({ aiProvider: p.id as AIProviderId }),
          }, h('strong', {}, p.label), h('span', {}, p.description)))),
        h('div', { class: 'form-grid' },
          this.text('aiEndpoint', 'Endpoint de la API', 'https://api.ejemplo.com/v1', settings.aiEndpoint),
          this.text('aiModel', 'Modelo', 'nombre-del-modelo', settings.aiModel),
          this.text('aiApiKey', 'Clave de API', '••••••••', settings.aiApiKey, 'password')),
        h('p', { class: 'disclaimer' }, 'La clave se guarda solo en este navegador y se envía únicamente al endpoint configurado.'),
        this.aiState),
      h('div', { class: 'settings-actions span-2' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => this.change({ ...DEFAULT_SETTINGS }) }, icon('rotate', 16), 'Restablecer preferencias')),
    );
  }

  private change(patch: Partial<AppSettings>): void {
    updateSettings(this.store, patch);
    this.render();
  }

  private statusSelect(): HTMLSelectElement {
    const { project } = this.store.get();
    const current = selectProjectStatus(this.store.get()).id;
    const select = h('select', {}, ...Object.values(PROJECT_STATUSES).map((st) => h('option', { value: st.id, selected: st.id === current }, `${st.label} · ${st.progress}%`)));
    select.addEventListener('change', () => setProjectStatus(this.store, project.id, select.value as ProjectStatusId));
    return select;
  }

  private toggle(key: BooleanKey, label: string, hint: string, value: boolean): HTMLLabelElement {
    const input = h('input', { type: 'checkbox', checked: value });
    input.addEventListener('change', () => updateSettings(this.store, { [key]: input.checked }));
    return h('label', { class: 'setting-toggle' }, input, h('span', {}, h('strong', {}, label), h('em', {}, hint)));
  }

  private text(key: 'aiEndpoint' | 'aiModel' | 'aiApiKey', label: string, placeholder: string, value: string, type = 'text'): HTMLLabelElement {
    const input = h('input', { type, value, placeholder, maxlength: 300, autocomplete: 'off' });
    input.addEventListener('change', () => updateSettings(this.store, { [key]: input.value.trim() }));
    return h('label', { class: 'field' }, h('span', {}, label), input);
  }
}
