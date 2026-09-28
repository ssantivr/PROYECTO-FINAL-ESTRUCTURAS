import { Component } from '../core/component';
import { formatCurrency, formatNumber, h, icon } from '../core/dom';
import { updateProject, type AppStore } from '../state/appState';
import type { FinishSlot, Material } from '../types/project';
import { FINISH_SLOTS } from '../types/project';
import type { AIEnvelope, MaterialRecommendationResult } from '../types/ai';
import { FINISH_SLOT_LABEL } from '../../shared/i18n/es';
import { estimateMaterials, totalCost } from '../services/materials';
import { computeMetrics } from '../services/metrics';
import { aiClient, sourceLabel } from '../services/aiClient';
import { describeApiError } from '../services/apiClient';

export class MaterialsPanel extends Component {
  private readonly catalog = h('div', { class: 'finish-slots' });
  private readonly budget = h('div', {});
  private readonly advice = h('div', { class: 'material-advice', 'aria-live': 'polite' });
  private readonly recommend = h('button', { class: 'btn btn-ghost', type: 'button' }, icon('spark', 16), 'Recomendar con IA');

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'materials' }));
    this.recommend.addEventListener('click', () => void this.askAI());
    this.el.append(
      h('header', { class: 'panel-head' }, h('h2', {}, 'Materiales'), this.recommend),
      h('div', { class: 'panel-body' }, this.advice, this.catalog, h('h3', { class: 'sub-title' }, 'Cantidades y presupuesto de materiales'), this.budget),
    );
    this.render();
    this.track(store.select((st) => st.project, () => this.render()));
  }

  private select(slot: FinishSlot, material: Material): void {
    updateProject(this.store, (p) => ({ ...p, finishes: { ...p.finishes, [slot]: material.id } }));
  }

  private render(): void {
    const { project } = this.store.get();
    this.catalog.replaceChildren(...FINISH_SLOTS.map((slot) =>
      h('div', { class: 'finish-slot' },
        h('h3', { class: 'sub-title' }, FINISH_SLOT_LABEL[slot]),
        h('div', { class: 'material-cards', role: 'radiogroup', 'aria-label': FINISH_SLOT_LABEL[slot] },
          ...project.materials.filter((m) => m.slot === slot).map((m) => {
            const selected = project.finishes[slot] === m.id;
            return h('button', {
              class: `material-card${selected ? ' is-selected' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(selected),
              onclick: () => this.select(slot, m),
            },
            h('span', { class: 'swatch', style: `--swatch:${m.color};--gloss:${(1 - m.roughness) * 0.6 + m.metalness * 0.3}` }),
            h('strong', {}, m.name),
            h('span', { class: 'material-desc' }, m.description),
            h('span', { class: 'material-meta' }, `${m.category} · ${formatCurrency(m.unitPrice)}/${m.unit} · rugosidad ${m.roughness.toFixed(2)} · metalicidad ${m.metalness.toFixed(2)}`));
          })))));

    const estimates = estimateMaterials(project);
    const total = totalCost(estimates);
    const { builtArea } = computeMetrics(project);
    this.budget.replaceChildren(
      h('div', { class: 'kpi-row' },
        kpi('Costo materiales', formatCurrency(total)),
        kpi('Costo por m²', formatCurrency(total / builtArea)),
        kpi('Presupuesto del proyecto', project.budget ? `${formatNumber((total / project.budget) * 100)} % usado` : '—'),
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
      h('p', { class: 'disclaimer' }, 'Cantidades estimadas por m² construido con precios de referencia; no reemplazan un presupuesto de obra profesional.'),
    );
  }

  private async askAI(): Promise<void> {
    this.recommend.disabled = true;
    this.advice.replaceChildren(h('p', { class: 'muted' }, 'Consultando recomendaciones de materiales…'));
    try {
      this.showAdvice(await aiClient.recommendMaterials(this.store));
    } catch (error) {
      this.advice.replaceChildren(h('p', { class: 'form-error' }, describeApiError(error, 'No fue posible obtener recomendaciones.')));
    } finally {
      this.recommend.disabled = false;
    }
  }

  private showAdvice(envelope: AIEnvelope<MaterialRecommendationResult>): void {
    const { materials } = this.store.get().project;
    const name = (id: string) => materials.find((m) => m.id === id)?.name ?? id;
    const apply = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, icon('check', 14), 'Aplicar recomendación');
    apply.addEventListener('click', () => {
      updateProject(this.store, (p) => ({
        ...p,
        finishes: envelope.result.recommendations.reduce((acc, r) => ({ ...acc, [r.slot]: r.materialId }), p.finishes),
      }));
      apply.disabled = true;
      apply.textContent = 'Aplicada';
    });
    this.advice.replaceChildren(
      h('div', { class: 'ai-source' },
        h('span', { class: `tag ${envelope.source === 'lmstudio' ? 'tag-ai' : ''}` }, sourceLabel(envelope)),
        envelope.fallbackReason ? h('span', { class: 'muted' }, envelope.fallbackReason) : null),
      h('ul', { class: 'reco-list' }, ...envelope.result.recommendations.map((r) =>
        h('li', { class: 'reco' },
          h('div', { class: 'reco-head' }, h('span', { class: 'tag' }, FINISH_SLOT_LABEL[r.slot]), h('strong', {}, name(r.materialId))),
          h('p', {}, r.reason)))),
      ...(envelope.result.notes.length ? [h('ul', { class: 'notes' }, ...envelope.result.notes.map((n) => h('li', {}, n)))] : []),
      apply,
      h('p', { class: 'disclaimer' }, envelope.disclaimer),
    );
  }
}

export function kpi(label: string, value: string): HTMLElement {
  return h('div', { class: 'kpi' }, h('span', {}, label), h('strong', {}, value));
}
