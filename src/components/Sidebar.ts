import { Component } from '../core/component';
import { h, icon, type IconName } from '../core/dom';
import type { AppStore } from '../core/appState';
import type { ViewId } from '../types/project';

interface NavItem {
  label: string;
  icon: IconName;
  view: ViewId;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', icon: 'home', view: 'overview' },
  { label: 'Proyectos', icon: 'folder', view: 'project' },
  { label: 'Terrenos', icon: 'terrain', view: 'terrain' },
  { label: 'Visualización 3D', icon: 'cube', view: 'viewer' },
  { label: 'Planos', icon: 'plan', view: 'plans' },
  { label: 'Construcción', icon: 'crane', view: 'construction' },
  { label: 'Materiales', icon: 'layers', view: 'materials' },
  { label: 'IA Asistente', icon: 'spark', view: 'ai' },
];

export class Sidebar extends Component {
  private readonly buttons = new Map<ViewId, HTMLButtonElement>();

  constructor(store: AppStore) {
    super(h('aside', { class: 'sidebar' }));
    const nav = h('nav', { class: 'side-nav', 'aria-label': 'Navegación principal' });
    for (const item of NAV_ITEMS) {
      const btn = h('button', { class: 'side-link', type: 'button', onclick: () => store.set({ view: item.view }) },
        icon(item.icon), h('span', {}, item.label));
      this.buttons.set(item.view, btn);
      nav.append(btn);
    }
    this.el.append(
      h('div', { class: 'brand' },
        h('div', { class: 'brand-mark', 'aria-hidden': 'true' }, brandMark()),
        h('div', {}, h('strong', { class: 'brand-name' }, 'ARQUILA'), h('span', { class: 'brand-tag' }, 'Diseña · Analiza · Construye')),
      ),
      nav,
      h('div', { class: 'side-foot' },
        h('span', { class: 'side-foot-label' }, 'Proyecto activo'),
        h('strong', {}, store.get().project.name),
        h('span', { class: 'side-foot-meta' }, 'Planos preliminares · no certificados'),
      ),
    );
    this.highlight(store.get().view);
    this.track(store.select((s) => s.view, (view) => this.highlight(view)));
  }

  private highlight(view: ViewId): void {
    this.buttons.forEach((btn, key) => btn.setAttribute('aria-current', key === view ? 'page' : 'false'));
  }
}

function brandMark(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', '30');
  svg.setAttribute('height', '30');
  svg.innerHTML =
    '<path d="M4 27L16 5l12 22" fill="none" stroke="#1597E5" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M9.5 19h13" stroke="#20C7F5" stroke-width="2"/><path d="M16 5v22" stroke="#20C7F5" stroke-width="1.2" stroke-dasharray="2 2"/>';
  return svg;
}
