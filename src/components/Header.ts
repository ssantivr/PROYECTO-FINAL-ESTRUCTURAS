import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import { computeMetrics } from '../services/metrics';
import { BUILDING_TYPE_LABEL } from '../../shared/i18n/es';
import { selectProjectStatus } from '../state/selectors';

export interface HeaderActions {
  onSave: () => void;
  onExport: () => void;
}

export class Header extends Component {
  private readonly title = h('h1', { class: 'project-title' });
  private readonly meta = h('div', { class: 'project-meta' });
  private readonly state = h('span', { class: 'save-state' });

  constructor(private readonly store: AppStore, actions: HeaderActions) {
    super(h('header', { class: 'topbar' }));
    this.el.append(
      h('div', { class: 'project-info' }, h('span', { class: 'eyebrow' }, 'Proyecto actual'), this.title, this.meta),
      h('div', { class: 'topbar-actions' },
        this.state,
        h('button', { class: 'btn btn-ghost', type: 'button', title: 'Guardar (Ctrl + S)', onclick: actions.onSave }, icon('save', 16), 'Guardar'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: actions.onExport }, icon('download', 16), 'Exportar Planos'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => store.set({ view: 'ai' }) }, icon('spark', 16), 'Generar IA'),
      ),
    );
    this.render();
    this.track(store.subscribe(() => this.render()));
  }

  private render(): void {
    const { project, dirty, mode } = this.store.get();
    const metrics = computeMetrics(project);
    const status = selectProjectStatus(this.store.get());
    this.title.replaceChildren(project.name, h('span', { class: `status-pill tone-${status.tone}` }, h('i', {}), status.label));
    this.meta.replaceChildren(
      h('span', { class: 'meta-chip' }, BUILDING_TYPE_LABEL[project.buildingType]),
      h('span', { class: 'meta-chip' }, icon('area', 14), `${formatNumber(metrics.builtArea)} m²`),
      h('span', { class: 'meta-chip' }, icon('pin', 14), `${project.city}, ${project.region}`),
      h('span', { class: 'meta-chip' }, `${project.building.floors.length} ${project.building.floors.length === 1 ? 'nivel' : 'niveles'}`),
      h('span', { class: `meta-chip ${mode === 'server' ? 'chip-ok' : 'chip-warn'}` }, mode === 'server' ? 'PostgreSQL' : 'Sin conexión · copia local'),
    );
    this.state.textContent = dirty ? 'Cambios sin guardar' : `Guardado ${new Date(project.updatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    this.state.classList.toggle('is-dirty', dirty);
  }
}
