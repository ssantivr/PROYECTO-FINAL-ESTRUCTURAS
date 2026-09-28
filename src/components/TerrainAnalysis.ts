import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import type { AppStore } from '../state/appState';
import type { AIEnvelope, TerrainAnalysisResult } from '../types/ai';
import { ORIENTATION_LABEL, SHAPE_LABEL, SIDE_LABEL } from '../../shared/i18n/es';
import { columnChart, lineChart } from '../render/charts';
import { topographyMap } from '../render/topography';
import { computeMetrics } from '../services/metrics';
import { longitudinalProfile, monthlyInsolation, slopeDistribution } from '../services/terrainAnalysis';
import { aiClient, sourceLabel } from '../services/aiClient';
import { describeApiError } from '../services/apiClient';

const AI_FIELDS: ReadonlyArray<[keyof Omit<TerrainAnalysisResult, 'generalNotes'>, string]> = [
  ['orientationRecommendation', 'Orientación'],
  ['placementRecommendation', 'Implantación'],
  ['drainageRecommendation', 'Drenaje'],
  ['lightingRecommendation', 'Iluminación'],
  ['ventilationRecommendation', 'Ventilación'],
  ['materialRecommendation', 'Materiales'],
];

export class TerrainAnalysis extends Component {
  private readonly body = h('div', { class: 'panel-body analysis-grid' });
  private readonly ai = h('div', { class: 'terrain-ai', 'aria-live': 'polite' });
  private readonly analyze = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, icon('spark', 14), 'Analizar terreno');
  private analyzedTerrain: unknown = null;

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'analysis' }));
    this.analyze.addEventListener('click', () => void this.runAI());
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Análisis del terreno'), this.analyze), this.body);
    this.ai.append(h('p', { class: 'muted' }, 'Pulse "Analizar terreno" para obtener recomendaciones preliminares de orientación, implantación, drenaje, iluminación, ventilación y materiales.'));
    this.render();
    this.track(store.subscribe((st, prev) => {
      if (st.project.terrain !== prev.project.terrain || st.project.building !== prev.project.building || st.sunMonth !== prev.sunMonth) this.render();
      if (this.analyzedTerrain && st.project.terrain !== this.analyzedTerrain) this.ai.classList.add('is-stale');
    }));
  }

  private render(): void {
    const { project, sunMonth } = this.store.get();
    const { terrain } = project;
    const metrics = computeMetrics(project);
    const sun = monthlyInsolation(terrain.latitude);
    const selected = sun[sunMonth];

    this.body.replaceChildren(
      h('dl', { class: 'analysis-summary' },
        ...([
          ['Área', `${formatNumber(metrics.lotArea)} m²`],
          ['Pendiente', `${formatNumber(terrain.slopePercent, 1)} %`],
          ['Elevación', `${formatNumber(terrain.elevation)} m s. n. m.`],
          ['Orientación', ORIENTATION_LABEL[terrain.orientation]],
          ['Forma', SHAPE_LABEL[terrain.shape]],
          ['Zona de construcción', `${formatNumber(metrics.footprintArea)} m²`],
          ['Zona libre', `${formatNumber(metrics.freeArea)} m²`],
          ['Acceso', SIDE_LABEL[terrain.accessSide]],
        ] as const).map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))),
      topographyMap(terrain),
      this.ai,
      lineChart(
        longitudinalProfile(terrain).map((p) => ({ label: `${formatNumber(p.distance, 1)} m`, value: p.elevation })),
        { caption: 'Perfil longitudinal (eje central, frente → fondo)', unit: 'm s. n. m.', format: (v) => formatNumber(v, 1) },
      ),
      columnChart(
        slopeDistribution(terrain).map((b) => ({ label: b.label, value: b.share * 100 })),
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

  private async runAI(): Promise<void> {
    this.analyze.disabled = true;
    this.ai.classList.remove('is-stale');
    this.ai.replaceChildren(h('p', { class: 'muted' }, 'Analizando terreno…'));
    const terrain = this.store.get().project.terrain;
    try {
      this.showAI(await aiClient.analyzeTerrain(this.store));
      this.analyzedTerrain = terrain;
    } catch (error) {
      this.ai.replaceChildren(h('p', { class: 'form-error' }, describeApiError(error, 'No fue posible analizar el terreno.')));
    } finally {
      this.analyze.disabled = false;
    }
  }

  private showAI(envelope: AIEnvelope<TerrainAnalysisResult>): void {
    const r = envelope.result;
    this.ai.replaceChildren(
      h('div', { class: 'ai-source' },
        h('strong', {}, 'RECOMENDACIONES PRELIMINARES'),
        h('span', { class: `tag ${envelope.source === 'lmstudio' ? 'tag-ai' : ''}` }, sourceLabel(envelope)),
        envelope.fallbackReason ? h('span', { class: 'muted' }, envelope.fallbackReason) : null),
      h('p', { class: 'stale-note' }, 'El terreno cambió después de este análisis: vuelva a analizarlo.'),
      h('ul', { class: 'check-list' }, ...AI_FIELDS.map(([key, label]) =>
        h('li', {}, icon('check', 14), h('span', {}, h('strong', {}, `${label}: `), r[key])))),
      h('ul', { class: 'notes' }, ...r.generalNotes.map((n) => h('li', {}, n))),
      h('p', { class: 'disclaimer' }, envelope.disclaimer),
    );
  }
}
