import { Component } from '../core/component';
import { h } from '../core/dom';
import { updateProject, type AppStore } from '../state/appState';
import type { Project } from '../types/project';
import { BUILDING_TYPE_LABEL } from '../../shared/i18n/es';
import { numberField, selectField, textField } from './formFields';

type TextKey = 'name' | 'city' | 'region' | 'style';

const TEXT_FIELDS: ReadonlyArray<[TextKey, string, number]> = [
  ['name', 'Nombre del proyecto', 120],
  ['style', 'Estilo arquitectónico', 80],
  ['city', 'Ciudad', 80],
  ['region', 'Departamento', 80],
];

export class ProjectEditor extends Component {
  private readonly error = h('p', { class: 'form-error', role: 'alert' });
  private readonly form = h('form', { class: 'panel-body form-grid', novalidate: true });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'editor' }));
    this.form.addEventListener('submit', (e) => e.preventDefault());
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Datos del proyecto'), h('span', { class: 'badge' }, 'Edición en vivo')), this.form);
    this.render();
    this.track(store.select((s) => s.project.id, () => this.render()));
  }

  private set(recipe: (p: Project) => Project): void {
    this.error.textContent = '';
    updateProject(this.store, recipe);
  }

  private render(): void {
    const { project } = this.store.get();
    const onError = (message: string) => (this.error.textContent = message);
    this.form.replaceChildren(
      ...TEXT_FIELDS.map(([key, label, max]) => textField(label, project[key], max, (value) => this.set((p) => ({ ...p, [key]: value })), onError)),
      selectField('Tipo de construcción', project.buildingType, BUILDING_TYPE_LABEL, (buildingType) => this.set((p) => ({ ...p, buildingType }))),
      numberField({
        label: 'Presupuesto aproximado', value: project.budget, min: 0, max: 1e13, step: 1_000_000, unit: 'COP',
        onValid: (budget) => this.set((p) => ({ ...p, budget })), onError,
      }),
      textField('Descripción', project.description, 2000, (description) => this.set((p) => ({ ...p, description })), onError, true),
      this.error,
    );
  }
}
