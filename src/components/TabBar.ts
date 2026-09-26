import { Component } from '../core/component';
import { h } from '../core/dom';
import type { AppStore } from '../core/appState';
import type { ViewId } from '../types/project';

const TABS: ReadonlyArray<{ label: string; view: ViewId }> = [
  { label: 'Vista 3D', view: 'overview' },
  { label: 'Planos', view: 'plans' },
  { label: 'Terreno', view: 'terrain' },
  { label: 'Construcción', view: 'construction' },
  { label: 'Materiales', view: 'materials' },
  { label: 'IA', view: 'ai' },
];

export class TabBar extends Component {
  private readonly tabs = new Map<ViewId, HTMLButtonElement>();

  constructor(store: AppStore) {
    super(h('nav', { class: 'tabbar', role: 'tablist', 'aria-label': 'Secciones del proyecto' }));
    for (const tab of TABS) {
      const btn = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: () => store.set({ view: tab.view }) }, tab.label);
      this.tabs.set(tab.view, btn);
      this.el.append(btn);
    }
    this.select(store.get().view);
    this.track(store.select((s) => s.view, (view) => this.select(view)));
  }

  private select(view: ViewId): void {
    const active = view === 'viewer' ? 'overview' : view;
    this.tabs.forEach((btn, key) => btn.setAttribute('aria-selected', String(key === active)));
  }
}
