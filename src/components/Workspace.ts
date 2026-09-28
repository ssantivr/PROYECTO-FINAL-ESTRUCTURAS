import { Component } from '../core/component';
import { h } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { ViewId } from '../types/project';
import type { AppSettings } from '../types/ui';

export type PanelArea =
  | 'dashboard' | 'projects' | 'editor' | 'terrainForm' | 'analysis' | 'program' | 'construction'
  | 'plans' | 'elevations' | 'materials' | 'ai' | 'viewer' | 'info'
  | 'planCards' | 'elevationCards' | 'insights' | 'terrainViewer' | 'newProject' | 'settings';

const VIEW_LAYOUT: Record<ViewId, readonly PanelArea[]> = {
  overview: ['viewer', 'info', 'planCards', 'insights', 'elevationCards', 'dashboard'],
  project: ['projects', 'editor', 'info'],
  newProject: ['newProject', 'info'],
  terrain: ['terrainViewer', 'terrainForm', 'analysis', 'info'],
  construction: ['program', 'construction', 'info'],
  plans: ['plans', 'elevations', 'info'],
  materials: ['materials', 'viewer', 'info'],
  viewer: ['viewer', 'info'],
  ai: ['ai', 'viewer', 'info'],
  settings: ['settings', 'info'],
};

const SLOTS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export class Workspace extends Component {
  constructor(store: AppStore, panels: readonly Component[]) {
    super(h('main', { class: 'workspace', id: 'workspace' }));
    panels.forEach((panel) => panel.mount(this.el));
    this.apply(store.get().view);
    this.applySettings(store.get().settings);
    this.track(store.select((st) => st.view, (view) => this.apply(view)));
    this.track(store.select((st) => st.settings, (settings) => this.applySettings(settings)));
  }

  private applySettings(settings: AppSettings): void {
    this.el.classList.toggle('hide-axes', !settings.showAxes);
    this.el.classList.toggle('hide-dims', !settings.showDimensions);
  }

  private apply(view: ViewId): void {
    const layout = VIEW_LAYOUT[view];
    this.el.dataset['view'] = view;
    this.el.dataset['layout'] = view === 'overview' ? 'overview' : String(layout.length);
    this.el.querySelectorAll<HTMLElement>(':scope > [data-area]').forEach((panel) => {
      const index = layout.indexOf(panel.dataset['area'] as PanelArea);
      panel.hidden = index < 0;
      panel.dataset['slot'] = index < 0 ? '' : SLOTS[index] ?? '';
    });
    this.el.scrollTop = 0;
  }
}
