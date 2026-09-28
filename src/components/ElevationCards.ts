import { Component } from '../core/component';
import { h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import { drawElevation, ELEVATION_TITLE, type ElevationKind } from '../render/elevationDrawing';

const KINDS: readonly ElevationKind[] = ['front', 'back', 'left', 'right', 'section'];

export class ElevationCards extends Component {
  private readonly grid = h('div', { class: 'card-grid elevation-cards' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'elevationCards' }));
    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Vistas y elevaciones'),
        h('span', { class: 'badge' }, 'Fachadas y corte'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => store.set({ view: 'plans' }) }, icon('expand', 14), 'Ampliar')),
      this.grid,
    );
    this.render();
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private render(): void {
    const project = this.store.get().project;
    this.grid.replaceChildren(...KINDS.map((kind) =>
      h('article', { class: 'mini-card' },
        h('button', { class: 'mini-card-stage', type: 'button', title: ELEVATION_TITLE[kind], onclick: () => this.store.set({ view: 'plans' }) }, drawElevation(project, kind)),
        h('footer', { class: 'mini-card-foot' }, h('strong', {}, ELEVATION_TITLE[kind])))));
  }
}
