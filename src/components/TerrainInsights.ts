import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import { SLOPE_CLASSES } from '../data/terrainLayers';
import { ORIENTATION_LABEL } from '../../shared/i18n/es';
import { columnChart } from '../render/charts';
import { monthlyInsolation, slopeDistribution } from '../services/terrainAnalysis';
import { elevationRange, reliefClass, sunSummary } from '../services/terrainInsights';

export class TerrainInsights extends Component {
  private readonly body = h('div', { class: 'panel-body insights' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'insights' }));
    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Análisis del terreno'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => store.set({ view: 'terrain' }) }, icon('terrain', 14), 'Detalle')),
      this.body,
    );
    this.render();
    this.track(store.subscribe((st, prev) => {
      if (st.project.terrain !== prev.project.terrain || st.sunMonth !== prev.sunMonth) this.render();
    }));
  }

  private render(): void {
    const { project, sunMonth } = this.store.get();
    const { terrain } = project;
    const relief = reliefClass(terrain.slopePercent);
    const range = elevationRange(terrain);
    const sun = sunSummary(terrain.latitude, sunMonth);
    const distribution = slopeDistribution(terrain);

    this.body.replaceChildren(
      h('div', { class: 'insight-kpis' },
        kpi('Pendiente media', `${formatNumber(terrain.slopePercent, 1)} %`, relief.label, relief.tone),
        kpi('Desnivel', `${formatNumber(range.drop, 2)} m`, `${formatNumber(range.min, 0)}–${formatNumber(range.max, 0)} m`, 'info'),
        kpi('Orientación', ORIENTATION_LABEL[terrain.orientation], 'Fachada de acceso', 'info'),
        kpi('Sol anual', `${formatNumber(sun.annualHours)} h`, `Mejor: ${sun.bestMonth} · Menor: ${sun.worstMonth}`, 'ok'),
      ),
      h('div', { class: 'insight-block' },
        h('h3', { class: 'sub-title' }, 'Pendientes'),
        h('ul', { class: 'slope-bars' }, ...distribution.map((b, i) =>
          h('li', {},
            h('span', {}, b.label),
            h('div', { class: 'slope-track' }, h('i', { style: `width:${(b.share * 100).toFixed(1)}%;background:${SLOPE_CLASSES[i]?.color ?? 'var(--accent)'}` })),
            h('em', {}, `${formatNumber(b.share * 100)} %`))))),
      h('div', { class: 'insight-block' },
        h('h3', { class: 'sub-title' }, 'Insolación'),
        columnChart(
          monthlyInsolation(terrain.latitude).map((m) => ({ label: m.month.charAt(0), value: m.sunHours })),
          { caption: `Horas de sol efectivas por día · mediodía ${formatNumber(sun.noonAltitude, 0)}° de altura`, unit: 'h/día', format: (v) => formatNumber(v, 1), highlight: sunMonth, onSelect: (i) => this.store.set({ sunMonth: i }) },
        )),
    );
  }
}

function kpi(label: string, value: string, note: string, tone: string): HTMLElement {
  return h('div', { class: `insight-kpi tone-${tone}` }, h('span', {}, label), h('strong', {}, value), h('em', {}, note));
}
