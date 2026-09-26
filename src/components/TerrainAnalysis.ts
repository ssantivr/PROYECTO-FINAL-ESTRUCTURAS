import { Component } from '../core/component';
import { formatNumber, h } from '../core/dom';
import type { AppStore } from '../core/appState';
import { columnChart, lineChart } from '../render/charts';
import { longitudinalProfile, monthlyInsolation, slopeDistribution } from '../services/terrainAnalysis';

export class TerrainAnalysis extends Component {
  private readonly body = h('div', { class: 'panel-body analysis-grid' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'analysis' }));
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Análisis del terreno'), h('span', { class: 'badge' }, 'Estimado')), this.body);
    this.render();
    this.track(store.subscribe((st, prev) => {
      if (st.project !== prev.project || st.sunMonth !== prev.sunMonth) this.render();
    }));
  }

  private render(): void {
    const { project, sunMonth } = this.store.get();
    const { terrain } = project;
    const profile = longitudinalProfile(terrain);
    const slopes = slopeDistribution(terrain);
    const sun = monthlyInsolation(terrain.latitude);
    const selected = sun[sunMonth];

    this.body.replaceChildren(
      lineChart(
        profile.map((p) => ({ label: `${formatNumber(p.distance, 1)} m`, value: p.elevation })),
        { caption: 'Perfil longitudinal (eje central, frente → fondo)', unit: 'm s. n. m.', format: (v) => formatNumber(v, 1) },
      ),
      columnChart(
        slopes.map((b) => ({ label: b.label, value: b.share * 100 })),
        { caption: 'Distribución de pendientes (% de superficie)', unit: '%', format: (v) => formatNumber(v), directLabels: true },
      ),
      columnChart(
        sun.map((m) => ({ label: m.month.charAt(0), value: m.sunHours })),
        {
          caption: 'Insolación media diaria (h de sol) — clic para fijar el mes en 3D',
          unit: 'h/día',
          format: (v) => formatNumber(v, 1),
          highlight: sunMonth,
          onSelect: (i) => this.store.set({ sunMonth: i }),
        },
      ),
      h('div', { class: 'sun-summary' },
        h('div', {}, h('span', {}, 'Mes'), h('strong', {}, selected?.month ?? '—')),
        h('div', {}, h('span', {}, 'Duración del día'), h('strong', {}, `${formatNumber(selected?.dayLength ?? 0, 1)} h`)),
        h('div', {}, h('span', {}, 'Altura solar mediodía'), h('strong', {}, `${formatNumber(selected?.noonAltitude ?? 0, 1)}°`)),
        h('div', {}, h('span', {}, 'Sol efectivo'), h('strong', {}, `${formatNumber(selected?.sunHours ?? 0, 1)} h`)),
      ),
    );
  }
}
