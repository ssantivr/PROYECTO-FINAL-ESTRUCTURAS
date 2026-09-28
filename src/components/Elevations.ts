import { Component } from '../core/component';
import { h } from '../core/dom';
import type { AppStore } from '../state/appState';
import { drawElevation, type ElevationKind } from '../render/elevationDrawing';

const KINDS: ReadonlyArray<[ElevationKind, string]> = [
  ['front', 'Frontal'],
  ['back', 'Posterior'],
  ['left', 'Lateral izq.'],
  ['right', 'Lateral der.'],
  ['section', 'Corte'],
];

export class Elevations extends Component {
  private kind: ElevationKind = 'front';
  private readonly canvas = h('div', { class: 'elev-canvas' });
  private readonly buttons = new Map<ElevationKind, HTMLButtonElement>();

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'elevations' }));
    const seg = h('div', { class: 'segmented' });
    for (const [kind, label] of KINDS) {
      const btn = h('button', { class: 'seg', type: 'button', onclick: () => this.setKind(kind) }, label);
      this.buttons.set(kind, btn);
      seg.append(btn);
    }
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Elevaciones y cortes'), seg), this.canvas);
    this.setKind('front');
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private setKind(kind: ElevationKind): void {
    this.kind = kind;
    this.buttons.forEach((btn, key) => btn.setAttribute('aria-pressed', String(key === kind)));
    this.render();
  }

  private render(): void {
    this.canvas.replaceChildren(drawElevation(this.store.get().project, this.kind));
  }
}
