import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import { setProjectStatus, type AppStore } from '../state/appState';
import { selectProjectStatus } from '../state/selectors';
import type { ProjectStatusId } from '../types/ui';
import { BUILDING_TYPE_LABEL } from '../../shared/i18n/es';
import { PROJECT_STATUSES } from '../data/projectStatus';

export interface ProjectsActions {
  open: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export class ProjectsPanel extends Component {
  private readonly list = h('ul', { class: 'project-list' });

  constructor(private readonly store: AppStore, private readonly actions: ProjectsActions) {
    super(h('section', { class: 'panel', 'data-area': 'projects' }));
    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Proyectos'),
        h('span', { class: 'badge' }, 'Abrir · estado · eliminar'),
        h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => store.set({ view: 'newProject' }) }, icon('plus', 14), 'Nuevo proyecto')),
      h('div', { class: 'panel-body' }, h('h3', { class: 'sub-title' }, 'Mis proyectos'), this.list),
    );
    this.render();
    this.track(store.subscribe((s, prev) => {
      if (s.projects !== prev.projects || s.project.id !== prev.project.id || s.mode !== prev.mode || s.statuses !== prev.statuses) this.render();
    }));
  }

  private render(): void {
    const { projects, project, mode } = this.store.get();
    this.list.replaceChildren(...projects.map((p) =>
      h('li', { class: `project-row${p.id === project.id ? ' is-active' : ''}` },
        h('div', {},
          h('strong', {}, p.name),
          h('span', {}, `${BUILDING_TYPE_LABEL[p.buildingType]} · ${p.city}, ${p.region} · lote ${formatNumber(p.lotArea)} m² · ${formatNumber(p.builtArea)} m² construidos · ${p.rooms} espacios`),
          this.progress(p.id)),
        h('div', { class: 'row-actions' },
          this.statusSelect(p.id),
          p.id === project.id
            ? h('span', { class: 'tag' }, 'Abierto')
            : h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => void this.actions.open(p.id) }, 'Abrir'),
          mode === 'server'
            ? h('button', {
              class: 'btn btn-ghost btn-sm btn-danger', type: 'button',
              onclick: () => {
                if (confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) void this.actions.remove(p.id);
              },
            }, 'Eliminar')
            : null))));
    if (!projects.length) this.list.append(h('li', { class: 'muted' }, 'No hay proyectos guardados.'));
  }

  private progress(id: string): HTMLElement {
    const status = selectProjectStatus(this.store.get(), id);
    return h('div', { class: 'row-progress' },
      h('div', { class: 'meter' }, h('span', { class: `meter-fill tone-${status.tone}`, style: `width:${status.progress}%` })),
      h('em', {}, `${status.label} · ${status.progress}%`));
  }

  private statusSelect(id: string): HTMLSelectElement {
    const current = selectProjectStatus(this.store.get(), id).id;
    const select = h('select', { class: 'status-select', 'aria-label': 'Estado del proyecto' },
      ...Object.values(PROJECT_STATUSES).map((st) => h('option', { value: st.id, selected: st.id === current }, st.label)));
    select.addEventListener('change', () => setProjectStatus(this.store, id, select.value as ProjectStatusId));
    return select;
  }
}
