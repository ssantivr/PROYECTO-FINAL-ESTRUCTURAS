import { Component } from '../core/component';
import { formatNumber, h, icon, type IconName } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { ViewId } from '../types/project';
import { BUILDING_TYPE_LABEL } from '../../shared/i18n/es';

export interface DashboardActions {
  openProject: (id: string) => void;
}

const QUICK: ReadonlyArray<{ label: string; hint: string; icon: IconName; view: ViewId }> = [
  { label: 'Nuevo proyecto', hint: 'Plantillas y datos base', icon: 'plus', view: 'newProject' },
  { label: 'Asistente IA', hint: 'Preguntas y recomendaciones', icon: 'spark', view: 'ai' },
  { label: 'Visualización 3D', hint: 'Terreno y construcción', icon: 'cube', view: 'viewer' },
  { label: 'Analizar terreno', hint: 'Topografía y sol', icon: 'terrain', view: 'terrain' },
];

const timeAgo = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export class DashboardPanel extends Component {
  constructor(private readonly store: AppStore, private readonly actions: DashboardActions) {
    super(h('section', { class: 'panel dashboard', 'data-area': 'dashboard' }));
    this.render();
    this.track(store.subscribe((s, prev) => {
      if (s.projects !== prev.projects || s.aiStatus !== prev.aiStatus || s.project !== prev.project) this.render();
    }));
  }

  private render(): void {
    const { projects, aiStatus, project, user, mode } = this.store.get();
    const totalLot = projects.reduce((sum, p) => sum + p.lotArea, 0);
    const totalBuilt = projects.reduce((sum, p) => sum + p.builtArea, 0);
    const last = projects[0];
    const rooms = project.building.floors.reduce((sum, f) => sum + f.rooms.length, 0);

    this.el.replaceChildren(
      h('header', { class: 'panel-head' },
        h('h2', {}, user ? `Hola, ${user.name.split(' ')[0]}` : 'Inicio'),
        h('span', { class: 'badge' }, mode === 'server' ? `${projects.length} proyecto(s) en la base de datos` : 'Trabajando sin conexión')),
      h('div', { class: 'panel-body dash-grid' },
        h('div', { class: 'dash-stats' },
          stat('Proyectos', formatNumber(projects.length)),
          stat('Área total de lotes', `${formatNumber(totalLot)} m²`),
          stat('Área construida', `${formatNumber(totalBuilt)} m²`),
          stat('Último proyecto', last?.name ?? '—', last ? timeAgo(last.updatedAt) : ''),
        ),
        h('div', { class: 'dash-quick' }, ...QUICK.map((q) =>
          h('button', { class: 'quick-card', type: 'button', onclick: () => this.store.set({ view: q.view }) },
            icon(q.icon, 20), h('strong', {}, q.label), h('span', {}, q.hint)))),
        h('div', { class: 'dash-recent' },
          h('h3', { class: 'sub-title' }, 'Proyectos recientes'),
          projects.length
            ? h('ul', { class: 'recent-list' }, ...projects.slice(0, 5).map((p) =>
              h('li', {},
                h('button', { class: `recent-item${p.id === project.id ? ' is-active' : ''}`, type: 'button', onclick: () => this.actions.openProject(p.id) },
                  h('strong', {}, p.name),
                  h('span', {}, `${BUILDING_TYPE_LABEL[p.buildingType]} · ${p.city} · ${formatNumber(p.builtArea)} m² · ${p.floors} piso(s)`)))))
            : h('p', { class: 'muted' }, 'Aún no hay proyectos.'),
        ),
        h('div', { class: 'dash-status' },
          h('h3', { class: 'sub-title' }, 'Estado de generación'),
          statusRow(rooms > 0, `Distribución: ${project.building.floors.length} piso(s), ${rooms} espacios`),
          statusRow(true, 'Planos y modelo 3D sincronizados con los datos del proyecto'),
          statusRow(aiStatus?.available ?? false, aiStatus ? aiStatus.message : mode === 'server' ? 'Consultando LM Studio…' : 'IA: motor de reglas local'),
        ),
      ),
    );
  }
}

function stat(label: string, value: string, note = ''): HTMLElement {
  return h('div', { class: 'stat-card' }, h('span', {}, label), h('strong', {}, value), note ? h('em', {}, note) : null);
}

function statusRow(ok: boolean, text: string): HTMLElement {
  return h('p', { class: 'status-row' },
    h('span', { class: `status ${ok ? 'status-ok' : 'status-warn'}` }, icon(ok ? 'check' : 'spark', 12), ok ? 'Listo' : 'Aviso'),
    text);
}
