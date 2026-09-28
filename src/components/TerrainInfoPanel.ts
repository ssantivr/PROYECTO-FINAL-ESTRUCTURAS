import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import { ORIENTATION_LABEL, SHAPE_LABEL, SIDE_LABEL } from '../../shared/i18n/es';
import { drawSitePlan } from '../render/sitePlan';
import { computeMetrics } from '../services/metrics';
import { elevationRange, reliefClass } from '../services/terrainInsights';

export class TerrainInfoPanel extends Component {
  private readonly body = h('div', { class: 'panel-body terrain-info' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'info' }));
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Información del terreno'), h('span', { class: 'badge' }, 'COS · CUS · Topografía')), this.body);
    this.render();
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private render(): void {
    const { project } = this.store.get();
    const { terrain } = project;
    const m = computeMetrics(project);
    const relief = reliefClass(terrain.slopePercent);
    const range = elevationRange(terrain);
    this.body.replaceChildren(
      h('div', { class: 'index-grid' },
        indexMeter('COS', 'Ocupación', m.cos, terrain.maxCos, m.cosCompliant),
        indexMeter('CUS', 'Utilización', m.cus, terrain.maxCus, m.cusCompliant),
      ),
      h('div', { class: 'topo-summary' },
        h('div', { class: 'topo-summary-head' },
          h('span', { class: 'index-code' }, 'TOPOGRAFÍA'),
          h('span', { class: `status-pill tone-${relief.tone}` }, h('i', {}), relief.label)),
        h('div', { class: 'topo-summary-grid' },
          h('div', {}, h('span', {}, 'Pendiente'), h('strong', {}, `${formatNumber(terrain.slopePercent, 1)} %`)),
          h('div', {}, h('span', {}, 'Desnivel'), h('strong', {}, `${formatNumber(range.drop, 2)} m`)),
          h('div', {}, h('span', {}, 'Cota base'), h('strong', {}, `${formatNumber(terrain.elevation)} m`))),
        h('p', {}, relief.note)),
      drawSitePlan(project, false),
      h('dl', { class: 'data-list' },
        row('Dimensiones', `${formatNumber(terrain.width, 1)} × ${formatNumber(terrain.length, 1)} m`),
        row('Área del lote', `${formatNumber(m.lotArea)} m²`),
        row('Huella construida', `${formatNumber(m.footprintArea)} m²`),
        row('Área libre', `${formatNumber(m.freeArea)} m²`),
        row('Pendiente media', `${formatNumber(terrain.slopePercent, 1)} %`),
        row('Desnivel por pendiente',`${formatNumber((terrain.slopePercent / 100) * terrain.length, 2)} m`),
        row('Cota base', `${formatNumber(terrain.elevation)} m s. n. m.`),
        row('Forma', SHAPE_LABEL[terrain.shape]),
        row('Orientación frente', ORIENTATION_LABEL[terrain.orientation]),
        row('Acceso', SIDE_LABEL[terrain.accessSide]),
        row('Jardín / estac. / piscina', `${formatNumber(terrain.gardenArea)} / ${formatNumber(terrain.parkingArea)} / ${formatNumber(terrain.poolArea)} m²`),
        row('Suelo', terrain.soilType),
        row('Pisos', `${project.building.floors.length} / ${terrain.maxFloors} permitidos`),
        row('Altura total', `${formatNumber(m.totalHeight, 2)} m`),
        row('Coordenadas', `${terrain.latitude.toFixed(4)}°, ${terrain.longitude.toFixed(4)}°`),
      ),
    );
  }
}

function row(label: string, value: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(h('dt', {}, label), h('dd', {}, value));
  return frag;
}

function indexMeter(code: string, label: string, value: number, max: number, ok: boolean): HTMLElement {
  const pct = Math.min(100, (value / max) * 100);
  return h('div', { class: 'index-card' },
    h('div', { class: 'index-top' },
      h('span', { class: 'index-code' }, code),
      h('span', { class: `status ${ok ? 'status-ok' : 'status-bad'}` }, icon(ok ? 'check' : 'spark', 12), ok ? 'Cumple' : 'Excede'),
    ),
    h('strong', { class: 'index-value' }, value.toFixed(2)),
    h('span', { class: 'index-label' }, `${label} · máx. ${max.toFixed(2)}`),
    h('div', { class: 'meter', role: 'meter', 'aria-valuenow': value.toFixed(2), 'aria-valuemax': max, 'aria-label': code },
      h('span', { class: 'meter-fill', style: `width:${pct}%` })),
  );
}
