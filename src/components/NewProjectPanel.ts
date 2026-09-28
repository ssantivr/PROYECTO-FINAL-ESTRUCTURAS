import { Component } from '../core/component';
import { formatCurrency, formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { BuildingType } from '../types/project';
import type { ProjectTemplate } from '../types/ui';
import { BUILDING_TYPES } from '../types/project';
import { BUILDING_TYPE_LABEL } from '../../shared/i18n/es';
import { PROJECT_TEMPLATES } from '../data/projectTemplates';
import type { NewProjectInput } from '../services/projectSync';

export interface NewProjectActions {
  create: (input: NewProjectInput) => Promise<void>;
}

export class NewProjectPanel extends Component {
  private readonly error = h('p', { class: 'form-error', role: 'alert' });
  private readonly form: HTMLFormElement;
  private readonly templates = new Map<string, HTMLButtonElement>();
  private readonly target = h('span', { class: 'badge' });

  constructor(private readonly store: AppStore, private readonly actions: NewProjectActions) {
    super(h('section', { class: 'panel', 'data-area': 'newProject' }));
    this.form = this.buildForm();
    this.el.append(
      h('header', { class: 'panel-head' }, h('h2', {}, 'Nuevo proyecto'), this.target),
      h('div', { class: 'panel-body new-project-body' },
        h('div', {},
          h('h3', { class: 'sub-title' }, 'Plantillas'),
          h('div', { class: 'template-grid' }, ...PROJECT_TEMPLATES.map((t) => this.templateCard(t)))),
        h('div', {}, h('h3', { class: 'sub-title' }, 'Datos del proyecto'), this.form)),
    );
    this.renderTarget();
    this.track(store.select((st) => st.mode, () => this.renderTarget()));
  }

  private renderTarget(): void {
    this.target.textContent = this.store.get().mode === 'server' ? 'Se guardará en PostgreSQL' : 'Se guardará en este navegador';
  }

  private templateCard(template: ProjectTemplate): HTMLButtonElement {
    const btn = h('button', { class: 'template-card', type: 'button', 'aria-pressed': 'false', onclick: () => this.apply(template) },
      h('div', { class: 'template-top' }, h('strong', {}, template.name), h('span', { class: 'tag' }, BUILDING_TYPE_LABEL[template.buildingType])),
      h('p', {}, template.description),
      h('div', { class: 'template-meta' },
        h('span', {}, `${template.floors} ${template.floors === 1 ? 'nivel' : 'niveles'}`),
        h('span', {}, `≈ ${formatNumber(template.area)} m²`),
        h('span', {}, formatCurrency(template.budget))));
    this.templates.set(template.id, btn);
    return btn;
  }

  private apply(template: ProjectTemplate): void {
    this.templates.forEach((btn, id) => btn.setAttribute('aria-pressed', String(id === template.id)));
    const set = (name: string, value: string | number) => {
      const field = this.form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = String(value);
    };
    set('name', template.name);
    set('buildingType', template.buildingType);
    set('description', template.description);
    set('city', template.city);
    set('region', template.region);
    set('budget', template.budget);
    set('style', template.style);
  }

  private buildForm(): HTMLFormElement {
    const input = (name: string, attrs: Record<string, string | number | boolean> = {}) => h('input', { name, type: 'text', maxlength: 120, ...attrs });
    const type = h('select', { name: 'buildingType' }, ...BUILDING_TYPES.map((t) => h('option', { value: t }, BUILDING_TYPE_LABEL[t])));
    const form = h('form', { class: 'form-grid new-project', novalidate: true },
      h('label', { class: 'field' }, h('span', {}, 'Nombre'), input('name', { required: true, placeholder: 'Casa Familiar' })),
      h('label', { class: 'field' }, h('span', {}, 'Tipo de construcción'), type),
      h('label', { class: 'field span-2' }, h('span', {}, 'Descripción'), h('textarea', { name: 'description', rows: 2, maxlength: 2000 })),
      h('label', { class: 'field' }, h('span', {}, 'Ciudad'), input('city', { required: true, value: 'Pasto' })),
      h('label', { class: 'field' }, h('span', {}, 'Departamento'), input('region', { required: true, value: 'Nariño' })),
      h('label', { class: 'field' }, h('span', {}, 'Presupuesto aproximado'), h('div', { class: 'input-unit' }, h('input', { name: 'budget', type: 'number', min: 0, step: 1000000, value: 300000000 }), h('em', {}, 'COP'))),
      h('label', { class: 'field' }, h('span', {}, 'Estilo arquitectónico'), input('style', { required: true, value: 'Contemporáneo' })),
      this.error,
      h('button', { class: 'btn btn-primary span-2', type: 'submit' }, icon('plus', 16), 'Crear proyecto'),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const text = (key: string) => String(data.get(key) ?? '').trim();
      const budget = Number(data.get('budget'));
      const missing = [['name', 'Nombre'], ['city', 'Ciudad'], ['region', 'Departamento'], ['style', 'Estilo']].filter(([key]) => !text(key ?? ''));
      if (missing.length) {
        this.error.textContent = `Complete: ${missing.map(([, label]) => label).join(', ')}.`;
        return;
      }
      if (!Number.isFinite(budget) || budget < 0) {
        this.error.textContent = 'El presupuesto debe ser un número positivo.';
        return;
      }
      this.error.textContent = '';
      const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submit.disabled = true;
      try {
        await this.actions.create({
          name: text('name'),
          description: text('description'),
          buildingType: text('buildingType') as BuildingType,
          city: text('city'),
          region: text('region'),
          budget,
          style: text('style'),
        });
        form.reset();
        this.templates.forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
      } catch (error) {
        this.error.textContent = error instanceof Error ? error.message : 'No fue posible crear el proyecto.';
      } finally {
        submit.disabled = false;
      }
    });
    return form;
  }
}
