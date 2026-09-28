import { Component } from '../core/component';
import { h } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { ViewId } from '../types/project';
import { PROJECT_TABS } from '../data/navigation';

export class TabBar extends Component {
  private readonly tabs = new Map<ViewId, HTMLButtonElement>();
  private readonly indicator = h('span', { class: 'tab-indicator', 'aria-hidden': 'true' });

  constructor(store: AppStore) {
    super(h('nav', { class: 'tabbar', role: 'tablist', 'aria-label': 'Secciones del proyecto' }));
    for (const tab of PROJECT_TABS) {
      const btn = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: () => store.set({ view: tab.view }) }, tab.label);
      this.tabs.set(tab.view, btn);
      this.el.append(btn);
    }
    this.el.append(this.indicator);
    this.select(store.get().view);
    this.track(store.select((s) => s.view, (view) => this.select(view)));
    const resize = new ResizeObserver(() => this.select(store.get().view));
    resize.observe(this.el);
    this.track(() => resize.disconnect());
  }

  private select(view: ViewId): void {
    this.tabs.forEach((btn, key) => btn.setAttribute('aria-selected', String(key === view)));
    const active = this.tabs.get(view);
    this.indicator.hidden = !active;
    if (active) this.indicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
  }
}
