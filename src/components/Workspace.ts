import { Component } from '../core/component';
import { h } from '../core/dom';
import type { AppStore } from '../core/appState';
import type { ViewId } from '../types/project';

export type PanelArea = 'viewer' | 'info' | 'plans' | 'analysis' | 'elevations' | 'editor' | 'construction' | 'materials' | 'ai';

const VIEW_LAYOUT: Record<ViewId, readonly PanelArea[]> = {
  overview: ['viewer', 'info', 'plans', 'analysis', 'elevations'],
  viewer: ['viewer', 'info'],
  project: ['editor', 'viewer', 'info'],
  plans: ['plans', 'elevations', 'info'],
  terrain: ['analysis', 'viewer', 'info'],
  construction: ['construction', 'elevations', 'info'],
  materials: ['materials', 'info'],
  ai: ['ai', 'viewer', 'info'],
};

/** CSS-grid container that shows the panels of the active view. */
export class Workspace extends Component {
  constructor(store: AppStore, panels: readonly Component[]) {
    super(h('main', { class: 'workspace', id: 'workspace' }));
    panels.forEach((panel) => panel.mount(this.el));
    this.apply(store.get().view);
    this.track(store.select((st) => st.view, (view) => this.apply(view)));
  }

  private apply(view: ViewId): void {
    const visible = new Set(VIEW_LAYOUT[view]);
    this.el.dataset['view'] = view;
    this.el.querySelectorAll<HTMLElement>(':scope > [data-area]').forEach((panel) => {
      panel.hidden = !visible.has(panel.dataset['area'] as PanelArea);
    });
    this.el.scrollTop = 0;
  }
}
