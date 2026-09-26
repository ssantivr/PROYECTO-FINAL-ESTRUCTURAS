import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../core/appState';
import { computeMetrics } from '../services/metrics';

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
      h('div', { class: 'project-info' }, h('span', { class: 'eyebrow' }, 'Proyecto'), this.title, this.meta),
      h('div', { class: 'topbar-actions' },
        this.state,
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: actions.onSave }, icon('save', 16), 'Guardar'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: actions.onExport }, icon('download', 16), 'Exportar Planos'),
      ),
    );
    this.render();
    this.track(store.subscribe(() => this.render()));
  }

  private render(): void {
    const { project, dirty } = this.store.get();
    const metrics = computeMetrics(project);
    this.title.textContent = project.name;
    this.meta.replaceChildren(
      h('span', { class: 'meta-chip' }, icon('area', 14), `${formatNumber(metrics.builtArea)} m²`),
      h('span', { class: 'meta-chip' }, icon('pin', 14), `${project.city}, ${project.region}`),
      h('span', { class: 'meta-chip' }, `${project.building.floors.length} niveles`),
      h('span', { class: 'meta-chip' }, project.style),
    );
    this.state.textContent = dirty ? 'Cambios sin guardar' : `Guardado ${new Date(project.updatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    this.state.classList.toggle('is-dirty', dirty);
  }
}
