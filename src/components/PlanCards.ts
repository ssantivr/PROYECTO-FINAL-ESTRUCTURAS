import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { Floor } from '../types/project';
import { drawPlanSheet } from '../render/planDrawing';

export class PlanCards extends Component {
  private readonly grid = h('div', { class: 'card-grid plan-cards' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'planCards' }));
    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Planos · Planta baja y alta'),
        h('span', { class: 'badge' }, 'Ejes y cotas'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => store.set({ view: 'plans' }) }, icon('plan', 14), 'Abrir planos')),
      this.grid,
    );
    this.render();
    this.track(store.select((st) => st.project.building, () => this.render()));
  }

  private render(): void {
    const floors = this.store.get().project.building.floors.slice(0, 2);
    this.grid.replaceChildren(...floors.map((floor) => this.card(floor)));
    if (floors.length < 2) {
      this.grid.append(h('article', { class: 'mini-card is-empty' },
        h('p', { class: 'muted' }, 'Proyecto de un solo nivel. Agregue un piso en Construcción para generar la planta alta.')));
    }
  }

  private card(floor: Floor): HTMLElement {
    const area = floor.footprint.width * floor.footprint.depth;
    return h('article', { class: 'mini-card' },
      h('button', { class: 'mini-card-stage', type: 'button', title: `Abrir ${floor.name}`, onclick: () => this.store.set({ view: 'plans' }) }, drawPlanSheet([floor])),
      h('footer', { class: 'mini-card-foot' },
        h('strong', {}, floor.name),
        h('span', {}, `${formatNumber(area, 1)} m² · ${floor.rooms.length} espacios · N+${floor.level.toFixed(2)}`)));
  }
}
