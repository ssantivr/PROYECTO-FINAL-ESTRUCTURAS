import { Component } from '../core/component';
import { formatNumber, h } from '../core/dom';
import type { AppStore } from '../state/appState';
import { constructionSchedule } from '../services/materials';
import { computeMetrics, floorArea } from '../services/metrics';
import { kpi } from './MaterialsPanel';

export class ConstructionPanel extends Component {
  private readonly body = h('div', { class: 'panel-body' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'construction' }));
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Construcción'), h('span', { class: 'badge' }, 'Cronograma estimado')), this.body);
    this.render();
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private render(): void {
    const { project } = this.store.get();
    const metrics = computeMetrics(project);
    const phases = constructionSchedule(project);
    const totalWeeks = phases.reduce((sum, p) => sum + p.weeks, 0);
    let start = 0;

    this.body.replaceChildren(
      h('div', { class: 'kpi-row' },
        kpi('Área construida', `${formatNumber(metrics.builtArea)} m²`),
        kpi('Duración estimada', `${totalWeeks} semanas`),
        kpi('Sistema estructural', 'Pórticos en concreto'),
      ),
      h('div', { class: 'floor-list' }, ...project.building.floors.map((f) =>
        h('div', { class: 'floor-item' },
          h('strong', {}, f.name),
          h('span', {}, `${formatNumber(floorArea(f))} m² · ${f.rooms.length} espacios · h = ${f.height.toFixed(2)} m`)))),
      h('ol', { class: 'gantt', 'aria-label': 'Cronograma de obra' }, ...phases.map((phase) => {
        const left = (start / totalWeeks) * 100;
        start += phase.weeks;
        return h('li', { class: 'gantt-row' },
          h('span', { class: 'gantt-label' }, phase.name),
          h('div', { class: 'gantt-track' },
            h('span', { class: 'gantt-bar', style: `left:${left}%;width:${(phase.weeks / totalWeeks) * 100}%`, title: `${phase.weeks} semanas` })),
          h('span', { class: 'gantt-weeks' }, `${phase.weeks} sem`));
      })),
    );
  }
}
