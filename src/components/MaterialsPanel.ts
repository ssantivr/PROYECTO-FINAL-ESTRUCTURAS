import { Component } from '../core/component';
import { formatCurrency, formatNumber, h } from '../core/dom';
import type { AppStore } from '../core/appState';
import { estimateMaterials, totalCost } from '../services/materials';
import { computeMetrics } from '../services/metrics';

export class MaterialsPanel extends Component {
  private readonly body = h('div', { class: 'panel-body' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'materials' }));
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Materiales y presupuesto'), h('span', { class: 'badge' }, 'Precios referenciales COP')), this.body);
    this.render();
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private render(): void {
    const { project } = this.store.get();
    const estimates = estimateMaterials(project);
    const total = totalCost(estimates);
    const { builtArea } = computeMetrics(project);
    this.body.replaceChildren(
      h('div', { class: 'kpi-row' },
        kpi('Costo materiales', formatCurrency(total)),
        kpi('Costo por m²', formatCurrency(total / builtArea)),
        kpi('Área base de cálculo', `${formatNumber(builtArea)} m²`),
      ),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data-table' },
          h('thead', {}, h('tr', {}, ...['Material', 'Categoría', 'Cantidad', 'Unidad', 'Valor unitario', 'Subtotal', 'Participación'].map((t) => h('th', {}, t)))),
          h('tbody', {}, ...estimates.map((e) => h('tr', {},
            h('td', {}, e.material.name),
            h('td', {}, h('span', { class: 'tag' }, e.material.category)),
            h('td', { class: 'num' }, formatNumber(e.quantity, e.quantity < 100 ? 2 : 0)),
            h('td', {}, e.material.unit),
            h('td', { class: 'num' }, formatCurrency(e.material.unitPrice)),
            h('td', { class: 'num' }, formatCurrency(e.cost)),
            h('td', {}, h('div', { class: 'share' }, h('span', { class: 'share-bar', style: `width:${(e.cost / total) * 100}%` }), h('em', {}, `${formatNumber((e.cost / total) * 100)} %`))),
          ))),
        ),
      ),
    );
  }
}

export function kpi(label: string, value: string): HTMLElement {
  return h('div', { class: 'kpi' }, h('span', {}, label), h('strong', {}, value));
}
