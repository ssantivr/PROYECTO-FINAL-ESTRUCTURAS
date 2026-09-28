import { Component } from '../core/component';
import { formatNumber, h, icon } from '../core/dom';
import { updateProject, type AppStore } from '../state/appState';
import type { BuildingProgram } from '../types/project';
import type { AIEnvelope, LayoutSuggestionResult } from '../types/ai';
import { BUILDING_TYPE_LABEL, PROGRAM_TOGGLE_LABEL } from '../../shared/i18n/es';
import { describeRooms } from '../../shared/domain/layoutGenerator';
import { aiClient, sourceLabel } from '../services/aiClient';
import { describeApiError } from '../services/apiClient';
import { selectField } from './formFields';

type CountKey = 'bedrooms' | 'bathrooms' | 'floors';
type ToggleKey = keyof typeof PROGRAM_TOGGLE_LABEL;

const COUNTERS: ReadonlyArray<[CountKey, string, number, number]> = [
  ['bedrooms', 'Habitaciones', 0, 20],
  ['bathrooms', 'Baños', 1, 15],
  ['floors', 'Pisos', 1, 10],
];

export class ProgramPanel extends Component {
  private program: BuildingProgram;
  private readonly controls = h('div', { class: 'program-grid' });
  private readonly result = h('div', { class: 'layout-result', 'aria-live': 'polite' });
  private readonly error = h('p', { class: 'form-error', role: 'alert' });
  private readonly generate = h('button', { class: 'btn btn-primary', type: 'button' }, icon('spark', 16), 'Generar distribución');

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'program' }));
    this.program = { ...store.get().project.building.program };
    this.generate.addEventListener('click', () => void this.run());
    this.el.append(
      h('header', { class: 'panel-head' }, h('h2', {}, 'Construcción'), h('span', { class: 'badge' }, 'Programa arquitectónico')),
      h('div', { class: 'panel-body' }, this.controls, this.error, h('div', { class: 'program-actions' }, this.generate), this.result),
    );
    this.render();
    this.renderDistribution(null);
    this.track(store.select((s) => s.project.id, () => {
      this.program = { ...this.store.get().project.building.program };
      this.render();
      this.renderDistribution(null);
    }));
    this.track(store.select((s) => s.project.building, () => this.renderDistribution(null)));
  }

  private render(): void {
    const { project } = this.store.get();
    this.controls.replaceChildren(
      selectField('Tipo', project.buildingType, BUILDING_TYPE_LABEL, (buildingType) => updateProject(this.store, (p) => ({ ...p, buildingType }))),
      ...COUNTERS.map(([key, label, min, max]) => this.counter(key, label, min, max)),
      ...(Object.keys(PROGRAM_TOGGLE_LABEL) as ToggleKey[]).map((key) => this.toggle(key)),
    );
  }

  private counter(key: CountKey, label: string, min: number, max: number): HTMLElement {
    const limit = key === 'floors' ? Math.min(max, this.store.get().project.terrain.maxFloors) : max;
    const output = h('output', {}, String(this.program[key]));
    const change = (delta: number) => {
      const next = Math.min(limit, Math.max(min, this.program[key] + delta));
      if (key === 'floors' && this.program[key] + delta > limit) this.error.textContent = `La norma del lote permite máximo ${limit} pisos.`;
      else this.error.textContent = '';
      this.program = { ...this.program, [key]: next };
      output.textContent = String(next);
    };
    return h('div', { class: 'counter' },
      h('span', {}, label),
      h('div', { class: 'stepper' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Menos ${label.toLowerCase()}`, onclick: () => change(-1) }, '−'),
        output,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Más ${label.toLowerCase()}`, onclick: () => change(1) }, '+')));
  }

  private toggle(key: ToggleKey): HTMLElement {
    const input = h('input', { type: 'checkbox', checked: this.program[key] });
    input.addEventListener('change', () => {
      this.program = { ...this.program, [key]: input.checked };
    });
    return h('label', { class: 'toggle' }, input, h('span', {}, PROGRAM_TOGGLE_LABEL[key]));
  }

  private async run(): Promise<void> {
    this.generate.disabled = true;
    this.error.textContent = '';
    this.result.replaceChildren(h('p', { class: 'muted' }, 'Generando distribución preliminar… (con un modelo local puede tardar unos segundos)'));
    try {
      const envelope = await aiClient.generateLayout(this.store, this.program);
      const { building } = envelope.result;
      const { terrain } = this.store.get().project;
      const ground = building.floors[0];
      const footprint = ground ? ground.footprint.width * ground.footprint.depth : 0;
      const open = Math.max(0, terrain.width * terrain.length - footprint - terrain.parkingArea);
      const gardenArea = this.program.garden ? Math.min(terrain.gardenArea, open) : 0;
      const room = open - gardenArea;
      const poolArea = this.program.pool ? Math.min(Math.max(terrain.poolArea, 24), room) : 0;
      updateProject(this.store, (p) => ({ ...p, building, terrain: { ...terrain, gardenArea, poolArea } }));
      this.renderDistribution(envelope);
    } catch (error) {
      this.error.textContent = describeApiError(error, 'No fue posible generar la distribución.');
      this.renderDistribution(null);
    } finally {
      this.generate.disabled = false;
    }
  }

  private renderDistribution(envelope: AIEnvelope<LayoutSuggestionResult> | null): void {
    const { building } = this.store.get().project;
    const rooms = describeRooms(building);
    const parts: Array<Node | null> = [
      envelope ? h('div', { class: 'ai-source' },
        h('span', { class: `tag ${envelope.source === 'lmstudio' ? 'tag-ai' : ''}` }, sourceLabel(envelope)),
        envelope.fallbackReason ? h('span', { class: 'muted' }, envelope.fallbackReason) : null) : null,
      h('div', { class: 'distribution' }, ...building.floors.map((floor, i) =>
        h('div', { class: 'distribution-floor' },
          h('h3', { class: 'sub-title' }, floor.name.toUpperCase()),
          h('ul', {}, ...rooms.filter((r) => r.floor === i).map((r) => h('li', {}, h('span', {}, r.name), h('em', {}, `${formatNumber(r.area, 1)} m²`))))))),
      ...(envelope?.result.warnings ?? []).map((w) => h('p', { class: 'warning-note' }, w)),
      envelope?.result.notes.length ? h('ul', { class: 'notes' }, ...envelope.result.notes.map((n) => h('li', {}, n))) : null,
      envelope ? h('p', { class: 'disclaimer' }, envelope.disclaimer) : null,
    ];
    this.result.replaceChildren(...parts.filter((p): p is Node => p !== null));
  }
}
