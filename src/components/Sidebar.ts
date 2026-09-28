import { Component } from '../core/component';
import { h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { ViewId } from '../types/project';
import { SIDEBAR_ITEMS } from '../data/navigation';
import { selectProjectStatus } from '../state/selectors';

export class Sidebar extends Component {
  private readonly buttons = new Map<ViewId, HTMLButtonElement>();
  private readonly foot = h('div', { class: 'side-foot' });

  constructor(private readonly store: AppStore, private readonly onLogout: () => void) {
    super(h('aside', { class: 'sidebar' }));
    const nav = h('nav', { class: 'side-nav', 'aria-label': 'Navegación principal' });
    for (const item of SIDEBAR_ITEMS) {
      const btn = h('button', { class: 'side-link', type: 'button', title: item.label, onclick: () => store.set({ view: item.view }) },
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
      this.foot,
    );
    this.highlight(store.get().view);
    this.renderFoot();
    this.track(store.select((s) => s.view, (view) => this.highlight(view)));
    this.track(store.subscribe((s, prev) => {
      if (s.project.name !== prev.project.name || s.user !== prev.user || s.mode !== prev.mode || s.statuses !== prev.statuses) this.renderFoot();
    }));
  }

  private renderFoot(): void {
    const { project, user, mode } = this.store.get();
    const status = selectProjectStatus(this.store.get());
    this.foot.replaceChildren(
      h('span', { class: 'side-foot-label' }, 'Proyecto activo'),
      h('strong', {}, project.name),
      h('div', { class: 'side-progress' },
        h('div', { class: 'side-progress-top' }, h('span', {}, status.label), h('em', {}, `${status.progress}%`)),
        h('div', { class: 'meter' }, h('span', { class: 'meter-fill', style: `width:${status.progress}%` }))),
      h('span', { class: 'side-foot-meta' }, 'Planos preliminares · no certificados'),
      h('div', { class: 'side-user' },
        h('span', {}, user ? user.name : 'Modo sin conexión'),
        mode === 'server'
          ? h('button', { class: 'link-btn', type: 'button', onclick: this.onLogout }, 'Cerrar sesión')
          : h('button', { class: 'link-btn', type: 'button', onclick: () => location.reload() }, 'Reintentar conexión')),
    );
  }

  private highlight(view: ViewId): void {
    this.buttons.forEach((btn, key) => btn.setAttribute('aria-current', key === view ? 'page' : 'false'));
  }
}

export function brandMark(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', '30');
  svg.setAttribute('height', '30');
  svg.innerHTML =
    '<path d="M4 27L16 5l12 22" fill="none" stroke="#1597E5" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M9.5 19h13" stroke="#20C7F5" stroke-width="2"/><path d="M16 5v22" stroke="#20C7F5" stroke-width="1.2" stroke-dasharray="2 2"/>';
  return svg;
}
